import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";

import { api } from "../api/client";
import { pinIcon, TILE_ATTRIBUTION, TILE_URL } from "../lib/leaflet";
import { useMyLocation } from "../lib/useMyLocation";

// A wide view of the continental US, so a provider who shares neither a pin
// nor their position still gets a map they can search or zoom into.
const FALLBACK_CENTER = { lat: 39.5, lng: -98.35 };
const FALLBACK_ZOOM = 4;
const CAMPUS_ZOOM = 14;
const PINNED_ZOOM = 17;

const MIN_QUERY_LENGTH = 3;

function ClickToPin({ onPick }) {
  useMapEvents({
    click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }),
  });
  return null;
}

// Moves the map whenever it is handed a new target. Each call builds a fresh
// object, so choosing the same search result twice still recentres, while
// panning by hand is never overridden because nothing sets a target for it.
function MoveTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.setView([target.lat, target.lng], target.zoom);
  }, [map, target]);
  return null;
}

export default function LocationPicker({
  value,
  onChange,
  approximate,
  onApproximateChange,
  campusCenter,
}) {
  const { position, status, request } = useMyLocation();

  const [target, setTarget] = useState(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [chosenLabel, setChosenLabel] = useState("");
  const [pinWhenLocated, setPinWhenLocated] = useState(false);

  // Once a pin exists the view belongs to the provider, so we stop following
  // their position or the campus. Searching still moves the map, because that
  // is an explicit request to go somewhere.
  const hasPinned = useRef(Boolean(value));

  // Dropping or dragging a pin must not move the map: that would undo the
  // zoom the provider just chose to be precise.
  const pinInPlace = (pin) => {
    hasPinned.current = true;
    onChange(pin);
  };

  const pinAndMove = (pin) => {
    hasPinned.current = true;
    onChange(pin);
    setTarget({ lat: pin.lat, lng: pin.lng, zoom: PINNED_ZOOM });
  };

  useEffect(() => {
    if (!hasPinned.current && position) {
      setTarget({ lat: position.lat, lng: position.lng, zoom: PINNED_ZOOM });
    }
  }, [position]);

  useEffect(() => {
    if (!hasPinned.current && !position && campusCenter) {
      setTarget({ lat: campusCenter.lat, lng: campusCenter.lng, zoom: CAMPUS_ZOOM });
    }
  }, [campusCenter, position]);

  useEffect(() => {
    if (pinWhenLocated && position) {
      setPinWhenLocated(false);
      hasPinned.current = true;
      onChange(position);
      setChosenLabel("your current location");
      setTarget({ lat: position.lat, lng: position.lng, zoom: PINNED_ZOOM });
    }
  }, [pinWhenLocated, position, onChange]);

  const useMyPosition = () => {
    setSearchError("");
    if (position) {
      pinAndMove(position);
      setChosenLabel("your current location");
    } else {
      setPinWhenLocated(true);
      request();
    }
  };

  const choose = (result) => {
    pinAndMove({ lat: result.latitude, lng: result.longitude });
    setChosenLabel(result.display_name);
    setResults(null);
  };

  const runSearch = async () => {
    const text = query.trim();
    if (text.length < MIN_QUERY_LENGTH) {
      setSearchError(`Type at least ${MIN_QUERY_LENGTH} characters to search.`);
      setResults(null);
      return;
    }
    setSearching(true);
    setSearchError("");
    setResults(null);
    try {
      const found = await api.geocode(text);
      if (found.length === 0) {
        setSearchError("Nothing found for that. Try a street address, or drop a pin by hand.");
      } else if (found.length === 1) {
        choose(found[0]);
      } else {
        setResults(found);
      }
    } catch (err) {
      setSearchError(err.message);
    } finally {
      setSearching(false);
    }
  };

  const onQueryKeyDown = (e) => {
    if (e.key !== "Enter") return;
    // This input sits inside the listing form, so without this Enter would
    // post the whole listing instead of running the search.
    e.preventDefault();
    runSearch();
  };

  const initialCenter = value ?? campusCenter ?? FALLBACK_CENTER;
  const initialZoom = value
    ? PINNED_ZOOM
    : campusCenter
      ? CAMPUS_ZOOM
      : FALLBACK_ZOOM;

  return (
    <div className="field">
      <label htmlFor="location-search">Where will you meet? (optional)</label>
      <p className="hint">
        Search for the address, then drag the pin if it is not quite right.
        Students browsing see how far it is from them, so they know whether
        this is a five minute walk or thirty.
      </p>

      <div className="search-row">
        <input
          id="location-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onQueryKeyDown}
          placeholder="e.g. 750 S Halsted St, Chicago"
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={runSearch}
          disabled={searching}
        >
          {searching ? "Searching…" : "Search"}
        </button>
      </div>

      {searchError && <p className="hint">{searchError}</p>}

      {results && (
        <ul className="results">
          {results.map((r, i) => (
            <li key={`${r.latitude},${r.longitude},${i}`}>
              <button type="button" onClick={() => choose(r)}>
                {r.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="map-frame">
        <MapContainer
          center={[initialCenter.lat, initialCenter.lng]}
          zoom={initialZoom}
          scrollWheelZoom={false}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
          <ClickToPin onPick={pinInPlace} />
          <MoveTo target={target} />
          {value && (
            <Marker
              position={[value.lat, value.lng]}
              icon={pinIcon}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const { lat, lng } = e.target.getLatLng();
                  pinInPlace({ lat, lng });
                  setChosenLabel("");
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      <div className="map-tools">
        <button type="button" className="btn btn-ghost" onClick={useMyPosition}>
          {status === "loading" ? "Locating…" : "Use my current location"}
        </button>
        {value && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              onChange(null);
              setChosenLabel("");
            }}
          >
            Clear pin
          </button>
        )}
      </div>

      {status === "denied" && (
        <p className="hint">
          Location is off, so search for the address or click the map instead.
        </p>
      )}
      {status === "unavailable" && (
        <p className="hint">
          This browser cannot share a location, so search or click the map.
        </p>
      )}

      {value ? (
        <>
          <p className="hint">
            Pinned at {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
            {chosenLabel ? ` (${chosenLabel})` : ""}. Drag the pin to adjust it.
          </p>
          <label className="check">
            <input
              type="checkbox"
              checked={approximate}
              onChange={(e) => onApproximateChange(e.target.checked)}
            />
            Show only the rough area, not the exact spot
          </label>
          <p className="hint">
            Anyone can browse listings, including people without an account, so
            leave this on if the pin is somewhere you live.
          </p>
        </>
      ) : (
        <p className="hint">No pin yet. A listing without one still posts fine.</p>
      )}
    </div>
  );
}
