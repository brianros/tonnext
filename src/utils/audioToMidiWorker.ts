import { MidiData } from '@/hooks/useMidiPlayer';

export interface AudioToMidiOptions {
  onsetThreshold?: number;
  frameThreshold?: number;
  minimumNoteDuration?: number;
  maxPolyphony?: number;
}

export interface ConversionProgress {
  progress: number;
  message: string;
}

export interface ConversionResult {
  type: 'midi' | 'notes';
  result: Uint8Array | MidiData;
}

export class AudioToMidiWorker {
  private worker: Worker | null = null;
  private isTerminated = false;
  private messageHandler: ((event: MessageEvent) => void) | null = null;
  private errorHandler: ((error: ErrorEvent) => void) | null = null;

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    try {
      // Use Function constructor to bypass static analysis
      const workerPath = '/audio-to-midi-worker.js';
      const createWorker = new Function('path', 'return new Worker(path)');
      this.worker = createWorker(workerPath);
      this.isTerminated = false;
    } catch (error) {
      console.error('Failed to create Web Worker:', error);
      throw new Error('Web Workers are not supported in this browser');
    }
  }

  /**
   * Convert audio file to MIDI blob using Web Worker
   */
  async convertAudioToMidi(
    audioFile: File,
    options: AudioToMidiOptions = {},
    onProgress?: (progress: ConversionProgress) => void
  ): Promise<Blob> {
    if (this.isTerminated) {
      this.initWorker();
    }

    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      this.messageHandler = (event: MessageEvent) => {
        const { type, result, error } = event.data;

        switch (type) {
          case 'progress':
            onProgress?.(event.data);
            break;

          case 'conversion-complete':
            if (event.data.originalType === 'midi') {
              const blob = new Blob([result], { type: 'audio/midi' });
              resolve(blob);
            } else {
              reject(new Error('Unexpected result type'));
            }
            this.cleanup();
            break;

          case 'error':
            reject(new Error(error));
            this.cleanup();
            break;

          case 'cancelled':
            reject(new Error('Conversion was cancelled'));
            this.cleanup();
            break;
        }
      };

      this.errorHandler = (error: ErrorEvent) => {
        reject(new Error(`Worker error: ${error.message}`));
        this.cleanup();
      };

      this.worker.addEventListener('message', this.messageHandler);
      this.worker.addEventListener('error', this.errorHandler);

      // Start conversion
      this.convertFileToAudioBuffer(audioFile)
        .then(audioBuffer => {
          this.worker?.postMessage({
            type: 'convert-audio-to-midi',
            data: {
              audioBuffer,
              options
            }
          });
        })
        .catch(reject);
    });
  }

  /**
   * Convert audio file to MIDI data using Web Worker
   */
  async convertAudioToNotes(
    audioFile: File,
    onProgress?: (progress: ConversionProgress) => void
  ): Promise<MidiData> {
    if (this.isTerminated) {
      this.initWorker();
    }

    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      this.messageHandler = (event: MessageEvent) => {
        const { type, result, error } = event.data;

        switch (type) {
          case 'progress':
            onProgress?.(event.data);
            break;

          case 'conversion-complete':
            if (event.data.originalType === 'notes') {
              resolve(result as MidiData);
            } else {
              reject(new Error('Unexpected result type'));
            }
            this.cleanup();
            break;

          case 'error':
            reject(new Error(error));
            this.cleanup();
            break;

          case 'cancelled':
            reject(new Error('Conversion was cancelled'));
            this.cleanup();
            break;
        }
      };

      this.errorHandler = (error: ErrorEvent) => {
        reject(new Error(`Worker error: ${error.message}`));
        this.cleanup();
      };

      this.worker.addEventListener('message', this.messageHandler);
      this.worker.addEventListener('error', this.errorHandler);

      // Start conversion
      this.convertFileToAudioBuffer(audioFile)
        .then(audioBuffer => {
          this.worker?.postMessage({
            type: 'convert-audio-to-notes',
            data: { audioBuffer }
          });
        })
        .catch(reject);
    });
  }

  /**
   * Convert File to AudioBuffer for transfer to worker
   */
  private async convertFileToAudioBuffer(file: File): Promise<AudioBuffer> {
    const arrayBuffer = await file.arrayBuffer();
    const audioCtx = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    return await audioCtx.decodeAudioData(arrayBuffer.slice(0));
  }

  /**
   * Cancel the current conversion
   */
  cancel() {
    if (this.worker && !this.isTerminated) {
      this.worker.postMessage({ type: 'cancel' });
    }
  }

  /**
   * Clean up event listeners
   */
  private cleanup() {
    if (this.worker && this.messageHandler && this.errorHandler) {
      this.worker.removeEventListener('message', this.messageHandler);
      this.worker.removeEventListener('error', this.errorHandler);
      this.messageHandler = null;
      this.errorHandler = null;
    }
  }

  /**
   * Terminate the worker
   */
  terminate() {
    this.cleanup();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isTerminated = true;
    }
  }

  /**
   * Check if worker is supported
   */
  static isSupported(): boolean {
    return typeof Worker !== 'undefined';
  }
}

// Create a singleton instance
let workerInstance: AudioToMidiWorker | null = null;

export function getAudioToMidiWorker(): AudioToMidiWorker {
  if (!workerInstance) {
    workerInstance = new AudioToMidiWorker();
  }
  return workerInstance;
}

export function terminateAudioToMidiWorker() {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
  }
} 