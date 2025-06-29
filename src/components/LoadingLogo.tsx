import React, { useEffect, useState } from 'react';

// Colors from theme
const MAIN = 'var(--color-main)';
const HIGHLIGHT = 'var(--color-highlight)';
const ACCENT = 'var(--color-accent)';
const HOVER = 'var(--color-hover)';
const ACCENT_DARK = '#b07c6b'; // darker version of accent

// Node positions for the logo
const nodes = [
  { cx: 110, cy: 40 },   // top
  { cx: 190, cy: 180 }, // bottom right
  { cx: 30, cy: 180 },  // bottom left
];

export default function LoadingLogo() {
  // 0: top, 1: bottom right, 2: bottom left
  const [active, setActive] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActive((prev) => (prev + 1) % 3);
    }, 600);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0,0,0,0.45)', // darken
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'all',
    }}>
      <svg viewBox="0 0 220 220" width={220} height={220} fill="none" xmlns="http://www.w3.org/2000/svg">
        <polygon points="110,40 190,180 30,180" fill={HIGHLIGHT} stroke={HOVER} strokeWidth={4} />
        {nodes.map((node, i) => (
          <circle
            key={i}
            cx={node.cx}
            cy={node.cy}
            r={28}
            fill={active === i ? ACCENT_DARK : ACCENT}
            style={{ transition: 'fill 0.2s' }}
          />
        ))}
      </svg>
    </div>
  );
} 