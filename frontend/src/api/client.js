// Central place for talking to the backend API.
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

// Pings the backend's /health endpoint.
export const getHealth = () => apiFetch("/health");