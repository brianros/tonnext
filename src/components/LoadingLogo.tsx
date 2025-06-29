import React, { useEffect, useRef, useState } from 'react';

// Colors from theme
// const MAIN = 'var(--color-main)';
const HIGHLIGHT = 'var(--color-highlight)';
// const ACCENT = 'var(--color-accent)';
const HOVER = 'var(--color-hover)';
const ACCENT_DARK = '#b07c6b'; // comet head
const ACCENT_LIGHT = '#e7cfc2'; // trail

// Node positions for the logo
const nodes = [
  { cx: 110, cy: 40 },   // top
  { cx: 190, cy: 180 }, // bottom right
  { cx: 30, cy: 180 },  // bottom left
];

const BAR_SEGMENTS = 40; // for smooth gradient
const TRAIL_LENGTH = 1.2; // how long the trail is (in node units)
const LOOP_DURATION = 2.0; // seconds per full loop

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

export default function LoadingLogo({ spin = false, onFinish }: { spin?: boolean; onFinish?: () => void } = {}) {
  // Comet progress: 0..3 (0=head at node 0, 1=head at node 1, 2=head at node 2, 3=wraps to 0)
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(true);
  const requestRef = useRef<number | null>(null);
  const spinTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTimestamp = useRef<number | null>(null);

  // Animate comet progress
  useEffect(() => {
    if (spin) return;
    let running = true;
    function animate(ts: number) {
      if (!running) return;
      if (lastTimestamp.current == null) lastTimestamp.current = ts;
      const dt = (ts - lastTimestamp.current) / 1000;
      lastTimestamp.current = ts;
      // 2.0 seconds per full loop
      setProgress(prev => (prev + dt * (3 / LOOP_DURATION)) % 3);
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
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      spinTimeoutRef.current = setTimeout(() => {
        setVisible(false);
        if (onFinish) onFinish();
      }, 2000); // match spin duration (2s)
    }
    return () => {
      if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);
    };
  }, [spin, onFinish]);

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
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0,0,0,0.45)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'all',
        transition: 'opacity 0.5s',
        opacity: spin ? 0 : 1,
      }}
    >
      <svg
        viewBox="0 0 220 220"
        width={220}
        height={220}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          transition: spin ? 'transform 2s cubic-bezier(0.4,2,0.4,1)' : undefined,
          transform: spin ? 'rotate(720deg)' : 'none',
          transformOrigin: '110px 120px', // center of triangle
        }}
      >
        <defs>
          {getBarGradient(0, 1, 'grad01', barIndex === 0, barIndex === 0 ? cometT : 0)}
          {getBarGradient(1, 2, 'grad12', barIndex === 1, barIndex === 1 ? cometT : 0)}
          {getBarGradient(2, 0, 'grad20', barIndex === 2, barIndex === 2 ? cometT : 0)}
        </defs>
        <polygon points="110,40 190,180 30,180" fill={HIGHLIGHT} stroke={HOVER} strokeWidth={4} />
        {/* Bars with comet trail gradient */}
        <line x1={nodes[0].cx} y1={nodes[0].cy} x2={nodes[1].cx} y2={nodes[1].cy} stroke="url(#grad01)" strokeWidth={10} strokeLinecap="round" />
        <line x1={nodes[1].cx} y1={nodes[1].cy} x2={nodes[2].cx} y2={nodes[2].cy} stroke="url(#grad12)" strokeWidth={10} strokeLinecap="round" />
        <line x1={nodes[2].cx} y1={nodes[2].cy} x2={nodes[0].cx} y2={nodes[0].cy} stroke="url(#grad20)" strokeWidth={10} strokeLinecap="round" />
        {/* Nodes */}
        {nodes.map((node, i) => (
          <circle
            key={i}
            cx={node.cx}
            cy={node.cy}
            r={28}
            fill={getNodeColor(i)}
            style={{ transition: 'fill 0.25s' }}
          />
        ))}
      </svg>
    </div>
  ) : null;
} 