import { useEffect, useState } from "react";
import { getHealth } from "./api/client";

export default function App() {
  const [status, setStatus] = useState("checking…");

  useEffect(() => {
    getHealth()
      .then((data) => setStatus(`connected to ${data.service}`))
      .catch(() => setStatus("backend not reachable"));
  }, []);

  return (
    <main style={{ fontFamily: "system-ui", padding: "3rem", textAlign: "center" }}>
      <h1>Quaddle</h1>
      <p>A campus marketplace for student businesses.</p>
      <p>
        Backend status: <strong>{status}</strong>
      </p>
    </main>
  );
}
