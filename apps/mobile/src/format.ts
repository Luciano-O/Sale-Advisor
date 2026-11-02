// The space after R$ never breaks, so a price cannot split across lines.
const CURRENCY = "R$ ";

const groupThousands = (reais: number) => String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

export function formatAmount(cents: number): string {
  const decimals = String(cents % 100).padStart(2, "0");
  return `${groupThousands(Math.floor(cents / 100))},${decimals}`;
}

export function formatWholeAmount(cents: number): string {
  return groupThousands(Math.round(cents / 100));
}

export const formatMoney = (cents: number) => `${CURRENCY}${formatAmount(cents)}`;

export const formatWholeMoney = (cents: number) => `${CURRENCY}${formatWholeAmount(cents)}`;

export const formatPercent = (percent: number) => `${Math.round(percent)}%`;

/** The discount against the median as a price change: −11% is cheaper, +5% more expensive. */
export function formatDelta(discountPercent: number | null): string | null {
  if (discountPercent === null) return null;
  const rounded = Math.round(discountPercent);
  if (rounded === 0) return "0%";
  return rounded > 0 ? `−${rounded}%` : `+${-rounded}%`;
}

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const calendarDaysBetween = (earlier: Date, later: Date) =>
  Math.round((startOfDay(later) - startOfDay(earlier)) / 86_400_000);

export function formatRelativeTime(iso: string, now: Date): string {
  const then = new Date(iso);
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const days = calendarDaysBetween(then, now);
  if (days === 0) return `há ${Math.floor(minutes / 60)} h`;
  return days === 1 ? "ontem" : `há ${days} dias`;
}

const twoDigits = (value: number) => String(value).padStart(2, "0");

export function formatUpdateTime(iso: string, now: Date): string {
  const then = new Date(iso);
  const time = `${twoDigits(then.getHours())}:${twoDigits(then.getMinutes())}`;
  const days = calendarDaysBetween(then, now);
  if (days === 0) return `de hoje às ${time}`;
  if (days === 1) return `de ontem às ${time}`;
  return `de ${twoDigits(then.getDate())}/${twoDigits(then.getMonth() + 1)} às ${time}`;
}
