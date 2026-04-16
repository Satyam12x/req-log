# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-04-16

### Security

- **Redaction of sensitive data** — new `redact` option with a default list covering `authorization`, `cookie`, `set-cookie`, `x-api-key`, `x-auth-token`, `password`, `token`, `secret`, `api_key`, `refresh_token`, and more. Applied recursively to request bodies and headers.
- **Log injection protection (CWE-117)** — CR/LF/NUL bytes in user-controlled fields (URL, user-agent, referer, request ID) are now escaped so attackers cannot forge fake log lines.
- **Size-bounded serialization** — new `maxFieldSize` option (default 2 KB) truncates oversized bodies/headers before they hit the log stream, preventing memory/disk DoS.
- **Safe JSON serialization** — circular references, BigInt, and unserializable values no longer crash logging.

### Added

- **Route and handler tracking** — `route`, `handler`, and `baseUrl` fields reveal which endpoint and controller function handled each request.
- **Request ID correlation** — `requestId` field with automatic UUID generation. Reads incoming `X-Request-ID`, echoes it on the response, and attaches it as `req.id`.
- New request-context fields: `referer`, `protocol`, `hostname`.
- New options: `requestIdHeader`, `generateRequestId`, `redact`, `maxFieldSize`.
- Exported `closeFileTransports()` for user-controlled graceful shutdown.
- Exported `DEFAULT_REDACT_KEYS` for extension.

### Changed

- File transport now flushes passively on `beforeExit` only. Previous versions attached SIGINT/SIGTERM handlers that called `process.exit()`, which could hijack a host application's graceful shutdown. Users who want to flush on shutdown should call `closeFileTransports()` from their own handler.
- Default formatter displays an 8-character prefix of the request ID when the field is enabled.

### Removed

- Useless `req.get('referrer')` fallback (HTTP spec defines only `Referer`).

## [0.1.0] - 2026-04-16

### Added

- Initial release.
- Configurable fields: `method`, `url`, `status`, `duration`, `timestamp`, `ip`, `userAgent`, `headers`, `body`, `query`, `params`, `contentLength`.
- Smart defaults — works out of the box with zero configuration.
- Two output formats: `default` (colored text) and `json` (structured).
- Two transports: `console` (stdout) and `file` (reusable write streams).
- Auto-detection of TTY to disable colors when piped.
- Skip function to exclude specific requests.
- Handles client disconnects via `close` event in addition to `finish`.
- Full TypeScript support with exported types.
