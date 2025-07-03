import { BasicPitch, noteFramesToTime, addPitchBendsToNoteEvents, outputToNotesPoly } from '@spotify/basic-pitch';
import { MidiNote, MidiTrack, MidiData } from '@/hooks/useMidiPlayer';
import { Midi } from '@tonejs/midi';

export async function convertAudioToNotes(audioFile: File): Promise<MidiData> {
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
  
  // Resample if needed
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
  
  // @ts-ignore
  const basicPitch = new BasicPitch('/model/model.json');
  const frames: number[][] = [];
  const onsets: number[][] = [];
  const contours: number[][] = [];
  
  await basicPitch.evaluateModel(
    audioBuffer,
    (f: number[][], o: number[][], c: number[][]) => {
      frames.push(...f);
      onsets.push(...o);
      contours.push(...c);
    },
    (p: number) => {
      // Progress callback (optional)
    }
  );
  
  // Use the specified thresholds: 0.40 for model confidence, 0.55 for note segmentation, 4 for polyphony
  const notesResult = noteFramesToTime(
    addPitchBendsToNoteEvents(
      contours,
      outputToNotesPoly(frames, onsets, 0.35, 0.9, 4)
    )
  );
  
  // Debug logging
  console.log('BasicPitch notesResult:', notesResult);
  
  // Convert the notes to the format expected by the MIDI player
  const convertedNotes: MidiNote[] = notesResult.map((note: any) => ({
    note: note.name,
    midi: note.midi,
    time: note.start,
    duration: note.end - note.start,
    velocity: note.velocity || 0.8,
    channel: 0
  }));
  
  // Debug logging
  console.log('Converted notes for MIDI:', convertedNotes);
  
  // Calculate duration from the latest note end time, guard against NaN/-Infinity
  let duration = 0;
  if (convertedNotes.length > 0) {
    duration = Math.max(...convertedNotes.map(n => (n.time ?? 0) + (n.duration ?? 0)));
    if (!isFinite(duration) || isNaN(duration)) duration = 0;
  }
  
  // Create a single track with all the notes
  const track: MidiTrack = {
    name: 'Audio Track',
    notes: convertedNotes,
    channel: 0
  };
  
  const midiData: MidiData = {
    duration,
    tracks: [track],
    tempo: 120, // Default tempo for audio files
    timeSignature: [4, 4] // Default time signature
  };
  
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