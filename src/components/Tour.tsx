'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

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
    content: 'Tonnext is an interactive music visualization tool that explores tonal relationships through beautiful geometric patterns. Let\'s take a quick tour of the key features. (Screen reader users: all interactive elements have descriptive aria-labels.)',
    target: 'body',
    position: 'center'
  },
  {
    id: 'midi-player',
    title: 'MIDI Player',
    content: 'Upload and play MIDI files to see how your music maps to the tonal network. The visualization will highlight the notes and chords as they play. (aria-label: MIDI Player Controls)',
    target: '[data-tour="midi-player"]',
    position: 'bottom'
  },
  {
    id: 'load-button',
    title: 'Load Files',
    content: 'Click the Load button to upload MIDI files, audio files, or YouTube URLs. Tonnext can convert audio to MIDI automatically. (aria-label: Load Files)',
    target: '.midi-player-compact button:has(.load-icon)',
    position: 'bottom'
  },
  {
    id: 'playback-controls',
    title: 'Playback Controls',
    content: 'Use Play/Pause, Stop, and Mute buttons to control playback. The progress bar shows your position in the track. (aria-label: Playback Controls)',
    target: '.midi-player-compact button:has(.playback-icon)',
    position: 'bottom'
  },
  {
    id: 'progress-bar',
    title: 'Progress Bar',
    content: 'Drag the progress bar to jump to any point in your music. The time display shows current position and total duration. (aria-label: Progress Bar)',
    target: '.midi-player-compact__progress-bar',
    position: 'bottom'
  },
  {
    id: 'export-button',
    title: 'Export Video',
    content: 'Create beautiful videos of your music visualization with custom settings for aspect ratio, quality, and timing. (aria-label: Export Video)',
    target: '.midi-player-compact button:has(.export-icon)',
    position: 'bottom'
  },
  {
    id: 'theme-settings',
    title: 'Theme & Appearance',
    content: 'Customize the visual theme with preset color palettes or create your own custom colors to match your style. (aria-label: Theme Settings)',
    target: '[data-tour="appearance"]',
    position: 'bottom'
  },
  {
    id: 'tour-btn',
    title: 'Guided Tour',
    content: 'Click this button any time to restart the guided tour. (aria-label: Start guided tour)',
    target: '.tour-btn[aria-label="Start guided tour"]',
    position: 'bottom'
  },
  {
    id: 'settings-btn',
    title: 'Settings',
    content: 'Open the settings panel to adjust advanced options. (aria-label: Settings)',
    target: '.options-btn[aria-label="Settings"]',
    position: 'bottom'
  },
  {
    id: 'canvas',
    title: 'Interactive Canvas',
    content: 'This is the main visualization area (aria-label: Main Tonnetz Canvas). Click on any node to hear and see musical notes, chords, or arpeggios. The triangular grid shows the relationships between musical tones.',
    target: '[aria-label="Main Tonnetz Canvas"]',
    position: 'center'
  },
  {
    id: 'instrument-selector',
    title: 'Instrument Selector',
    content: 'Choose your instrument sound for playback. (aria-label: Instrument Selector)',
    target: '[aria-label="Instrument Selector"]',
    position: 'top'
  },
  {
    id: 'mode-controls',
    title: 'Playback Modes',
    content: 'Choose how you want to interact with the canvas: Note (aria-label: Note Mode), Chord (aria-label: Chord Mode), or Arpeggio (aria-label: Arpeggio Mode).',
    target: '[data-tour="mode-controls"]',
    position: 'top'
  },
  {
    id: 'chord-selector',
    title: 'Chord Types',
    content: 'Select from 25+ chord types including major, minor, diminished, augmented, and extended chords like 7ths, 9ths, and suspended chords. (aria-label: Chord Type Selector)',
    target: '[aria-label="Chord Type Selector"]',
    position: 'center'
  },
  {
    id: 'settings-modal',
    title: 'Settings Modal',
    content: 'Here you can adjust advanced settings for Tonnext. (aria-label: Settings)',
    target: '.export-modal[role="dialog"], [aria-label="Settings"]',
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
  const [visible, setVisible] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const currentTourStep = TOUR_STEPS[step];
  const isCanvasStep = currentTourStep.id === 'canvas';

  const positionTooltip = useCallback((target: HTMLElement | null, position: string) => {
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
  }, [currentTourStep]);

  // Handle tour opening and step change
  useEffect(() => {
    if (isOpen) {
      setVisible(false);
      // Use longer delay for step changes, shorter for tour opening
      const delay = step === 0 ? 50 : 220;
      const timeout = setTimeout(() => {
        setVisible(true);
      }, delay);
      return () => clearTimeout(timeout);
    } else {
      setVisible(false); // Ensure tooltip is hidden when tour is closed
    }
  }, [isOpen, step]); // Add step to dependency array

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
        // Handle CSS selector targets
        if (stepObj.target.startsWith('[') || stepObj.target.startsWith('.')) {
          targetElement = document.querySelector(stepObj.target);
        } else {
          targetElement = document.body;
        }
    }

    setHighlightedElement(targetElement);
    
    // Position tooltip after a short delay to ensure DOM is ready
    const positionTimeout = setTimeout(() => {
      positionTooltip(targetElement, isCanvasStep ? 'left' : stepObj.position);
    }, 50);
    
    return () => clearTimeout(positionTimeout);
  }, [step, isOpen, isCanvasStep, positionTooltip]);

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
          <button
            onClick={handleSkip}
            className="export-modal-btn export-modal-close"
            title="Close"
          >
            ×
          </button>
          <div className="mb-4">
            <h3 className="text-lg font-bold text-white">
              {currentTourStep.title}
            </h3>
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
                  className="tour-tooltip__btn tour-tooltip__btn--highlight"
                >
                  Previous
                </button>
              )}
              
              <button
                onClick={handleNext}
                className="tour-tooltip__btn tour-tooltip__btn--accent"
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