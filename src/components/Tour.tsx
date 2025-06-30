'use client';

import { useState, useEffect, useRef } from 'react';

interface TourStep {
  id: string;
  title: string;
  content: string;
  target: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: () => void;
}

interface TourProps {
  isOpen: boolean;
  onComplete: () => void;
  step: number;
  setStep: (step: number) => void;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Tonnext!',
    content: 'Tonnext is an interactive music visualization tool that explores tonal relationships through beautiful geometric patterns. Let\'s take a quick tour of the key features.',
    target: 'body',
    position: 'center'
  },
  {
    id: 'canvas',
    title: 'Interactive Canvas',
    content: 'This is the main visualization area. Click on any node to hear and see musical notes, chords, or arpeggios. The triangular grid shows the relationships between musical tones.',
    target: 'canvas',
    position: 'center'
  },
  {
    id: 'midi-player',
    title: 'MIDI Player',
    content: 'Upload and play MIDI files to see how your music maps to the tonal network. The visualization will highlight the notes and chords as they play.',
    target: 'midi-player',
    position: 'bottom'
  },
  {
    id: 'mode-controls',
    title: 'Playback Modes',
    content: 'Choose how you want to interact with the canvas: Note (single tones), Chord (harmonies), or Arpeggio (sequential chord notes).',
    target: 'mode-controls',
    position: 'top'
  },
  {
    id: 'chord-selector',
    title: 'Chord Types',
    content: 'Select from 25+ chord types including major, minor, diminished, augmented, and extended chords like 7ths, 9ths, and suspended chords.',
    target: 'chord-selector',
    position: 'center'
  },
  {
    id: 'appearance',
    title: 'Appearance',
    content: 'Customize the visual theme with preset color palettes or create your own custom colors to match your style.',
    target: 'appearance',
    position: 'bottom'
  },
  {
    id: 'zoom',
    title: 'Zoom & Navigation',
    content: 'Use your mouse wheel to zoom in and out of the visualization. The grid adapts to show more or fewer details.',
    target: 'canvas',
    position: 'center'
  },
  {
    id: 'complete',
    title: 'You\'re All Set!',
    content: 'You now know the basics of Tonnext. Start exploring by clicking on the canvas, uploading MIDI files, or trying different chord types. Have fun creating music!',
    target: 'body',
    position: 'center'
  }
];

export default function Tour({ isOpen, onComplete, step, setStep }: TourProps) {
  const [highlightedElement, setHighlightedElement] = useState<HTMLElement | null>(null);
  const [visible, setVisible] = useState(true);
  const overlayRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const currentTourStep = TOUR_STEPS[step];
  const isCanvasStep = currentTourStep.id === 'canvas';

  // Animate tooltip on step change
  useEffect(() => {
    if (!isOpen) return;
    setVisible(false);
    const timeout = setTimeout(() => {
      setVisible(true);
    }, 220); // match CSS transition duration
    return () => clearTimeout(timeout);
  }, [step, isOpen]);

  // Show a chord being pressed in the canvas during the 'Interactive Canvas' step
  useEffect(() => {
    if (!isOpen || !isCanvasStep) return;
    if (!visible) return;
    // Wait 1000ms after tooltip is visible
    const timeout = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('tour-demo-chord', { detail: { chord: 'maj7' } }));
    }, 700);
    return () => clearTimeout(timeout);
  }, [step, isOpen, isCanvasStep, visible]);

  useEffect(() => {
    if (!isOpen) return;

    const stepObj = TOUR_STEPS[step];
    let targetElement: HTMLElement | null = null;

    // Find target element based on step
    switch (stepObj.target) {
      case 'canvas':
        targetElement = document.querySelector('canvas');
        break;
      case 'midi-player':
        targetElement = document.querySelector('[data-tour="midi-player"]');
        break;
      case 'mode-controls':
        targetElement = document.querySelector('[data-tour="mode-controls"]');
        break;
      case 'chord-selector':
        targetElement = document.querySelector('[data-tour="chord-selector"]');
        break;
      case 'appearance':
        targetElement = document.querySelector('[data-tour="appearance"]');
        break;
      default:
        targetElement = document.body;
    }

    setHighlightedElement(targetElement);
    setTimeout(() => {
      // For the canvas step, force position to 'left'
      positionTooltip(targetElement, isCanvasStep ? 'left' : stepObj.position);
    }, 100);
  }, [step, isOpen, isCanvasStep]);

  const positionTooltip = (target: HTMLElement | null, position: string) => {
    if (!target || !tooltipRef.current) return;

    const targetRect = target.getBoundingClientRect();
    const tooltip = tooltipRef.current;
    tooltip.style.visibility = 'hidden';
    tooltip.style.display = 'block';
    const tooltipRect = tooltip.getBoundingClientRect();
    tooltip.style.visibility = 'visible';

    let top = 0;
    let left = 0;

    // Special case for 4th step (Playback Modes)
    const isModeControlsStep = currentTourStep.id === 'mode-controls';

    switch (position) {
      case 'top':
        // Raise the tooltip higher for the 4th step
        top = targetRect.top - tooltipRect.height - (isModeControlsStep ? 100 : 20);
        left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'bottom':
        top = targetRect.bottom + 20;
        left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'left':
        top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
        left = targetRect.left - tooltipRect.width - 40; // extra margin from edge
        left = Math.max(left, 32); // never too close to the edge
        break;
      case 'right':
        top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
        left = targetRect.right + 20;
        break;
      case 'center':
      default:
        top = window.innerHeight / 2 - tooltipRect.height / 2;
        left = window.innerWidth / 2 - tooltipRect.width / 2;
        break;
    }

    // Ensure tooltip stays within viewport
    top = Math.max(20, Math.min(top, window.innerHeight - tooltipRect.height - 20));
    left = Math.max(20, Math.min(left, window.innerWidth - tooltipRect.width - 20));

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
  };

  const handleNext = () => {
    if (step < TOUR_STEPS.length - 1) {
      setVisible(false);
      setTimeout(() => setStep(step + 1), 200);
    } else {
      onComplete();
    }
  };

  const handlePrevious = () => {
    if (step > 0) {
      setVisible(false);
      setTimeout(() => setStep(step - 1), 200);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay: transparent over canvas for the canvas step */}
      {!isCanvasStep ? (
        <div
          ref={overlayRef}
          className="tour-overlay"
          onClick={handleSkip}
        />
      ) : (
        <>
          {/* Overlay for everything except the canvas */}
          <div
            ref={overlayRef}
            className="tour-overlay"
            style={{ pointerEvents: 'auto', background: 'transparent' }}
            onClick={handleSkip}
          />
        </>
      )}

      {/* Highlight overlay for target element */}
      {highlightedElement && highlightedElement !== document.body && (
        <div
          className="tour-highlight"
          style={{
            top: highlightedElement.getBoundingClientRect().top - 4,
            left: highlightedElement.getBoundingClientRect().left - 4,
            width: highlightedElement.getBoundingClientRect().width + 8,
            height: highlightedElement.getBoundingClientRect().height + 8,
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className={`tour-tooltip transition-all duration-200 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
        style={{
          display: 'block',
          pointerEvents: visible ? 'auto' : 'none',
        }}
      >
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-bold text-white">
              {currentTourStep.title}
            </h3>
            <button
              onClick={handleSkip}
              className="text-gray-400 hover:text-white text-xl font-bold"
            >
              ×
            </button>
          </div>
          
          <p className="text-sm leading-relaxed mb-6">
            {currentTourStep.content}
          </p>

          <div className="flex justify-between items-center">
            <div className="text-xs text-gray-400">
              {step + 1} of {TOUR_STEPS.length}
            </div>
            
            <div className="flex space-x-2">
              {step > 0 && (
                <button
                  onClick={handlePrevious}
                  className="px-4 py-2 text-sm font-medium rounded"
                  style={{
                    background: 'var(--color-highlight)',
                    color: 'var(--color-main)',
                  }}
                >
                  Previous
                </button>
              )}
              
              <button
                onClick={handleNext}
                className="px-4 py-2 text-sm font-medium rounded"
                style={{
                  background: 'var(--color-accent)',
                  color: 'white',
                }}
              >
                {step === TOUR_STEPS.length - 1 ? 'Finish' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 