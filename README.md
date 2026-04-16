# req-log

[![npm version](https://img.shields.io/npm/v/req-log.svg?style=flat-square)](https://www.npmjs.com/package/req-log)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg?style=flat-square)](https://www.typescriptlang.org/)

A simple, powerful request logger for Express. See every request your server handles — with colors, timing, and zero setup.

![demo](https://via.placeholder.com/700x150?text=Sample+log+output+here)

---

## What Does This Do?

Every time someone visits your server, this package prints a line showing **what they asked for, how your server responded, and how long it took**. That's it.

```
[2026-04-16T10:30:00.000Z] GET     /users/42   200   4.05ms
```

Reading left to right: the time, the request method, the URL, the response status, and how long it took.

---

## Install

```bash
npm install req-log
```

---

## Use It (30 seconds)

Just add **one line** to your Express app:

```js
const express = require('express');
const { requestLogger } = require('req-log');

const app = express();

app.use(requestLogger());  // ← that's it

app.get('/', (req, res) => res.send('Hello!'));
app.listen(3000);
```

Now every request gets logged automatically. You don't need to change your routes or controllers.

---

## What You Get by Default

When you just call `requestLogger()`, each log line shows:

| What you see   | Example                          |
|----------------|----------------------------------|
| **Time**       | `[2026-04-16T10:30:00.000Z]`     |
| **Method**     | `GET`, `POST`, `PUT`, `DELETE`   |
| **URL**        | `/users/42`                      |
| **Status**     | `200` (green if OK, red if error)|
| **Duration**   | `4.05ms`                         |

Status codes are color-coded:
- 🟢 **2xx** — success
- 🔵 **3xx** — redirect
- 🟡 **4xx** — client made a mistake (like "not found")
- 🔴 **5xx** — your server crashed

---

## Want More? Add Fields

You can log many more things by listing the fields you want:

```js
app.use(requestLogger({
  fields: ['method', 'url', 'status', 'duration', 'timestamp', 'ip', 'handler']
}));
```

### Available Fields

| Field           | What it shows                                              |
|-----------------|-----------------------------------------------------------|
| `method`        | GET, POST, etc. (default)                                 |
| `url`           | `/users/42` (default)                                     |
| `status`        | `200`, `404`, `500` (default)                             |
| `duration`      | How long the request took (default)                       |
| `timestamp`     | When it happened (default)                                |
| `route`         | The route pattern, e.g. `/users/:id`                      |
| `handler`       | The name of the controller function that handled it       |
| `baseUrl`       | Router mount point, e.g. `/api/v1`                        |
| `requestId`     | A unique ID for tracing one request across your logs      |
| `ip`            | Who made the request (their IP address)                   |
| `userAgent`     | What browser or tool they used                            |
| `headers`       | All HTTP headers they sent                                |
| `body`          | The request body (POST/PUT data)                          |
| `query`         | The `?key=value` stuff in the URL                         |
| `params`        | Values like `:id` from routes                             |
| `contentLength` | How big the response is                                   |
| `referer`       | The page that linked to yours                             |
| `protocol`      | `http` or `https`                                         |
| `hostname`      | `yoursite.com`                                            |

---

## "Which Controller Ran?" — The Most Useful Field

Ever wondered *"which function handled this request?"* This is the magic:

```js
function getUserById(req, res) {
  res.send('user data');
}

app.get('/users/:id', getUserById);

app.use(requestLogger({
  fields: ['method', 'url', 'route', 'handler', 'status', 'duration']
}));
```

Output:

```
GET  /users/42  200  4ms  route=/users/:id  → getUserById
```

Now you know exactly **which function** handled **which URL**. No more guessing.

**Tip:** Always give your controller functions names (don't use arrow functions like `(req, res) => {}`), otherwise `handler` shows `<anonymous>`.

---

## Save Logs to a File

Don't just print to the screen — save them for later:

```js
app.use(requestLogger({
  transports: ['console', 'file'],    // where to send logs
  filePath: 'logs/requests.log',      // where to save them
}));
```

Now logs go to **both** your terminal AND a file. Easy.

---

## Use JSON Format (for Production)

If you're running in production and using a log tool (like Datadog, Papertrail, etc.), use JSON:

```js
app.use(requestLogger({
  format: 'json',
  transports: ['file'],
  filePath: 'logs/app.log',
}));
```

Each line becomes a parseable JSON object:

```json
{"timestamp":"2026-04-16T10:30:00.000Z","method":"GET","url":"/users/42","status":200,"duration":4.05}
```

---

## Skip Certain Requests

Don't want to log health checks or static file requests? Use `skip`:

```js
app.use(requestLogger({
  skip: (req) => req.url === '/health' || req.url.startsWith('/static/')
}));
```

Any request where `skip` returns `true` won't be logged.

---

## Trace a Request Across Your App (Request IDs)

Each request gets a unique ID automatically. You can use it in your own logs too:

```js
app.use(requestLogger({
  fields: ['requestId', 'method', 'url', 'status', 'duration']
}));

app.get('/users/:id', (req, res) => {
  console.log(`[${req.id}] Fetching user ${req.params.id}`);
  // All your logs for THIS request share the same ID
  res.send('ok');
});
```

**Why this helps:** When something goes wrong, you can search your logs for that one ID and see *everything* that happened during that request.

The ID is also sent back in the response header `X-Request-ID`, so the client can reference it too (e.g., in a bug report).

---

## Common Setups (Copy-Paste Ready)

### Development — Nice and Detailed

```js
app.use(requestLogger({
  fields: ['method', 'url', 'status', 'duration', 'timestamp', 'route', 'handler', 'query']
}));
```

### Production — JSON Logs to File

```js
app.use(requestLogger({
  fields: ['method', 'url', 'status', 'duration', 'timestamp', 'ip', 'requestId'],
  format: 'json',
  transports: ['file'],
  filePath: 'logs/production.log',
}));
```

### Debug Mode — Log Everything

```js
app.use(requestLogger({
  fields: [
    'method', 'url', 'route', 'handler', 'status', 'duration', 'timestamp',
    'ip', 'userAgent', 'headers', 'body', 'query', 'params', 'requestId'
  ],
  format: 'json',
  transports: ['console', 'file'],
  filePath: 'logs/debug.log',
}));
```

---

## All Options (Cheat Sheet)

```js
app.use(requestLogger({
  fields: [...],              // which fields to log
  format: 'default' | 'json', // how it looks
  transports: ['console', 'file'], // where it goes
  filePath: 'logs/app.log',   // file to write to
  colors: true,               // turn colors on/off (auto by default)
  skip: (req, res) => false,  // skip certain requests
  requestIdHeader: 'x-request-id', // header name for IDs (or false to disable)
  generateRequestId: () => '...',  // your own ID generator
}));
```

---

## TypeScript

Works out of the box. All types are exported:

```ts
import { requestLogger, LoggerOptions, LogField } from 'req-log';
```

---

## Requirements

- Node.js 16 or newer
- Express 4 or newer

---

## License

[MIT](LICENSE) — see LICENSE file for details.

## Issues & Feedback

Found a bug? Have an idea? [Open an issue](https://github.com/Satyam12x/req-log/issues).
