"use client";
import React, { useState } from 'react';
import { BasicPitch, noteFramesToTime, addPitchBendsToNoteEvents, outputToNotesPoly } from '@spotify/basic-pitch';

const AudioToMidi: React.FC = () => {
  const [status, setStatus] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setStatus(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('Processing...');
    try {
      const arrayBuffer = await file.arrayBuffer();
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
        () => {}
      );
      const notes = noteFramesToTime(
        addPitchBendsToNoteEvents(
          contours,
          outputToNotesPoly(frames, onsets, 0.35, 0.35, 5)
        )
      );
      // Correction step: clamp and sanitize notes
      const correctNotes = (notesArr: any[]): any[] => {
        return notesArr
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
      };
      const correctedNotes = correctNotes(notes);
      // Validation step
      const validateNotes = (notesArr: any[]): string | null => {
        if (!Array.isArray(notesArr)) return 'Notes result is not an array.';
        for (let i = 0; i < notesArr.length; i++) {
          const n = notesArr[i];
          if (typeof n.pitchMidi !== 'number' || n.pitchMidi < 0 || n.pitchMidi > 127) return `Invalid pitchMidi at index ${i}`;
          if (typeof n.amplitude !== 'number' || n.amplitude < 0 || n.amplitude > 1) return `Invalid amplitude at index ${i}`;
          if (typeof n.startTimeSeconds !== 'number' || n.startTimeSeconds < 0) return `Invalid startTimeSeconds at index ${i}`;
          if (typeof n.durationSeconds !== 'number' || n.durationSeconds < 0) return `Invalid durationSeconds at index ${i}`;
          if (n.pitchBends && Array.isArray(n.pitchBends)) {
            for (let j = 0; j < n.pitchBends.length; j++) {
              if (typeof n.pitchBends[j] !== 'number' || n.pitchBends[j] < -1 || n.pitchBends[j] > 1) return `Invalid pitchBend at note ${i}, bend ${j}`;
            }
          }
        }
        return null;
      };
      const validationError = validateNotes(correctedNotes);
      if (validationError) {
        setStatus('Validation error: ' + validationError);
        return;
      }
      // Generate MIDI file
      const { Midi } = await import('@tonejs/midi');
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
      const midiBlob = new Blob([midi.toArray()], { type: 'audio/midi' });
      const midiUrl = URL.createObjectURL(midiBlob);
      const a = document.createElement('a');
      a.href = midiUrl;
      a.download = 'output.mid';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setStatus('MIDI file downloaded!');
    } catch (err: any) {
      setStatus('Error: ' + (err.message || 'Unknown error'));
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="audio/*,.mp3,.wav,.ogg,.flac"
        onChange={handleFileChange}
      />
      {status && <div>{status}</div>}
    </div>
  );
};

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <AudioToMidi />
    </main>
  );
}
