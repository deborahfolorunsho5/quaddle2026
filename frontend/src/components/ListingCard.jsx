import { Link } from "react-router-dom";

import { mediaUrl } from "../api/client";
import { formatMiles, formatWalk } from "../lib/geo";

// Compact "4.8 ★ (12)" for a card. An unrated provider says so plainly
// rather than showing zero stars, which would read as a bad rating.
function CardRating({ owner }) {
  if (!owner.rating_count) {
    return <span className="card-rating new">New</span>;
  }
  const count = owner.rating_count;
  return (
    <span
      className="card-rating"
      title={`${owner.rating_average} out of 5 from ${count} review${count > 1 ? "s" : ""}`}
    >
      {owner.rating_average.toFixed(1)} ★ ({count})
    </span>
  );
}

export default function ListingCard({ listing, miles }) {
  const img = mediaUrl(listing.image_urls[0]);
  return (
    <Link to={`/listings/${listing.id}`} className="card">
      {img ? (
        <img className="card-img" src={img} alt={listing.title} />
      ) : (
        <div className="card-img placeholder">No photo</div>
      )}
      <div className="card-body">
        {listing.category && <p className="eyebrow">{listing.category}</p>}
        {/* Only an owner is ever sent their inactive listings. */}
        {!listing.is_active && <p className="card-hidden">Hidden from browse</p>}
        <p className="card-title">{listing.title}</p>
        <p className="card-desc">{listing.description}</p>
        {miles != null && (
          <p className="card-walk">
            {formatMiles(miles)} away · {formatWalk(miles)}
          </p>
        )}
        <div className="card-foot">
          <span className="price">${Number(listing.price).toFixed(2)}</span>
          {listing.owner && (
            <span className="card-by">
              @{listing.owner.username}
              <CardRating owner={listing.owner} />
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
