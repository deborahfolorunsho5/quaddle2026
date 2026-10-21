import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { api, mediaUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { pinOf } from "../lib/geo";
import LocationPicker from "../components/LocationPicker";
import Photo from "../components/Photo";

// Mirrors MAX_PHOTOS in backend/app/schemas/listing.py, which enforces it.
const MAX_PHOTOS = 6;

// Posting and editing share this form. /listings/new posts; /listings/:id/edit
// loads that listing into it and saves the changes.
export default function ListingFormPage() {
  const { id } = useParams();
  const editing = id != null;
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInput = useRef(null);
  // The pin as the API served it, to tell whether the provider moved it.
  const loadedPin = useRef(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    category: "",
  });
  // Ordered; the first photo is the cover on browse cards.
  const [imageUrls, setImageUrls] = useState([]);
  const [linkDraft, setLinkDraft] = useState("");
  const [pin, setPin] = useState(null);
  const [approximate, setApproximate] = useState(true);
  const [campusCenter, setCampusCenter] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isActive, setIsActive] = useState(true);
  // LocationPicker reads its starting pin once, on mount, so the form waits
  // for the listing rather than mounting empty and filling in later.
  const [loaded, setLoaded] = useState(!editing);

  useEffect(() => {
    if (!editing) return;
    let cancelled = false;
    api
      .getListing(id)
      .then((listing) => {
        if (cancelled) return;
        // The API refuses a stranger's edit anyway; this just says so up front.
        if (listing.owner.id !== user.id) {
          setError("You can only edit your own listings.");
          return;
        }
        const listingPin = pinOf(listing);
        setForm({
          title: listing.title,
          description: listing.description,
          price: String(listing.price),
          category: listing.category ?? "",
        });
        setImageUrls(listing.image_urls);
        setPin(listingPin);
        loadedPin.current = listingPin;
        // A listing with no pin stores false here; a pin added now should
        // still start private, as it does when posting.
        setApproximate(listingPin ? listing.location_is_approximate : true);
        setIsActive(listing.is_active);
        setLoaded(true);
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [editing, id, user.id]);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  // Start the map over the pins this campus already has, so a provider who
  // will not share their location still opens somewhere near their school.
  useEffect(() => {
    if (!user?.university_id) return;
    api
      .getListings({ university_id: user.university_id })
      .then((rows) => {
        const pins = rows.map(pinOf).filter(Boolean);
        if (pins.length === 0) return;
        setCampusCenter({
          lat: pins.reduce((sum, p) => sum + p.lat, 0) / pins.length,
          lng: pins.reduce((sum, p) => sum + p.lng, 0) / pins.length,
        });
      })
      .catch(() => {});
  }, [user?.university_id]);

  const room = MAX_PHOTOS - imageUrls.length;

  // Shared by the file picker, drag-drop, and paste. Uploads one at a time so
  // the photos keep the order they were chosen in.
  const handleFiles = async (files) => {
    // `room` is only recounted after a batch lands, so a second batch dropped
    // mid-upload could overshoot the limit.
    if (uploading) return;
    const images = [...files].filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;
    setError("");
    if (images.length > room) {
      setError(
        room === 0
          ? `A listing can have up to ${MAX_PHOTOS} photos.`
          : `Only ${room} more photo${room > 1 ? "s" : ""} fit, so the rest were skipped.`,
      );
    }
    setUploading(true);
    try {
      for (const file of images.slice(0, room)) {
        const { image_url } = await api.uploadImage(file);
        setImageUrls((urls) => [...urls, image_url]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  // Paste images straight from the clipboard (Cmd/Ctrl+V).
  const onPaste = (e) => {
    const files = [...e.clipboardData.items]
      .filter((i) => i.type.startsWith("image/"))
      .map((i) => i.getAsFile());
    handleFiles(files);
  };

  const onDrop = (e) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files ?? []);
  };

  const addLink = () => {
    const url = linkDraft.trim();
    if (!url || room === 0) return;
    setImageUrls((urls) => [...urls, url]);
    setLinkDraft("");
  };

  const removePhoto = (index) =>
    setImageUrls((urls) => urls.filter((_, i) => i !== index));

  const makeCover = (index) =>
    setImageUrls((urls) => [urls[index], ...urls.filter((_, i) => i !== index)]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const fields = {
      title: form.title,
      description: form.description,
      price: Number(form.price),
      category: form.category || null,
      image_urls: imageUrls,
      // Meaningless without a pin, so do not claim it.
      location_is_approximate: pin ? approximate : false,
    };
    try {
      if (editing) {
        // A rough-area listing is served with a rounded pin. Sending that
        // back untouched would overwrite the exact spot in the database, so
        // coordinates go only when the provider actually moved or removed it.
        if (pin !== loadedPin.current) {
          fields.latitude = pin?.lat ?? null;
          fields.longitude = pin?.lng ?? null;
        }
        await api.updateListing(id, { ...fields, is_active: isActive });
        navigate(`/listings/${id}`);
      } else {
        const created = await api.createListing({
          ...fields,
          latitude: pin?.lat ?? null,
          longitude: pin?.lng ?? null,
        });
        navigate(`/listings/${created.id}`);
      }
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  if (!loaded) {
    return error ? (
      <div className="error">{error}</div>
    ) : (
      <p className="muted">Loading…</p>
    );
  }

  return (
    <div className="page-form">
      <div className="page-head">
        <p className="eyebrow">{editing ? "Your listing" : "New listing"}</p>
        <h1>{editing ? "Edit listing" : "Post a listing"}</h1>
        <p className="page-sub">
          Say what you offer, what it costs, and roughly where you would meet.
        </p>
      </div>

      <form className="card-panel" onSubmit={onSubmit}>
        {error && <div className="error">{error}</div>}

        <div className="form-grid">
          <div className="form-col">
            <div className="field">
              <label>Title</label>
              <input
                value={form.title}
                onChange={set("title")}
                required
                minLength={3}
              />
            </div>
            <div className="field">
              <label>Description</label>
              <textarea
                rows={4}
                value={form.description}
                onChange={set("description")}
                required
              />
            </div>
            <div className="field">
              <label>Price ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={set("price")}
                required
              />
            </div>
            <div className="field">
              <label>Category (optional)</label>
              <input
                value={form.category}
                onChange={set("category")}
                placeholder="e.g. tutoring, hair, photography"
              />
            </div>
          </div>

          <div className="form-col">
            <div className="field">
              <label>
                Photos (optional, up to {MAX_PHOTOS})
              </label>
              {room > 0 && (
                <>
                  <div
                    className="dropzone"
                    tabIndex={0}
                    onClick={() => fileInput.current?.click()}
                    onPaste={onPaste}
                    onDrop={onDrop}
                    onDragOver={(e) => e.preventDefault()}
                  >
                    {uploading
                      ? "Uploading…"
                      : "Click to choose photos, drag them in, or paste (Cmd/Ctrl+V)"}
                  </div>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={(e) => {
                      handleFiles(e.target.files ?? []);
                      // Let the same file be chosen again after removing it.
                      e.target.value = "";
                    }}
                  />
                  <div className="link-row">
                    <input
                      value={linkDraft}
                      onChange={(e) => setLinkDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addLink();
                        }
                      }}
                      placeholder="…or paste an image link"
                    />
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={addLink}
                      disabled={!linkDraft.trim()}
                    >
                      Add
                    </button>
                  </div>
                </>
              )}
              {imageUrls.length > 0 && (
                <ul className="photo-grid">
                  {imageUrls.map((url, index) => (
                    <li key={`${url}-${index}`} className="photo-tile">
                      <Photo src={mediaUrl(url)} alt={`Photo ${index + 1}`} />
                      {index === 0 ? (
                        <span className="photo-cover">Cover</span>
                      ) : (
                        <button
                          type="button"
                          className="photo-action photo-make-cover"
                          onClick={() => makeCover(index)}
                        >
                          Make cover
                        </button>
                      )}
                      <button
                        type="button"
                        className="photo-action photo-remove"
                        onClick={() => removePhoto(index)}
                        aria-label={`Remove photo ${index + 1}`}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="form-span">
            <LocationPicker
              value={pin}
              onChange={setPin}
              approximate={approximate}
              onApproximateChange={setApproximate}
              campusCenter={campusCenter}
            />
          </div>

          {editing && (
            <div className="form-span">
              <label className="check">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                Show this listing in browse and search
              </label>
              <p className="hint">
                Turn this off to take a break without deleting it. It stays on
                your profile, visible only to you.
              </p>
            </div>
          )}

          <div className="form-span form-actions">
            <button
              className="btn btn-primary btn-block"
              disabled={submitting || uploading}
            >
              {editing
                ? submitting
                  ? "Saving…"
                  : "Save changes"
                : submitting
                  ? "Posting…"
                  : "Post listing"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
