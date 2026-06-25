// Central API client for the Quaddle backend.
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const TOKEN_KEY = "quaddle_token";
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) =>
  t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);

// Turn a relative "/media/..." path from the API into a full URL for <img>.
export const mediaUrl = (path) =>
  !path ? null : path.startsWith("http") ? path : `${API_URL}${path}`;

async function request(path, { method = "GET", body, form, headers = {} } = {}) {
  const opts = { method, headers: { ...headers } };
  const token = getToken();
  if (token) opts.headers["Authorization"] = `Bearer ${token}`;

  if (form) {
    opts.body = form; // URLSearchParams or FormData — browser sets the type
  } else if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_URL}${path}`, opts);
  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data?.detail;
    throw new Error(
      typeof detail === "string" ? detail : `Request failed (${res.status})`
    );
  }
  return data;
}

export const api = {
  // --- auth ---
  register: (data) => request("/auth/register", { method: "POST", body: data }),
  login: (username, password) =>
    request("/auth/login", {
      method: "POST",
      form: new URLSearchParams({ username, password }),
    }),
  getMe: () => request("/users/me"),

  // --- universities ---
  getUniversities: () => request("/universities"),

  // --- listings ---
  getListings: (params = {}) => {
    const entries = Object.entries(params).filter(
      ([, v]) => v != null && v !== ""
    );
    const qs = new URLSearchParams(entries).toString();
    return request(`/listings${qs ? `?${qs}` : ""}`);
  },
  getListing: (id) => request(`/listings/${id}`),
  createListing: (data) => request("/listings", { method: "POST", body: data }),
  updateListing: (id, data) =>
    request(`/listings/${id}`, { method: "PATCH", body: data }),
  deleteListing: (id) => request(`/listings/${id}`, { method: "DELETE" }),

  // --- uploads ---
  uploadImage: (file) => {
    const form = new FormData();
    form.append("file", file);
    return request("/uploads/image", { method: "POST", form });
  },
};