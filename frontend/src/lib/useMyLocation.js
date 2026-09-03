import { useCallback, useEffect, useState } from "react";

// Reads the viewer's position so distances can be measured from where they
// actually are. Deliberately does not ask on mount: an unprompted permission
// dialog on page load is hostile, and browsers penalise it. The viewer clicks,
// or we read a grant they already gave this origin.
export function useMyLocation() {
  const [position, setPosition] = useState(null);
  // idle | loading | ready | denied | unavailable
  const [status, setStatus] = useState("idle");

  const request = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus("unavailable");
      return;
    }
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus("ready");
      },
      () => {
        setPosition(null);
        setStatus("denied");
      },
      // Campus distances do not need GPS precision, and the cheap fix keeps
      // the battery and the wait down. A minute-old position is fine.
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  // If the viewer already granted location for this origin, read it without
  // making them click again on every page. Safari has no Permissions API for
  // geolocation, so this is best-effort and the button remains the fallback.
  useEffect(() => {
    let cancelled = false;
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((result) => {
        if (!cancelled && result.state === "granted") request();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [request]);

  return { position, status, request };
}
