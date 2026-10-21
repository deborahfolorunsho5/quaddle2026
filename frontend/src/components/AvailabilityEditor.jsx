import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api/client";
import {
  addMinutesToIso,
  formatTime,
  groupByDay,
  localPartsToIso,
  todayInputValue,
} from "../lib/datetime";

const DURATIONS = [
  { minutes: 30, label: "30 minutes" },
  { minutes: 45, label: "45 minutes" },
  { minutes: 60, label: "1 hour" },
  { minutes: 90, label: "1 hour 30" },
  { minutes: 120, label: "2 hours" },
  { minutes: 180, label: "3 hours" },
  { minutes: 240, label: "4 hours" },
  { minutes: 300, label: "5 hours" },
  { minutes: 360, label: "6 hours" },
  { minutes: 480, label: "8 hours" },
  // MAX_SLOT_HOURS in backend/app/schemas/availability.py; it refuses longer.
  { minutes: 720, label: "12 hours" },
];

export default function AvailabilityEditor() {
  const [slots, setSlots] = useState(null);
  const [date, setDate] = useState(todayInputValue());
  const [time, setTime] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () =>
    api
      .getMyAvailability()
      .then(setSlots)
      .catch((err) => setError(err.message));

  useEffect(() => {
    load();
  }, []);

  const addSlot = async (e) => {
    e.preventDefault();
    setError("");

    const startsAt = localPartsToIso(date, time);
    if (!startsAt) {
      setError("Pick a date and a start time.");
      return;
    }

    setSaving(true);
    try {
      await api.createSlot({
        starts_at: startsAt,
        ends_at: addMinutesToIso(startsAt, minutes),
      });
      setTime("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const removeSlot = async (slot) => {
    setError("");
    try {
      await api.deleteSlot(slot.id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const days = slots ? groupByDay(slots) : [];

  return (
    <>
      {error && <div className="error">{error}</div>}

      <form className="card-panel slot-form" onSubmit={addSlot}>
        <div className="field">
          <label htmlFor="slot-date">Date</label>
          <input
            id="slot-date"
            type="date"
            value={date}
            min={todayInputValue()}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="slot-time">Starts at</label>
          <input
            id="slot-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="slot-length">Length</label>
          <select
            id="slot-length"
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
          >
            {DURATIONS.map((d) => (
              <option key={d.minutes} value={d.minutes}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? "Adding…" : "Add this time"}
        </button>
      </form>

      <h2 className="section-head">Coming up</h2>

      {slots === null ? (
        <p className="muted">Loading…</p>
      ) : days.length === 0 ? (
        <p className="empty">
          No times open yet. Add one above and it shows on your listings right
          away.
        </p>
      ) : (
        days.map((day) => (
          <section key={day.key} className="slot-day">
            <h3>{day.label}</h3>
            <ul className="slot-list">
              {day.slots.map((slot) => (
                <li key={slot.id} className="slot-row">
                  <span className="slot-row-time">
                    {formatTime(slot.starts_at)} to {formatTime(slot.ends_at)}
                  </span>
                  <span
                    className={`status-pill status-${
                      slot.is_booked ? "accepted" : "open"
                    }`}
                  >
                    {slot.is_booked ? "Booked" : "Open"}
                  </span>
                  {slot.is_booked ? (
                    <Link className="btn-link" to="/bookings">
                      See the booking
                    </Link>
                  ) : (
                    <button
                      className="btn-danger"
                      type="button"
                      onClick={() => removeSlot(slot)}
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}
