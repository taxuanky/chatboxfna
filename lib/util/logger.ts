/**
 * Log tối giản, có cơ chế LOG-MỘT-LẦN-MỖI-TIẾN-TRÌNH cho các cảnh báo cấu hình.
 *
 * Vì sao cần: §6.1 quy định "cấu hình ngoài khoảng ⇒ dùng mặc định + log warn MỘT LẦN,
 * không throw". `lib/config/env.ts` đọc env lười và được gọi lại mỗi request, nên không có
 * cơ chế này thì một biến gõ sai sẽ in một dòng warn cho MỖI lượt chat và nhấn chìm log.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function currentLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? '').trim().toLowerCase();
  return raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error' ? raw : 'info';
}

function enabled(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[currentLevel()];
}

const seen = new Set<string>();

function emit(level: LogLevel, message: string, fields?: Record<string, unknown>): void {
  if (!enabled(level)) return;
  const line = fields && Object.keys(fields).length > 0
    ? `[${level}] ${message} ${JSON.stringify(fields)}`
    : `[${level}] ${message}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export function logDebug(message: string, fields?: Record<string, unknown>): void {
  emit('debug', message, fields);
}

export function logInfo(message: string, fields?: Record<string, unknown>): void {
  emit('info', message, fields);
}

export function logWarn(message: string, fields?: Record<string, unknown>): void {
  emit('warn', message, fields);
}

export function logError(message: string, fields?: Record<string, unknown>): void {
  emit('error', message, fields);
}

/** Phát `message` nhiều nhất MỘT lần cho mỗi `key` trong suốt vòng đời tiến trình. */
export function logOnce(
  level: LogLevel,
  key: string,
  message: string,
  fields?: Record<string, unknown>,
): void {
  if (seen.has(key)) return;
  seen.add(key);
  emit(level, message, fields);
}

export function logWarnOnce(key: string, message: string, fields?: Record<string, unknown>): void {
  logOnce('warn', key, message, fields);
}

export function logInfoOnce(key: string, message: string, fields?: Record<string, unknown>): void {
  logOnce('info', key, message, fields);
}

/** Chỉ dùng trong test: xoá bộ nhớ "đã log" để mỗi ca kiểm được hành vi một-lần. */
export function resetLogOnceForTests(): void {
  seen.clear();
}

/** Chỉ dùng trong test/debug: đã phát cảnh báo nào chưa. */
export function hasLoggedOnce(key: string): boolean {
  return seen.has(key);
}
