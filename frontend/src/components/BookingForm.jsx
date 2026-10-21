import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { formatWhen } from "../lib/datetime";
import SlotPicker from "./SlotPicker";

/**
 * Request one of a provider's open times. A listing page passes its one
 * listing; a profile passes every active listing, and the customer picks which
 * service the time is for, since a booking is always against a listing.
 */
export default function BookingForm({ providerId, providerName, listings }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [slots, setSlots] = useState(null);
  const [listingId, setListingId] = useState(
    listings.length === 1 ? listings[0].id : null
  );
  const [slotId, setSlotId] = useState(null);
  const [note, setNote] = useState("");
  const [booked, setBooked] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getAvailability(providerId)
      .then((open) => !cancelled && setSlots(open))
      .catch((err) => {
        if (cancelled) return;
        setSlots([]);
        setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [providerId]);

  const refreshSlots = async () => {
    try {
      setSlots(await api.getAvailability(providerId));
    } catch {
      // Keep whatever the picker already has rather than emptying it.
    }
  };

  const requestBooking = async (e) => {
    e.preventDefault();
    if (!listingId) {
      setError("Pick which service this is for.");
      return;
    }
    if (!slotId) {
      setError("Pick a time first.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const created = await api.createBooking({
        listing_id: listingId,
        slot_id: slotId,
        message: note.trim() || null,
      });
      setBooked(created);
      setSlotId(null);
      setNote("");
    } catch (err) {
      // Most likely someone took the slot first, so reload before they retry.
      setError(err.message);
    } finally {
      await refreshSlots();
      setBusy(false);
    }
  };

  const messageProvider = async () => {
    setError("");
    try {
      const conversation = await api.startConversation(providerId);
      navigate(`/messages/${conversation.id}`);
    } catch (err) {
      setError(err.message);
    }
  };

  const errorBox = error && <div className="error">{error}</div>;

  if (booked) {
    return (
      <>
        {errorBox}
        <div className="booking-done">
          <p>
            Requested {listings.length > 1 && `${booked.listing.title} `}for{" "}
            <strong>{formatWhen(booked.requested_time, booked.requested_end)}</strong>
            . @{providerName} has to accept it.
          </p>
          <div className="booking-actions">
            <Link className="btn btn-ghost" to="/bookings">
              See your bookings
            </Link>
            <button className="btn-link" type="button" onClick={messageProvider}>
              Message @{providerName}
            </button>
          </div>
        </div>
      </>
    );
  }

  if (slots === null) return <p className="muted">Loading times…</p>;

  if (slots.length === 0) {
    return (
      <>
        {errorBox}
        <p className="empty">@{providerName} has not opened any times yet.</p>
        {user && (
          <button className="btn btn-ghost" type="button" onClick={messageProvider}>
            Message @{providerName}
          </button>
        )}
      </>
    );
  }

  return (
    <form onSubmit={requestBooking}>
      {errorBox}

      {listings.length > 1 && (
        <div className="field">
          <span className="field-label" id="booking-service">
            Which service
          </span>
          <div className="chips" role="group" aria-labelledby="booking-service">
            {listings.map((l) => (
              <button
                key={l.id}
                type="button"
                className={`chip${l.id === listingId ? " on" : ""}`}
                aria-pressed={l.id === listingId}
                onClick={() => setListingId(l.id)}
                disabled={!user || busy}
              >
                {l.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <SlotPicker slots={slots} value={slotId} onChange={setSlotId} disabled={!user || busy} />

      {user ? (
        <>
          <div className="field booking-note-field">
            <label htmlFor="booking-note">Anything they should know (optional)</label>
            <textarea
              id="booking-note"
              rows={3}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="booking-actions">
            <button
              className="btn btn-primary"
              type="submit"
              disabled={busy || !slotId || !listingId}
            >
              {busy ? "Requesting…" : "Request this time"}
            </button>
            <button className="btn-link" type="button" onClick={messageProvider}>
              Message @{providerName}
            </button>
          </div>
        </>
      ) : (
        <p className="hint">
          <Link to="/login">Log in</Link> to book one of these times or message{" "}
          @{providerName}.
        </p>
      )}
    </form>
  );
}
