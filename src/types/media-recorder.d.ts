interface MediaRecorderOptions {
  mimeType?: string;
  audioBitsPerSecond?: number;
  videoBitsPerSecond?: number;
  bitsPerSecond?: number;
}

interface MediaRecorderDataAvailableEvent extends Event {
  data: Blob;
}

interface MediaRecorderErrorEvent extends Event {
  error: DOMException;
}

interface MediaRecorderEventMap {
  dataavailable: MediaRecorderDataAvailableEvent;
  error: MediaRecorderErrorEvent;
  pause: Event;
  resume: Event;
  start: Event;
  stop: Event;
}

declare class MediaRecorder extends EventTarget {
  constructor(stream: MediaStream, options?: MediaRecorderOptions);
  
  readonly state: 'inactive' | 'recording' | 'paused';
  readonly stream: MediaStream;
  readonly mimeType: string;
  
  ondataavailable: ((event: MediaRecorderDataAvailableEvent) => void) | null;
  onerror: ((event: MediaRecorderErrorEvent) => void) | null;
  onpause: ((event: Event) => void) | null;
  onresume: ((event: Event) => void) | null;
  onstart: ((event: Event) => void) | null;
  onstop: ((event: Event) => void) | null;
  
  addEventListener<K extends keyof MediaRecorderEventMap>(
    type: K,
    listener: (event: MediaRecorderEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions
  ): void;
  
  removeEventListener<K extends keyof MediaRecorderEventMap>(
    type: K,
    listener: (event: MediaRecorderEventMap[K]) => void,
    options?: boolean | EventListenerOptions
  ): void;
  
  start(timeslice?: number): void;
  stop(): void;
  pause(): void;
  resume(): void;
  requestData(): void;
  
  static isTypeSupported(type: string): boolean;
}

declare global {
  interface Window {
    MediaRecorder: typeof MediaRecorder;
  }
} 