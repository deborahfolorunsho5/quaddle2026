import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, Marker, CircleMarker, Popup, useMap } from "react-leaflet";

import { pinIcon, TILE_ATTRIBUTION, TILE_URL } from "../lib/leaflet";
import { distanceMiles, formatDistanceAndWalk, pinOf } from "../lib/geo";

const SINGLE_PIN_ZOOM = 16;

// Callers must hand this a memoised array. A fresh array of identical points
// on every render would re-fit the view continuously and fight the viewer's
// own panning and zooming.
function FitToPins({ points }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], SINGLE_PIN_ZOOM);
      return;
    }
    map.fitBounds(
      points.map((p) => [p.lat, p.lng]),
      { padding: [32, 32] }
    );
  }, [map, points]);

  return null;
}

export default function ListingsMap({ listings, me }) {
  const pinned = useMemo(
    () => listings.map((l) => ({ listing: l, pin: pinOf(l) })).filter((x) => x.pin),
    [listings]
  );

  const points = useMemo(() => {
    const all = pinned.map((x) => x.pin);
    return me ? [...all, me] : all;
  }, [pinned, me]);

  if (pinned.length === 0) {
    return (
      <p className="empty">
        None of these listings has a location pinned yet.
      </p>
    );
  }

  return (
    <div className="map-frame map-frame-tall">
      <MapContainer
        center={[points[0].lat, points[0].lng]}
        zoom={SINGLE_PIN_ZOOM}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        <FitToPins points={points} />

        {me && (
          <CircleMarker
            center={[me.lat, me.lng]}
            radius={7}
            pathOptions={{ color: "#6b3e52", fillColor: "#6b3e52", fillOpacity: 0.8 }}
          >
            <Popup>You are here</Popup>
          </CircleMarker>
        )}

        {pinned.map(({ listing, pin }) => {
          const miles = me ? distanceMiles(me, pin) : null;
          return (
            <Marker key={listing.id} position={[pin.lat, pin.lng]} icon={pinIcon}>
              <Popup>
                <Link to={`/listings/${listing.id}`}>{listing.title}</Link>
                <br />
                ${Number(listing.price).toFixed(2)}
                {miles != null && (
                  <>
                    <br />
                    {formatDistanceAndWalk(miles)}
                  </>
                )}
                {listing.location_is_approximate && (
                  <>
                    <br />
                    <span className="muted">Approximate area</span>
                  </>
                )}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
