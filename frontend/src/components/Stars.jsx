// Read-only star display for a rating value (e.g. 4.5).
export function Stars({ value }) {
  if (value == null) return <span className="muted">No ratings yet</span>;
  const rounded = Math.round(value);
  return (
    <span className="stars" title={`${value} out of 5`}>
      {"★".repeat(rounded)}
      {"☆".repeat(5 - rounded)}
    </span>
  );
}

// Clickable 1–5 star input.
export function StarInput({ value, onChange }) {
  return (
    <span className="stars stars-input">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          type="button"
          key={n}
          className={n <= value ? "on" : "off"}
          onClick={() => onChange(n)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          {n <= value ? "★" : "☆"}
        </button>
      ))}
    </span>
  );
}