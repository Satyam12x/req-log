// Default header keys that will be redacted unless the user overrides.
// These are the most common secrets that accidentally end up in logs.
// Kept lowercase so they can be used directly for case-insensitive lookup.
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

const DEFAULT_REDACT_SET: Set<string> = new Set(DEFAULT_REDACT_KEYS);

const REDACTED = '[REDACTED]';
const TRUNCATED_SUFFIX = '...[TRUNCATED]';
const UNSERIALIZABLE_PREFIX = '[Unserializable:';
const MAX_DEPTH = 10;

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

// Build a lowercased Set once per logger instance. Set lookup is O(1)
// vs O(n) array scan + repeated toLowerCase() calls on every field.
export function buildRedactSet(keys: string[]): Set<string> {
  if (keys === DEFAULT_REDACT_KEYS) return DEFAULT_REDACT_SET;
  const set = new Set<string>();
  for (const k of keys) set.add(k.toLowerCase());
  return set;
}

function resolveSet(keys: string[] | Set<string>): Set<string> {
  return keys instanceof Set ? keys : buildRedactSet(keys);
}

// Redact sensitive keys from a flat object (e.g. headers).
// Returns the original object if nothing needed redacting — avoids
// an allocation in the common case.
export function redactObject<T extends Record<string, unknown>>(
  obj: T,
  redactKeys: string[] | Set<string> = DEFAULT_REDACT_SET
): Record<string, unknown> {
  const set = resolveSet(redactKeys);
  if (set.size === 0) return obj;

  let result: Record<string, unknown> | null = null;
  for (const key of Object.keys(obj)) {
    if (set.has(key.toLowerCase())) {
      if (!result) result = { ...obj };
      result[key] = REDACTED;
    }
  }
  return result ?? obj;
}

// Deep version for nested objects (e.g. request bodies).
// Handles circular references via WeakSet — returns '[Circular]' on revisit.
// Returns the original subtree when no descendant needed redacting,
// so unchanged branches don't trigger allocations.
export function redactDeep(
  value: unknown,
  redactKeys: string[] | Set<string> = DEFAULT_REDACT_SET
): unknown {
  const set = resolveSet(redactKeys);
  if (set.size === 0) return value;
  return redactDeepCore(value, set, 0, new WeakSet());
}

function redactDeepCore(
  value: unknown,
  set: Set<string>,
  depth: number,
  seen: WeakSet<object>
): unknown {
  if (depth > MAX_DEPTH) return '[Object: too deep]';
  if (value === null || typeof value !== 'object') return value;

  if (seen.has(value as object)) return '[Circular]';
  seen.add(value as object);

  if (Array.isArray(value)) {
    let result: unknown[] = value;
    let changed = false;
    for (let i = 0; i < value.length; i++) {
      const v = redactDeepCore(value[i], set, depth + 1, seen);
      if (v !== value[i]) {
        if (!changed) {
          result = value.slice();
          changed = true;
        }
        result[i] = v;
      }
    }
    return result;
  }

  const obj = value as Record<string, unknown>;
  let result: Record<string, unknown> = obj;
  let changed = false;
  for (const key of Object.keys(obj)) {
    if (set.has(key.toLowerCase())) {
      if (!changed) {
        result = { ...obj };
        changed = true;
      }
      result[key] = REDACTED;
    } else {
      const v = redactDeepCore(obj[key], set, depth + 1, seen);
      if (v !== obj[key]) {
        if (!changed) {
          result = { ...obj };
          changed = true;
        }
        result[key] = v;
      }
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
    return `${UNSERIALIZABLE_PREFIX} ${msg}]`;
  }
}

// Preflight for the JSON formatter: if `value` serializes cleanly and fits
// within maxBytes, return the original value so the parent stringify can
// inline it directly (avoids the old parse-and-reserialize round-trip).
// If truncated or unserializable, return the stringified form so it shows
// up as an escaped string in the final log line.
export function safeInlineOrTruncated(value: unknown, maxBytes: number): unknown {
  const s = safeStringify(value, maxBytes);
  if (s.endsWith(TRUNCATED_SUFFIX) || s.startsWith(UNSERIALIZABLE_PREFIX)) {
    return s;
  }
  return value;
}
