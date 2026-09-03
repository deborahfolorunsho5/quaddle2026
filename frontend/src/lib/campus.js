import { useEffect, useState } from "react";

import { api } from "../api/client";

// Quad is open to one campus at a time and the API decides which, so the
// campus name is never written into the markup. The nav, browse, and sign-up
// all want it, hence one shared request instead of three identical ones.
let resolved = null;
let inFlight;

export function useCampus() {
  const [campus, setCampus] = useState(resolved);

  useEffect(() => {
    if (resolved) return;
    inFlight ??= api.getUniversities().then((rows) => rows[0] ?? null);

    let alive = true;
    inFlight
      .then((row) => {
        resolved = row;
        if (alive) setCampus(row);
      })
      .catch(() => {
        // Let the next mount try again rather than caching the failure.
        inFlight = undefined;
      });

    return () => {
      alive = false;
    };
  }, []);

  return campus;
}
