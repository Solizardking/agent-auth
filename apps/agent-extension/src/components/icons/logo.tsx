import type { SVGProps } from "react";

export function BetterAuthLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      width="60"
      height="45"
      viewBox="0 0 60 45"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Clawd — Solana-native agent auth */}
      <circle cx="22" cy="22" r="18" className="fill-[#9945FF]" opacity="0.15" />
      <circle cx="22" cy="22" r="18" stroke="#9945FF" strokeWidth="2" fill="none" />
      <path
        d="M14 26 L18 18 L22 24 L26 16 L30 26"
        stroke="#14F195"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="22" cy="22" r="3" className="fill-[#14F195]" />
    </svg>
  );
}

export function ClawdLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="32" height="32" rx="8" fill="#9945FF" fillOpacity="0.12" />
      <path
        d="M8 22 L12 14 L16 20 L20 12 L24 22"
        stroke="#9945FF"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="16" cy="16" r="2.5" fill="#14F195" />
    </svg>
  );
}
