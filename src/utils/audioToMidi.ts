import { BasicPitch, noteFramesToTime, addPitchBendsToNoteEvents, outputToNotesPoly } from '@spotify/basic-pitch';
import { Midi } from '@tonejs/midi';
import { getAudioToMidiWorker, AudioToMidiWorker, ConversionProgress } from './audioToMidiWorker';

export interface AudioToMidiOptions {
  onsetThreshold?: number;
  frameThreshold?: number;
  maxPolyphony?: number;
}

/**
 * Limit the number of simultaneous notes to prevent polyphony issues
 * @param notes Array of notes from BasicPitch
 * @param maxPolyphony Maximum number of simultaneous notes allowed
 * @returns Filtered array of notes with limited polyphony
 */
function limitPolyphony(notes: unknown[], maxPolyphony: number): unknown[] {
  if (notes.length === 0) return notes;
  
  // Sort notes by start time
  const sortedNotes = [...notes].sort((a, b) => (a as { startTimeSeconds: number }).startTimeSeconds - (b as { startTimeSeconds: number }).startTimeSeconds);
  const limitedNotes: unknown[] = [];
  const activeNotes: unknown[] = [];
  
  for (const note of sortedNotes) {
    // Remove notes that have ended before this note starts
    const currentTime = (note as { startTimeSeconds: number }).startTimeSeconds;
    const stillActive = activeNotes.filter(n => (n as { startTimeSeconds: number; durationSeconds: number }).startTimeSeconds + (n as { startTimeSeconds: number; durationSeconds: number }).durationSeconds > currentTime);
    
    // If we're at max polyphony, remove the oldest note
    if (stillActive.length >= maxPolyphony) {
      // Sort by start time and remove the oldest
      stillActive.sort((a, b) => (a as { startTimeSeconds: number }).startTimeSeconds - (b as { startTimeSeconds: number }).startTimeSeconds);
      stillActive.shift(); // Remove oldest note
    }
    
    // Add the new note
    stillActive.push(note);
    activeNotes.length = 0;
    activeNotes.push(...stillActive);
    
    // Add to limited notes
    limitedNotes.push(note);
  }
  
  return limitedNotes;
}

export async function convertAudioToMidi(
  audioFile: File,
  options: AudioToMidiOptions = {},
  onProgress?: (progress: ConversionProgress) => void
): Promise<Blob> {
  // Try to use Web Worker first
  if (AudioToMidiWorker.isSupported()) {
    try {
      console.log('Using Web Worker for audio-to-MIDI conversion');
      const worker = getAudioToMidiWorker();
      return await worker.convertAudioToMidi(audioFile, options, onProgress);
    } catch (error) {
      console.warn('Web Worker failed, falling back to main thread:', error);
      // Fall back to main thread implementation
    }
  }

  // Fallback to main thread implementation
  console.log('Using main thread for audio-to-MIDI conversion');
  return convertAudioToMidiMainThread(audioFile, options, onProgress);
}

/**
 * Main thread implementation (fallback)
 */
async function convertAudioToMidiMainThread(
  audioFile: File,
  options: AudioToMidiOptions = {},
  onProgress?: (progress: ConversionProgress) => void
): Promise<Blob> {
  const {
    onsetThreshold = 0.35,
    frameThreshold = 0.35,
    maxPolyphony = 4
  } = options;

  try {
    onProgress?.({ progress: 5, message: 'Reading audio file...' });
    
    // Read the audio file
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioCtx = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    let audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));

    onProgress?.({ progress: 15, message: 'Preprocessing audio...' });

    // Convert to mono if needed
    if (audioBuffer.numberOfChannels > 1) {
      const length = audioBuffer.length;
      const sampleRate = audioBuffer.sampleRate;
      const monoBuffer = audioCtx.createBuffer(1, length, sampleRate);
      const monoData = monoBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        let sum = 0;
        for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
          sum += audioBuffer.getChannelData(ch)[i];
        }
        monoData[i] = sum / audioBuffer.numberOfChannels;
      }
      audioBuffer = monoBuffer;
    }

    // Resample to 22050 Hz if needed (required by Basic Pitch)
    if (audioBuffer.sampleRate !== 22050) {
      onProgress?.({ progress: 25, message: 'Resampling audio...' });
      
      const offlineCtx = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        Math.ceil(audioBuffer.duration * 22050),
        22050
      );
      const bufferSource = offlineCtx.createBufferSource();
      bufferSource.buffer = audioBuffer;
      bufferSource.connect(offlineCtx.destination);
      bufferSource.start(0);
      audioBuffer = await offlineCtx.startRendering();
    }

    onProgress?.({ progress: 30, message: 'Loading BasicPitch model...' });

    // Initialize Basic Pitch model
    const basicPitch = new BasicPitch('/model/model.json');
    
    const frames: number[][] = [];
    const onsets: number[][] = [];
    const contours: number[][] = [];

    onProgress?.({ progress: 40, message: 'Analyzing audio with BasicPitch...' });

    // Process the audio
    await basicPitch.evaluateModel(
      audioBuffer,
      (f: number[][], o: number[][], c: number[][]) => {
        frames.push(...f);
        onsets.push(...o);
        contours.push(...c);
      },
      (progress: number) => {
        // Map BasicPitch progress (0-1) to our progress range (40-70)
        const mappedProgress = 40 + (progress * 30);
        onProgress?.({ 
          progress: Math.round(mappedProgress), 
          message: `Processing audio... ${Math.round(progress * 100)}%` 
        });
      }
    );

    onProgress?.({ progress: 75, message: 'Converting to notes...' });

    // Convert frames to notes with reduced polyphony (2 instead of default)
    const notes = noteFramesToTime(
      addPitchBendsToNoteEvents(
        contours,
        outputToNotesPoly(frames, onsets, onsetThreshold, frameThreshold, 2)
      )
    );

    // Limit polyphony to prevent too many simultaneous notes
    const limitedNotes = limitPolyphony(notes, maxPolyphony);
    
    // Debug logging
    console.log('Original notes count:', notes.length);
    console.log('Limited notes count:', limitedNotes.length);
    console.log('Polyphony reduction:', notes.length - limitedNotes.length, 'notes removed');

    onProgress?.({ progress: 85, message: 'Validating notes...' });

    // Sanitize and validate notes
    const correctedNotes = sanitizeNotes(limitedNotes);
    const validationError = validateNotes(correctedNotes);
    if (validationError) {
      throw new Error(`Validation error: ${validationError}`);
    }

    onProgress?.({ progress: 90, message: 'Generating MIDI file...' });

    // Generate MIDI file
    const midi = new Midi();
    const track = midi.addTrack();

    correctedNotes.forEach((note: unknown) => {
      const midiNote = Math.round(Math.max(0, Math.min(127, (note as { pitchMidi: number }).pitchMidi)));
      const velocity = Math.max(0, Math.min(1, (note as { amplitude: number }).amplitude));
      const startTime = Math.max(0, (note as { startTimeSeconds: number }).startTimeSeconds);
      const duration = Math.max(0, (note as { durationSeconds: number }).durationSeconds);

      track.addNote({
        midi: midiNote,
        time: startTime,
        duration: duration,
        velocity: velocity,
      });

      // Add pitch bends if present
      if ((note as { pitchBends: number[] }).pitchBends && Array.isArray((note as { pitchBends: number[] }).pitchBends)) {
        (note as { pitchBends: number[] }).pitchBends.forEach((bend: number, i: number) => {
          const clampedBend = Math.max(-1, Math.min(1, bend));
          track.addPitchBend({
            time: startTime + (duration * i) / ((note as { pitchBends: number[] }).pitchBends as number[]).length,
            value: clampedBend,
          });
        });
      }
    });

    onProgress?.({ progress: 100, message: 'Conversion complete!' });

    // Return MIDI blob
    return new Blob([midi.toArray()], { type: 'audio/midi' });
  } catch (error) {
    throw new Error(`Audio to MIDI conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function sanitizeNotes(notes: unknown[]): unknown[] {
  return notes
    .map(n => {
      if (
        typeof (n as { pitchMidi: number }).pitchMidi !== 'number' ||
        typeof (n as { amplitude: number }).amplitude !== 'number' ||
        typeof (n as { startTimeSeconds: number }).startTimeSeconds !== 'number' ||
        typeof (n as { durationSeconds: number }).durationSeconds !== 'number'
      ) {
        return null; // Remove notes missing required fields
      }
      return {
        pitchMidi: Math.round(Math.max(0, Math.min(127, (n as { pitchMidi: number }).pitchMidi))),
        amplitude: Math.max(0, Math.min(1, (n as { amplitude: number }).amplitude)),
        startTimeSeconds: Math.max(0, (n as { startTimeSeconds: number }).startTimeSeconds),
        durationSeconds: Math.max(0, (n as { durationSeconds: number }).durationSeconds),
        pitchBends: Array.isArray((n as { pitchBends: number[] }).pitchBends)
          ? (n as { pitchBends: number[] }).pitchBends.map((b: number) =>
              typeof b === 'number' ? Math.max(-1, Math.min(1, b)) : 0
            )
          : undefined,
      };
    })
    .filter(Boolean);
}

function validateNotes(notes: unknown[]): string | null {
  if (!Array.isArray(notes)) return 'Notes result is not an array.';
  
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    if (typeof (n as { pitchMidi: number }).pitchMidi !== 'number' || (n as { pitchMidi: number }).pitchMidi < 0 || (n as { pitchMidi: number }).pitchMidi > 127) {
      return `Invalid pitchMidi at index ${i}`;
    }
    if (typeof (n as { amplitude: number }).amplitude !== 'number' || (n as { amplitude: number }).amplitude < 0 || (n as { amplitude: number }).amplitude > 1) {
      return `Invalid amplitude at index ${i}`;
    }
    if (typeof (n as { startTimeSeconds: number }).startTimeSeconds !== 'number' || (n as { startTimeSeconds: number }).startTimeSeconds < 0) {
      return `Invalid startTimeSeconds at index ${i}`;
    }
    if (typeof (n as { durationSeconds: number }).durationSeconds !== 'number' || (n as { durationSeconds: number }).durationSeconds < 0) {
      return `Invalid durationSeconds at index ${i}`;
    }
    if ((n as { pitchBends: number[] }).pitchBends && Array.isArray((n as { pitchBends: number[] }).pitchBends)) {
      for (let j = 0; j < (n as { pitchBends: number[] }).pitchBends.length; j++) {
        if (typeof (n as { pitchBends: number[] }).pitchBends[j] !== 'number' || (n as { pitchBends: number[] }).pitchBends[j] < -1 || (n as { pitchBends: number[] }).pitchBends[j] > 1) {
          return `Invalid pitchBend at note ${i}, bend ${j}`;
        }
      }
    }
  }
  return null;
}

export function isAudioFile(file: File): boolean {
  const audioTypes = [
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'audio/flac',
    'audio/aac',
    'audio/mp4',
    'audio/webm'
  ];
  
  const audioExtensions = ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.webm'];
  
  return audioTypes.includes(file.type) || 
         audioExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
} 