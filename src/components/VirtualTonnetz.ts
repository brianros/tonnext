interface VirtualTonnetzNode {
  x: number;
  y: number;
  tone: number;
}

interface VirtualTonnetzOptions {
  mode: 'note' | 'chord' | 'arpeggio';
  chordType: string;
  density?: number;
}

// Constants from useTonnext
const LAYOUT_RIEMANN = 'riemann';
const LAYOUT_SONOME = 'sonome';
const SQRT_3 = Math.sqrt(3);

// Utility function to get CSS variable
function getCssVar(name: string, fallback: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name) || fallback;
}

// Utility function to calculate luminance
function getLuminance(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export class VirtualTonnetz {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private options: VirtualTonnetzOptions;
  private nodes: VirtualTonnetzNode[] = [];
  private activeNotes: boolean[] = new Array(12).fill(false);
  private dimensions: { width: number; height: number; unit: number };
  private density: number = 20;
  private layout: string = LAYOUT_RIEMANN;

  constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, options: VirtualTonnetzOptions) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.options = options;
    
    // Use provided density or set responsive density like the main canvas
    if (options.density !== undefined) {
      this.density = options.density;
    } else {
      this.setResponsiveDensity();
    }
    
    this.dimensions = {
      width: canvas.width,
      height: canvas.height,
      unit: (canvas.width + canvas.height) / this.density
    };
    
    this.buildToneGrid();
    this.drawGrid();
  }

  private setResponsiveDensity() {
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    if (isMobile) {
      this.density = Math.max(14, Math.min(24, Math.floor(window.innerWidth / 24)));
    } else {
      this.density = Math.max(16, Math.min(28, Math.floor(window.innerWidth / 28)));
    }
  }

  private buildToneGrid() {
    this.nodes = [];
    const { width, height, unit } = this.dimensions;
    
    if (this.layout === LAYOUT_RIEMANN) {
      const yUnit = unit * SQRT_3;
      const uW = Math.ceil(width / unit);
      const uH = Math.ceil(height / yUnit);
      
      for (let j = -Math.floor(uW / 2 + 1); j <= Math.floor(uW / 2 + 1); j++) {
        for (let i = -Math.floor(uH / 2 + 1); i <= Math.floor(uH / 2 + 1); i++) {
          this.addNode(((i - 7 * j) % 12 + 12) % 12, width / 2 - j * unit, height / 2 + i * yUnit, unit);
          this.addNode(((i - 7 * j) % 12 + 12 + 4) % 12, width / 2 - (j - 0.5) * unit, height / 2 + (i + 0.5) * yUnit, unit);
        }
      }
    } else if (this.layout === LAYOUT_SONOME) {
      const xUnit = unit * SQRT_3;
      const uW = Math.ceil(width / xUnit);
      const uH = Math.ceil(height / unit);

      for (let j = -Math.floor(uH / 2 + 1); j <= Math.floor(uH / 2 + 1); j++) {
        for (let i = -Math.floor(uW / 2 + 1); i <= Math.floor(uW / 2 + 1); i++) {
          this.addNode(((i - 7 * j) % 12 + 12) % 12, width / 2 + i * xUnit, height / 2 + j * unit, unit);
          this.addNode(((i - 7 * j) % 12 + 12 + 4) % 12, width / 2 + (i + 0.5) * xUnit, height / 2 + (j - 0.5) * unit, unit);
        }
      }
    }
  }

  private addNode(tone: number, x: number, y: number, unit: number) {
    if (x >= 0 && x < this.dimensions.width && y >= 0 && y < this.dimensions.height) {
      this.nodes.push({ x, y, tone });
    }
  }

  private drawGrid() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const { width, height, unit } = this.dimensions;
    if (unit === 0) return;
    
    ctx.clearRect(0, 0, width, height);
    
    // Use palette from CSS variables - exact same as main canvas
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

    const radius = unit / 5;

    // draw edges - exact same logic as main canvas
    ctx.strokeStyle = colorEdge;
    ctx.lineWidth = 1;
    const threshold = unit * 1.05;
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const dx = this.nodes[i].x - this.nodes[j].x;
        const dy = this.nodes[i].y - this.nodes[j].y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.9 * unit && dist < threshold) {
          ctx.beginPath();
          ctx.moveTo(this.nodes[i].x, this.nodes[i].y);
          ctx.lineTo(this.nodes[j].x, this.nodes[j].y);
          ctx.stroke();
        }
      }
    }

    // draw nodes (without labels first) - exact same logic as main canvas
    this.nodes.forEach(({ x, y, tone }) => {
      const active = this.activeNotes[tone];
      ctx.fillStyle = active ? nodeHighlight : nodeNormal;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // Highlight lines and triangles between active notes - exact same logic as main canvas
    const activeNodes = this.nodes.filter(n => this.activeNotes[n.tone]);
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

    // Draw labels last to ensure they're always on top - exact same logic as main canvas
    this.nodes.forEach(({ x, y, tone }) => {
      const active = this.activeNotes[tone];
      
      // Draw note labels
      const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const noteName = noteNames[tone % 12];
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
  }

  public update(time: number, midiData?: any) {
    // Clear active notes
    this.activeNotes.fill(false);
    
    if (midiData && midiData.tracks) {
      // Parse actual MIDI data to find notes at current time
      for (const track of midiData.tracks) {
        if (track.notes && Array.isArray(track.notes)) {
          for (const event of track.notes) {
            if (
              event.time <= time &&
              (event.time + (event.duration || 0) > time)
            ) {
              if (typeof event.midi === 'number') {
                this.activeNotes[event.midi % 12] = true;
              }
            }
          }
        }
      }
    } else {
      // Fallback simulation
      const noteIndex = Math.floor(time * 2) % 12; // Change note every 0.5 seconds
      this.activeNotes[noteIndex] = true;
    }
    
    // Redraw the grid
    this.drawGrid();
  }

  public setActiveNotes(notes: number[]) {
    this.activeNotes.fill(false);
    for (const note of notes) {
      this.activeNotes[note % 12] = true;
    }
    this.drawGrid();
  }

  public updateDensity(newDensity: number) {
    this.density = newDensity;
    this.dimensions.unit = (this.dimensions.width + this.dimensions.height) / this.density;
    this.buildToneGrid();
    this.drawGrid();
  }

  public getDensity(): number {
    return this.density;
  }
}

export function createVirtualTonnetz(
  canvas: HTMLCanvasElement, 
  ctx: CanvasRenderingContext2D,
  options: VirtualTonnetzOptions = { mode: 'note', chordType: 'major' }
): VirtualTonnetz {
  return new VirtualTonnetz(canvas, ctx, options);
} 