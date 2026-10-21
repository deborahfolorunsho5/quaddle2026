import { useRef, useState } from "react";

import { api, mediaUrl } from "../api/client";

/** Change your own profile photo. It uploads as soon as it is picked, so
    Save only has to send its path. */
export default function ProfileEditor({ profile, onSaved, onCancel }) {
  const fileInput = useRef(null);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const pickPhoto = async (file) => {
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const { image_url } = await api.uploadImage(file);
      setAvatarUrl(image_url);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.updateMe({ avatar_url: avatarUrl });
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const busy = uploading || saving;

  return (
    <form className="card-panel profile-editor" onSubmit={save}>
      <h2>Edit profile</h2>
      {error && <div className="error">{error}</div>}

      <div className="field">
        <span className="field-label">Profile photo</span>
        <div className="profile-editor-photo">
          {avatarUrl ? (
            <img className="avatar avatar-lg" src={mediaUrl(avatarUrl)} alt="Your profile photo" />
          ) : (
            <div className="avatar avatar-lg" aria-hidden="true">
              {profile.username.slice(0, 1)}
            </div>
          )}
          <div className="profile-editor-photo-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => fileInput.current?.click()}
              disabled={busy}
            >
              {uploading ? "Uploading…" : avatarUrl ? "Change photo" : "Choose a photo"}
            </button>
            {avatarUrl && (
              <button
                type="button"
                className="btn-danger"
                onClick={() => setAvatarUrl(null)}
                disabled={busy}
              >
                Remove photo
              </button>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              pickPhoto(e.target.files?.[0]);
              // Let the same file be picked again after removing it.
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <div className="booking-actions">
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {saving ? "Saving…" : "Save profile"}
        </button>
        <button className="btn-link" type="button" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}
