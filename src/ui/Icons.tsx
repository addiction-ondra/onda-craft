import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({
  viewBox: '0 0 48 48',
  width: '100%',
  height: '100%',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...p,
});

export const IconBuild = (p: P) => (
  <svg {...base(p)}>
    <path d="M24 6 40 14v18L24 40 8 32V14Z" fill="#ffd8a8" stroke="#8a5a2b" />
    <path d="M8 14l16 8 16-8M24 22v18" stroke="#8a5a2b" />
    <circle cx="38" cy="38" r="9" fill="#40c057" stroke="#fff" strokeWidth="3" />
    <path d="M38 33v10M33 38h10" stroke="#fff" strokeWidth="3.5" />
  </svg>
);

export const IconErase = (p: P) => (
  <svg {...base(p)}>
    <path d="M10 30 26 12a4 4 0 0 1 6 0l6 6a4 4 0 0 1 0 6L22 40H14l-4-4a4 4 0 0 1 0-6Z" fill="#ffc9de" stroke="#c2255c" />
    <path d="M18 22l12 12" stroke="#c2255c" />
    <path d="M22 40h18" stroke="#c2255c" />
  </svg>
);

export const IconRotateLeft = (p: P) => (
  <svg {...base(p)}>
    <path d="M14 18a14 14 0 1 1-2 14" />
    <path d="M8 10v10h10" />
  </svg>
);

export const IconRotateRight = (p: P) => (
  <svg {...base(p)}>
    <path d="M34 18a14 14 0 1 0 2 14" />
    <path d="M40 10v10H30" />
  </svg>
);

export const IconPlus = (p: P) => (
  <svg {...base(p)}>
    <circle cx="21" cy="21" r="12" />
    <path d="M30 30l10 10M21 15v12M15 21h12" />
  </svg>
);

export const IconMinus = (p: P) => (
  <svg {...base(p)}>
    <circle cx="21" cy="21" r="12" />
    <path d="M30 30l10 10M15 21h12" />
  </svg>
);

export const IconGear = (p: P) => (
  <svg {...base(p)} strokeWidth={3}>
    <circle cx="24" cy="24" r="6" />
    <path d="M24 6v6M24 36v6M6 24h6M36 24h6M11 11l4 4M33 33l4 4M37 11l-4 4M15 33l-4 4" />
  </svg>
);

export const IconSpeaker = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 18h8l10-8v28l-10-8H8Z" fill="currentColor" />
    <path d="M32 17a9 9 0 0 1 0 14M36 12a15 15 0 0 1 0 24" />
  </svg>
);

export const IconClose = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 12l24 24M36 12 12 36" />
  </svg>
);

export const IconPlay = (p: P) => (
  <svg {...base(p)} stroke="none">
    <path d="M16 9v30l24-15Z" fill="currentColor" />
  </svg>
);

export const IconStar = ({ filled = true, ...p }: P & { filled?: boolean }) => (
  <svg {...base(p)} strokeWidth={3}>
    <path
      d="M24 5l5.6 12 13 1.4-9.8 8.8 2.8 12.8L24 33.4 12.4 40l2.8-12.8L5.4 18.4l13-1.4Z"
      fill={filled ? '#ffd43b' : 'rgba(255,255,255,0.4)'}
      stroke={filled ? '#e67700' : '#adb5bd'}
    />
  </svg>
);

export const IconFlag = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 42V6" stroke="#5c3d1e" />
    <path d="M12 8h24l-6 8 6 8H12" fill="#ff6b6b" stroke="#c92a2a" />
  </svg>
);

export const IconHint = (p: P) => (
  <svg {...base(p)} strokeWidth={3}>
    <path d="M24 6a12 12 0 0 0-7 21.8V32h14v-4.2A12 12 0 0 0 24 6Z" fill="#fff3bf" stroke="#e67700" />
    <path d="M18 38h12M20 43h8" stroke="#e67700" />
  </svg>
);

export const IconBridge = (p: P) => (
  <svg {...base(p)} strokeWidth={3}>
    <rect x="2" y="30" width="44" height="14" rx="2" fill="#4dabf7" stroke="none" />
    <path d="M6 34c4-3 8 3 12 0s8 3 12 0 8 3 12 0" stroke="#d0ebff" />
    <rect x="4" y="20" width="10" height="10" fill="#c98a4b" stroke="#6b4423" />
    <rect x="14" y="20" width="10" height="10" fill="#c98a4b" stroke="#6b4423" />
    <rect x="24" y="20" width="10" height="10" fill="#c98a4b" stroke="#6b4423" />
    <rect x="34" y="20" width="10" height="10" fill="#c98a4b" stroke="#6b4423" />
  </svg>
);

export const IconSearch = (p: P) => (
  <svg {...base(p)}>
    <circle cx="20" cy="20" r="11" fill="rgba(255,255,255,0.6)" />
    <path d="M28 28l12 12" strokeWidth={6} />
  </svg>
);
