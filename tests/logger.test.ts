import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { requestLogger } from '../src/index';

function captureStdout(): { restore: () => void; output: () => string } {
  let captured = '';
  const original = process.stdout.write.bind(process.stdout);
  (process.stdout.write as unknown) = (chunk: string | Uint8Array) => {
    captured += typeof chunk === 'string' ? chunk : chunk.toString();
    return true;
  };
  return {
    output: () => captured,
    restore: () => {
      process.stdout.write = original;
    },
  };
}

describe('requestLogger', () => {
  let app: Express;
  let capture: ReturnType<typeof captureStdout>;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    capture = captureStdout();
  });

  afterEach(() => {
    capture.restore();
  });

  describe('default configuration', () => {
    it('logs a basic GET request', async () => {
      app.use(requestLogger({ colors: false }));
      app.get('/hello', (_req, res) => res.send('ok'));

      await request(app).get('/hello').expect(200);

      const output = capture.output();
      expect(output).toContain('GET');
      expect(output).toContain('/hello');
      expect(output).toContain('200');
    });

    it('includes timestamp by default', async () => {
      app.use(requestLogger({ colors: false }));
      app.get('/', (_req, res) => res.send('ok'));

      await request(app).get('/').expect(200);

      const output = capture.output();
      expect(output).toMatch(/\[\d{4}-\d{2}-\d{2}T/);
    });

    it('includes duration in ms', async () => {
      app.use(requestLogger({ colors: false }));
      app.get('/', (_req, res) => res.send('ok'));

      await request(app).get('/').expect(200);

      expect(capture.output()).toMatch(/\d+\.\d+ms/);
    });
  });

  describe('status codes', () => {
    it('logs 404 for unknown routes', async () => {
      app.use(requestLogger({ colors: false }));

      await request(app).get('/nonexistent').expect(404);

      expect(capture.output()).toContain('404');
    });

    it('logs 500 for server errors', async () => {
      app.use(requestLogger({ colors: false }));
      app.get('/error', (_req, res) => res.status(500).send('fail'));

      await request(app).get('/error').expect(500);

      expect(capture.output()).toContain('500');
    });

    it('logs 201 for created resources', async () => {
      app.use(requestLogger({ colors: false }));
      app.post('/create', (_req, res) => res.status(201).send('created'));

      await request(app).post('/create').expect(201);

      expect(capture.output()).toContain('201');
    });
  });

  describe('custom fields', () => {
    it('logs only specified fields', async () => {
      app.use(requestLogger({ fields: ['method', 'url'], colors: false }));
      app.get('/test', (_req, res) => res.send('ok'));

      await request(app).get('/test').expect(200);

      const output = capture.output();
      expect(output).toContain('GET');
      expect(output).toContain('/test');
      expect(output).not.toMatch(/\[\d{4}-\d{2}-\d{2}/); // no timestamp
      expect(output).not.toMatch(/\d+\.\d+ms/); // no duration
    });

    it('includes userAgent when requested', async () => {
      app.use(requestLogger({
        fields: ['method', 'url', 'userAgent'],
        colors: false,
      }));
      app.get('/', (_req, res) => res.send('ok'));

      await request(app).get('/').set('User-Agent', 'test-agent/1.0').expect(200);

      expect(capture.output()).toContain('test-agent/1.0');
    });

    it('includes query params when requested', async () => {
      app.use(requestLogger({
        fields: ['method', 'url', 'query'],
        colors: false,
      }));
      app.get('/search', (_req, res) => res.send('ok'));

      await request(app).get('/search?q=hello&page=1').expect(200);

      const output = capture.output();
      expect(output).toContain('q');
      expect(output).toContain('hello');
    });

    it('includes body when requested', async () => {
      app.use(requestLogger({
        fields: ['method', 'url', 'body'],
        colors: false,
      }));
      app.post('/data', (_req, res) => res.send('ok'));

      await request(app).post('/data').send({ name: 'Alice' }).expect(200);

      expect(capture.output()).toContain('Alice');
    });
  });

  describe('json format', () => {
    it('outputs valid JSON', async () => {
      app.use(requestLogger({ format: 'json', colors: false }));
      app.get('/', (_req, res) => res.send('ok'));

      await request(app).get('/').expect(200);

      const line = capture.output().trim().split('\n').pop()!;
      const parsed = JSON.parse(line);
      expect(parsed.method).toBe('GET');
      expect(parsed.url).toBe('/');
      expect(parsed.status).toBe(200);
      expect(typeof parsed.duration).toBe('number');
    });
  });

  describe('skip function', () => {
    it('skips requests matching the filter', async () => {
      app.use(requestLogger({
        colors: false,
        skip: (req) => req.url === '/health',
      }));
      app.get('/health', (_req, res) => res.send('ok'));
      app.get('/users', (_req, res) => res.send('ok'));

      await request(app).get('/health').expect(200);
      await request(app).get('/users').expect(200);

      const output = capture.output();
      expect(output).not.toContain('/health');
      expect(output).toContain('/users');
    });
  });

  describe('file transport', () => {
    const testLogPath = path.join(__dirname, 'tmp', 'test.log');

    beforeEach(() => {
      if (fs.existsSync(testLogPath)) {
        fs.unlinkSync(testLogPath);
      }
    });

    afterEach(() => {
      if (fs.existsSync(testLogPath)) {
        fs.unlinkSync(testLogPath);
      }
    });

    it('writes logs to file', async () => {
      app.use(requestLogger({
        transports: ['file'],
        filePath: testLogPath,
        colors: false,
      }));
      app.get('/file-test', (_req, res) => res.send('ok'));

      await request(app).get('/file-test').expect(200);

      // Give stream a tick to flush
      await new Promise((resolve) => setTimeout(resolve, 100));

      const contents = fs.readFileSync(testLogPath, 'utf-8');
      expect(contents).toContain('GET');
      expect(contents).toContain('/file-test');
      expect(contents).toContain('200');
    });

    it('creates log directory if missing', async () => {
      const deepPath = path.join(__dirname, 'tmp', 'nested', 'dir', 'test.log');
      app.use(requestLogger({
        transports: ['file'],
        filePath: deepPath,
        colors: false,
      }));
      app.get('/', (_req, res) => res.send('ok'));

      await request(app).get('/').expect(200);
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(fs.existsSync(deepPath)).toBe(true);

      // cleanup
      fs.rmSync(path.join(__dirname, 'tmp', 'nested'), { recursive: true, force: true });
    });
  });

  describe('route and handler tracking', () => {
    it('logs the route pattern, not the actual URL', async () => {
      app.use(requestLogger({
        fields: ['method', 'route'],
        colors: false,
      }));
      app.get('/users/:id', (_req, res) => res.send('ok'));

      await request(app).get('/users/123').expect(200);

      const output = capture.output();
      expect(output).toContain('route=/users/:id');
    });

    it('logs the controller handler name', async () => {
      app.use(requestLogger({
        fields: ['method', 'url', 'handler'],
        colors: false,
      }));
      function getUserById(_req: express.Request, res: express.Response) {
        res.send('ok');
      }
      app.get('/users/:id', getUserById);

      await request(app).get('/users/42').expect(200);

      expect(capture.output()).toContain('getUserById');
    });

    it('handles anonymous handlers gracefully', async () => {
      app.use(requestLogger({
        fields: ['method', 'handler'],
        colors: false,
      }));
      app.get('/', (_req, res) => res.send('ok'));

      await request(app).get('/').expect(200);

      // Arrow functions have no name, should log '<anonymous>'
      expect(capture.output()).toContain('<anonymous>');
    });

    it('logs baseUrl for mounted routers', async () => {
      app.use(requestLogger({
        fields: ['method', 'url', 'baseUrl', 'route'],
        colors: false,
      }));
      const router = express.Router();
      router.get('/list', (_req, res) => res.send('ok'));
      app.use('/api/v1', router);

      await request(app).get('/api/v1/list').expect(200);

      const output = capture.output();
      expect(output).toContain('base=/api/v1');
      expect(output).toContain('route=/api/v1/list');
    });
  });

  describe('request ID tracking', () => {
    it('generates a request ID when none is provided', async () => {
      app.use(requestLogger({
        fields: ['requestId', 'method', 'url'],
        colors: false,
      }));
      app.get('/', (req, res) => res.send(req.id));

      const res = await request(app).get('/').expect(200);

      expect(res.text).toMatch(/^[0-9a-f-]{36}$/); // UUID
      expect(res.headers['x-request-id']).toBe(res.text);
    });

    it('uses incoming X-Request-ID header when present', async () => {
      app.use(requestLogger({
        fields: ['requestId'],
        colors: false,
      }));
      app.get('/', (req, res) => res.send(req.id));

      const customId = 'trace-abc-123';
      const res = await request(app)
        .get('/')
        .set('X-Request-ID', customId)
        .expect(200);

      expect(res.text).toBe(customId);
      expect(res.headers['x-request-id']).toBe(customId);
      expect(capture.output()).toContain(customId.slice(0, 8));
    });

    it('supports custom request ID generator', async () => {
      let counter = 0;
      app.use(requestLogger({
        fields: ['requestId'],
        colors: false,
        generateRequestId: () => `req-${++counter}`,
      }));
      app.get('/', (req, res) => res.send(req.id));

      const res = await request(app).get('/').expect(200);

      expect(res.text).toBe('req-1');
    });

    it('can be disabled with requestIdHeader: false', async () => {
      app.use(requestLogger({
        fields: ['method', 'url'],
        colors: false,
        requestIdHeader: false,
      }));
      app.get('/', (req, res) => res.send(typeof req.id));

      const res = await request(app).get('/').expect(200);

      expect(res.text).toBe('undefined');
      expect(res.headers['x-request-id']).toBeUndefined();
    });

    it('supports custom header name', async () => {
      app.use(requestLogger({
        fields: ['requestId'],
        colors: false,
        requestIdHeader: 'x-trace-id',
      }));
      app.get('/', (req, res) => res.send(req.id));

      const res = await request(app)
        .get('/')
        .set('X-Trace-ID', 'trace-xyz')
        .expect(200);

      expect(res.text).toBe('trace-xyz');
      expect(res.headers['x-trace-id']).toBe('trace-xyz');
    });
  });

  describe('security - redaction', () => {
    it('redacts Authorization header by default', async () => {
      app.use(requestLogger({
        fields: ['method', 'headers'],
        colors: false,
      }));
      app.get('/', (_req, res) => res.send('ok'));

      await request(app).get('/').set('Authorization', 'Bearer secret-token-xyz').expect(200);

      const output = capture.output();
      expect(output).not.toContain('secret-token-xyz');
      expect(output).toContain('[REDACTED]');
    });

    it('redacts Cookie header by default', async () => {
      app.use(requestLogger({
        fields: ['method', 'headers'],
        colors: false,
      }));
      app.get('/', (_req, res) => res.send('ok'));

      await request(app).get('/').set('Cookie', 'session=abc123; token=xyz').expect(200);

      const output = capture.output();
      expect(output).not.toContain('abc123');
      expect(output).toContain('[REDACTED]');
    });

    it('redacts password field in request body by default', async () => {
      app.use(requestLogger({
        fields: ['method', 'body'],
        colors: false,
      }));
      app.post('/login', (_req, res) => res.send('ok'));

      await request(app)
        .post('/login')
        .send({ username: 'alice', password: 'super-secret-pw' })
        .expect(200);

      const output = capture.output();
      expect(output).not.toContain('super-secret-pw');
      expect(output).toContain('[REDACTED]');
      expect(output).toContain('alice');
    });

    it('redacts nested sensitive fields in body', async () => {
      app.use(requestLogger({
        fields: ['body'],
        colors: false,
      }));
      app.post('/', (_req, res) => res.send('ok'));

      await request(app)
        .post('/')
        .send({ user: { name: 'alice', api_key: 'sk-123' } })
        .expect(200);

      const output = capture.output();
      expect(output).not.toContain('sk-123');
      expect(output).toContain('[REDACTED]');
    });

    it('accepts custom redact keys', async () => {
      app.use(requestLogger({
        fields: ['body'],
        colors: false,
        redact: ['ssn'],
      }));
      app.post('/', (_req, res) => res.send('ok'));

      await request(app)
        .post('/')
        .send({ ssn: '123-45-6789', authorization: 'should-not-be-redacted-now' })
        .expect(200);

      const output = capture.output();
      expect(output).not.toContain('123-45-6789');
      // With custom redact, defaults are replaced — 'authorization' no longer redacted
      expect(output).toContain('should-not-be-redacted-now');
    });
  });

  describe('security - log injection', () => {
    it('sanitizes CRLF injection in URL', async () => {
      app.use(requestLogger({
        fields: ['method', 'url'],
        colors: false,
      }));
      app.get(/.*/, (_req, res) => res.send('ok'));

      // Simulate a URL with encoded newline
      await request(app).get('/path%0AFAKE%20LOG%20LINE').expect(200);

      const output = capture.output();
      // Decoded value should be escaped, not render as a real newline
      const lines = output.trim().split('\n').filter((l) => l.length > 0);
      // Should still be exactly one log line, not two
      expect(lines.length).toBe(1);
      expect(output).not.toContain('\nFAKE LOG LINE');
    });

    it('sanitizeString utility escapes CR/LF/NUL characters', async () => {
      // HTTP clients reject invalid headers before they reach us, but
      // some request fields (e.g., query strings, URL paths) can still
      // carry URL-decoded CRLF. The sanitize utility is the last line
      // of defense — test it directly.
      const { sanitizeString } = await import('../src/utils/sanitize');
      expect(sanitizeString('hello\nworld')).toBe('hello\\nworld');
      expect(sanitizeString('hello\r\nworld')).toBe('hello\\r\\nworld');
      expect(sanitizeString('hello\x00world')).toBe('hello\\0world');
      expect(sanitizeString('normal text')).toBe('normal text');
    });
  });

  describe('security - safe serialization', () => {
    it('handles circular references without crashing', async () => {
      app.use(requestLogger({
        fields: ['body'],
        colors: false,
      }));
      app.post('/', (req, res) => {
        const circular: Record<string, unknown> = { name: 'alice' };
        circular.self = circular;
        req.body = circular;
        res.send('ok');
      });

      await request(app).post('/').send({ name: 'alice' }).expect(200);

      expect(capture.output()).toContain('[Circular]');
    });

    it('truncates oversized body fields', async () => {
      app.use(requestLogger({
        fields: ['body'],
        colors: false,
        maxFieldSize: 50,
      }));
      app.post('/', (_req, res) => res.send('ok'));

      const bigString = 'x'.repeat(10000);
      await request(app).post('/').send({ data: bigString }).expect(200);

      const output = capture.output();
      expect(output).toContain('[TRUNCATED]');
      expect(output.length).toBeLessThan(2000);
    });
  });

  describe('lifecycle', () => {
    it('exports closeFileTransports for user-controlled shutdown', async () => {
      const mod = await import('../src/index');
      expect(typeof mod.closeFileTransports).toBe('function');
    });

    it('does not attach SIGINT or SIGTERM handlers (library must not own signals)', () => {
      // Regression guard: earlier versions hijacked the host process's
      // shutdown signals and called process.exit(), breaking user code.
      // After importing the package, listener counts must not include ours.
      // Node's default behavior has 0 listeners; test runners may add some.
      // We verify our package did not ADD any SIGINT/SIGTERM listeners
      // by checking that no listener references closeFileTransports by reference.
      const sigintListeners = process.listeners('SIGINT');
      const sigtermListeners = process.listeners('SIGTERM');
      for (const listener of [...sigintListeners, ...sigtermListeners]) {
        expect(listener.toString()).not.toContain('closeFileTransports');
        expect(listener.toString()).not.toContain('process.exit(0)');
      }
    });
  });

  describe('error resilience', () => {
    it('does not crash on malformed skip function', async () => {
      app.use(requestLogger({
        colors: false,
        skip: () => {
          throw new Error('boom');
        },
      }));
      app.get('/', (_req, res) => res.send('ok'));

      // Should still respond even if logging throws
      await request(app).get('/').expect(200);
    });
  });
});
