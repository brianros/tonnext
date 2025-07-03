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
  const [originalAudioFile, setOriginalAudioFile] = useState<File | null>(null);
  const [originalAudioBuffer, setOriginalAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isOriginalAudio, setIsOriginalAudio] = useState(false);
  
  const { setMidiPlayerState, setMidiPlayerFunctions, getSelectedInstrument, isMuted } = useMidiContext();
  
  const synthRef = useRef<Tone.PolySynth | null>(null);
  const currentNotesRef = useRef<Set<number>>(new Set());
  const animationFrameRef = useRef<number | null>(null);
  const isPlayingRef = useRef<boolean>(false);
  const scheduleIdsRef = useRef<Set<string>>(new Set());
  
  const originalAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const originalAudioContextRef = useRef<AudioContext | null>(null);
  const audioStartTimeRef = useRef<number>(0);
  
  const onNoteStartRef = useRef<(note: MidiNote) => void>(() => {});
  const onNoteEndRef = useRef<(note: MidiNote) => void>(() => {});
  const onChordStartRef = useRef<(chord: MidiChord) => void>(() => {});
  const onChordEndRef = useRef<(chord: MidiChord) => void>(() => {});

  useEffect(() => {
    if (midiData || fileName || duration > 0) {
      setMidiPlayerState({
        isPlaying,
        currentTime,
        duration,
        midiData,
        fileName,
        isOriginalAudio,
        originalAudioBuffer
      });
    }
  }, [isPlaying, currentTime, duration, midiData, fileName, isOriginalAudio, originalAudioBuffer, setMidiPlayerState]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (originalAudioSourceRef.current) {
        originalAudioSourceRef.current.stop();
        originalAudioSourceRef.current = null;
      }
      if (originalAudioContextRef.current) {
        originalAudioContextRef.current.close();
        originalAudioContextRef.current = null;
      }
    };
  }, []);

  const triggerSynthAttack = useCallback((note: string, time: number, velocity: number) => {
    if (synthRef.current && !isOriginalAudio) {
      synthRef.current.triggerAttack(note, time, velocity);
    }
  }, [isOriginalAudio]);

  const triggerSynthRelease = useCallback((note: string, time: number) => {
    if (synthRef.current && !isOriginalAudio) {
      synthRef.current.triggerRelease(note, time);
    }
  }, [isOriginalAudio]);

  const releaseAllSynthNotes = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.releaseAll();
    }
  }, []);

  useEffect(() => {
    if (synthRef.current) {
      const shouldMute = isMuted || isOriginalAudio;
      synthRef.current.volume.value = shouldMute ? -Infinity : 0;
    }
  }, [isMuted, isOriginalAudio]);

  const loadOriginalAudio = useCallback(async (file: File): Promise<AudioBuffer> => {
    const arrayBuffer = await file.arrayBuffer();
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    return audioBuffer;
  }, []);

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
      setOriginalAudioFile(null);
      setOriginalAudioBuffer(null);
      setIsOriginalAudio(false);
      return data;
    } catch (error) {
      console.error('Error parsing MIDI file:', error);
      return null;
    }
  }, []);

  const parseAudioFile = useCallback(async (file: File, midiData: MidiData): Promise<void> => {
    try {
      setOriginalAudioFile(file);
      const audioBuffer = await loadOriginalAudio(file);
      setOriginalAudioBuffer(audioBuffer);
      setIsOriginalAudio(true);
      
      setDuration(audioBuffer.duration);
      
      const updatedMidiData = {
        ...midiData,
        duration: audioBuffer.duration
      };
      setMidiData(updatedMidiData);
      setFileName(file.name);
    } catch (error) {
      console.error('Error loading original audio:', error);
      setIsOriginalAudio(false);
    }
  }, [loadOriginalAudio]);

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
      setOriginalAudioFile(null);
      setOriginalAudioBuffer(null);
      setIsOriginalAudio(false);
      return data;
    } catch (error) {
      console.error('Error loading MIDI file from URL:', error);
      return null;
    }
  }, []);

  const startPlayback = useCallback(async () => {
    if (!midiData) return;

    console.log('startPlayback called, isPlaying:', isPlaying, 'currentTime:', currentTime, 'isOriginalAudio:', isOriginalAudio);

    await Tone.start();
    
    if (!synthRef.current && !isOriginalAudio) {
      synthRef.current = new Tone.PolySynth({ maxPolyphony: 64, voice: Tone.Synth }).toDestination();
    }

    if (!isOriginalAudio && synthRef.current) {
      const selectedInstrument = getSelectedInstrument();
      if (selectedInstrument && selectedInstrument.toneOptions) {
        synthRef.current.set(selectedInstrument.toneOptions);
      } else {
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
    }

    if (isPlaying) return;

    isPlayingRef.current = true;
    setIsPlaying(true);
    currentNotesRef.current.clear();

    if (isOriginalAudio && originalAudioBuffer) {
      console.log('Starting original audio playback');
      
      if (!originalAudioContextRef.current) {
        originalAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      if (originalAudioSourceRef.current) {
        originalAudioSourceRef.current.stop();
      }
      
      originalAudioSourceRef.current = originalAudioContextRef.current.createBufferSource();
      originalAudioSourceRef.current.buffer = originalAudioBuffer;
      originalAudioSourceRef.current.connect(originalAudioContextRef.current.destination);
      
      // Track when we start the audio
      audioStartTimeRef.current = originalAudioContextRef.current.currentTime - currentTime;
      originalAudioSourceRef.current.start(0, currentTime);
      
      originalAudioSourceRef.current.onended = () => {
        if (isPlayingRef.current) {
          setIsPlaying(false);
          setCurrentTime(0);
          currentNotesRef.current.clear();
        }
      };
      
      if (originalAudioContextRef.current.state === 'suspended') {
        await originalAudioContextRef.current.resume();
      }
    }

    if (Tone.Transport.state === 'paused') {
      console.log('Resuming from pause');
      Tone.Transport.start();
    } else {
      console.log('Starting fresh');
      Tone.Transport.cancel();
      scheduleIdsRef.current.clear();

      if (currentTime > 0) {
        console.log('Setting transport position to:', currentTime);
        Tone.Transport.start('+0', currentTime);
      } else {
        console.log('Starting transport normally');
        Tone.Transport.start();
      }

      Tone.Transport.stop();
      Tone.Transport.bpm.value = midiData.tempo;

      midiData.tracks.forEach((track, trackIndex) => {
        track.notes.forEach((note, noteIndex) => {
          const startId = `note-start-${trackIndex}-${noteIndex}`;
          const endId = `note-end-${trackIndex}-${noteIndex}`;
          
          Tone.Transport.schedule((time) => {
            currentNotesRef.current.add(note.midi);
            triggerSynthAttack(note.note, time, note.velocity);
            onNoteStartRef.current(note);
          }, note.time);

          Tone.Transport.schedule((time) => {
            currentNotesRef.current.delete(note.midi);
            triggerSynthRelease(note.note, time);
            onNoteEndRef.current(note);
          }, note.time + note.duration);

          scheduleIdsRef.current.add(startId);
          scheduleIdsRef.current.add(endId);
        });
      });

      Tone.Transport.start();
    }

    const updateTime = () => {
      if (!isPlayingRef.current) {
        console.log('Time update stopped: not playing');
        return;
      }
      
      let transportTime: number;
      
      if (isOriginalAudio && originalAudioContextRef.current && originalAudioSourceRef.current) {
        // Calculate elapsed time since audio started
        transportTime = originalAudioContextRef.current.currentTime - audioStartTimeRef.current;
      } else {
        transportTime = Tone.Transport.seconds;
      }
      
      console.log('Time update:', transportTime, 'Duration:', duration, 'IsPlaying:', isPlayingRef.current);
      setCurrentTime(transportTime);
      
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
        setIsPlaying(false);
        Tone.Transport.stop();
        Tone.Transport.cancel();
        releaseAllSynthNotes();
        currentNotesRef.current.clear();
        setCurrentTime(0);
        
        if (originalAudioSourceRef.current) {
          originalAudioSourceRef.current.stop();
          originalAudioSourceRef.current = null;
        }
      }
    };

    console.log('Starting time update loop');
    updateTime();
  }, [midiData, duration, releaseAllSynthNotes, isOriginalAudio, originalAudioBuffer, currentTime, triggerSynthAttack, triggerSynthRelease]);

  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
    Tone.Transport.stop();
    Tone.Transport.cancel();
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    scheduleIdsRef.current.clear();
    
    releaseAllSynthNotes();
    
    if (originalAudioSourceRef.current) {
      originalAudioSourceRef.current.stop();
      originalAudioSourceRef.current = null;
    }
    
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
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    releaseAllSynthNotes();
    currentNotesRef.current.clear();
    
    if (originalAudioSourceRef.current) {
      originalAudioSourceRef.current.stop();
      originalAudioSourceRef.current = null;
    }
  }, [releaseAllSynthNotes]);

  const seekTo = useCallback((time: number) => {
    if (!midiData) return;
    
    Tone.Transport.stop();
    Tone.Transport.cancel();
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    releaseAllSynthNotes();
    currentNotesRef.current.clear();
    
    if (originalAudioSourceRef.current) {
      originalAudioSourceRef.current.stop();
      originalAudioSourceRef.current = null;
    }
    
    scheduleIdsRef.current.clear();
    
    setCurrentTime(time);
    
    if (isPlayingRef.current) {
      if (isOriginalAudio && originalAudioBuffer && originalAudioContextRef.current) {
        originalAudioSourceRef.current = originalAudioContextRef.current.createBufferSource();
        originalAudioSourceRef.current.buffer = originalAudioBuffer;
        originalAudioSourceRef.current.connect(originalAudioContextRef.current.destination);
        
        // Track when we start the audio
        audioStartTimeRef.current = originalAudioContextRef.current.currentTime - time;
        originalAudioSourceRef.current.start(0, time);
        
        originalAudioSourceRef.current.onended = () => {
          if (isPlayingRef.current) {
            setIsPlaying(false);
            setCurrentTime(0);
            currentNotesRef.current.clear();
          }
        };
      }
      
      Tone.Transport.position = Tone.Time(time).toBarsBeatsSixteenths();
      
      midiData.tracks.forEach((track, trackIndex) => {
        track.notes.forEach((note, noteIndex) => {
          if (note.time >= time) {
            const startId = `note-start-seek-${trackIndex}-${noteIndex}`;
            const endId = `note-end-seek-${trackIndex}-${noteIndex}`;
            
            Tone.Transport.schedule((time) => {
              currentNotesRef.current.add(note.midi);
              triggerSynthAttack(note.note, time, note.velocity);
              onNoteStartRef.current(note);
            }, note.time);

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
      
      Tone.Transport.start('+0', time);
      
      const updateTime = () => {
        if (!isPlayingRef.current) return;
        
        let transportTime: number;
        
        if (isOriginalAudio && originalAudioContextRef.current && originalAudioSourceRef.current) {
          // Calculate elapsed time since audio started
          transportTime = originalAudioContextRef.current.currentTime - audioStartTimeRef.current;
        } else {
          transportTime = Tone.Transport.seconds;
        }
        
        setCurrentTime(transportTime);
        
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
          setIsPlaying(false);
          Tone.Transport.stop();
          Tone.Transport.cancel();
          releaseAllSynthNotes();
          currentNotesRef.current.clear();
          setCurrentTime(0);
          
          if (originalAudioSourceRef.current) {
            originalAudioSourceRef.current.stop();
            originalAudioSourceRef.current = null;
          }
        }
      };

      updateTime();
    }
  }, [midiData, duration, releaseAllSynthNotes, isOriginalAudio, originalAudioBuffer, triggerSynthAttack, triggerSynthRelease]);

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
    await Tone.start();
    
    if (!synthRef.current) {
      synthRef.current = new Tone.PolySynth({ maxPolyphony: 64, voice: Tone.Synth }).toDestination();
    }
    
    if (instrument.toneOptions) {
      console.log('Updating instrument to:', instrument.name, instrument.toneOptions);
      synthRef.current.set(instrument.toneOptions);
    }
  }, []);

  const functions = useMemo(() => ({
    parseMidiFile,
    parseAudioFile,
    loadMidiFromUrl,
    startPlayback,
    stopPlayback,
    pausePlayback,
    seekTo,
    setNoteCallbacks,
    updateInstrument,
  }), [parseMidiFile, parseAudioFile, loadMidiFromUrl, startPlayback, stopPlayback, pausePlayback, seekTo, setNoteCallbacks, updateInstrument]);

  useEffect(() => {
    setMidiPlayerFunctions(functions);
  }, [setMidiPlayerFunctions, functions]);

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
    isPlaying,
    currentTime,
    duration,
    midiData,
    fileName,
    isOriginalAudio,
    originalAudioBuffer,
    
    parseMidiFile,
    parseAudioFile,
    loadMidiFromUrl,
    startPlayback,
    stopPlayback,
    pausePlayback,
    seekTo,
    setNoteCallbacks,
    updateInstrument,
  };
} 