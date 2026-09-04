import type { DateRange } from "@/lib/analytics";

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

export function getLast30DaysRange(): DateRange {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 29);
  return { from: isoDay(from), to: isoDay(to) };
}
