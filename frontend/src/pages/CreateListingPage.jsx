import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api, mediaUrl } from "../api/client";

export default function CreateListingPage() {
  const navigate = useNavigate();
  const fileInput = useRef(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    category: "",
  });
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

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
      i.type.startsWith("image/")
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
      });
      navigate(`/listings/${created.id}`);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const preview = mediaUrl(imageUrl);

  return (
    <div className="page-narrow">
      <h1>Post a listing</h1>
      <form className="card-panel" onSubmit={onSubmit}>
        {error && <div className="error">{error}</div>}

        <div className="field">
          <label>Title</label>
          <input value={form.title} onChange={set("title")} required minLength={3} />
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
          {preview && <img className="preview" src={preview} alt="preview" />}
        </div>

        <button
          className="btn btn-primary btn-block"
          disabled={submitting || uploading}
        >
          {submitting ? "Posting…" : "Post listing"}
        </button>
      </form>
    </div>
  );
}