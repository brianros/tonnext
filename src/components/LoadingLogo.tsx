import React, { useEffect, useRef, useState } from 'react';

// Colors from theme
// const MAIN = 'var(--color-main)';
const HOVER = 'var(--color-hover)';
// const ACCENT = 'var(--color-accent)';
const ACCENT_DARK = '#b07c6b'; // comet head
const ACCENT_LIGHT = '#e7cfc2'; // trail

// Smaller node positions for the logo
const nodes = [
  { cx: 60, cy: 22 },   // top
  { cx: 104, cy: 98 }, // bottom right
  { cx: 16, cy: 98 },  // bottom left
];

const BAR_SEGMENTS = 40; // for smooth gradient
const TRAIL_LENGTH = 1.2; // how long the trail is (in node units)
const LOOP_DURATION = 1.2; // seconds per full loop (faster)

function lerpColor(a: string, b: string, t: number) {
  // a, b: hex or rgb strings
  // t: 0..1
  function hexToRgb(hex: string) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
    const num = parseInt(hex, 16);
    return [num >> 16, (num >> 8) & 255, num & 255];
  }
  function parseColor(str: string) {
    if (str.startsWith('var(')) {
      // fallback to accent
      return hexToRgb('#D7A798');
    }
    if (str.startsWith('#')) return hexToRgb(str);
    if (str.startsWith('rgb')) return str.match(/\d+/g)!.map(Number);
    return hexToRgb(str);
  }
  const ca = parseColor(a), cb = parseColor(b);
  return `rgb(${Math.round(ca[0] + (cb[0] - ca[0]) * t)},${Math.round(ca[1] + (cb[1] - ca[1]) * t)},${Math.round(ca[2] + (cb[2] - ca[2]) * t)})`;
}

// Add this above the component:
const slowSpinStyle: React.CSSProperties = {
  animation: 'loading-logo-spin 16s linear infinite',
};

export default function LoadingLogo({ spin = false, onFinish }: { spin?: boolean; onFinish?: () => void } = {}) {
  // Comet progress: 0..3 (0=head at node 0, 1=head at node 1, 2=head at node 2, 3=wraps to 0)
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(true);
  const requestRef = useRef<number | null>(null);
  const spinTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTimestamp = useRef<number | null>(null);
  const [fadeOut, setFadeOut] = useState(false);
  const [rotation, setRotation] = useState(0); // degrees
  const fadeOutRef = useRef(false);

  // Animate comet progress and rotation
  useEffect(() => {
    if (spin) return;
    let running = true;
    function animate(ts: number) {
      if (!running) return;
      if (lastTimestamp.current == null) lastTimestamp.current = ts;
      const dt = (ts - lastTimestamp.current) / 1000;
      lastTimestamp.current = ts;
      // 1.2 seconds per full loop (faster)
      setProgress(prev => (prev + dt * (3 / LOOP_DURATION)) % 3);
      // For slow spin: 16s per 360deg
      setRotation(prev => (prev + (dt * 360) / 16) % 360);
      requestRef.current = requestAnimationFrame(animate);
    }
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      running = false;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      lastTimestamp.current = null;
    };
  }, [spin]);

  // When spin becomes true, trigger spin animation, then fade out and call onFinish
  useEffect(() => {
    if (spin) {
      setFadeOut(true);
      fadeOutRef.current = true;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      spinTimeoutRef.current = setTimeout(() => {
        setVisible(false);
        if (onFinish) onFinish();
      }, 2000); // match spin duration (2s)
    } else {
      setFadeOut(false);
      fadeOutRef.current = false;
    }
    return () => {
      if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);
    };
  }, [spin, onFinish]);

  // For fadeOut, animate from current rotation to 540deg over 2s
  const [fadeOutTransform, setFadeOutTransform] = useState<string | null>(null);
  useEffect(() => {
    if (fadeOut) {
      // Start at current rotation
      setFadeOutTransform(`scale(1) rotate(${rotation}deg)`);
      // Next tick, animate to final
      setTimeout(() => {
        setFadeOutTransform('scale(0.5) rotate(540deg)');
      }, 20);
    } else {
      setFadeOutTransform(null);
    }
  }, [fadeOut, rotation]);

  // Determine which bar the comet is on
  const barIndex = Math.floor(progress) % 3;
  const nextNode = (barIndex + 1) % 3;
  const cometT = progress - barIndex; // 0..1 along the active bar

  // Node color based on comet position
  function getNodeColor(idx: number) {
    // If this is the start or end node of the active bar, use cometT
    if (idx === barIndex) {
      // Start node: highlight based on cometT
      if (cometT < TRAIL_LENGTH) {
        const t = cometT / TRAIL_LENGTH;
        return lerpColor(ACCENT_DARK, ACCENT_LIGHT, t);
      }
      return ACCENT_LIGHT;
    } else if (idx === nextNode) {
      // End node: highlight based on (1 - cometT)
      if (1 - cometT < TRAIL_LENGTH) {
        const t = (1 - cometT) / TRAIL_LENGTH;
        return lerpColor(ACCENT_DARK, ACCENT_LIGHT, t);
      }
      return ACCENT_LIGHT;
    } else {
      // Other node: fade out as before
      let d = (idx - progress + 3) % 3;
      if (d > 1.5) d = 3 - d; // wrap for shortest path
      if (d < TRAIL_LENGTH) {
        const t = d / TRAIL_LENGTH;
        return lerpColor(ACCENT_DARK, ACCENT_LIGHT, t);
      }
      return ACCENT_LIGHT;
    }
  }

  // Only the active bar gets a gradient trail
  function getBarGradient(i: number, j: number, gradId: string, active: boolean, cometT: number) {
    if (!active) {
      // Inactive bar: solid base color
      return (
        <linearGradient id={gradId} gradientUnits="userSpaceOnUse"
          x1={nodes[i].cx} y1={nodes[i].cy} x2={nodes[j].cx} y2={nodes[j].cy}>
          <stop offset="0%" stopColor={ACCENT_LIGHT} />
          <stop offset="100%" stopColor={ACCENT_LIGHT} />
        </linearGradient>
      );
    }
    // Active bar: gradient from comet head to trail to base
    // cometT: 0 (at i) to 1 (at j)
    const stops = [];
    for (let s = 0; s <= BAR_SEGMENTS; ++s) {
      const t = s / BAR_SEGMENTS;
      let color;
      if (t > cometT) {
        color = ACCENT_LIGHT;
      } else {
        const trailPos = (cometT - t) / TRAIL_LENGTH;
        color = lerpColor(ACCENT_DARK, ACCENT_LIGHT, Math.min(Math.max(trailPos, 0), 1));
      }
      stops.push(
        <stop key={s} offset={`${t * 100}%`} stopColor={color} />
      );
    }
    return (
      <linearGradient id={gradId} gradientUnits="userSpaceOnUse"
        x1={nodes[i].cx} y1={nodes[i].cy} x2={nodes[j].cx} y2={nodes[j].cy}>
        {stops}
      </linearGradient>
    );
  }

  return visible ? (
    <>
      <style>{`
        @keyframes loading-logo-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <div
        className="loading-logo__overlay"
        style={{
          opacity: fadeOut ? 0 : 1,
        }}
      >
        <svg
          viewBox="0 0 120 120"
          className="loading-logo__svg"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            ...(fadeOut
              ? {
                  transition: 'transform 2s cubic-bezier(0.4,2,0.4,1), opacity 1s',
                  transform: fadeOutTransform || `scale(1) rotate(${rotation}deg)`,
                  opacity: 0.2,
                  transformOrigin: '60px 70px',
                }
              : {
                  ...slowSpinStyle,
                  transition: 'transform 1s cubic-bezier(0.4,2,0.4,1), opacity 1s',
                  transform: `scale(1) rotate(${rotation}deg)`,
                  opacity: 1,
                  transformOrigin: '60px 70px',
                }),
          }}
        >
          <defs>
            {getBarGradient(0, 1, 'grad01', barIndex === 0, barIndex === 0 ? cometT : 0)}
            {getBarGradient(1, 2, 'grad12', barIndex === 1, barIndex === 1 ? cometT : 0)}
            {getBarGradient(2, 0, 'grad20', barIndex === 2, barIndex === 2 ? cometT : 0)}
          </defs>
          <polygon points="60,22 104,98 16,98" fill="transparent" stroke={HOVER} strokeWidth={4} />
          {/* Bars with comet trail gradient */}
          <line x1={nodes[0].cx} y1={nodes[0].cy} x2={nodes[1].cx} y2={nodes[1].cy} stroke="url(#grad01)" strokeWidth={6} strokeLinecap="round" />
          <line x1={nodes[1].cx} y1={nodes[1].cy} x2={nodes[2].cx} y2={nodes[2].cy} stroke="url(#grad12)" strokeWidth={6} strokeLinecap="round" />
          <line x1={nodes[2].cx} y1={nodes[2].cy} x2={nodes[0].cx} y2={nodes[0].cy} stroke="url(#grad20)" strokeWidth={6} strokeLinecap="round" />
          {/* Nodes */}
          {nodes.map((node, i) => (
            <circle
              key={i}
              cx={node.cx}
              cy={node.cy}
              r={15}
              fill={getNodeColor(i)}
              className="loading-logo__node"
            />
          ))}
        </svg>
      </div>
    </>
  ) : null;
} 