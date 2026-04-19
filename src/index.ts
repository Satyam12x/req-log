import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { LoggerOptions, LogEntry, LogField, DEFAULT_FIELDS } from './types';
import { startTimer, getDuration } from './utils/timer';
import { defaultFormat } from './formatters/default';
import { jsonFormat } from './formatters/json';
import { consoleTransport } from './transports/console';
import { fileTransport, closeFileTransports } from './transports/file';
import {
  sanitizeString,
  redactObject,
  redactDeep,
  buildRedactSet,
  DEFAULT_REDACT_KEYS,
} from './utils/sanitize';

// Handler names are stable per route object. Cache lookups so the
// layer scan only runs on first request to each route.
const handlerNameCache = new WeakMap<object, string>();

function getHandlerName(req: Request): string | undefined {
  const route = req.route;
  if (!route || !Array.isArray(route.stack) || route.stack.length === 0) {
    return undefined;
  }

  const cached = handlerNameCache.get(route);
  if (cached !== undefined) return cached;

  let resolved = '<anonymous>';
  for (let i = route.stack.length - 1; i >= 0; i--) {
    const layer = route.stack[i];
    const name = layer?.handle?.name;
    if (name && name !== '<anonymous>' && name !== 'anonymous') {
      resolved = name;
      break;
    }
  }

  handlerNameCache.set(route, resolved);
  return resolved;
}

function buildEntry(
  req: Request,
  res: Response,
  duration: number,
  fields: LogField[],
  redactSet: Set<string>
): LogEntry {
  const entry: LogEntry = {};

  for (const field of fields) {
    switch (field) {
      case 'method':
        entry.method = req.method;
        break;
      case 'url':
        entry.url = sanitizeString(req.originalUrl || req.url);
        break;
      case 'status':
        entry.status = res.statusCode;
        break;
      case 'duration':
        entry.duration = duration;
        break;
      case 'timestamp':
        entry.timestamp = new Date().toISOString();
        break;
      case 'route':
        entry.route = req.route?.path
          ? `${req.baseUrl || ''}${req.route.path}`
          : undefined;
        break;
      case 'handler':
        entry.handler = getHandlerName(req);
        break;
      case 'baseUrl':
        entry.baseUrl = req.baseUrl || '/';
        break;
      case 'requestId':
        entry.requestId = req.id;
        break;
      case 'ip':
        entry.ip = req.ip || req.socket.remoteAddress || 'unknown';
        break;
      case 'userAgent':
        entry.userAgent = sanitizeString(req.get('user-agent') || 'unknown');
        break;
      case 'headers':
        entry.headers = redactObject(
          req.headers as Record<string, unknown>,
          redactSet
        );
        break;
      case 'body':
        entry.body = redactDeep(req.body, redactSet);
        break;
      case 'query':
        entry.query = req.query as Record<string, unknown>;
        break;
      case 'params':
        entry.params = req.params;
        break;
      case 'contentLength':
        entry.contentLength = res.get('content-length') || 'unknown';
        break;
      case 'referer':
        entry.referer = sanitizeString(req.get('referer') || 'unknown');
        break;
      case 'protocol':
        entry.protocol = req.protocol;
        break;
      case 'hostname':
        entry.hostname = req.hostname;
        break;
    }
  }

  return entry;
}

export function requestLogger(options: LoggerOptions = {}) {
  const fields = options.fields ?? DEFAULT_FIELDS;
  const format = options.format ?? 'default';
  const transports = options.transports ?? ['console'];
  const filePath = options.filePath ?? 'logs/app.log';
  const skip = options.skip;
  const colors = options.colors ?? process.stdout.isTTY ?? false;
  const requestIdHeader =
    options.requestIdHeader === undefined ? 'x-request-id' : options.requestIdHeader;
  const generateRequestId = options.generateRequestId ?? randomUUID;
  const redactSet = buildRedactSet(options.redact ?? DEFAULT_REDACT_KEYS);
  const maxFieldSize = options.maxFieldSize ?? 2048;

  // Request ID is only attached when a header name is configured.
  // Setting requestIdHeader: false fully disables ID generation
  // and response echoing, even if `requestId` is in the fields list
  // (the field will just be undefined in the log).
  const requestIdEnabled = requestIdHeader !== false;
  const headerName = requestIdEnabled ? (requestIdHeader as string) : '';

  return (req: Request, res: Response, next: NextFunction): void => {
    const start = startTimer();
    let logged = false;

    if (requestIdEnabled && !req.id) {
      const incoming = req.get(headerName);
      req.id = incoming ? sanitizeString(incoming) : generateRequestId();
      res.setHeader(headerName, req.id);
    }

    const emit = (): void => {
      if (logged) return;
      logged = true;

      try {
        if (skip && skip(req, res)) return;

        const duration = getDuration(start);
        const entry = buildEntry(req, res, duration, fields, redactSet);

        const message = format === 'json'
          ? jsonFormat(entry, maxFieldSize)
          : defaultFormat(entry, colors, maxFieldSize);

        for (const transport of transports) {
          if (transport === 'console') consoleTransport(message);
          if (transport === 'file') fileTransport(message, filePath);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[request-logger] Logging error: ${msg}\n`);
      }
    };

    res.once('finish', emit);
    res.once('close', emit);

    next();
  };
}

export { closeFileTransports } from './transports/file';
export {
  LoggerOptions,
  LogEntry,
  LogField,
  LogFormat,
  LogTransport,
  DEFAULT_FIELDS,
} from './types';
export { DEFAULT_REDACT_KEYS } from './utils/sanitize';
