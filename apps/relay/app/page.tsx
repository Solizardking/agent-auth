export default function RelayHome() {
  return (
    <main style={{ fontFamily: "monospace", padding: "2rem" }}>
      <h1>Clawd Auth Relay</h1>
      <p>CAAP/1.0 · Clerk + Solana · Phala TEE</p>
      <ul>
        <li><a href="/api/caap/discovery">GET /api/caap/discovery</a></li>
        <li>POST /api/caap/attest</li>
        <li>POST /api/siws/challenge</li>
        <li>POST /api/siws/verify</li>
        <li>GET /api/tee/report</li>
      </ul>
    </main>
  );
}
