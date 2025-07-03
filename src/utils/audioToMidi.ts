import { BasicPitch, noteFramesToTime, addPitchBendsToNoteEvents, outputToNotesPoly } from '@spotify/basic-pitch';
import { Midi } from '@tonejs/midi';

export interface AudioToMidiOptions {
  onsetThreshold?: number;
  frameThreshold?: number;
  minimumNoteDuration?: number;
}

export async function convertAudioToMidi(
  audioFile: File,
  options: AudioToMidiOptions = {}
): Promise<Blob> {
  const {
    onsetThreshold = 0.35,
    frameThreshold = 0.35,
    minimumNoteDuration = 5
  } = options;

  try {
    // Read the audio file
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    let audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));

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

    // Initialize Basic Pitch model
    // @ts-ignore
    const basicPitch = new BasicPitch('/model/model.json');
    
    const frames: number[][] = [];
    const onsets: number[][] = [];
    const contours: number[][] = [];

    // Process the audio
    await basicPitch.evaluateModel(
      audioBuffer,
      (f: number[][], o: number[][], c: number[][]) => {
        frames.push(...f);
        onsets.push(...o);
        contours.push(...c);
      },
      () => {}
    );

    // Convert frames to notes
    const notes = noteFramesToTime(
      addPitchBendsToNoteEvents(
        contours,
        outputToNotesPoly(frames, onsets, onsetThreshold, frameThreshold, minimumNoteDuration)
      )
    );

    // Sanitize and validate notes
    const correctedNotes = sanitizeNotes(notes);
    const validationError = validateNotes(correctedNotes);
    if (validationError) {
      throw new Error(`Validation error: ${validationError}`);
    }

    // Generate MIDI file
    const midi = new Midi();
    const track = midi.addTrack();

    correctedNotes.forEach((note: any) => {
      const midiNote = Math.round(Math.max(0, Math.min(127, note.pitchMidi)));
      const velocity = Math.max(0, Math.min(1, note.amplitude));
      const startTime = Math.max(0, note.startTimeSeconds);
      const duration = Math.max(0, note.durationSeconds);

      track.addNote({
        midi: midiNote,
        time: startTime,
        duration: duration,
        velocity: velocity,
      });

      // Add pitch bends if present
      if (note.pitchBends && Array.isArray(note.pitchBends)) {
        note.pitchBends.forEach((bend: number, i: number) => {
          const clampedBend = Math.max(-1, Math.min(1, bend));
          track.addPitchBend({
            time: startTime + (duration * i) / note.pitchBends.length,
            value: clampedBend,
          });
        });
      }
    });

    // Return MIDI blob
    return new Blob([midi.toArray()], { type: 'audio/midi' });
  } catch (error) {
    throw new Error(`Audio to MIDI conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function sanitizeNotes(notes: any[]): any[] {
  return notes
    .map(n => {
      if (
        typeof n.pitchMidi !== 'number' ||
        typeof n.amplitude !== 'number' ||
        typeof n.startTimeSeconds !== 'number' ||
        typeof n.durationSeconds !== 'number'
      ) {
        return null; // Remove notes missing required fields
      }
      return {
        pitchMidi: Math.round(Math.max(0, Math.min(127, n.pitchMidi))),
        amplitude: Math.max(0, Math.min(1, n.amplitude)),
        startTimeSeconds: Math.max(0, n.startTimeSeconds),
        durationSeconds: Math.max(0, n.durationSeconds),
        pitchBends: Array.isArray(n.pitchBends)
          ? n.pitchBends.map((b: number) =>
              typeof b === 'number' ? Math.max(-1, Math.min(1, b)) : 0
            )
          : undefined,
      };
    })
    .filter(Boolean);
}

function validateNotes(notes: any[]): string | null {
  if (!Array.isArray(notes)) return 'Notes result is not an array.';
  
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    if (typeof n.pitchMidi !== 'number' || n.pitchMidi < 0 || n.pitchMidi > 127) {
      return `Invalid pitchMidi at index ${i}`;
    }
    if (typeof n.amplitude !== 'number' || n.amplitude < 0 || n.amplitude > 1) {
      return `Invalid amplitude at index ${i}`;
    }
    if (typeof n.startTimeSeconds !== 'number' || n.startTimeSeconds < 0) {
      return `Invalid startTimeSeconds at index ${i}`;
    }
    if (typeof n.durationSeconds !== 'number' || n.durationSeconds < 0) {
      return `Invalid durationSeconds at index ${i}`;
    }
    if (n.pitchBends && Array.isArray(n.pitchBends)) {
      for (let j = 0; j < n.pitchBends.length; j++) {
        if (typeof n.pitchBends[j] !== 'number' || n.pitchBends[j] < -1 || n.pitchBends[j] > 1) {
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