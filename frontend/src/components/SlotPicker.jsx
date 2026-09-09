import { useMemo, useState } from "react";

import { formatTime, groupByDay } from "../lib/datetime";

/**
 * The customer's side of the calendar: pick a day, then a time the provider
 * has actually opened. Only open slots are passed in, so anything rendered
 * here is bookable.
 */
export default function SlotPicker({ slots, value, onChange, disabled = false }) {
  const days = useMemo(() => groupByDay(slots), [slots]);
  const [chosenDay, setChosenDay] = useState(null);

  // Derived rather than stored: when the slot list reloads after a booking, a
  // remembered day that no longer has openings would leave the picker blank.
  const activeDay =
    days.find((d) => d.key === chosenDay) ?? days.find((d) => d.slots.some((s) => s.id === value)) ?? days[0];

  if (!days.length) return null;

  return (
    <div className="slot-picker">
      <div className="slot-days" role="group" aria-label="Days with openings">
        {days.map((day) => (
          <button
            key={day.key}
            type="button"
            className={`chip${day.key === activeDay.key ? " on" : ""}`}
            onClick={() => setChosenDay(day.key)}
            disabled={disabled}
          >
            {day.label}
          </button>
        ))}
      </div>

      <div className="slot-times" role="group" aria-label={`Times on ${activeDay.label}`}>
        {activeDay.slots.map((slot) => (
          <button
            key={slot.id}
            type="button"
            className={`slot-time${slot.id === value ? " on" : ""}`}
            aria-pressed={slot.id === value}
            onClick={() => onChange(slot.id === value ? null : slot.id)}
            disabled={disabled}
          >
            <span className="slot-time-start">{formatTime(slot.starts_at)}</span>
            <span className="slot-time-end">to {formatTime(slot.ends_at)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
