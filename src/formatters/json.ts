import { LogEntry } from '../types';
import { safeStringify, safeInlineOrTruncated } from '../utils/sanitize';

// Structured JSON — one entry per line.
// Uses safeStringify to handle circular refs, bigints, and oversized values
// without ever throwing (a logger must never crash the server).

export function jsonFormat(entry: LogEntry, maxFieldSize: number = 2048): string {
  // Per-field size cap: if body/headers fit, keep the original reference
  // so the final stringify inlines them directly. If they overflow, they
  // come back as already-truncated strings and show up escaped in the output.
  let safeEntry: Record<string, unknown> = entry as Record<string, unknown>;
  let cloned = false;

  if (entry.body !== undefined) {
    const capped = safeInlineOrTruncated(entry.body, maxFieldSize);
    if (capped !== entry.body) {
      if (!cloned) {
        safeEntry = { ...safeEntry };
        cloned = true;
      }
      safeEntry.body = capped;
    }
  }
  if (entry.headers !== undefined) {
    const capped = safeInlineOrTruncated(entry.headers, maxFieldSize);
    if (capped !== entry.headers) {
      if (!cloned) {
        safeEntry = { ...safeEntry };
        cloned = true;
      }
      safeEntry.headers = capped;
    }
  }

  return safeStringify(safeEntry, maxFieldSize * 4);
}
