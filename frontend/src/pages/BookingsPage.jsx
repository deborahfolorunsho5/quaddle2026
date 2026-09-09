import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { api } from "../api/client";
import { formatWhen } from "../lib/datetime";

// Mirrors ALLOWED_TRANSITIONS in backend/app/routers/bookings.py. The server is
// the one enforcing this; the buttons just avoid offering a move it will refuse.
const ACTIONS = {
  provider: {
    pending: [
      { status: "accepted", label: "Accept", style: "btn btn-primary" },
      { status: "declined", label: "Decline", style: "btn-danger" },
    ],
    accepted: [
      { status: "completed", label: "Mark completed", style: "btn btn-ghost" },
    ],
  },
  customer: {
    pending: [{ status: "cancelled", label: "Cancel", style: "btn-danger" }],
    accepted: [{ status: "cancelled", label: "Cancel", style: "btn-danger" }],
  },
};

// Matches SLOT_RELEASING_STATUSES on the backend.
const RELEASED = new Set(["declined", "cancelled"]);

function BookingCard({ booking, role, onAct, onMessage, busy }) {
  const other = role === "provider" ? booking.customer : booking.provider;
  const actions = ACTIONS[role][booking.status] ?? [];

  return (
    <li className="booking-card">
      <div className="booking-top">
        <Link className="booking-title" to={`/listings/${booking.listing.id}`}>
          {booking.listing.title}
        </Link>
        <span className={`status-pill status-${booking.status}`}>
          {booking.status}
        </span>
      </div>

      <p className="booking-when">
        {formatWhen(booking.requested_time, booking.requested_end)}
        {/* The slot goes back on the calendar when a booking ends this way. */}
        {RELEASED.has(booking.status) && " (time reopened)"}
      </p>

      <p className="booking-who">
        {role === "provider" ? "Requested by " : "With "}
        <Link to={`/users/${other.id}`}>@{other.username}</Link>
      </p>

      {booking.message && <p className="booking-note">{booking.message}</p>}

      <div className="booking-actions">
        {actions.map((action) => (
          <button
            key={action.status}
            type="button"
            className={action.style}
            disabled={busy}
            onClick={() => onAct(booking, action.status)}
          >
            {action.label}
          </button>
        ))}
        <button
          type="button"
          className="btn-link"
          onClick={() => onMessage(other.id)}
        >
          Message @{other.username}
        </button>
      </div>
    </li>
  );
}

function Section({ title, empty, bookings, role, onAct, onMessage, busy }) {
  return (
    <section className="booking-section">
      <h2 className="section-head">{title}</h2>
      {bookings.length === 0 ? (
        <p className="empty">{empty}</p>
      ) : (
        <ul className="booking-list">
          {bookings.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              role={role}
              onAct={onAct}
              onMessage={onMessage}
              busy={busy}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export default function BookingsPage() {
  const navigate = useNavigate();
  const [incoming, setIncoming] = useState(null);
  const [mine, setMine] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () =>
    Promise.all([api.getIncomingBookings(), api.getMyBookings()])
      .then(([theirs, ours]) => {
        setIncoming(theirs);
        setMine(ours);
      })
      .catch((err) => setError(err.message));

  useEffect(() => {
    load();
  }, []);

  const act = async (booking, status) => {
    setError("");
    setBusy(true);
    try {
      await api.updateBookingStatus(booking.id, status);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const message = async (userId) => {
    setError("");
    try {
      const conversation = await api.startConversation(userId);
      navigate(`/messages/${conversation.id}`);
    } catch (err) {
      setError(err.message);
    }
  };

  if (incoming === null || mine === null) {
    return error ? <div className="error">{error}</div> : <p className="muted">Loading…</p>;
  }

  return (
    <>
      <div className="page-head">
        <h1>Bookings</h1>
        <p className="page-sub">
          Requests on your listings and the ones you have sent.{" "}
          <Link to="/availability">Manage the times you are free</Link>.
        </p>
      </div>

      {error && <div className="error">{error}</div>}

      <Section
        title="Requests on your listings"
        empty="Nobody has booked you yet. Open some times so students can."
        bookings={incoming}
        role="provider"
        onAct={act}
        onMessage={message}
        busy={busy}
      />

      <Section
        title="Requests you sent"
        empty="You have not booked anyone yet."
        bookings={mine}
        role="customer"
        onAct={act}
        onMessage={message}
        busy={busy}
      />
    </>
  );
}
