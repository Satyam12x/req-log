// Default header keys that will be redacted unless the user overrides.
// These are the most common secrets that accidentally end up in logs.
export const DEFAULT_REDACT_KEYS: string[] = [
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
  'x-access-token',
  'proxy-authorization',
  'password',
  'pwd',
  'secret',
  'token',
  'api_key',
  'apikey',
  'access_token',
  'refresh_token',
];

const REDACTED = '[REDACTED]';
const TRUNCATED_SUFFIX = '...[TRUNCATED]';

// Strip characters that could be used to forge log lines (CWE-117).
// We replace CR / LF / NUL with a visible token so the log still shows
// that something suspicious was in the field, without letting it
// actually break log structure.
export function sanitizeString(value: string): string {
  if (typeof value !== 'string') return value;
  return value.replace(/[\r\n\x00]/g, (ch) => {
    if (ch === '\r') return '\\r';
    if (ch === '\n') return '\\n';
    return '\\0';
  });
}

// Case-insensitive check: is this key name in the redact list?
function shouldRedact(key: string, redactKeys: string[]): boolean {
  const lowered = key.toLowerCase();
  return redactKeys.some((k) => k.toLowerCase() === lowered);
}

// Redact sensitive keys from a flat object (e.g. headers)
export function redactObject<T extends Record<string, unknown>>(
  obj: T,
  redactKeys: string[] = DEFAULT_REDACT_KEYS
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    result[key] = shouldRedact(key, redactKeys) ? REDACTED : obj[key];
  }
  return result;
}

// Deep version for nested objects (e.g. request bodies).
// Handles circular references via WeakSet — returns '[Circular]' on revisit.
export function redactDeep(
  value: unknown,
  redactKeys: string[] = DEFAULT_REDACT_KEYS,
  depth: number = 0,
  seen: WeakSet<object> = new WeakSet()
): unknown {
  if (depth > 10) return '[Object: too deep]';
  if (value === null || typeof value !== 'object') return value;

  if (seen.has(value as object)) return '[Circular]';
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((v) => redactDeep(v, redactKeys, depth + 1, seen));
  }

  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (shouldRedact(key, redactKeys)) {
      result[key] = REDACTED;
    } else {
      result[key] = redactDeep(
        (value as Record<string, unknown>)[key],
        redactKeys,
        depth + 1,
        seen
      );
    }
  }
  return result;
}

// Safely stringify a value:
//   1. Handles circular references (returns '[Circular]' instead of throwing)
//   2. Enforces a max size (truncates with a visible marker)
//   3. Catches any other errors
export function safeStringify(value: unknown, maxBytes: number = 2048): string {
  const seen = new WeakSet<object>();
  try {
    const json = JSON.stringify(value, (_key, val) => {
      if (typeof val === 'bigint') return val.toString();
      if (val !== null && typeof val === 'object') {
        if (seen.has(val as object)) return '[Circular]';
        seen.add(val as object);
      }
      return val;
    });

    if (json === undefined) return '';
    if (json.length <= maxBytes) return json;
    return json.slice(0, maxBytes) + TRUNCATED_SUFFIX;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `[Unserializable: ${msg}]`;
  }
}
