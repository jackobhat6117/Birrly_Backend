import { DateTime } from 'luxon';
import { DEFAULT_TIMEZONE } from '@/shared/constants/app';
import { AppError, ERROR_CODE } from '@/shared/errors/app-error';

function calendarDate(year: number, month: number, day: number): Date {
  return DateTime.utc(year, month, day).toJSDate();
}

export function nowInZone(timezone: string = DEFAULT_TIMEZONE): DateTime {
  const dt = DateTime.now().setZone(timezone);
  if (!dt.isValid) {
    throw new AppError(ERROR_CODE.INVALID_DATE, 'Timezone is invalid.', 400);
  }
  return dt;
}

export function parseDateInput(value: string, timezone: string = DEFAULT_TIMEZONE): Date {
  const trimmed = value.trim();
  const zone = timezone || DEFAULT_TIMEZONE;
  const formats = ['yyyy-MM-dd', 'd MMMM yyyy', 'MMMM d yyyy', 'MMMM d', 'd MMMM', "MMMM d, yyyy"];

  const iso = DateTime.fromISO(trimmed, { zone });
  if (iso.isValid && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return calendarDate(iso.year, iso.month, iso.day);
  }

  for (const format of formats) {
    const parsed = DateTime.fromFormat(trimmed, format, { zone });
    if (parsed.isValid) {
      const year = parsed.year > 0 ? parsed.year : nowInZone(zone).year;
      return calendarDate(year, parsed.month, parsed.day);
    }
  }

  const lower = trimmed.toLowerCase();
  const today = nowInZone(zone);
  if (lower === 'today') return calendarDate(today.year, today.month, today.day);
  if (lower === 'yesterday') {
    const previous = today.minus({ days: 1 });
    return calendarDate(previous.year, previous.month, previous.day);
  }
  if (lower === 'tomorrow') {
    const next = today.plus({ days: 1 });
    return calendarDate(next.year, next.month, next.day);
  }

  throw new AppError(ERROR_CODE.INVALID_DATE, 'Date could not be understood.', 400);
}

export function monthRange(year: number, month: number): { start: Date; end: Date } {
  const start = DateTime.utc(year, month, 1);
  const end = start.endOf('month').startOf('day');
  return { start: start.toJSDate(), end: end.toJSDate() };
}

export function currentMonthRange(timezone: string = DEFAULT_TIMEZONE): { start: Date; end: Date } {
  const now = nowInZone(timezone);
  return monthRange(now.year, now.month);
}
