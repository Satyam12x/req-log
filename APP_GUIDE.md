# backend-logger — App Guide (in simple words)

A friendly walk-through of what this project is, why it exists, how every file
fits together, and how you use it in your own app.

---

## 1. What is this app?

`backend-logger` is a small **Express middleware library** that logs every HTTP
request your server handles.

When you plug it into an Express app, every time a request comes in (like
`GET /users` or `POST /login`), this library automatically prints a line like:

```
[2026-04-18T10:00:01.123Z] GET /users 200 12.45ms
```

It can also:
- Save the same logs to a file.
- Print them in **structured JSON** (great for tools like Datadog, Grafana Loki, ELK).
- Hide secrets (passwords, cookies, tokens) before they touch the log.
- Give every request a unique ID so you can trace it across your system.

It is published as an npm package (name: `backend-logger`) — so other people
install it and use it in their own Express apps.

---

## 2. Why does this app exist?

There are already popular loggers like **morgan**, **pino-http**, and
**express-winston**. This project is a **lightweight, zero-dependency
alternative**:

| Need | Why this library is a good fit |
|------|-------------------------------|
| Very small install | No runtime dependencies — just pure Node + Express types. |
| Works out of the box | `app.use(requestLogger())` — no config needed. |
| Safe by default | Automatically redacts passwords, tokens, cookies. |
| Production-ready | Can write JSON logs to a file with a single option. |
| TypeScript-first | Full types, no separate `@types/...` package needed. |

Think of it as a "batteries-included starter logger" — enough for tiny side
projects and enough for real production apps, without pulling a huge
dependency tree.

---

## 3. High-level structure

```
backend-logger/
├── src/                    ← the library source code (TypeScript)
│   ├── index.ts            ← the main middleware (entry point)
│   ├── types.ts            ← all TypeScript types and defaults
│   ├── formatters/         ← turns a log object into a string
│   │   ├── default.ts      ← pretty, colored console format
│   │   └── json.ts         ← structured JSON (one line per request)
│   ├── transports/         ← where the log goes
│   │   ├── console.ts      ← write to stdout
│   │   └── file.ts         ← append to a file
│   └── utils/              ← small helpers
│       ├── colors.ts       ← ANSI color codes
│       ├── sanitize.ts     ← redaction + safe JSON
│       └── timer.ts        ← high-precision request timing
├── tests/                  ← vitest unit tests
├── example/
│   └── server.js           ← a runnable demo Express app
├── dist/                   ← compiled JS + type declarations (built output)
├── package.json            ← npm metadata, scripts, keywords
├── tsconfig.json           ← TypeScript compiler settings
├── vitest.config.ts        ← test runner config
├── README.md               ← user-facing documentation
├── CHANGELOG.md            ← version history
└── CONTRIBUTING.md         ← how to contribute
```

**Mental model:** a request comes in → the middleware in `src/index.ts`
collects fields about it → a **formatter** turns those fields into a string
→ one or more **transports** write that string somewhere.

```
   Request
      │
      ▼
  index.ts  ──►  builds LogEntry (fields from req/res)
      │
      ▼
  formatter  ──►  default.ts  OR  json.ts  ──► a string
      │
      ▼
  transport  ──►  console.ts  AND/OR  file.ts
```

---

## 4. Walking through every file

### `src/index.ts` — the heart of the library

This is the **entry point**. When you do `import { requestLogger } from 'backend-logger'`,
you get the function defined here.

What it does, step by step:
1. Accepts a config object (`LoggerOptions`) with sensible defaults.
2. Returns an Express middleware `(req, res, next) => { ... }`.
3. On every request:
   - Starts a nanosecond-precision timer.
   - Attaches a **request ID** to `req.id` and echoes it back on the response
     header (default header name: `x-request-id`). If the incoming request
     already has one, it reuses it — this is what enables distributed tracing.
   - Listens for the response to `finish` or `close` (whichever comes first).
   - Once the response is done, it:
     - Calls the optional `skip(req, res)` to decide whether to drop the log
       (handy for `/health` endpoints).
     - Measures the duration.
     - Builds a `LogEntry` object with only the fields you asked for
       (`buildEntry` function).
     - Sends it to the right formatter (`default` or `json`).
     - Fans out the formatted string to every configured transport
       (`console`, `file`, or both).
   - If anything inside the logger throws, it writes to stderr **but never
     crashes your server** — a logger should never take down the host.

**Small clever detail:** `handlerNameCache` is a `WeakMap` that remembers the
name of the Express handler function per route. This avoids re-scanning the
route's layer stack on every request.

### `src/types.ts` — the shape of everything

Defines the contracts used throughout the code:

- **`LogField`** — the 19 possible fields you can log (`method`, `url`,
  `status`, `duration`, `timestamp`, `route`, `handler`, `baseUrl`,
  `requestId`, `ip`, `userAgent`, `headers`, `body`, `query`, `params`,
  `contentLength`, `referer`, `protocol`, `hostname`).
- **`DEFAULT_FIELDS`** — the 5 fields used if you don't specify any:
  method, url, status, duration, timestamp.
- **`LogEntry`** — the object that is built per request; every key is optional.
- **`LoggerOptions`** — the config bag the user passes in (`fields`, `format`,
  `transports`, `filePath`, `skip`, `colors`, `requestIdHeader`,
  `generateRequestId`, `redact`, `maxFieldSize`).
- **Module augmentation** — extends Express's `Request` type so
  `req.id` is properly typed for TypeScript users.

This file is the "source of truth" — every other file imports from here.

### `src/formatters/default.ts` — pretty console output

Turns a `LogEntry` into a one-line, **human-readable** string:

```
[2026-04-18T10:00:01.123Z] [a1b2c3d4] GET    /users 200 12.45ms route=/users -> listUsers
```

- Uses colors from `utils/colors.ts` (green for 2xx, yellow for 4xx,
  red for 5xx or slow requests) — but only when `colors: true`.
- Order of fields is fixed and intentional (timestamp → id → method → url
  → status → duration → …) so visual scanning is easy.
- Big values (`body`, `headers`) are rendered through `safeStringify` with a
  size cap so a 10 MB payload doesn't explode your log file.
- Comment at the bottom explains a security win: user-controlled fields are
  already sanitized upstream, so no double-escaping is needed.

### `src/formatters/json.ts` — structured logs

Produces **one-line JSON per request** (NDJSON), the format most log aggregators
expect.

- Uses `safeInlineOrTruncated` to cap the `body` and `headers` fields
  individually — if they fit, they stay as native objects; if they overflow,
  they become truncated strings.
- Delegates the final stringify to `safeStringify`, which handles circular
  references, `bigint`, and other JSON gotchas without ever throwing.

### `src/transports/console.ts` — write to stdout

- Uses `process.stdout.write` directly, not `console.log`, because
  `console.log` goes through `util.format` and adds overhead.
- Wraps the write in try/catch so a broken stream can't kill the server.

### `src/transports/file.ts` — append to a file

- Keeps **one write stream per file path** in a `Map`, so we aren't opening
  and closing a file for every request (that would be slow).
- Creates the target directory if it doesn't exist (`mkdirSync recursive`).
- Registers an `'error'` handler to recover if the stream dies.
- Exports `closeFileTransports()` so the user can call it on graceful
  shutdown to flush buffered writes.
- Registers a passive `beforeExit` hook — a **library must not own signals**
  like SIGTERM (that would hijack the host's lifecycle), so it only flushes
  when Node is already about to exit on its own.

### `src/utils/sanitize.ts` — keep secrets out of logs

The most security-sensitive file. It:

1. **`DEFAULT_REDACT_KEYS`** — common secret keys (authorization, cookie,
   password, token, api_key, refresh_token, etc.). Anything matching gets
   replaced with `[REDACTED]`.
2. **`sanitizeString`** — strips CR / LF / NUL characters so a malicious
   user-agent header can't forge fake log lines (this defends against
   CWE-117, "log injection").
3. **`buildRedactSet`** — builds a lowercase `Set` once per logger instance
   so lookups are O(1) on each request.
4. **`redactObject`** — shallow redaction (headers).
5. **`redactDeep`** — deep redaction for nested bodies, with a
   depth limit (`MAX_DEPTH = 10`) and circular-ref detection (`WeakSet`).
   Both functions return the **original object** when nothing changed, to
   avoid unnecessary allocations — a nice performance detail.
6. **`safeStringify`** — JSON.stringify that never throws: handles circular
   refs, bigints, and truncates to a byte cap with a visible suffix.
7. **`safeInlineOrTruncated`** — preflight used by the JSON formatter to
   decide "inline the object directly" vs "fallback to a truncated string".

### `src/utils/colors.ts` — ANSI color helpers

Teaches the terminal to print "hello" in red. Small table of escape codes
plus three helpers:
- `colorStatus` — color by HTTP status range (green/cyan/yellow/red).
- `colorMethod` — cyan, padded to 7 chars so methods align visually.
- `colorDuration` — green <500ms, yellow <1000ms, red otherwise.

### `src/utils/timer.ts` — how long did the request take

Uses `process.hrtime.bigint()` which has **nanosecond precision**, much
more accurate than `Date.now()` (millisecond only). The answer is returned
in milliseconds as a `number` because that's what humans expect to see.

### `tests/logger.test.ts` — the test suite

Vitest + Supertest. Boots a real Express app in-process, captures stdout,
fires requests, and asserts the output. Covers:
- Default config behavior
- Field selection
- Redaction of sensitive keys
- JSON format
- File transport (writes to `tests/tmp/`)
- Request ID generation and echo
- `skip` callback

### `example/server.js` — a runnable demo

A tiny Express app showing **4 usage patterns** (basic, with IP + user
agent, full debug mode, and production config). Great for anyone who just
cloned the repo and wants to see it work: `npm run build && node example/server.js`.

### `package.json`

Defines the npm package:
- `main: dist/index.js` and `types: dist/index.d.ts` — users import from the
  compiled output, not the TypeScript source.
- `files: [dist, README.md, LICENSE, CHANGELOG.md]` — only those ship to npm.
- `peerDependencies: express >= 4.0.0` — we don't bundle Express; the user's
  app provides it.
- No runtime `dependencies` — zero-dependency install.
- Scripts: `build`, `dev` (watch mode), `test`, `test:coverage`.
- Lots of `keywords` for npm search discoverability.

### `tsconfig.json`

- Target **ES2020** (Node 16+).
- Emits both `.js` and `.d.ts` into `dist/`.
- `strict: true` — no sloppy types allowed.
- Excludes `tests` and `example` from the compile (they aren't shipped).

### `vitest.config.ts`

Test runner config. Uses the `node` environment, picks up
`tests/**/*.test.ts`, and enables v8 coverage over `src/**/*.ts`.

### `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `LICENSE`

Standard open-source project files. The README is the main user-facing
documentation (full API reference + recipes); the CHANGELOG tracks
version-by-version changes; CONTRIBUTING explains how to submit PRs;
LICENSE is MIT.

### `.gitignore`, `.npmignore`

`.gitignore` keeps `node_modules`, `dist`, etc. out of git. `.npmignore`
controls what ships to npm (redundant here because `package.json#files`
already whitelists).

---

## 5. How do you use it? (quick recipes)

### Install

```bash
npm install backend-logger
```

### Zero-config (dev)

```js
const express = require('express');
const { requestLogger } = require('backend-logger');

const app = express();
app.use(requestLogger());

app.get('/', (req, res) => res.send('hi'));
app.listen(3000);
```

You get: timestamp + method + URL + status + duration, colored if the
terminal supports it.

### Production-style (JSON to a file, skip health checks)

```js
app.use(requestLogger({
  format: 'json',
  transports: ['file'],
  filePath: 'logs/app.log',
  fields: ['method', 'url', 'status', 'duration', 'timestamp', 'ip', 'requestId'],
  skip: (req) => req.url === '/health',
}));
```

### Debug mode (log everything, redaction still active)

```js
app.use(requestLogger({
  fields: [
    'method', 'url', 'route', 'handler', 'status', 'duration',
    'timestamp', 'ip', 'userAgent', 'headers', 'body',
    'query', 'params', 'contentLength', 'requestId',
  ],
  format: 'json',
}));
```

Passwords, cookies, and tokens will still be `[REDACTED]`.

### Graceful shutdown (if using file transport)

```js
const { closeFileTransports } = require('backend-logger');

process.on('SIGTERM', async () => {
  await closeFileTransports();
  process.exit(0);
});
```

### Tracing a request across services

The middleware reads `x-request-id` if the caller sends one, otherwise
generates one with `crypto.randomUUID()`. It sets the same ID on the
response header. Forward that header when you call downstream services
and every log line for that request — across every service — will share
the same ID.

---

## 6. Why some decisions were made (the "why" behind the code)

- **Zero dependencies.** Keeps install fast, reduces supply-chain risk, and
  forces the code to stay small.
- **Redaction on by default.** Logs are one of the most common places
  secrets leak. The defaults err on the side of safety.
- **`maxFieldSize` on body/headers.** Without a cap, a malicious 10 MB
  request body could balloon log files and cause disk-pressure DoS.
- **`WeakMap` handler-name cache.** Express route objects live for the
  lifetime of the app; caching by route avoids re-scanning the handler
  stack for every request while allowing routes to be GC'd cleanly.
- **`process.hrtime.bigint()` for timing.** Millisecond timing rounds a lot
  of requests to 0ms; nanosecond precision shows real differences.
- **`res.once('finish')` AND `res.once('close')` with a `logged` flag.**
  Clients may disconnect before `finish` fires; `close` is the fallback.
  The flag makes sure only one log line is emitted.
- **Library never calls `process.exit()` or owns SIGTERM.** A library that
  hijacks signals is impossible to wrap safely. We expose
  `closeFileTransports()` so the host app stays in control.
- **Return original objects when redaction is a no-op.** Avoids allocating
  new objects for the common case where a request has no sensitive data.

---

## 7. How the project builds and ships

1. Developer edits files in `src/`.
2. `npm run build` runs `tsc` which reads `tsconfig.json` and outputs
   JavaScript + `.d.ts` declarations to `dist/`.
3. `npm test` runs `vitest` against the TypeScript sources.
4. `npm publish` (triggered manually by the maintainer) runs `prepublishOnly`
   → `build` → then uploads only the files listed in `package.json#files`
   (just `dist/`, `README.md`, `LICENSE`, `CHANGELOG.md`).
5. End users `npm install backend-logger` and import from the compiled
   `dist/index.js`; TypeScript users get autocomplete from `dist/index.d.ts`.

---

## 8. Summary in one breath

`backend-logger` is a small, zero-dependency Express middleware that times
every request, builds a structured record of it, safely redacts secrets,
formats it either for humans or for machines, and writes it to stdout and/or
a file — without ever crashing your server or hijacking its lifecycle.
