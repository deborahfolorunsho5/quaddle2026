/**
 * A listing photo shown whole, whatever its shape, inside a box whose size the
 * caller sets with `className`. Students post square, tall and wide photos, and
 * cropping them to one shape cut off whatever was near the edges. The space the
 * photo does not cover is filled with a blurred copy of itself rather than a
 * flat color, so the box always looks full.
 *
 * The backdrop is a second <img> of the same file (the browser fetches it
 * once) instead of a CSS background, so a user-supplied URL is never written
 * into a style string.
 */
export default function Photo({ src, alt = "", className = "", lazy = true }) {
  const loading = lazy ? "lazy" : undefined;
  return (
    <span className={`photo ${className}`}>
      <img className="photo-backdrop" src={src} alt="" aria-hidden="true" loading={loading} />
      <img className="photo-main" src={src} alt={alt} loading={loading} />
    </span>
  );
}
