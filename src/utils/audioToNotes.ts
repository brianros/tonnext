import { BasicPitch, noteFramesToTime, addPitchBendsToNoteEvents, outputToNotesPoly } from '@spotify/basic-pitch';
import { MidiNote, MidiTrack, MidiData } from '@/hooks/useMidiPlayer';
import { Midi } from '@tonejs/midi';
import { getAudioToMidiWorker, AudioToMidiWorker, ConversionProgress } from './audioToMidiWorker';

/**
 * Limit the number of simultaneous notes to prevent polyphony issues
 * @param notes Array of MIDI notes
 * @param maxPolyphony Maximum number of simultaneous notes allowed
 * @returns Filtered array of notes with limited polyphony
 */
function limitPolyphony(notes: MidiNote[], maxPolyphony: number): MidiNote[] {
  if (notes.length === 0) return notes;
  
  // Sort notes by start time
  const sortedNotes = [...notes].sort((a, b) => a.time - b.time);
  const limitedNotes: MidiNote[] = [];
  const activeNotes: MidiNote[] = [];
  
  for (const note of sortedNotes) {
    // Remove notes that have ended before this note starts
    const currentTime = note.time;
    const stillActive = activeNotes.filter(n => n.time + n.duration > currentTime);
    
    // If we're at max polyphony, remove the oldest note
    if (stillActive.length >= maxPolyphony) {
      // Sort by start time and remove the oldest
      stillActive.sort((a, b) => a.time - b.time);
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

export async function convertAudioToNotes(
  audioFile: File,
  onProgress?: (progress: ConversionProgress) => void
): Promise<MidiData> {
  // Try to use Web Worker first
  if (AudioToMidiWorker.isSupported()) {
    try {
      console.log('Using Web Worker for audio-to-notes conversion');
      const worker = getAudioToMidiWorker();
      return await worker.convertAudioToNotes(audioFile, onProgress);
    } catch (error) {
      console.warn('Web Worker failed, falling back to main thread:', error);
      // Fall back to main thread implementation
    }
  }

  // Fallback to main thread implementation
  console.log('Using main thread for audio-to-notes conversion');
  return convertAudioToNotesMainThread(audioFile, onProgress);
}

/**
 * Main thread implementation (fallback)
 */
async function convertAudioToNotesMainThread(
  audioFile: File,
  onProgress?: (progress: ConversionProgress) => void
): Promise<MidiData> {
  onProgress?.({ progress: 5, message: 'Reading audio file...' });
  
  const arrayBuffer = await audioFile.arrayBuffer();
  const audioCtx = new (window.AudioContext || (window as unknown as typeof window & { webkitAudioContext: typeof AudioContext }))();
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
  
  // Resample if needed
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
  
  const basicPitch = new BasicPitch('/model/model.json');
  const frames: number[][] = [];
  const onsets: number[][] = [];
  const contours: number[][] = [];
  
  onProgress?.({ progress: 40, message: 'Analyzing audio with BasicPitch...' });
  
  await basicPitch.evaluateModel(
    audioBuffer,
    (f: number[][], o: number[][], c: number[][]) => {
      frames.push(...f);
      onsets.push(...o);
      contours.push(...c);
    },
    (p: number) => {
      // Map BasicPitch progress (0-1) to our progress range (40-70)
      const mappedProgress = 40 + (p * 30);
      onProgress?.({ 
        progress: Math.round(mappedProgress), 
        message: `Processing audio... ${Math.round(p * 100)}%` 
      });
    }
  );
  
  onProgress?.({ progress: 75, message: 'Converting to notes...' });
  
  // Use the specified thresholds: 0.40 for model confidence, 0.55 for note segmentation, 2 for polyphony (reduced from 4)
  const notesResult = noteFramesToTime(
    addPitchBendsToNoteEvents(
      contours,
      outputToNotesPoly(frames, onsets, 0.35, 0.9, 2)
    )
  );
  
  // Debug logging
  console.log('BasicPitch notesResult:', notesResult);
  
  // Convert the notes to the format expected by the MIDI player
  const convertedNotes: MidiNote[] = (notesResult as unknown as Array<{ name: string; midi: number; start: number; end: number; velocity?: number }>).map((note) => ({
    note: note.name,
    midi: note.midi,
    time: note.start,
    duration: note.end - note.start,
    velocity: note.velocity || 0.8,
    channel: 0
  }));
  
  onProgress?.({ progress: 85, message: 'Limiting polyphony...' });
  
  // Post-process to limit polyphony to 4 simultaneous notes maximum (reduced from 8)
  const limitedNotes = limitPolyphony(convertedNotes, 4);
  
  // Debug logging
  console.log('Original notes count:', convertedNotes.length);
  console.log('Limited notes count:', limitedNotes.length);
  console.log('Polyphony reduction:', convertedNotes.length - limitedNotes.length, 'notes removed');
  console.log('Converted notes for MIDI:', limitedNotes);
  
  // Calculate duration from the latest note end time, guard against NaN/-Infinity
  let duration = 0;
  if (limitedNotes.length > 0) {
    duration = Math.max(...limitedNotes.map(n => (n.time ?? 0) + (n.duration ?? 0)));
    if (!isFinite(duration) || isNaN(duration)) duration = 0;
  }
  
  // Create a single track with all the notes
  const track: MidiTrack = {
    name: 'Audio Track',
    notes: limitedNotes,
    channel: 0
  };
  
  const midiData: MidiData = {
    duration,
    tracks: [track],
    tempo: 120, // Default tempo for audio files
    timeSignature: [4, 4] // Default time signature
  };
  
  onProgress?.({ progress: 100, message: 'Conversion complete!' });
  
  return midiData;
}

/**
 * Convert MidiData to a valid MIDI file (Uint8Array) using @tonejs/midi.
 * Usage: const midiArray = midiDataToFile(midiData); // then trigger download
 */
export function midiDataToFile(midiData: MidiData): Uint8Array {
  const midi = new Midi();
  midi.header.setTempo(midiData.tempo);
  midi.header.timeSignatures.push({ ticks: 0, timeSignature: midiData.timeSignature });

  midiData.tracks.forEach(track => {
    const midiTrack = midi.addTrack();
    track.notes.forEach(note => {
      midiTrack.addNote({
        midi: note.midi,
        time: note.time,
        duration: note.duration,
        velocity: note.velocity,
      });
    });
  });

  return midi.toArray();
} 