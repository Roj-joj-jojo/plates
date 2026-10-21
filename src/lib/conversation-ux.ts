const zone = "Europe/London";
const dayParts = new Intl.DateTimeFormat("en-GB", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" });
const dayLabel = new Intl.DateTimeFormat("en-GB", { timeZone: zone, weekday: "long", day: "numeric", month: "long", year: "numeric" });
const shortTime = new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const fullTime = new Intl.DateTimeFormat("en-GB", { timeZone: zone, day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "short" });
const shortDate = new Intl.DateTimeFormat("en-GB", { timeZone: zone, day: "numeric", month: "short", year: "numeric" });

export function conversationDate(value: string, todayKey: string | null = null) {
  const stamp = conversationStamp(value);
  if (stamp.dayKey === "unknown") return "Date unavailable";
  return stamp.dayKey === todayKey ? "Today" : shortDate.format(new Date(value));
}

export function shortDateTime(value: string) {
  const stamp = conversationStamp(value);
  return stamp.dayKey === "unknown" ? stamp.full : `${conversationDate(value)} · ${stamp.time}`;
}

export function conversationStamp(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return { dayKey: "unknown", day: "Date unavailable", time: "Time unavailable", full: "Date and time unavailable" };
  const parts = dayParts.formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? "";
  return { dayKey: `${part("year")}-${part("month")}-${part("day")}`, day: dayLabel.format(date), time: shortTime.format(date), full: fullTime.format(date) };
}

export function startsConversationDay(current: string, previous?: string) {
  return !previous || conversationStamp(current).dayKey !== conversationStamp(previous).dayKey;
}

export function conversationCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}
