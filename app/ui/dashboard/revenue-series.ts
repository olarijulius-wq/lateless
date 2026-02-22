export type RevenueSeriesPoint = {
  period: string;
  revenueCents: number;
};

type RevenueSeriesGranularity = 'daily' | 'monthly';

const DEFAULT_TIMEZONE = 'Europe/Tallinn';

function getZonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    throw new Error('Failed to resolve timezone-adjusted date parts.');
  }

  return { year, month, day };
}

function toDayKey(year: number, month: number, day: number) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function toMonthKey(year: number, month: number) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

function shiftDayKey(dayKey: string, offsetDays: number) {
  const [year, month, day] = dayKey.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + offsetDays));
  return toDayKey(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

function shiftMonthKey(monthKey: string, offsetMonths: number) {
  const [year, month] = monthKey.split('-').map(Number);
  const monthIndex = year * 12 + (month - 1) + offsetMonths;
  const shiftedYear = Math.floor(monthIndex / 12);
  const shiftedMonth = (monthIndex % 12) + 1;
  return toMonthKey(shiftedYear, shiftedMonth);
}

function isAscending(periods: string[]) {
  for (let i = 1; i < periods.length; i += 1) {
    if (periods[i - 1] > periods[i]) {
      return false;
    }
  }
  return true;
}

export function fillRevenueSeries(
  existing: RevenueSeriesPoint[],
  granularity: RevenueSeriesGranularity,
  options?: { now?: Date; timeZone?: string; windowSize?: number },
): RevenueSeriesPoint[] {
  const now = options?.now ?? new Date();
  const timeZone = options?.timeZone ?? DEFAULT_TIMEZONE;
  const defaultWindowSize = granularity === 'monthly' ? 6 : 30;
  const windowSize = Math.max(1, Math.floor(options?.windowSize ?? defaultWindowSize));
  const current = getZonedParts(now, timeZone);

  const keys: string[] = [];
  if (granularity === 'monthly') {
    const currentMonth = toMonthKey(current.year, current.month);
    for (let index = windowSize - 1; index >= 0; index -= 1) {
      keys.push(shiftMonthKey(currentMonth, -index));
    }
  } else {
    const today = toDayKey(current.year, current.month, current.day);
    for (let index = windowSize - 1; index >= 0; index -= 1) {
      keys.push(shiftDayKey(today, -index));
    }
  }

  const merged = new Map(keys.map((key) => [key, 0]));
  for (const point of existing) {
    if (merged.has(point.period)) {
      merged.set(point.period, point.revenueCents);
    }
  }

  return keys.map((key) => ({
    period: key,
    revenueCents: merged.get(key) ?? 0,
  }));
}

function runRevenueSeriesDevAssertions() {
  const now = new Date('2026-02-22T12:00:00.000Z');

  const monthly = fillRevenueSeries(
    [{ period: '2026-02', revenueCents: 1200 }],
    'monthly',
    { now, timeZone: DEFAULT_TIMEZONE },
  );
  if (monthly.length !== 6) {
    throw new Error('fillRevenueSeries monthly assertion failed: expected 6 points.');
  }
  if (monthly[0]?.revenueCents !== 0 || monthly[5]?.revenueCents !== 1200) {
    throw new Error('fillRevenueSeries monthly assertion failed: expected zero-padded history.');
  }
  if (!isAscending(monthly.map((point) => point.period))) {
    throw new Error('fillRevenueSeries monthly assertion failed: expected ascending order.');
  }

  const daily = fillRevenueSeries(
    [{ period: '2026-02-22', revenueCents: 500 }],
    'daily',
    { now, timeZone: DEFAULT_TIMEZONE },
  );
  if (daily.length !== 30) {
    throw new Error('fillRevenueSeries daily assertion failed: expected 30 points.');
  }
  if (daily[0]?.revenueCents !== 0 || daily[29]?.revenueCents !== 500) {
    throw new Error('fillRevenueSeries daily assertion failed: expected zero-filled missing days.');
  }
}

if (process.env.NODE_ENV === 'development') {
  runRevenueSeriesDevAssertions();
}
