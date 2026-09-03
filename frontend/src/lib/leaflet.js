import L from "leaflet";
import "leaflet/dist/leaflet.css";

// A teardrop pin in rose. Inline SVG rather than an image file so it picks
// up the palette tokens and needs no asset request, and because Leaflet builds
// its default icon URLs from its own script path, which a bundler breaks.
// Every Marker in the app passes this, so that default never loads.
const PIN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="26" height="39">
  <path d="M12 0.8C5.9 0.8 0.9 5.8 0.9 11.9c0 7.8 11.1 23.3 11.1 23.3S23.1 19.7 23.1 11.9C23.1 5.8 18.1 0.8 12 0.8z"
        fill="var(--q-rose, #e27ba0)" stroke="#c55c82" stroke-width="1.4"/>
  <circle cx="12" cy="11.9" r="4.2" fill="var(--q-white, #ffffff)"/>
</svg>`;

// The anchor sits at the very tip of the teardrop, so the point of the pin is
// the coordinate rather than the middle of the artwork.
export const pinIcon = L.divIcon({
  className: "map-pin",
  html: PIN_SVG,
  iconSize: [26, 39],
  iconAnchor: [13, 39],
  popupAnchor: [0, -34],
});

// OpenStreetMap's public tiles need no key, but their policy does require
// attribution, so every map in the app renders through these two constants.
export const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export default L;
