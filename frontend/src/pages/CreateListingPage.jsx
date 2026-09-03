import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api, mediaUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { pinOf } from "../lib/geo";
import LocationPicker from "../components/LocationPicker";

export default function CreateListingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInput = useRef(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    category: "",
  });
  const [imageUrl, setImageUrl] = useState("");
  const [pin, setPin] = useState(null);
  const [approximate, setApproximate] = useState(true);
  const [campusCenter, setCampusCenter] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  // Shared by the file picker, drag-drop, and paste.
  const handleFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setError("");
    setUploading(true);
    try {
      const { image_url } = await api.uploadImage(file);
      setImageUrl(image_url);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  // Paste an image straight from the clipboard (Cmd/Ctrl+V).
  const onPaste = (e) => {
    const item = [...e.clipboardData.items].find((i) =>
      i.type.startsWith("image/"),
    );
    if (item) handleFile(item.getAsFile());
  };

  const onDrop = (e) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files?.[0]);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const created = await api.createListing({
        title: form.title,
        description: form.description,
        price: Number(form.price),
        category: form.category || null,
        image_url: imageUrl || null,
        latitude: pin?.lat ?? null,
        longitude: pin?.lng ?? null,
        // Meaningless without a pin, so do not claim it.
        location_is_approximate: pin ? approximate : false,
      });
      navigate(`/listings/${created.id}`);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const preview = mediaUrl(imageUrl);

  return (
    <div className="page-form">
      <div className="page-head">
        <p className="eyebrow">New listing</p>
        <h1>Post a listing</h1>
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
              <label>Photo (optional)</label>
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
                  : "Click to choose a file, drag one in, or paste an image (Cmd/Ctrl+V)"}
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <input
                style={{ marginTop: "0.5rem" }}
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="…or paste an image link"
              />
              {preview && (
                <img className="preview" src={preview} alt="preview" />
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

          <div className="form-span form-actions">
            <button
              className="btn btn-primary btn-block"
              disabled={submitting || uploading}
            >
              {submitting ? "Posting…" : "Post listing"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
