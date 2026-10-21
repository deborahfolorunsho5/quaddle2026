import { useRef, useState } from "react";

import { mediaUrl } from "../api/client";
import Photo from "./Photo";

// A listing's photos as a swipeable strip. Scroll snapping gives phones a
// native swipe for free; the arrows are for a mouse, which cannot swipe.
export default function PhotoGallery({ urls, title }) {
  const strip = useRef(null);
  const [index, setIndex] = useState(0);

  if (urls.length === 0) return null;

  const go = (step) => {
    const el = strip.current;
    el.scrollTo({ left: (index + step) * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="gallery">
      <div
        className="gallery-strip"
        ref={strip}
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {urls.map((url, i) => (
          <Photo
            key={`${url}-${i}`}
            className="gallery-slide"
            src={mediaUrl(url)}
            alt={urls.length > 1 ? `${title}, photo ${i + 1}` : title}
          />
        ))}
      </div>
      {urls.length > 1 && (
        <>
          {index > 0 && (
            <button
              type="button"
              className="gallery-arrow prev"
              onClick={() => go(-1)}
              aria-label="Previous photo"
            >
              ‹
            </button>
          )}
          {index < urls.length - 1 && (
            <button
              type="button"
              className="gallery-arrow next"
              onClick={() => go(1)}
              aria-label="Next photo"
            >
              ›
            </button>
          )}
          <span className="gallery-count">
            {index + 1} / {urls.length}
          </span>
        </>
      )}
    </div>
  );
}
