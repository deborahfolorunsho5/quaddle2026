import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api, mediaUrl } from "../api/client";
import ListingCard from "../components/ListingCard";
import ListingsMap from "../components/ListingsMap";
import { useAuth } from "../context/AuthContext";
import { useCampus } from "../lib/campus";
import { formatTime, formatWhen } from "../lib/datetime";
import { distanceMiles, formatWalk, pinOf } from "../lib/geo";
import { useMyLocation } from "../lib/useMyLocation";

const OPEN_ROW_LIMIT = 10;
const CATEGORY_TILE_LIMIT = 4;
const FRESH_DAYS = 7;
const FRESH_LIMIT = 6;
// A booking in one of these is still going to happen.
const UPCOMING_STATUSES = new Set(["pending", "accepted"]);

// Local midnight, so "today" means the student's today and not the server's.
function endOfDay(daysFromNow) {
  const end = new Date();
  end.setDate(end.getDate() + daysFromNow);
  end.setHours(23, 59, 59, 999);
  return end;
}

function partOfDay(now) {
  const hour = now.getHours();
  const part = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  return `${now.toLocaleDateString(undefined, { weekday: "long" })} ${part}`;
}

/** The soonest booking still ahead of us, on either side of it. */
function soonestUpcoming(mine, incoming) {
  const now = Date.now();
  const entries = [
    ...mine.map((booking) => ({ booking, role: "customer" })),
    ...incoming.map((booking) => ({ booking, role: "provider" })),
  ].filter(
    ({ booking }) =>
      UPCOMING_STATUSES.has(booking.status) &&
      booking.requested_time &&
      new Date(booking.requested_time).getTime() > now
  );
  entries.sort(
    (a, b) => new Date(a.booking.requested_time) - new Date(b.booking.requested_time)
  );
  return entries[0] ?? null;
}

const priceOf = (listing) => `$${Number(listing.price).toFixed(2)}`;

function milesFrom(position, listing) {
  const pin = pinOf(listing);
  return position && pin ? distanceMiles(position, pin) : null;
}

function NextBooking({ entry, listing }) {
  const { booking, role } = entry;
  const other = role === "provider" ? booking.customer : booking.provider;
  const img = mediaUrl(listing?.image_urls[0]);

  return (
    <section className="home-section">
      <h2 className="home-head">Your next booking</h2>
      <Link to="/bookings" className="next-booking">
        {img && <img className="next-booking-img" src={img} alt="" />}
        <div className="next-booking-body">
          <span className="next-booking-title">{booking.listing.title}</span>
          <span className="next-booking-when">
            {formatWhen(booking.requested_time, booking.requested_end)}
          </span>
          <span className="next-booking-who">
            {role === "provider" ? "Requested by" : "With"} @{other.username}
          </span>
        </div>
        <span className={`status-pill status-${booking.status}`}>{booking.status}</span>
      </Link>
    </section>
  );
}

function OpenSoon({ items, day, located }) {
  return (
    <section className="home-section">
      <h2 className="home-head">
        Open {day} {located ? "near you" : "on campus"}
      </h2>
      {items.length === 0 ? (
        <p className="empty">
          Nobody has opened a time for today or tomorrow yet. Everything on campus is below.
        </p>
      ) : (
        <ul className="open-row">
          {items.map(({ listing, slots, miles }) => {
            const img = mediaUrl(listing.image_urls[0]);
            return (
              <li key={listing.id}>
                <Link className="open-card" to={`/listings/${listing.id}`}>
                  <div className="open-card-img">
                    {img ? <img src={img} alt="" /> : <span>No photo</span>}
                    {miles != null && (
                      <span className="open-card-walk">{formatWalk(miles)}</span>
                    )}
                  </div>
                  <span className="open-card-title">{listing.title}</span>
                  <span className="open-card-meta">
                    @{listing.owner.username} ·{" "}
                    <span className="open-card-price">{priceOf(listing)}</span>
                  </span>
                  {/* The earliest time and a count: two times already wrap on a card this narrow. */}
                  <span className="open-card-times">
                    <span className="time-chip">{formatTime(slots[0].starts_at)}</span>
                    {slots.length > 1 && (
                      <span className="time-chip">+{slots.length - 1} more</span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function CategoryTiles({ categories }) {
  return (
    <section className="home-section">
      <h2 className="home-head">Browse by what you need</h2>
      <ul className="category-tiles">
        {categories.map(({ name, count, img }) => (
          <li key={name}>
            <Link
              className="category-tile"
              to={`/search?category=${encodeURIComponent(name)}`}
            >
              {img && <img src={img} alt="" />}
              <span className="category-tile-name">{name}</span>
              <span className="category-tile-count">
                {count} listing{count > 1 ? "s" : ""}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FreshListings({ listings }) {
  return (
    <section className="home-section">
      <h2 className="home-head">New on campus this week</h2>
      <ul className="fresh-grid">
        {listings.map((listing) => {
          const img = mediaUrl(listing.image_urls[0]);
          const { rating_count: count, rating_average: average } = listing.owner;
          return (
            <li key={listing.id}>
              <Link className="fresh-card" to={`/listings/${listing.id}`}>
                <div className="fresh-card-img">
                  {img ? <img src={img} alt="" /> : <span>No photo</span>}
                  <span className="fresh-card-price">{priceOf(listing)}</span>
                </div>
                <span className="fresh-card-title">{listing.title}</span>
                <span className="fresh-card-meta">
                  @{listing.owner.username} ·{" "}
                  {count ? (
                    <span className="fresh-card-rating">{average.toFixed(1)} ★</span>
                  ) : (
                    <span className="fresh-card-new">New</span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const campus = useCampus();
  const { position, status, request } = useMyLocation();

  const [listings, setListings] = useState([]);
  const [openSlots, setOpenSlots] = useState([]);
  const [next, setNext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("newest");
  const [showMap, setShowMap] = useState(false);
  const [error, setError] = useState("");

  // No campus to choose: the API scopes a guest to the campus Quad is open
  // to, and a logged-in student to their own.
  useEffect(() => {
    let alive = true;
    api
      .getListings()
      .then((rows) => {
        if (alive) setListings(rows);
      })
      .catch((err) => {
        if (alive) setError(err.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    // The open row is a shortcut, not the page: if it fails, the row shows
    // as empty and everything below still works. Tomorrow comes too, so late
    // in the evening the row has something to offer.
    api
      .getCampusOpenSlots(endOfDay(1).toISOString())
      .then((rows) => {
        if (alive) setOpenSlots(rows);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNext(null);
      return;
    }
    let alive = true;
    // Same reasoning as the open row: the Bookings tab reports these errors.
    Promise.all([api.getMyBookings(), api.getIncomingBookings()])
      .then(([mine, incoming]) => {
        if (alive) setNext(soonestUpcoming(mine, incoming));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user]);

  // Today's openings, or tomorrow's once today has none left. Your own times
  // are not news to you, and should not keep tomorrow's row from showing.
  const { openDay, daySlots } = useMemo(() => {
    const others = openSlots.filter((s) => s.provider_id !== user?.id);
    const midnight = endOfDay(0).getTime();
    const today = others.filter((s) => new Date(s.starts_at).getTime() <= midnight);
    return today.length > 0 || others.length === 0
      ? { openDay: "today", daySlots: today }
      : { openDay: "tomorrow", daySlots: others };
  }, [openSlots, user]);

  const openItems = useMemo(() => {
    const byProvider = new Map();
    for (const slot of daySlots) {
      if (!byProvider.has(slot.provider_id)) byProvider.set(slot.provider_id, []);
      byProvider.get(slot.provider_id).push(slot);
    }
    // A provider's slots cover every listing they have, so each of their
    // listings shows the same times.
    return listings
      .filter((l) => byProvider.has(l.owner.id))
      .map((listing) => ({
        listing,
        slots: byProvider.get(listing.owner.id),
        miles: milesFrom(position, listing),
      }))
      .sort((a, b) => new Date(a.slots[0].starts_at) - new Date(b.slots[0].starts_at))
      .slice(0, OPEN_ROW_LIMIT);
  }, [listings, daySlots, position]);

  const categories = useMemo(() => {
    const byName = new Map();
    for (const listing of listings) {
      if (!listing.category) continue;
      const entry = byName.get(listing.category) ?? { name: listing.category, count: 0, img: null };
      entry.count += 1;
      entry.img ??= mediaUrl(listing.image_urls[0]);
      byName.set(listing.category, entry);
    }
    return [...byName.values()]
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, CATEGORY_TILE_LIMIT);
  }, [listings]);

  // Browse already returns newest first.
  const fresh = useMemo(() => {
    const cutoff = Date.now() - FRESH_DAYS * 24 * 60 * 60 * 1000;
    return listings
      .filter((l) => new Date(l.created_at).getTime() > cutoff)
      .slice(0, FRESH_LIMIT);
  }, [listings]);

  const shown = useMemo(() => {
    const measured = listings.map((listing) => ({
      listing,
      miles: milesFrom(position, listing),
    }));
    if (sort !== "nearest") return measured;
    // A listing with no pin cannot be ranked by distance, so it sinks to the
    // bottom rather than posing as the closest thing on campus.
    return [...measured].sort((a, b) => {
      if (a.miles == null) return b.miles == null ? 0 : 1;
      if (b.miles == null) return -1;
      return a.miles - b.miles;
    });
  }, [listings, position, sort]);

  // Stable identity for ListingsMap, which fits its view to these pins.
  const shownListings = useMemo(() => shown.map((x) => x.listing), [shown]);

  const sortNearest = () => {
    setSort("nearest");
    if (!position) request();
  };

  const anyPinned = shown.some(({ listing }) => pinOf(listing));
  const locationOff = status === "denied" || status === "unavailable";
  const nextListing = next && listings.find((l) => l.id === next.booking.listing.id);

  return (
    <>
      <div className="page-head">
        <p className="eyebrow">{partOfDay(new Date())}</p>
        <h1>{user ? `Hi @${user.username}` : "What students offer on campus"}</h1>
        <p className="page-sub">
          {campus
            ? `Every listing is posted by a ${campus.name} student, so whoever you book is a walk away.`
            : "Every listing is posted by a student on your campus, so whoever you book is a walk away."}
        </p>
      </div>

      {error && <div className="error">{error}</div>}

      {loading ? (
        <p className="muted">Loading listings…</p>
      ) : (
        <>
          {next && <NextBooking entry={next} listing={nextListing} />}
          {listings.length > 0 && (
            <OpenSoon items={openItems} day={openDay} located={Boolean(position)} />
          )}
          {categories.length > 1 && <CategoryTiles categories={categories} />}
          {fresh.length > 0 && <FreshListings listings={fresh} />}

          <section className="home-section">
            <h2 className="home-head">Everything on campus</h2>

            {anyPinned && (
              <div className="viewbar">
                <div className="chips">
                  <button
                    className={`chip${sort === "newest" ? " on" : ""}`}
                    onClick={() => setSort("newest")}
                  >
                    Newest
                  </button>
                  <button
                    className={`chip${sort === "nearest" ? " on" : ""}`}
                    onClick={sortNearest}
                  >
                    {status === "loading" ? "Locating…" : "Nearest"}
                  </button>
                </div>
                <button className="chip" onClick={() => setShowMap((v) => !v)}>
                  {showMap ? "Show list" : "Show map"}
                </button>
              </div>
            )}

            {anyPinned && status === "idle" && (
              <p className="hint" style={{ marginBottom: "1.25rem" }}>
                <button className="link-button" onClick={request}>
                  Use my location
                </button>{" "}
                to see how far each listing is from you.
              </p>
            )}

            {anyPinned && locationOff && (
              <p className="hint" style={{ marginBottom: "1.25rem" }}>
                Location is off, so walking times are hidden. Turn it on in your
                browser to see how far each listing is.
              </p>
            )}

            {shown.length === 0 ? (
              <p className="empty">No listings yet. Be the first to post one.</p>
            ) : showMap && anyPinned ? (
              <ListingsMap listings={shownListings} me={position} />
            ) : (
              <div className="grid">
                {shown.map(({ listing, miles }) => (
                  <ListingCard key={listing.id} listing={listing} miles={miles} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
