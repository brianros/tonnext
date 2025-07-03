'use client';

import { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import * as Tone from 'tone';
import { Midi } from '@tonejs/midi';
import { useMidiContext } from '@/contexts/MidiContext';
import type { Instrument } from '@/components/InstrumentSelector';

export interface MidiNote {
  note: string;
  midi: number;
  time: number;
  duration: number;
  velocity: number;
  channel: number;
}

export interface MidiChord {
  notes: MidiNote[];
  time: number;
  duration: number;
}

export interface MidiTrack {
  name: string;
  notes: MidiNote[];
  channel: number;
}

export interface MidiData {
  duration: number;
  tracks: MidiTrack[];
  tempo: number;
  timeSignature: [number, number];
}

export function useMidiPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [midiData, setMidiData] = useState<MidiData | null>(null);
  const [fileName, setFileName] = useState<string>('');
  
  const { setMidiPlayerState, setMidiPlayerFunctions, getSelectedInstrument, isMuted } = useMidiContext();
  
  const synthRef = useRef<Tone.PolySynth | null>(null);
  const currentNotesRef = useRef<Set<number>>(new Set());
  const animationFrameRef = useRef<number | null>(null);
  const isPlayingRef = useRef<boolean>(false);
  const scheduleIdsRef = useRef<Set<string>>(new Set());
  
  // Callbacks for canvas integration
  const onNoteStartRef = useRef<(note: MidiNote) => void>(() => {});
  const onNoteEndRef = useRef<(note: MidiNote) => void>(() => {});
  const onChordStartRef = useRef<(chord: MidiChord) => void>(() => {});
  const onChordEndRef = useRef<(chord: MidiChord) => void>(() => {});

  // Share state with context
  useEffect(() => {
    // Only update context if we have meaningful state
    if (midiData || fileName || duration > 0) {
      setMidiPlayerState({
        isPlaying,
        currentTime,
        duration,
        midiData,
        fileName
      });
    }
  }, [isPlaying, currentTime, duration, midiData, fileName, setMidiPlayerState]);

  // Update ref when state changes
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Helper function to trigger synth notes only when not muted
  const triggerSynthAttack = useCallback((note: string, time: number, velocity: number) => {
    if (synthRef.current) {
      synthRef.current.triggerAttack(note, time, velocity);
    }
  }, []);

  const triggerSynthRelease = useCallback((note: string, time: number) => {
    if (synthRef.current) {
      synthRef.current.triggerRelease(note, time);
    }
  }, []);

  const releaseAllSynthNotes = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.releaseAll();
    }
  }, []);

  // Effect to control synth volume based on mute state
  useEffect(() => {
    if (synthRef.current) {
      synthRef.current.volume.value = isMuted ? -Infinity : 0; // -Infinity = mute, 0 = normal volume
    }
  }, [isMuted]);

  const parseMidiFile = useCallback(async (file: File): Promise<MidiData | null> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const midi = new Midi(arrayBuffer);
      
      const tracks: MidiTrack[] = midi.tracks.map((track, index) => ({
        name: track.name || `Track ${index + 1}`,
        notes: track.notes.map(note => ({
          note: note.name,
          midi: note.midi,
          time: note.time,
          duration: note.duration,
          velocity: note.velocity,
          channel: track.channel || 0
        })),
        channel: track.channel || 0
      }));

      const data: MidiData = {
        duration: midi.duration,
        tracks,
        tempo: midi.header.tempos[0]?.bpm || 120,
        timeSignature: [midi.header.timeSignatures[0]?.timeSignature[0] || 4, 
                       midi.header.timeSignatures[0]?.timeSignature[1] || 4]
      };

      setMidiData(data);
      setDuration(data.duration);
      setFileName(file.name);
      return data;
    } catch (error) {
      console.error('Error parsing MIDI file:', error);
      return null;
    }
  }, []);

  const loadMidiFromUrl = useCallback(async (url: string, fileName: string): Promise<MidiData | null> => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch MIDI file: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const midi = new Midi(arrayBuffer);
      
      const tracks: MidiTrack[] = midi.tracks.map((track, index) => ({
        name: track.name || `Track ${index + 1}`,
        notes: track.notes.map(note => ({
          note: note.name,
          midi: note.midi,
          time: note.time,
          duration: note.duration,
          velocity: note.velocity,
          channel: track.channel || 0
        })),
        channel: track.channel || 0
      }));

      const data: MidiData = {
        duration: midi.duration,
        tracks,
        tempo: midi.header.tempos[0]?.bpm || 120,
        timeSignature: [midi.header.timeSignatures[0]?.timeSignature[0] || 4, 
                       midi.header.timeSignatures[0]?.timeSignature[1] || 4]
      };

      setMidiData(data);
      setDuration(data.duration);
      setFileName(fileName);
      return data;
    } catch (error) {
      console.error('Error loading MIDI file from URL:', error);
      return null;
    }
  }, []);

  const startPlayback = useCallback(async () => {
    if (!midiData) return;

    console.log('startPlayback called, isPlaying:', isPlaying, 'currentTime:', currentTime);

    // Initialize audio context if needed
    await Tone.start();
    
    // Initialize synth with increased polyphony
    if (!synthRef.current) {
      synthRef.current = new Tone.PolySynth({ maxPolyphony: 64, voice: Tone.Synth }).toDestination();
    }

    // Update synth with selected instrument settings
    const selectedInstrument = getSelectedInstrument();
    if (selectedInstrument && selectedInstrument.toneOptions) {
      synthRef.current.set(selectedInstrument.toneOptions);
    } else {
      // Default piano settings
      synthRef.current.set({
        oscillator: { type: 'triangle' },
        envelope: {
          attack: 0.02,
          decay: 0.1,
          sustain: 0.3,
          release: 1
        }
      });
    }

    // If already playing, don't restart
    if (isPlaying) return;

    isPlayingRef.current = true;
    setIsPlaying(true);
    currentNotesRef.current.clear();

    // Check if transport is paused (resume) or stopped (start fresh)
    if (Tone.Transport.state === 'paused') {
      console.log('Resuming from pause');
      // Resume from current position
      Tone.Transport.start();
    } else {
      console.log('Starting fresh');
      // Start fresh - clear all previous schedules
      Tone.Transport.cancel();
      scheduleIdsRef.current.clear();

      // Set transport position to current time if we're not at the beginning
      if (currentTime > 0) {
        console.log('Setting transport position to:', currentTime);
        // Use the transport start method with an offset
        Tone.Transport.start('+0', currentTime);
      } else {
        console.log('Starting transport normally');
        // Start transport normally
        Tone.Transport.start();
      }

      // Use Tone.js Transport for timing but schedule notes directly
      Tone.Transport.stop();
      Tone.Transport.bpm.value = midiData.tempo;

      // Schedule all notes using Transport with unique IDs
      midiData.tracks.forEach((track, trackIndex) => {
        track.notes.forEach((note, noteIndex) => {
          const startId = `note-start-${trackIndex}-${noteIndex}`;
          const endId = `note-end-${trackIndex}-${noteIndex}`;
          
          // Schedule note start
          Tone.Transport.schedule((time) => {
            currentNotesRef.current.add(note.midi);
            triggerSynthAttack(note.note, time, note.velocity);
            onNoteStartRef.current(note);
          }, note.time);

          // Schedule note end
          Tone.Transport.schedule((time) => {
            currentNotesRef.current.delete(note.midi);
            triggerSynthRelease(note.note, time);
            onNoteEndRef.current(note);
          }, note.time + note.duration);

          scheduleIdsRef.current.add(startId);
          scheduleIdsRef.current.add(endId);
        });
      });

      // Start transport
      Tone.Transport.start();
    }

    // Start the time update loop immediately
    const updateTime = () => {
      if (!isPlayingRef.current) {
        console.log('Time update stopped: not playing');
        return;
      }
      
      const transportTime = Tone.Transport.seconds;
      console.log('Time update:', transportTime, 'Duration:', duration, 'IsPlaying:', isPlayingRef.current);
      setCurrentTime(transportTime);
      
      // Check for chords
      const currentChordNotes = Array.from(currentNotesRef.current);
      if (currentChordNotes.length > 1) {
        const chord: MidiChord = {
          notes: currentChordNotes.map(midi => {
            const note = midiData.tracks.flatMap(t => t.notes).find(n => n.midi === midi);
            return note!;
          }),
          time: transportTime,
          duration: 0.1
        };
        onChordStartRef.current(chord);
      }

      if (transportTime < duration) {
        animationFrameRef.current = requestAnimationFrame(updateTime);
      } else {
        // Stop playback when we reach the end
        setIsPlaying(false);
        Tone.Transport.stop();
        Tone.Transport.cancel();
        releaseAllSynthNotes();
        currentNotesRef.current.clear();
        setCurrentTime(0);
      }
    };

    // Start the update loop immediately
    console.log('Starting time update loop');
    updateTime();
  }, [midiData, duration, releaseAllSynthNotes]);

  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
    Tone.Transport.stop();
    Tone.Transport.cancel();
    
    // Clean up animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Clear all schedules
    scheduleIdsRef.current.clear();
    
    // Stop all playing notes
    releaseAllSynthNotes();
    // Call canvas note/chord end callbacks to clear highlights
    currentNotesRef.current.forEach(midi => {
      onNoteEndRef.current({
        note: Tone.Frequency(midi, 'midi').toNote(),
        midi,
        time: 0,
        duration: 0,
        velocity: 0,
        channel: 0
      });
    });
    onChordEndRef.current({ notes: [], time: 0, duration: 0 });
    currentNotesRef.current.clear();
    setCurrentTime(0);
  }, [releaseAllSynthNotes]);

  const pausePlayback = useCallback(() => {
    setIsPlaying(false);
    Tone.Transport.pause();
    
    // Clean up animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Silence all currently playing notes
    releaseAllSynthNotes();
    currentNotesRef.current.clear();
  }, [releaseAllSynthNotes]);

  const seekTo = useCallback((time: number) => {
    if (!midiData) return;
    
    // Stop current playback
    Tone.Transport.stop();
    Tone.Transport.cancel();
    
    // Clean up animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Stop all playing notes
    releaseAllSynthNotes();
    currentNotesRef.current.clear();
    
    // Clear all schedules
    scheduleIdsRef.current.clear();
    
    // Update current time
    setCurrentTime(time);
    
    // If we were playing, restart from the new position
    if (isPlayingRef.current) {
      // Set transport position using the correct API
      Tone.Transport.position = Tone.Time(time).toBarsBeatsSixteenths();
      
      // Reschedule notes from the new position
      midiData.tracks.forEach((track, trackIndex) => {
        track.notes.forEach((note, noteIndex) => {
          // Only schedule notes that start after the seek time
          if (note.time >= time) {
            const startId = `note-start-seek-${trackIndex}-${noteIndex}`;
            const endId = `note-end-seek-${trackIndex}-${noteIndex}`;
            
            // Schedule note start
            Tone.Transport.schedule((time) => {
              currentNotesRef.current.add(note.midi);
              triggerSynthAttack(note.note, time, note.velocity);
              onNoteStartRef.current(note);
            }, note.time);

            // Schedule note end
            Tone.Transport.schedule((time) => {
              currentNotesRef.current.delete(note.midi);
              triggerSynthRelease(note.note, time);
              onNoteEndRef.current(note);
            }, note.time + note.duration);

            scheduleIdsRef.current.add(startId);
            scheduleIdsRef.current.add(endId);
          }
        });
      });
      
      // Start transport with offset
      Tone.Transport.start('+0', time);
      
      // Restart the time update loop
      const updateTime = () => {
        if (!isPlayingRef.current) return;
        
        const transportTime = Tone.Transport.seconds;
        setCurrentTime(transportTime);
        
        // Check for chords
        const currentChordNotes = Array.from(currentNotesRef.current);
        if (currentChordNotes.length > 1) {
          const chord: MidiChord = {
            notes: currentChordNotes.map(midi => {
              const note = midiData.tracks.flatMap(t => t.notes).find(n => n.midi === midi);
              return note!;
            }),
            time: transportTime,
            duration: 0.1
          };
          onChordStartRef.current(chord);
        }

        if (transportTime < duration) {
          animationFrameRef.current = requestAnimationFrame(updateTime);
        } else {
          // Stop playback when we reach the end
          setIsPlaying(false);
          Tone.Transport.stop();
          Tone.Transport.cancel();
          releaseAllSynthNotes();
          currentNotesRef.current.clear();
          setCurrentTime(0);
        }
      };

      updateTime();
    }
  }, [midiData, duration, releaseAllSynthNotes]);

  const setNoteCallbacks = useCallback((callbacks: {
    onNoteStart?: (note: MidiNote) => void;
    onNoteEnd?: (note: MidiNote) => void;
    onChordStart?: (chord: MidiChord) => void;
    onChordEnd?: (chord: MidiChord) => void;
  }) => {
    if (callbacks.onNoteStart) onNoteStartRef.current = callbacks.onNoteStart;
    if (callbacks.onNoteEnd) onNoteEndRef.current = callbacks.onNoteEnd;
    if (callbacks.onChordStart) onChordStartRef.current = callbacks.onChordStart;
    if (callbacks.onChordEnd) onChordEndRef.current = callbacks.onChordEnd;
  }, []);

  const updateInstrument = useCallback(async (instrument: Instrument) => {
    // Initialize audio context if needed
    await Tone.start();
    
    // Initialize synth if it doesn't exist with increased polyphony
    if (!synthRef.current) {
      synthRef.current = new Tone.PolySynth({ maxPolyphony: 64, voice: Tone.Synth }).toDestination();
    }
    
    // Apply instrument settings
    if (instrument.toneOptions) {
      console.log('Updating instrument to:', instrument.name, instrument.toneOptions);
      synthRef.current.set(instrument.toneOptions);
    }
  }, []);

  const functions = useMemo(() => ({
    parseMidiFile,
    loadMidiFromUrl,
    startPlayback,
    stopPlayback,
    pausePlayback,
    seekTo,
    setNoteCallbacks,
    updateInstrument,
  }), [parseMidiFile, loadMidiFromUrl, startPlayback, stopPlayback, pausePlayback, seekTo, setNoteCallbacks, updateInstrument]);

  // Share functions with context
  useEffect(() => {
    setMidiPlayerFunctions(functions);
  }, [setMidiPlayerFunctions, functions]);

  // Apply initial instrument settings when synth is created
  useEffect(() => {
    const applyInitialInstrument = async () => {
      const selectedInstrument = getSelectedInstrument();
      if (selectedInstrument && synthRef.current) {
        console.log('Applying initial instrument settings:', selectedInstrument.name);
        await updateInstrument(selectedInstrument);
      }
    };
    
    applyInitialInstrument();
  }, [getSelectedInstrument, updateInstrument]);

  return {
    // State
    isPlaying,
    currentTime,
    duration,
    midiData,
    fileName,
    
    // Actions
    parseMidiFile,
    loadMidiFromUrl,
    startPlayback,
    stopPlayback,
    pausePlayback,
    seekTo,
    setNoteCallbacks,
    updateInstrument,
  };
} 