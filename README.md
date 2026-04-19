# backend-logger — Fast Express Request Logger Middleware for Node.js

> **Zero-config HTTP request logging for Express and Node.js.** Structured JSON logs, colored console output, file transport, automatic secret redaction, request ID correlation, and full TypeScript support — in a tiny, dependency-free package.

[![npm version](https://img.shields.io/npm/v/backend-logger.svg?style=flat-square)](https://www.npmjs.com/package/backend-logger)
[![npm downloads](https://img.shields.io/npm/dm/backend-logger.svg?style=flat-square)](https://www.npmjs.com/package/backend-logger)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D16-green.svg?style=flat-square)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4%20%7C%205-lightgrey.svg?style=flat-square)](https://expressjs.com/)

**backend-logger** is a modern Express request logger middleware designed for Node.js APIs in 2026. It gives you production-ready HTTP request logging — structured JSON, color-coded status codes, per-request correlation IDs, and sensitive-field redaction — without forcing you to configure anything.

```
[2026-04-16T10:30:00.000Z] GET     /users/42   200   4.05ms
```

---

## Table of Contents

- [Features](#features)
- [Why backend-logger?](#why-backend-logger)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [What You Get by Default](#what-you-get-by-default)
- [Configurable Fields](#configurable-fields)
- [Handler & Route Tracking](#handler--route-tracking)
- [File Transport](#file-transport)
- [JSON Format (Production)](#json-format-production)
- [Skip Requests](#skip-requests)
- [Request ID Correlation & Distributed Tracing](#request-id-correlation--distributed-tracing)
- [Sensitive Data Redaction](#sensitive-data-redaction)
- [Common Configurations](#common-configurations)
- [API Reference](#api-reference)
- [TypeScript](#typescript)
- [Comparison: backend-logger vs morgan vs pino-http](#comparison-backend-logger-vs-morgan-vs-pino-http)
- [FAQ](#faq)
- [Requirements](#requirements)
- [License](#license)

---

## Features

- ⚡ **Zero-config** — one line of code, sensible defaults, works immediately.
- 🎨 **Color-coded output** — instantly spot 2xx, 4xx, and 5xx responses.
- 📊 **Structured JSON logs** — ready for Datadog, Grafana Loki, Elasticsearch, Splunk, Papertrail, New Relic, CloudWatch, and any log aggregator.
- 🔒 **Built-in secret redaction** — `authorization`, `cookie`, `password`, `token`, `api_key`, and more are redacted by default in headers and nested request bodies.
- 🧭 **Request ID correlation** — automatic UUIDs for distributed tracing, reads and echoes `X-Request-ID`, attaches as `req.id`.
- 📁 **Multi-transport** — log to console, file, or both simultaneously.
- 🧩 **19 configurable fields** — method, URL, status, duration, route, handler name, IP, user agent, headers, body, query, params, and more.
- 🛡️ **Log injection safe** — CR/LF/NUL bytes in user input are escaped (CWE-117 protection).
- 🎯 **TypeScript-first** — fully typed API, no `@types` package required.
- 🪶 **No runtime dependencies** — ships with only the Express peer dependency.
- 🚀 **Fast hot path** — single-pass redaction with Set-based key lookup, cached route metadata, reused write streams.

---

## Why backend-logger?

If you've used `morgan`, you know it only gives you a single-line text format and no built-in redaction. If you've used `pino-http`, you know it's fast but requires a separate pretty-printer and opinionated setup. **backend-logger** sits in the middle: **as simple as morgan, as production-ready as pino, with secure-by-default redaction baked in** — and it's written in TypeScript from the ground up.

- **Express 4 and Express 5 compatible**
- **Works with Node.js 16, 18, 20, 22, and newer**
- **No wrapper libraries, no plugins, no extra configuration files**

---

## Installation

```bash
npm install backend-logger
# or
yarn add backend-logger
# or
pnpm add backend-logger
```

---

## Quick Start

Add **one line** to your Express app:

```js
const express = require('express');
const { requestLogger } = require('backend-logger');

const app = express();
app.use(requestLogger());            // ← that's it

app.get('/', (req, res) => res.send('Hello!'));
app.listen(3000);
```

ESM / TypeScript:

```ts
import express from 'express';
import { requestLogger } from 'backend-logger';

const app = express();
app.use(requestLogger());
```

Every request is now logged automatically with timestamp, method, URL, status code, and response time.

---

## What You Get by Default

With a bare `requestLogger()` call, each log line shows:

| Field        | Example                          |
|--------------|----------------------------------|
| **Time**     | `[2026-04-16T10:30:00.000Z]`     |
| **Method**   | `GET`, `POST`, `PUT`, `DELETE`   |
| **URL**      | `/users/42`                      |
| **Status**   | `200` (green if OK, red if error)|
| **Duration** | `4.05ms`                         |

Status codes are color-coded:

- 🟢 **2xx** — success
- 🔵 **3xx** — redirect
- 🟡 **4xx** — client error (e.g. `404 Not Found`, `401 Unauthorized`)
- 🔴 **5xx** — server error

---

## Configurable Fields

Log any of these 19 request/response fields by listing them in `fields`:

```js
app.use(requestLogger({
  fields: ['method', 'url', 'status', 'duration', 'timestamp', 'ip', 'handler']
}));
```

| Field           | Description                                                |
|-----------------|------------------------------------------------------------|
| `method`        | HTTP method (GET, POST, etc.) — default                    |
| `url`           | Full request URL — default                                 |
| `status`        | Response status code — default                             |
| `duration`      | Request time in milliseconds — default                     |
| `timestamp`     | ISO 8601 timestamp — default                               |
| `route`         | Route pattern, e.g. `/users/:id`                           |
| `handler`       | Controller function name that handled the request          |
| `baseUrl`       | Router mount point, e.g. `/api/v1`                         |
| `requestId`     | Unique correlation ID for distributed tracing              |
| `ip`            | Client IP address                                          |
| `userAgent`     | HTTP `User-Agent` header                                   |
| `headers`       | All request headers (sensitive keys auto-redacted)         |
| `body`          | Parsed request body (sensitive keys auto-redacted)         |
| `query`         | URL query parameters                                       |
| `params`        | Express route parameters                                   |
| `contentLength` | Response size in bytes                                     |
| `referer`       | HTTP `Referer` header                                      |
| `protocol`      | `http` or `https`                                          |
| `hostname`      | Request hostname                                           |

---

## Handler & Route Tracking

Know exactly which controller function handled a request — invaluable for debugging large Express applications:

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
GET  /users/42  200  4ms  route=/users/:id  -> getUserById
```

**Tip:** Give controllers named functions (not inline arrow functions) so `handler` shows the real name instead of `<anonymous>`.

---

## File Transport

Write logs to a file in addition to (or instead of) the console:

```js
app.use(requestLogger({
  transports: ['console', 'file'],
  filePath: 'logs/requests.log',
}));
```

The log directory is created automatically if it doesn't exist. Write streams are reused across requests and flushed passively on `beforeExit`.

For explicit flushing on shutdown, call `closeFileTransports()`:

```js
import { closeFileTransports } from 'backend-logger';

process.on('SIGTERM', async () => {
  await closeFileTransports();
  process.exit(0);
});
```

---

## JSON Format (Production)

For production observability pipelines — Datadog, Grafana Loki, Elasticsearch, Splunk, CloudWatch, Papertrail, New Relic — use the structured `json` format:

```js
app.use(requestLogger({
  format: 'json',
  transports: ['file'],
  filePath: 'logs/app.log',
}));
```

Each log line is a single NDJSON record:

```json
{"timestamp":"2026-04-16T10:30:00.000Z","method":"GET","url":"/users/42","status":200,"duration":4.05}
```

---

## Skip Requests

Suppress logs for health checks, static assets, or anything else:

```js
app.use(requestLogger({
  skip: (req) => req.url === '/health' || req.url.startsWith('/static/')
}));
```

---

## Request ID Correlation & Distributed Tracing

Every request gets a unique correlation ID automatically — essential for microservices and distributed tracing:

```js
app.use(requestLogger({
  fields: ['requestId', 'method', 'url', 'status', 'duration']
}));

app.get('/users/:id', (req, res) => {
  console.log(`[${req.id}] Fetching user ${req.params.id}`);
  res.send('ok');
});
```

- Incoming `X-Request-ID` headers are preserved (propagates across services).
- The ID is echoed back in the response header so clients can reference it.
- Available as `req.id` throughout your middleware chain.
- Customizable via `requestIdHeader` and `generateRequestId` options.

---

## Sensitive Data Redaction

Secrets and PII are **redacted by default** in both request headers and request bodies (including deeply nested objects):

```js
// Request body: { username: 'alice', password: 'hunter2', api_key: 'sk-xxx' }
// Logged as:    { username: 'alice', password: '[REDACTED]', api_key: '[REDACTED]' }
```

Default redacted keys (case-insensitive): `authorization`, `cookie`, `set-cookie`, `x-api-key`, `x-auth-token`, `x-access-token`, `proxy-authorization`, `password`, `pwd`, `secret`, `token`, `api_key`, `apikey`, `access_token`, `refresh_token`.

Override with your own list:

```js
app.use(requestLogger({
  fields: ['body', 'headers'],
  redact: ['ssn', 'creditCard', 'authorization'],
}));
```

Oversized bodies are also truncated via `maxFieldSize` (default 2 KB) to prevent log DoS.

---

## Common Configurations

### Development — Detailed Colored Output

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

## API Reference

```ts
app.use(requestLogger({
  fields?: LogField[],              // which fields to log
  format?: 'default' | 'json',      // output format
  transports?: ('console' | 'file')[], // destinations
  filePath?: string,                // path for file transport
  colors?: boolean,                 // ANSI colors (auto-detects TTY)
  skip?: (req, res) => boolean,     // filter predicate
  requestIdHeader?: string | false, // header name, or false to disable
  generateRequestId?: () => string, // custom ID generator
  redact?: string[],                // keys to redact
  maxFieldSize?: number,            // body/headers truncation limit (bytes)
}));
```

---

## TypeScript

Fully typed. No `@types/backend-logger` needed:

```ts
import {
  requestLogger,
  LoggerOptions,
  LogField,
  LogEntry,
  LogFormat,
  LogTransport,
  DEFAULT_FIELDS,
  DEFAULT_REDACT_KEYS,
  closeFileTransports,
} from 'backend-logger';
```

The module also augments `Express.Request` with an optional `id: string` property when request IDs are enabled.

---

## Comparison: backend-logger vs morgan vs pino-http

| Feature                       | backend-logger | morgan       | pino-http    |
|-------------------------------|:--------------:|:------------:|:------------:|
| Zero-config defaults          | ✅             | ✅           | ⚠️ verbose   |
| Colored console output        | ✅ built-in    | ❌           | ❌ requires `pino-pretty` |
| Structured JSON logs          | ✅             | ❌           | ✅           |
| Secret redaction (headers+body) | ✅ default   | ❌           | ⚠️ paths only |
| Request ID correlation        | ✅ automatic   | ❌           | ⚠️ manual    |
| Handler / controller name     | ✅             | ❌           | ❌           |
| Route pattern tracking        | ✅             | ❌           | ❌           |
| File transport built-in       | ✅             | ❌ via stream | ❌ via transport |
| TypeScript types shipped      | ✅             | ⚠️ separate  | ✅           |
| Runtime dependencies          | 0              | 6            | 10+          |
| Log injection (CWE-117) safe  | ✅             | ❌           | ⚠️           |
| Express 5 support             | ✅             | ✅           | ✅           |

---

## FAQ

### How do I log HTTP requests in an Express app?

Install `backend-logger`, then add `app.use(requestLogger())` before your routes. That's all — every request will be logged with timestamp, method, URL, status code, and response time.

### Does backend-logger work with Express 5?

Yes. backend-logger supports both Express 4.x and Express 5.x, and is tested against the latest Express release.

### How is it different from morgan?

Morgan is a minimal text-only request logger. backend-logger adds structured JSON output, automatic secret redaction in headers and nested request bodies, request ID correlation for distributed tracing, handler/route tracking, file transport, and full TypeScript types — all with no runtime dependencies.

### How is it different from pino-http?

Pino-http is fast but requires separate packages (`pino-pretty`, transports) and a lot of configuration for pretty development output and redaction. backend-logger is zero-config, ships colored output and redaction out of the box, and has a smaller API surface.

### How do I redact passwords, API keys, and other secrets from logs?

backend-logger redacts sensitive keys by default, including `authorization`, `cookie`, `password`, `token`, `api_key`, and more. It walks nested request bodies recursively so secrets in deeply nested objects are also caught. Override the defaults with the `redact` option.

### How do I correlate logs across microservices?

Enable the `requestId` field. backend-logger reads an incoming `X-Request-ID` header if present, generates a UUID otherwise, echoes it on the response, and attaches it to `req.id` for use in your own application logs. This gives you a single ID to search by across every service that handles the request.

### Can I write logs to both console and a file?

Yes. Pass `transports: ['console', 'file']` and a `filePath`. Log directories are created automatically if missing.

### Is the JSON format compatible with Datadog, Grafana Loki, Elasticsearch, and CloudWatch?

Yes. The `json` format outputs one NDJSON (newline-delimited JSON) record per request, the standard ingestion format for every major log aggregator including Datadog, Grafana Loki, Elastic Stack, Splunk, Papertrail, New Relic, and AWS CloudWatch Logs.

### Does it support TypeScript?

Yes, natively. The package is written in TypeScript and ships with full type definitions — no separate `@types` package is required.

### Is it production-ready?

Yes. It's designed to survive bad input: circular references, BigInt values, oversized payloads, malformed skip functions, and log injection attempts (CWE-117) are all handled safely without crashing your server.

### How do I skip health check or static asset logs?

Use the `skip` option with a predicate: `skip: (req) => req.url === '/health'`.

---

## Requirements

- **Node.js** 16 or newer
- **Express** 4 or newer (Express 5 supported)

---

## License

[MIT](LICENSE) — free for commercial and personal use.

## Issues & Feedback

Found a bug? Have a feature request? [Open an issue on GitHub](https://github.com/Satyam12x/req-log/issues).

---

**Keywords:** express request logger, express logger middleware, node.js http logger, express json logging, request logging middleware, access log express, structured logging node, log redaction express, correlation id middleware, morgan alternative, pino-http alternative, typescript express logger.
