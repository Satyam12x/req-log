import { LogEntry } from '../types';
import { colorStatus, colorMethod, colorDuration, COLORS } from '../utils/colors';
import { safeStringify } from '../utils/sanitize';

export function defaultFormat(
  entry: LogEntry,
  useColors: boolean = true,
  maxFieldSize: number = 2048
): string {
  const parts: string[] = [];
  const gray = useColors ? COLORS.gray : '';
  const cyan = useColors ? COLORS.cyan : '';
  const reset = useColors ? COLORS.reset : '';

  if (entry.timestamp !== undefined) {
    parts.push(`${gray}[${entry.timestamp}]${reset}`);
  }

  if (entry.requestId !== undefined) {
    parts.push(`${cyan}[${entry.requestId.slice(0, 8)}]${reset}`);
  }

  if (entry.method !== undefined) {
    parts.push(useColors ? colorMethod(entry.method) : entry.method.padEnd(7));
  }

  if (entry.url !== undefined) {
    parts.push(entry.url);
  }

  if (entry.status !== undefined) {
    parts.push(useColors ? colorStatus(entry.status) : entry.status.toString());
  }

  if (entry.duration !== undefined) {
    parts.push(useColors ? colorDuration(entry.duration) : `${entry.duration.toFixed(2)}ms`);
  }

  if (entry.route !== undefined) {
    parts.push(`${gray}route=${entry.route}${reset}`);
  }

  if (entry.handler !== undefined) {
    parts.push(`${gray}-> ${entry.handler}${reset}`);
  }

  if (entry.baseUrl !== undefined && entry.baseUrl !== '/') {
    parts.push(`${gray}base=${entry.baseUrl}${reset}`);
  }

  if (entry.ip !== undefined) {
    parts.push(`${gray}${entry.ip}${reset}`);
  }

  if (entry.protocol !== undefined) {
    parts.push(`${gray}${entry.protocol}${reset}`);
  }

  if (entry.hostname !== undefined) {
    parts.push(`${gray}${entry.hostname}${reset}`);
  }

  if (entry.userAgent !== undefined) {
    parts.push(`${gray}"${entry.userAgent}"${reset}`);
  }

  if (entry.referer !== undefined && entry.referer !== 'unknown') {
    parts.push(`${gray}ref="${entry.referer}"${reset}`);
  }

  if (entry.contentLength !== undefined) {
    parts.push(`${gray}${entry.contentLength}b${reset}`);
  }

  if (entry.query !== undefined && Object.keys(entry.query).length > 0) {
    parts.push(`${gray}query=${safeStringify(entry.query, maxFieldSize)}${reset}`);
  }

  if (entry.params !== undefined && Object.keys(entry.params).length > 0) {
    parts.push(`${gray}params=${safeStringify(entry.params, maxFieldSize)}${reset}`);
  }

  if (entry.body !== undefined) {
    parts.push(`${gray}body=${safeStringify(entry.body, maxFieldSize)}${reset}`);
  }

  if (entry.headers !== undefined) {
    parts.push(`${gray}headers=${safeStringify(entry.headers, maxFieldSize)}${reset}`);
  }

  // User-controlled fields (url, userAgent, referer, requestId) are already
  // sanitized in buildEntry. Logger-produced fields (method/status/duration/
  // route/handler/ip/protocol/hostname/timestamp) can't carry CR/LF, and
  // safeStringify output has them JSON-escaped. A second pass is redundant.
  return parts.join(' ');
}
