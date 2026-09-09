// The API sends times as UTC with an offset. Everything here renders them in
// the student's own timezone, which is what a campus app wants: a 2 pm slot
// should read as 2 pm to both sides of the booking.

const DAY = { weekday: "short", month: "short", day: "numeric" };
const TIME = { hour: "numeric", minute: "2-digit" };

export const formatDay = (iso) => new Date(iso).toLocaleDateString(undefined, DAY);

export const formatTime = (iso) => new Date(iso).toLocaleTimeString(undefined, TIME);

/** "Sat, Sep 12, 2:00 PM to 3:00 PM", or just the start when there is no end. */
export function formatWhen(startIso, endIso) {
  if (!startIso) return "";
  const start = `${formatDay(startIso)}, ${formatTime(startIso)}`;
  return endIso ? `${start} to ${formatTime(endIso)}` : start;
}

/** A stable per-day key in local time. Slicing the ISO string would group by
    UTC day, which puts a Friday evening slot on Saturday for anyone west of
    Greenwich. */
export function dayKey(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Slots bucketed into days, in the order they arrive (the API sorts them). */
export function groupByDay(slots) {
  const days = [];
  const byKey = new Map();
  for (const slot of slots) {
    const key = dayKey(slot.starts_at);
    let day = byKey.get(key);
    if (!day) {
      day = { key, label: formatDay(slot.starts_at), slots: [] };
      byKey.set(key, day);
      days.push(day);
    }
    day.slots.push(slot);
  }
  return days;
}

/** Short, relative stamp for a message: time today, date before that. */
export function formatStamp(iso) {
  return dayKey(iso) === dayKey(Date.now())
    ? formatTime(iso)
    : `${formatDay(iso)}, ${formatTime(iso)}`;
}

/** Turn the two halves of a date/time form into the UTC instant the API wants.
    Returns null when the pair does not parse, so callers can say so. */
export function localPartsToIso(dateValue, timeValue) {
  if (!dateValue || !timeValue) return null;
  const parsed = new Date(`${dateValue}T${timeValue}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function addMinutesToIso(iso, minutes) {
  return new Date(new Date(iso).getTime() + minutes * 60000).toISOString();
}

/** Today in the yyyy-mm-dd shape <input type="date"> expects, local time. */
export function todayInputValue() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
