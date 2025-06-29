'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';

// Constants
const TONE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const STATE_OFF = 0;
const STATE_GHOST = 1;
const STATE_SUSTAIN = 2;
const STATE_ON = 3;
const LAYOUT_RIEMANN = 'riemann';
const LAYOUT_SONOME = 'sonome';

// Types
interface Tone {
  pitch: number;
  name: string;
  state: number;
  byChannel: Record<number, number>;
  channelsSust: Record<number, number>;
  released: Date | null;
  cache: Record<string, unknown>;
}

interface Channel {
  number: number;
  pitches: Record<number, number>;
  sustTones: Record<number, number>;
  sustain: boolean;
}

interface UseTonnextOptions {
  mode: 'note' | 'chord' | 'arpeggio';
  chordType: string;
}

export function useTonnext(options: UseTonnextOptions) {
  // Utility to get CSS variable
  function getCssVar(name: string, fallback: string) {
    return getComputedStyle(document.documentElement).getPropertyValue(name) || fallback;
  }

  // Utility to check luminance (for contrast)
  function getLuminance(hex: string) {
    const c = hex.replace('#', '');
    if (c.length !== 6) return 1;
    const r = parseInt(c.slice(0, 2), 16) / 255;
    const g = parseInt(c.slice(2, 4), 16) / 255;
    const b = parseInt(c.slice(4, 6), 16) / 255;
    // Perceived luminance
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  const [isInitialized] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const synthRef = useRef<Tone.Synth | null>(null);
  const polySynthRef = useRef<Tone.PolySynth | null>(null);
  
  // State
  const getResponsiveDensity = () => Math.max(16, Math.min(40, Math.floor(window.innerWidth / 32)));
  const [density, setDensity] = useState(getResponsiveDensity());
  const [ghostDuration, setGhostDuration] = useState(500);
  const [layout, setLayout] = useState(LAYOUT_RIEMANN);
  const [sustainEnabled, setSustainEnabled] = useState(false);
  
  // Data structures
  const tonesRef = useRef<Tone[]>([]);
  const channelsRef = useRef<Channel[]>([]);
  const ghostsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const drawTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const nodesRef = useRef<{x:number,y:number,tone:number}[]>([]);
  const activeRef = useRef<boolean[]>(Array(12).fill(false));
  
  // Dimensions
  const [dimensions] = useState({ width: 0, height: 0, unit: 0 });

  const audioStartedRef = useRef(false);

  // 1. drawGrid
  const drawGrid = useCallback(() => {
    if (!ctxRef.current) return;
    const ctx = ctxRef.current;
    const { width, height } = dimensions;
    if (dimensions.unit === 0) return;
    const SQRT_3 = Math.sqrt(3);
    ctx.clearRect(0, 0, width, height);
    // Use palette from CSS variables
    const colorMain = getCssVar('--color-main', '#DA4C2B').trim() || '#DA4C2B';
    const colorHighlight = getCssVar('--color-highlight', '#D4D7CB').trim() || '#D4D7CB';
    const colorAccent = getCssVar('--color-accent', '#D7A798').trim() || '#D7A798';
    const colorEdge = getCssVar('--color-hover', '#DD4A2F').trim() || '#DD4A2F';
    // Use highlight as background if main is used for header/footer, else use main
    // Always ensure canvas background is different from header/footer
    const headerFooterColor = colorMain;
    const bgColor = headerFooterColor === colorMain ? colorHighlight : colorMain;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);
    // Pick a contrasting highlight for nodes
    const bgLum = getLuminance(bgColor);
    // If background is light, use main for highlight; if dark, use highlight
    const nodeHighlight = bgLum > 0.6 ? colorMain : colorHighlight;
    const nodeNormal = colorAccent;

    const radius = dimensions.unit / 5;
    const nodes: { x: number; y: number; tone: number }[] = [];

    function add(x: number, y: number, tone: number) {
      nodes.push({ x, y, tone });
    }

    if (layout === LAYOUT_RIEMANN) {
      const yUnit = dimensions.unit * SQRT_3;
      const uW = Math.ceil(width / dimensions.unit);
      const uH = Math.ceil(height / yUnit);
      for (let j = -Math.floor(uW / 2 + 1); j <= Math.floor(uW / 2 + 1); j++) {
        for (let i = -Math.floor(uH / 2 + 1); i <= Math.floor(uH / 2 + 1); i++) {
          add(((i - 7 * j) % 12 + 12) % 12, width / 2 - j * dimensions.unit, height / 2 + i * yUnit);
          add(((i - 7 * j) % 12 + 12 + 4) % 12, width / 2 - (j - 0.5) * dimensions.unit, height / 2 + (i + 0.5) * yUnit);
        }
      }
    } else if (layout === LAYOUT_SONOME) {
      const xUnit = dimensions.unit * SQRT_3;
      const uW = Math.ceil(width / xUnit);
      const uH = Math.ceil(height / dimensions.unit);

      for (let j = -Math.floor(uH / 2 + 1); j <= Math.floor(uH / 2 + 1); j++) {
        for (let i = -Math.floor(uW / 2 + 1); i <= Math.floor(uW / 2 + 1); i++) {
          add(((i - 7 * j) % 12 + 12) % 12, width / 2 + i * xUnit, height / 2 + j * dimensions.unit);
          add(((i - 7 * j) % 12 + 12 + 4) % 12, width / 2 + (i + 0.5) * xUnit, height / 2 + (j - 0.5) * dimensions.unit);
        }
      }
    }

    nodesRef.current = nodes;

    // draw edges
    ctx.strokeStyle = colorEdge;
    ctx.lineWidth = 1;
    const threshold = dimensions.unit * 1.05;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.9 * dimensions.unit && dist < threshold) {
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
    }

    // draw nodes (without labels first)
    nodes.forEach(({ x, y, tone }) => {
      const active = activeRef.current[tone];
      ctx.fillStyle = active ? nodeHighlight : nodeNormal;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // Highlight lines and triangles between active notes
    const activeNodes = nodes.filter(n => activeRef.current[n.tone]);
    if (activeNodes.length >= 2) {
      // Draw lines only between adjacent active nodes (using edge threshold)
      ctx.save();
      ctx.strokeStyle = nodeHighlight;
      ctx.lineWidth = 2;
      const threshold = dimensions.unit * 1.05;
      for (let i = 0; i < activeNodes.length; i++) {
        for (let j = i + 1; j < activeNodes.length; j++) {
          const dx = activeNodes[i].x - activeNodes[j].x;
          const dy = activeNodes[i].y - activeNodes[j].y;
          const dist = Math.hypot(dx, dy);
          if (dist > 0.9 * dimensions.unit && dist < threshold) {
            ctx.beginPath();
            ctx.moveTo(activeNodes[i].x, activeNodes[i].y);
            ctx.lineTo(activeNodes[j].x, activeNodes[j].y);
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }
    if (activeNodes.length >= 3) {
      // Draw filled triangles only for mutually adjacent active nodes
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = nodeHighlight;
      const threshold = dimensions.unit * 1.05;
      // Check all combinations of 3 active nodes
      for (let i = 0; i < activeNodes.length; i++) {
        for (let j = i + 1; j < activeNodes.length; j++) {
          for (let k = j + 1; k < activeNodes.length; k++) {
            const a = activeNodes[i], b = activeNodes[j], c = activeNodes[k];
            const d1 = Math.hypot(a.x - b.x, a.y - b.y);
            const d2 = Math.hypot(a.x - c.x, a.y - c.y);
            const d3 = Math.hypot(b.x - c.x, b.y - c.y);
            // All three must be adjacent (form a triangle in the grid)
            if (
              d1 > 0.9 * dimensions.unit && d1 < threshold &&
              d2 > 0.9 * dimensions.unit && d2 < threshold &&
              d3 > 0.9 * dimensions.unit && d3 < threshold
            ) {
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.lineTo(c.x, c.y);
              ctx.closePath();
              ctx.fill();
            }
          }
        }
      }
      ctx.globalAlpha = 1.0;
      ctx.restore();
    }

    // Draw labels last to ensure they're always on top
    nodes.forEach(({ x, y, tone }) => {
      const active = activeRef.current[tone];
      
      // Draw note labels
      const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const noteName = noteNames[tone % 12];
      const fontSize = Math.max(12, Math.min(20, radius * 0.8));
      ctx.font = `bold ${fontSize}px Arial`;
      
      // Determine text color based on node fill color
      let textColor = '#fff';
      // Helper to compare hex colors (ignoring case)
      function hexEquals(a: string, b: string) {
        return a.replace('#', '').toLowerCase() === b.replace('#', '').toLowerCase();
      }
      // If node fill color is Cinnabar accent, use white
      if (hexEquals(active ? nodeHighlight : nodeNormal, '#D7A798') || hexEquals(active ? nodeHighlight : nodeNormal, '#d7a798')) {
        textColor = '#fff';
      } else {
        const mainLum = getLuminance(colorMain);
        const highlightLum = getLuminance(colorHighlight);
        if (mainLum < 0.5 && highlightLum > 0.5) textColor = colorHighlight;
        else if (mainLum > 0.5 && highlightLum < 0.5) textColor = colorMain;
        else if (mainLum > 0.7) textColor = '#222';
        else if (mainLum < 0.3) textColor = '#fff';
      }
      
      // Draw a larger, more opaque background circle behind the text for better readability
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = "#222";
      ctx.shadowBlur = 2;
      ctx.fillText(noteName, x, y);
      ctx.shadowBlur = 0;
    });
  }, [dimensions, layout, activeRef]);

  // 2. drawNow
  const drawNow = useCallback(() => {
    drawTimeoutRef.current = null;
    
    if (!ctxRef.current) return;

    const ctx = ctxRef.current;
    const { width, height } = dimensions;

    ctx.clearRect(0, 0, width, height);

    // Only draw the zoomable Tonnext grid
    drawGrid();
  }, [dimensions, drawGrid]);

  // 3. draw
  const draw = useCallback((immediately = false) => {
    if (immediately) {
      if (drawTimeoutRef.current) {
        clearTimeout(drawTimeoutRef.current);
      }
      drawNow();
    } else if (drawTimeoutRef.current === null) {
      drawTimeoutRef.current = setTimeout(drawNow, 30);
    }
  }, [drawNow]);

  // 4. startGhosts
  const startGhosts = useCallback(() => {
    if (ghostsIntervalRef.current === null) {
      ghostsIntervalRef.current = setInterval(() => {
        let numAlive = 0;
        let numDead = 0;
        const now = new Date();

        for (let i = 0; i < 12; i++) {
          if (tonesRef.current[i].state === STATE_GHOST) {
            if (now.getTime() - tonesRef.current[i].released!.getTime() >= ghostDuration) {
              tonesRef.current[i].state = STATE_OFF;
              numDead++;
            } else {
              numAlive++;
            }
          }
        }

        if (numAlive === 0) {
          if (ghostsIntervalRef.current) {
            clearInterval(ghostsIntervalRef.current);
            ghostsIntervalRef.current = null;
          }
        }

        if (numDead > 0) {
          draw();
        }
      }, Math.min(ghostDuration, 30));
    }
  }, [ghostDuration, draw]);

  // 5. releaseTone
  const releaseTone = useCallback((tone: Tone) => {
    tone.released = new Date();
    if (ghostDuration > 0) {
      tone.state = STATE_GHOST;
      startGhosts();
    } else {
      tone.state = STATE_OFF;
    }
  }, [ghostDuration, startGhosts]);

  // 6. rebuild
  const rebuild = useCallback(() => {
    // ...existing code...
  }, []);

  // 7. initTonnext
  const initTonnext = useCallback(() => {
    // ...existing code...
  }, []);

  const handleCanvasClick = useCallback(async (x: number, y: number) => {
    // Resume Tone.js audio context on first interaction
    if (!audioStartedRef.current) {
      await Tone.start();
      audioStartedRef.current = true;
    }
    if (nodesRef.current.length === 0) return;
    const radius = dimensions.unit / 5;
    let clickedTone: number | null = null;
    for (const node of nodesRef.current) {
      const dx = x - node.x;
      const dy = y - node.y;
      if (Math.hypot(dx, dy) <= radius) {
        clickedTone = node.tone;
        break;
      }
    }
    if (clickedTone === null) return;

    const getChordIntervals = (type: string): number[] => {
      switch (type) {
        case 'major': return [0, 4, 7];
        case 'minor': return [0, 3, 7];
        case 'diminished': return [0, 3, 6];
        case 'augmented': return [0, 4, 8];
        case 'major7': return [0, 4, 7, 11];
        case 'minor7': return [0, 3, 7, 10];
        case 'dominant7': return [0, 4, 7, 10];
        default: return [0, 4, 7];
      }
    };

    if (options.mode === 'note') {
      // Play note and highlight briefly (no toggle)
      activeRef.current[clickedTone] = true;
      drawGrid();
      if (synthRef.current) {
        synthRef.current.triggerAttackRelease(TONE_NAMES[clickedTone] + '4', 0.3);
      }
      setTimeout(() => {
        activeRef.current[clickedTone] = false;
        drawGrid();
      }, 300);
    } else if (options.mode === 'chord' && polySynthRef.current) {
      // Highlight all chord notes, play chord, then clear highlights
      const root = clickedTone;
      const intervals = getChordIntervals(options.chordType);
      const notesIdx = intervals.map(i => (root + i) % 12);
      const notes = notesIdx.map(i => TONE_NAMES[i] + '4');
      // Highlight
      notesIdx.forEach(i => { activeRef.current[i] = true; });
      drawGrid();
      polySynthRef.current.triggerAttackRelease(notes, 0.5);
      setTimeout(() => {
        notesIdx.forEach(i => { activeRef.current[i] = false; });
        drawGrid();
      }, 500);
    } else if (options.mode === 'arpeggio' && polySynthRef.current) {
      // Sequentially play each note, highlight as played, keep all highlighted, then play full chord, then clear
      const root = clickedTone;
      const intervals = getChordIntervals(options.chordType);
      const notesIdx = intervals.map(i => (root + i) % 12);
      const notes = notesIdx.map(i => TONE_NAMES[i] + '4');
      // Clear all highlights first
      for (let i = 0; i < 12; i++) activeRef.current[i] = false;
      drawGrid();
      // Play arpeggio
      const arpeggioStep = 160; // ms
      notesIdx.forEach((idx, step) => {
        setTimeout(() => {
          activeRef.current[idx] = true;
          drawGrid();
          polySynthRef.current!.triggerAttackRelease(TONE_NAMES[idx] + '4', arpeggioStep / 1000); // duration in seconds
        }, step * arpeggioStep);
      });
      // After arpeggio, add a pause (same as step), then play full chord and keep all highlighted
      const arpeggioPause = arpeggioStep; // ms
      setTimeout(() => {
        polySynthRef.current!.triggerAttackRelease(notes, (arpeggioStep * 3) / 1000); // chord duration = step * 3
      }, notesIdx.length * arpeggioStep + arpeggioPause);
      // After full chord, clear highlights
      setTimeout(() => {
        notesIdx.forEach(i => { activeRef.current[i] = false; });
        drawGrid();
      }, notesIdx.length * arpeggioStep + arpeggioPause + arpeggioStep * 3);
    }
  }, [drawGrid, dimensions, options, synthRef, polySynthRef, activeRef]);

  const handleMouseMove = useCallback((x: number, y: number) => {
    if (canvasRef.current) {
      // Check if hovering over a node
      let overNode = false;
      const radius = dimensions.unit/5;
      if (nodesRef.current.length > 0) {
        for (const node of nodesRef.current) {
          const dx = x - node.x;
          const dy = y - node.y;
          if (Math.hypot(dx, dy) <= radius) {
            overNode = true;
            break;
          }
        }
      }
      canvasRef.current.style.cursor = overNode ? 'pointer' : 'default';
    }
  }, [dimensions, nodesRef]);

  const handleMouseLeave = useCallback(() => {
    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'default';
    }
  }, [canvasRef]);

  const noteOn = useCallback((channel: number, pitch: number) => {
    if (synthRef.current) {
      synthRef.current.triggerAttack(TONE_NAMES[pitch % 12]);
    }

    if (!(pitch in channelsRef.current[channel].pitches)) {
      const i = pitch % 12;
      tonesRef.current[i].state = STATE_ON;

      if (!tonesRef.current[i].byChannel[channel]) {
        tonesRef.current[i].byChannel[channel] = 1;
      } else {
        tonesRef.current[i].byChannel[channel]++;
      }

      channelsRef.current[channel].pitches[pitch] = 1;

      delete tonesRef.current[i].channelsSust[channel];
      delete channelsRef.current[channel].sustTones[i];
    }
    
    draw();
  }, [synthRef, draw]);

  const noteOff = useCallback((channel: number, pitch: number) => {
    if (synthRef.current) {
      
      synthRef.current.triggerRelease();
    }

    if (pitch in channelsRef.current[channel].pitches) {
      const i = pitch % 12;
      delete channelsRef.current[channel].pitches[pitch];
      tonesRef.current[i].byChannel[channel]--;

      if (tonesRef.current[i].byChannel[channel] === 0) {
        delete tonesRef.current[i].byChannel[channel];

        if (Object.keys(tonesRef.current[i].byChannel).length === 0) {
          if (sustainEnabled && channelsRef.current[channel].sustain) {
            tonesRef.current[i].state = STATE_SUSTAIN;
            channelsRef.current[channel].sustTones[i] = 1;
          } else {
            releaseTone(tonesRef.current[i]);
          }
        }
      }

      draw();
    }
  }, [synthRef, channelsRef, sustainEnabled, draw, releaseTone]);

  useEffect(()=>{
    if(isInitialized){
      drawGrid();
    }
  },[drawGrid,isInitialized]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
        if (ctxRef.current) {
          const ctx = ctxRef.current;
          ctx.fillStyle = '#1a1a1a';
          ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
        setDensity(getResponsiveDensity());
        rebuild();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [rebuild]);

  // Handle mouse wheel for zoom
  const handleWheel = (event: React.WheelEvent<HTMLCanvasElement> | WheelEvent) => {
    event.preventDefault();
    setDensity(prev => Math.max(10, Math.min(30, prev - event.deltaY * 0.01)));
  };

  // Rebuild grid when density changes (for zoom)
  useEffect(() => {
    rebuild();
  }, [density, rebuild]);

  // Redraw canvas when palette CSS variables change
  useEffect(() => {
    // Listen for palette changes
    const observer = new MutationObserver(() => {
      drawGrid();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    return () => observer.disconnect();
  }, [drawGrid]);

  return {
    isInitialized,
    initTonnext,
    handleCanvasClick,
    handleMouseMove,
    handleMouseLeave,
    handleWheel,
    noteOn,
    noteOff,
    setDensity,
    setGhostDuration,
    setLayout,
    setSustainEnabled,
  };
} 