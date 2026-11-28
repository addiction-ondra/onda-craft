/** Kulaté vlajky pro výběr jazyka (vlastní kresba v SVG). */
export function FlagCZ() {
  return (
    <svg viewBox="0 0 60 60" aria-hidden>
      <defs>
        <clipPath id="flag-cz-clip">
          <circle cx="30" cy="30" r="30" />
        </clipPath>
      </defs>
      <g clipPath="url(#flag-cz-clip)">
        <rect width="60" height="30" fill="#ffffff" />
        <rect y="30" width="60" height="30" fill="#d7141a" />
        <path d="M0 0 L30 30 L0 60 Z" fill="#11457e" />
      </g>
    </svg>
  );
}

export function FlagUK() {
  return (
    <svg viewBox="0 0 60 60" aria-hidden>
      <defs>
        <clipPath id="flag-uk-clip">
          <circle cx="30" cy="30" r="30" />
        </clipPath>
      </defs>
      <g clipPath="url(#flag-uk-clip)">
        <rect width="60" height="60" fill="#012169" />
        <path d="M0 0 L60 60 M60 0 L0 60" stroke="#ffffff" strokeWidth="12" />
        <path d="M0 0 L60 60 M60 0 L0 60" stroke="#c8102e" strokeWidth="4" />
        <path d="M30 0 V60 M0 30 H60" stroke="#ffffff" strokeWidth="18" />
        <path d="M30 0 V60 M0 30 H60" stroke="#c8102e" strokeWidth="10" />
      </g>
    </svg>
  );
}
