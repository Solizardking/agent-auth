import type { ReactNode } from "react";

export const metadata = {
  title: "Clawd Auth Relay",
  description: "CAAP/1.0 confidential compute relay — Clerk + Solana onchain attestation",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
