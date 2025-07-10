'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import { useMidiContext } from '@/contexts/MidiContext';
import { useNotation } from '@/contexts/NotationContext';
import type { Instrument } from '@/components/InstrumentSelector';
import { Piano } from 'lucide-react';

// Constants
const TONE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const STATE_OFF = 0;
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

interface TonnextNode {
  x: number;
  y: number;
  tone: number;
}

interface UseTonnextOptions {
  mode: 'note' | 'chord' | 'arpeggio';
  chordType: string;
}

export function useTonnext(options: UseTonnextOptions) {
  const [isInitialized, setIsInitialized] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const synthRef = useRef<Tone.Synth | null>(null);
  const polySynthRef = useRef<Tone.PolySynth | null>(null);
  
  // Get MIDI context for instrument settings
  const { getSelectedInstrument, isMuted } = useMidiContext();
  const { getNoteName } = useNotation();
  
  // State
  // Initialize density with a safe default for SSR
  const [density, setDensity] = useState(20);
  
  // Track if density has been manually set by user (for zoom)
  const [densityManuallySet, setDensityManuallySet] = useState(false);
  
  // Ref to track current density for resize handler
  const densityRef = useRef(density);
  
  // Ref to track manually set state for resize handler
  const densityManuallySetRef = useRef(densityManuallySet);
  
  // Update refs when state changes
  useEffect(() => {
    densityRef.current = density;
  }, [density]);
  
  useEffect(() => {
    densityManuallySetRef.current = densityManuallySet;
  }, [densityManuallySet]);
  
  // Responsive density function (uses window, so only call on client)
  const getResponsiveDensity = () => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    if (isMobile) {
      // Slightly higher density (smaller nodes) for mobile
      return Math.max(14, Math.min(24, Math.floor(window.innerWidth / 24)));
    } else {
      // Higher density (smaller nodes) for desktop
      return Math.max(16, Math.min(28, Math.floor(window.innerWidth / 28)));
    }
  };

  // On mount, update density responsively (client only)
  useEffect(() => {
    // Only set responsive density if it hasn't been manually set
    if (!densityManuallySet) {
      setDensity(getResponsiveDensity());
    }
  }, [densityManuallySet]);

  const [layout, setLayout] = useState(LAYOUT_RIEMANN);
  
  // Data structures
  const tonesRef = useRef<Tone[]>([]);
  const channelsRef = useRef<Channel[]>([]);
  const toneGridRef = useRef<TonnextNode[][]>([]);
  const drawTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const nodesRef = useRef<{x:number,y:number,tone:number}[]>([]);
  const activeRef = useRef<boolean[]>(Array(12).fill(false));
  const arpeggioTimeoutsRef = useRef<NodeJS.Timeout[]>([]);
  
  // Dimensions
  const [dimensions, setDimensions] = useState({ width: 0, height: 0, unit: 0 });

  const audioStartedRef = useRef(false);

  // Helper functions to trigger synth only when not muted
  const triggerSynthAttackRelease = useCallback((note: string, duration: number, time?: number, velocity?: number) => {
    if (!isMuted && synthRef.current) {
      synthRef.current.triggerAttackRelease(note, duration, time, velocity);
    }
  }, [isMuted]);

  const triggerPolySynthAttackRelease = useCallback((notes: string | string[], duration: number, time?: number, velocity?: number) => {
    if (!isMuted && polySynthRef.current) {
      polySynthRef.current.triggerAttackRelease(notes, duration, time, velocity);
    }
  }, [isMuted]);

  const triggerSynthAttack = useCallback((note: string) => {
    if (!isMuted && synthRef.current) {
      synthRef.current.triggerAttack(note);
    }
  }, [isMuted]);

  const triggerSynthRelease = useCallback((note: string) => {
    if (!isMuted && synthRef.current) {
      synthRef.current.triggerRelease(note);
    }
  }, [isMuted]);

  // Function to update synths with selected instrument settings
  const updateSynthsWithInstrument = useCallback(async (instrument: Instrument) => {
    // Initialize audio context if needed
    await Tone.start();
    
    // Apply instrument settings
    if (synthRef.current && instrument.toneOptions) {
      console.log('Updating useTonnext synth to:', instrument.name);
      synthRef.current.set(instrument.toneOptions);
    }
    
    if (polySynthRef.current && instrument.toneOptions) {
      console.log('Updating useTonnext polySynth to:', instrument.name);
      polySynthRef.current.set(instrument.toneOptions);
    }
  }, []);

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

  // 1. addNode
  const addNode = useCallback((tone: number, x: number, y: number, unit: number) => {
    if (x < -unit || y < -unit || x > window.innerWidth + unit || y > window.innerHeight + unit) {
      return;
    }
    const node = { x, y, tone };
    toneGridRef.current[tone].push(node);
  }, []);

  // 7. buildToneGrid
  const buildToneGrid = useCallback((width: number, height: number, unit: number) => {
    // Clear existing tone grid
    toneGridRef.current = Array.from({ length: 12 }, () => []);
    
    const SQRT_3 = Math.sqrt(3);
    
    if (layout === LAYOUT_RIEMANN) {
      const yUnit = unit * SQRT_3;
      const uW = Math.ceil(width / unit);
      const uH = Math.ceil(height / yUnit);
      
      for (let j = -Math.floor(uW / 2 + 1); j <= Math.floor(uW / 2 + 1); j++) {
        for (let i = -Math.floor(uH / 2 + 1); i <= Math.floor(uH / 2 + 1); i++) {
          addNode(((i - 7 * j) % 12 + 12) % 12, width / 2 - j * unit, height / 2 + i * yUnit, unit);
          addNode(((i - 7 * j) % 12 + 12 + 4) % 12, width / 2 - (j - 0.5) * unit, height / 2 + (i + 0.5) * yUnit, unit);
        }
      }
    } else if (layout === LAYOUT_SONOME) {
      const xUnit = unit * SQRT_3;
      const uW = Math.ceil(width / xUnit);
      const uH = Math.ceil(height / unit);

      for (let j = -Math.floor(uH / 2 + 1); j <= Math.floor(uH / 2 + 1); j++) {
        for (let i = -Math.floor(uW / 2 + 1); i <= Math.floor(uW / 2 + 1); i++) {
          addNode(((i - 7 * j) % 12 + 12) % 12, width / 2 + i * xUnit, height / 2 + j * unit, unit);
          addNode(((i - 7 * j) % 12 + 12 + 4) % 12, width / 2 + (i + 0.5) * xUnit, height / 2 + (j - 0.5) * unit, unit);
        }
      }
    }
  }, [layout, addNode]);

  // 3. drawGrid
  const drawGrid = useCallback(()=>{
    if(!ctxRef.current || !canvasRef.current) return;
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    
    // Calculate dimensions directly from canvas and current density to avoid stale state
    const width = canvas.width;
    const height = canvas.height;
    const unit = (width + height) / densityRef.current;
    
    if(unit===0) return;
    const SQRT_3=Math.sqrt(3);
    ctx.clearRect(0,0,width,height);
    // Use palette from CSS variables
    const colorMain = getCssVar('--color-main', '#DA4C2B').trim() || '#DA4C2B';
    const colorHighlight = getCssVar('--color-highlight', '#D4D7CB').trim() || '#D4D7CB';
    const colorAccent = getCssVar('--color-accent', '#D7A798').trim() || '#D7A798';
    const colorEdge = getCssVar('--color-hover', '#DD4A2F').trim() || '#DD4A2F';
    // Use highlight as background if main is used for header/footer, else use main
    // Always ensure canvas background is different from header/footer
    const headerFooterColor = colorMain;
    const bgColor = headerFooterColor === colorMain ? colorHighlight : colorMain;
    ctx.fillStyle=bgColor;
    ctx.fillRect(0,0,width,height);
    // Pick a contrasting highlight for nodes
    const bgLum = getLuminance(bgColor);
    // If background is light, use main for highlight; if dark, use highlight
    const nodeHighlight = bgLum > 0.6 ? colorMain : colorHighlight;
    const nodeNormal = colorAccent;

    const radius=unit/5;
    const nodes: {x:number,y:number,tone:number}[]=[];

    function add(x:number,y:number,tone:number){
      nodes.push({x,y,tone});
    }

    if(layout===LAYOUT_RIEMANN){
      const yUnit=unit*SQRT_3;
      const uW=Math.ceil(width/unit);
      const uH=Math.ceil(height/yUnit);
      for(let j=-Math.floor(uW/2+1);j<=Math.floor(uW/2+1);j++){
        for(let i=-Math.floor(uH/2+1);i<=Math.floor(uH/2+1);i++){
          add(width/2 - j*unit, height/2 + i*yUnit, ((i-7*j)%12+12)%12);
          add(width/2 - (j-0.5)*unit, height/2 + (i+0.5)*yUnit, ((i-7*j+4)%12+12)%12);
        }
      }
    }else{
      const xUnit=unit*SQRT_3;
      const uW=Math.ceil(width/xUnit);
      const uH=Math.ceil(height/unit);
      for(let j=-Math.floor(uH/2+1);j<=Math.floor(uH/2+1);j++){
        for(let i=-Math.floor(uW/2+1);i<=Math.floor(uW/2+1);i++){
          add(width/2 + i*xUnit, height/2 + j*unit, ((i-7*j)%12+12)%12);
          add(width/2 + (i+0.5)*xUnit, height/2 + (j-0.5)*unit, ((i-7*j+4)%12+12)%12);
        }
      }
    }

    nodesRef.current=nodes;

    // draw edges
    ctx.strokeStyle=colorEdge;
    ctx.lineWidth=1;
    const threshold=unit*1.05;
    for(let i=0;i<nodes.length;i++){
      for(let j=i+1;j<nodes.length;j++){
        const dx=nodes[i].x-nodes[j].x;
        const dy=nodes[i].y-nodes[j].y;
        const dist=Math.hypot(dx,dy);
        if(dist>0.9*unit && dist<threshold){
          ctx.beginPath();
          ctx.moveTo(nodes[i].x,nodes[i].y);
          ctx.lineTo(nodes[j].x,nodes[j].y);
          ctx.stroke();
        }
      }
    }

    // draw nodes (without labels first)
    nodes.forEach(({x,y,tone})=>{
      const active=activeRef.current[tone];
      ctx.fillStyle=active?nodeHighlight:nodeNormal;
      ctx.beginPath();
      ctx.arc(x,y,radius,0,Math.PI*2);
      ctx.fill();
    });

    // Highlight lines and triangles between active notes
    const activeNodes = nodes.filter(n => activeRef.current[n.tone]);
    if (activeNodes.length >= 2) {
      // Draw lines only between adjacent active nodes (using edge threshold)
      ctx.save();
      ctx.strokeStyle = nodeHighlight;
      ctx.lineWidth = 2;
      const threshold = unit * 1.05;
      for (let i = 0; i < activeNodes.length; i++) {
        for (let j = i + 1; j < activeNodes.length; j++) {
          const dx = activeNodes[i].x - activeNodes[j].x;
          const dy = activeNodes[i].y - activeNodes[j].y;
          const dist = Math.hypot(dx, dy);
          if (dist > 0.9 * unit && dist < threshold) {
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
      const threshold = unit * 1.05;
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
              d1 > 0.9 * unit && d1 < threshold &&
              d2 > 0.9 * unit && d2 < threshold &&
              d3 > 0.9 * unit && d3 < threshold
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
    nodes.forEach(({x,y,tone})=>{
      const active=activeRef.current[tone];
      
      // Draw note labels
      const noteName = getNoteName(tone);
      const fontSize = Math.max(12, Math.min(20, radius * 0.8));
      ctx.font = `bold ${fontSize}px Arial`;
      
      // Determine text color based on node fill color
      let textColor = '#fff';
      // Helper to compare hex colors (ignoring case)
      function hexEquals(a: string, b: string) {
        return a.replace('#','').toLowerCase() === b.replace('#','').toLowerCase();
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
      
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = "#222";
      ctx.shadowBlur = 2;
      ctx.fillText(noteName, x, y);
      ctx.shadowBlur = 0;
    });
  },[layout,activeRef,getNoteName]);

  // 4. drawNow
  const drawNow = useCallback(() => {
    drawTimeoutRef.current = null;
    
    if (!ctxRef.current) return;

    const ctx = ctxRef.current;
    const { width, height } = dimensions;

    ctx.clearRect(0, 0, width, height);

    // Only draw the zoomable Tonnext grid
    drawGrid();
  }, [dimensions, drawGrid]);

  // 5. draw
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

  // 6. initTonnext
  const initTonnext = useCallback(async (canvas: HTMLCanvasElement) => {
    canvasRef.current = canvas;
    ctxRef.current = canvas.getContext('2d');
    
    if (!ctxRef.current) return;

    // Initialize audio
    synthRef.current = new Tone.Synth().toDestination();
    polySynthRef.current = new Tone.PolySynth().toDestination();
    
    // Apply initial instrument settings
    const selectedInstrument = getSelectedInstrument();
    if (selectedInstrument) {
      await updateSynthsWithInstrument(selectedInstrument);
    } else {
      // Default piano settings
      const defaultInstrument: Instrument = {
        id: 'piano',
        name: 'Piano',
        category: 'Keys',
        icon: Piano,
        toneType: 'synth',
        toneOptions: {
          oscillator: { type: 'triangle' },
          envelope: {
            attack: 0.02,
            decay: 0.1,
            sustain: 0.3,
            release: 1
          }
        }
      };
      await updateSynthsWithInstrument(defaultInstrument);
    }
    
    // Initialize tones
    tonesRef.current = Array.from({ length: 12 }, (_, i) => ({
      pitch: i,
      name: TONE_NAMES[i],
      state: STATE_OFF,
      byChannel: {},
      channelsSust: {},
      released: null,
      cache: {}
    }));

    // Initialize channels
    channelsRef.current = Array.from({ length: 17 }, (_, i) => ({
      number: i,
      pitches: {},
      sustTones: {},
      sustain: false
    }));

    // Initialize tone grid
    toneGridRef.current = Array.from({ length: 12 }, () => []);

    // Set canvas size to parent container size
    const parent = canvas.parentElement;
    const width = parent ? parent.clientWidth : window.innerWidth;
    const height = parent ? parent.clientHeight : window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    
    // Draw initial background
    const ctx = ctxRef.current;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    setIsInitialized(true);
    // Call rebuild directly instead of through the callback to avoid circular dependency
    const unit = (width + height) / density;
    
    setDimensions({ width, height, unit });
    buildToneGrid(width, height, unit);
    draw(true);
  }, [density, layout, buildToneGrid, draw]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCanvasClick = useCallback(async (x: number, y: number) => {
    // Resume Tone.js audio context on first interaction
    if (!audioStartedRef.current) {
      await Tone.start();
      audioStartedRef.current = true;
      // Warm up synths to prevent first-note stutter
      triggerSynthAttackRelease('C4', 0.01, undefined, 0.001);
      triggerPolySynthAttackRelease(['C4', 'E4', 'G4'], 0.01, undefined, 0.001);
    }
    if(nodesRef.current.length===0) return;
    const radius = dimensions.unit/5;
    let clickedTone: number|null = null;
    for(const node of nodesRef.current){
      const dx = x - node.x;
      const dy = y - node.y;
      if(Math.hypot(dx,dy) <= radius){
        clickedTone = node.tone;
        break;
      }
    }
    if(clickedTone===null) return;

    const getChordIntervals = (type: string): number[] => {
      switch (type) {
        // Triads
        case 'major': return [0, 4, 7];
        case 'minor': return [0, 3, 7];
        case 'diminished': return [0, 3, 6];
        case 'augmented': return [0, 4, 8];
        case 'sus2': return [0, 2, 7];
        case 'sus4': return [0, 5, 7];
        // 6th chords
        case 'major6': return [0, 4, 7, 9];
        case 'minor6': return [0, 3, 7, 9];
        // 7th chords
        case 'major7': return [0, 4, 7, 11];
        case 'minor7': return [0, 3, 7, 10];
        case 'dominant7': return [0, 4, 7, 10];
        case 'diminished7': return [0, 3, 6, 9];
        case 'half-diminished7': return [0, 3, 6, 10];
        case 'minorMajor7': return [0, 3, 7, 11];
        case 'augmented7': return [0, 4, 8, 10];
        // 9th chords (5 notes)
        case 'major9': return [0, 4, 7, 11, 14];
        case 'minor9': return [0, 3, 7, 10, 14];
        case 'dominant9': return [0, 4, 7, 10, 14];
        case 'diminished9': return [0, 3, 6, 9, 14];
        // 7th with altered 5th/9th
        case '7b5': return [0, 4, 6, 10];
        case '7#5': return [0, 4, 8, 10];
        case '7b9': return [0, 4, 7, 10, 13];
        case '7#9': return [0, 4, 7, 10, 15];
        // Add chords
        case 'add9': return [0, 4, 7, 14];
        case 'madd9': return [0, 3, 7, 14];
        case 'add11': return [0, 4, 7, 17];
        case 'add13': return [0, 4, 7, 21];
        // 6/9 chord
        case '6/9': return [0, 4, 7, 9, 14];
        // m7b5
        case 'm7b5': return [0, 3, 6, 10];
        // m9
        case 'm9': return [0, 3, 7, 10, 14];
        // sus2/7, sus4/7
        case 'sus2_7': return [0, 2, 7, 10];
        case 'sus4_7': return [0, 5, 7, 10];
        // Default
        default: return [0, 4, 7];
      }
    };

    if (options.mode === 'note') {
      // Play note and highlight briefly (no toggle)
      activeRef.current[clickedTone] = true;
      draw(true);
      if (synthRef.current) {
        const note = TONE_NAMES[clickedTone] + '4';
        console.log('useTonnext: Playing note with current synth settings:', note);
        triggerSynthAttackRelease(note, 0.3);
      }
      setTimeout(() => {
        activeRef.current[clickedTone] = false;
        draw(true);
      }, 300);
    } else if (options.mode === 'chord' && polySynthRef.current) {
      // Highlight all chord notes, play chord, then clear highlights
      const root = clickedTone;
      const intervals = getChordIntervals(options.chordType);
      const notesIdx = intervals.map(i => (root + i) % 12);
      const notes = notesIdx.map(i => TONE_NAMES[i] + '4');
      // Highlight
      notesIdx.forEach(i => { activeRef.current[i] = true; });
      draw(true);
      console.log('useTonnext: Playing chord with current polySynth settings:', notes);
      triggerPolySynthAttackRelease(notes, 0.5);
      setTimeout(() => {
        notesIdx.forEach(i => { activeRef.current[i] = false; });
        draw(true);
      }, 500);
    } else if (options.mode === 'arpeggio' && polySynthRef.current) {
      // Stop any previous arpeggio
      arpeggioTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      arpeggioTimeoutsRef.current = [];
      // Sequentially play each note, highlight as played, then clear highlights
      const root = clickedTone;
      const intervals = getChordIntervals(options.chordType);
      const notesIdx = intervals.map(i => (root + i) % 12);
      // Clear all highlights first
      for (let i = 0; i < 12; i++) activeRef.current[i] = false;
      draw(true);
      // Play arpeggio
      const arpeggioStep = 160; // ms
      notesIdx.forEach((idx, step) => {
        arpeggioTimeoutsRef.current.push(setTimeout(() => {
          activeRef.current[idx] = true;
          draw(true);
          triggerPolySynthAttackRelease(TONE_NAMES[idx] + '4', arpeggioStep / 1000); // duration in seconds
        }, step * arpeggioStep));
      });
      // After arpeggio, clear highlights
      arpeggioTimeoutsRef.current.push(setTimeout(() => {
        notesIdx.forEach(i => { activeRef.current[i] = false; });
        draw(true);
      }, notesIdx.length * arpeggioStep + arpeggioStep));
    }
  }, [drawGrid, dimensions, options, synthRef, polySynthRef, activeRef, arpeggioTimeoutsRef, triggerSynthAttackRelease, triggerPolySynthAttackRelease, getSelectedInstrument, updateSynthsWithInstrument]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const note = TONE_NAMES[pitch % 12];
      const octave = Math.floor(pitch / 12) + 4;
      triggerSynthAttack(note + octave);
    }
  }, [triggerSynthAttack]);

  const noteOff = useCallback((channel: number, pitch: number) => {
    const note = TONE_NAMES[pitch % 12];
    const octave = Math.floor(pitch / 12) + 4;
    triggerSynthRelease(note + octave);
  }, [triggerSynthRelease]);

  // MIDI Integration functions
  const handleMidiNoteStart = useCallback((midiNote: { note: string; midi: number; velocity: number }) => {
    const toneIndex = midiNote.midi % 12;
    activeRef.current[toneIndex] = true;
    draw(true);
  }, [draw]);

  const handleMidiNoteEnd = useCallback((midiNote: { note: string; midi: number }) => {
    const toneIndex = midiNote.midi % 12;
    activeRef.current[toneIndex] = false;
    draw(true);
  }, [draw]);

  const handleMidiChordStart = useCallback((chord: { notes: Array<{ midi: number }> }) => {
    // Clear previous highlights
    for (let i = 0; i < 12; i++) {
      activeRef.current[i] = false;
    }
    
    // Highlight all notes in the chord
    chord.notes.forEach(note => {
      const toneIndex = note.midi % 12;
      activeRef.current[toneIndex] = true;
    });
    
    draw(true);
  }, [draw]);

  const handleMidiChordEnd = useCallback(() => {
    // Clear all highlights
    for (let i = 0; i < 12; i++) {
      activeRef.current[i] = false;
    }
    draw(true);
  }, [draw]);

  useEffect(() => {
    if (isInitialized) {
      drawGrid();
    }
  }, [drawGrid, isInitialized]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      console.log('Window resize handler called, densityManuallySet:', densityManuallySetRef.current);
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const parent = canvas.parentElement;
        const width = parent ? parent.clientWidth : window.innerWidth;
        const height = parent ? parent.clientHeight : window.innerHeight;
        const unit = (width + height) / densityRef.current;
        
        canvas.width = width;
        canvas.height = height;
        
        if (ctxRef.current) {
          const ctx = ctxRef.current;
          ctx.fillStyle = '#1a1a1a';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        // Only update density to responsive value if it hasn't been manually set by user
        if (!densityManuallySetRef.current) {
          console.log('Window resize: Setting responsive density');
          setDensity(getResponsiveDensity());
        } else {
          console.log('Window resize: Skipping density update (manually set)');
        }
        
        // Update dimensions and rebuild grid directly
        setDimensions({ width, height, unit });
        buildToneGrid(width, height, unit);
        draw(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [buildToneGrid, draw, densityManuallySet]);

  // Handle mouse wheel for zoom
  const handleWheel = (event: React.WheelEvent<HTMLCanvasElement> | WheelEvent) => {
    event.preventDefault();
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      // Higher zoom limits for mobile (more zoomed in)
      setDensity(prev => Math.max(15, Math.min(60, prev + event.deltaY * 0.01)));
    } else {
      // Standard zoom limits for desktop
      setDensity(prev => Math.max(10, Math.min(40, prev + event.deltaY * 0.01)));
    }
    // Mark density as manually set by user
    setDensityManuallySet(true);
  };

  // Function to reset zoom to responsive default
  const resetZoom = useCallback(() => {
    setDensityManuallySet(false);
    setDensity(getResponsiveDensity());
  }, []);

  // Rebuild grid when density changes (for zoom)
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const parent = canvas.parentElement;
    const width = parent ? parent.clientWidth : window.innerWidth;
    const height = parent ? parent.clientHeight : window.innerHeight;
    const unit = (width + height) / density;
    
    // Set global density for virtual canvas
    (window as typeof window & { __currentCanvasDensity: number }).__currentCanvasDensity = density;
    
    setDimensions(prev => {
      if (
        prev.width === width &&
        prev.height === height &&
        prev.unit === unit
      ) {
        return prev;
      }
      return { width, height, unit };
    });
    buildToneGrid(width, height, unit);
    draw(true);
  }, [density, buildToneGrid, draw]);

  // Ref for drawGrid to use in MutationObserver
  const drawGridRef = useRef(drawGrid);
  useEffect(() => {
    drawGridRef.current = drawGrid;
  }, [drawGrid]);

  // Redraw canvas when palette CSS variables change
  useEffect(() => {
    // Listen for palette changes
    const observer = new MutationObserver(() => {
      drawGridRef.current();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    return () => observer.disconnect();
  }, []); // No dependency on drawGrid!

  // Listen for instrument changes and update synths
  useEffect(() => {
    const checkInstrumentChange = () => {
      const selectedInstrument = getSelectedInstrument();
      if (selectedInstrument && (synthRef.current || polySynthRef.current)) {
        console.log('useTonnext: Updating synths with instrument:', selectedInstrument.name);
        updateSynthsWithInstrument(selectedInstrument);
      }
    };

    // Check immediately
    checkInstrumentChange();

    // Set up an interval to check for changes (since we don't have a direct way to listen to context changes)
    const interval = setInterval(checkInstrumentChange, 100);

    return () => clearInterval(interval);
  }, [getSelectedInstrument, updateSynthsWithInstrument]);

  return {
    isInitialized,
    initTonnext,
    handleCanvasClick,
    handleMouseMove,
    handleMouseLeave,
    handleWheel,
    noteOn,
    noteOff,
    density,
    setDensity,
    setLayout,
    resetZoom,
    // MIDI Integration
    handleMidiNoteStart,
    handleMidiNoteEnd,
    handleMidiChordStart,
    handleMidiChordEnd,
  };
} 