// Audio to MIDI Web Worker
// This worker handles the CPU-intensive audio-to-MIDI conversion process

// Import BasicPitch functions (these will be available in the worker context)
// Note: The actual BasicPitch library needs to be loaded in the worker

let basicPitch = null;
let isModelLoaded = false;

// Progress tracking
let progressCallback = null;

/**
 * Limit the number of simultaneous notes to prevent polyphony issues
 * @param notes Array of notes from BasicPitch
 * @param maxPolyphony Maximum number of simultaneous notes allowed
 * @returns Filtered array of notes with limited polyphony
 */
function limitPolyphony(notes, maxPolyphony) {
  if (notes.length === 0) return notes;
  
  // Sort notes by start time
  const sortedNotes = [...notes].sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
  const limitedNotes = [];
  const activeNotes = [];
  
  for (const note of sortedNotes) {
    // Remove notes that have ended before this note starts
    const currentTime = note.startTimeSeconds;
    const stillActive = activeNotes.filter(n => n.startTimeSeconds + n.durationSeconds > currentTime);
    
    // If we're at max polyphony, remove the oldest note
    if (stillActive.length >= maxPolyphony) {
      // Sort by start time and remove the oldest
      stillActive.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
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

/**
 * Sanitize and validate notes
 */
function sanitizeNotes(notes) {
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
          ? n.pitchBends.map((b) =>
              typeof b === 'number' ? Math.max(-1, Math.min(1, b)) : 0
            )
          : undefined,
      };
    })
    .filter(Boolean);
}

/**
 * Validate notes
 */
function validateNotes(notes) {
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

/**
 * Optimized audio preprocessing
 */
async function preprocessAudio(audioBuffer) {
  // Report progress
  self.postMessage({ type: 'progress', progress: 10, message: 'Preprocessing audio...' });
  
  let processedBuffer = audioBuffer;
  
  // Convert to mono if needed (optimized)
  if (audioBuffer.numberOfChannels > 1) {
    const length = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;
    const monoBuffer = new AudioBuffer({ length, sampleRate, numberOfChannels: 1 });
    const monoData = monoBuffer.getChannelData(0);
    
    // Optimized mono conversion
    for (let i = 0; i < length; i++) {
      let sum = 0;
      for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
        sum += audioBuffer.getChannelData(ch)[i];
      }
      monoData[i] = sum / audioBuffer.numberOfChannels;
    }
    processedBuffer = monoBuffer;
  }
  
  // Resample to 22050 Hz if needed (required by Basic Pitch)
  if (processedBuffer.sampleRate !== 22050) {
    self.postMessage({ type: 'progress', progress: 20, message: 'Resampling audio...' });
    
    const offlineCtx = new OfflineAudioContext(
      processedBuffer.numberOfChannels,
      Math.ceil(processedBuffer.duration * 22050),
      22050
    );
    const bufferSource = offlineCtx.createBufferSource();
    bufferSource.buffer = processedBuffer;
    bufferSource.connect(offlineCtx.destination);
    bufferSource.start(0);
    processedBuffer = await offlineCtx.startRendering();
  }
  
  return processedBuffer;
}

/**
 * Load BasicPitch model
 */
async function loadBasicPitchModel() {
  if (isModelLoaded && basicPitch) {
    return basicPitch;
  }
  
  self.postMessage({ type: 'progress', progress: 5, message: 'Loading BasicPitch model...' });
  
  try {
    // Import BasicPitch dynamically
    const { BasicPitch } = await import('/node_modules/@spotify/basic-pitch/dist/basic-pitch.js');
    basicPitch = new BasicPitch('/model/model.json');
    isModelLoaded = true;
    
    self.postMessage({ type: 'progress', progress: 15, message: 'Model loaded successfully' });
    return basicPitch;
  } catch (error) {
    throw new Error(`Failed to load BasicPitch model: ${error.message}`);
  }
}

/**
 * Main conversion function
 */
async function convertAudioToMidi(audioData, options = {}) {
  const {
    onsetThreshold = 0.35,
    frameThreshold = 0.35,
    minimumNoteDuration = 5,
    maxPolyphony = 4
  } = options;
  
  try {
    // Step 1: Load model
    const model = await loadBasicPitchModel();
    
    // Step 2: Preprocess audio
    const processedBuffer = await preprocessAudio(audioData);
    
    // Step 3: Initialize arrays for model output
    const frames = [];
    const onsets = [];
    const contours = [];
    
    // Step 4: Process audio with BasicPitch
    self.postMessage({ type: 'progress', progress: 30, message: 'Analyzing audio with BasicPitch...' });
    
    await model.evaluateModel(
      processedBuffer,
      (f, o, c) => {
        frames.push(...f);
        onsets.push(...o);
        contours.push(...c);
      },
      (progress) => {
        // Map BasicPitch progress (0-1) to our progress range (30-70)
        const mappedProgress = 30 + (progress * 40);
        self.postMessage({ 
          type: 'progress', 
          progress: Math.round(mappedProgress), 
          message: `Processing audio... ${Math.round(progress * 100)}%` 
        });
      }
    );
    
    // Step 5: Convert frames to notes
    self.postMessage({ type: 'progress', progress: 75, message: 'Converting to notes...' });
    
    const { noteFramesToTime, addPitchBendsToNoteEvents, outputToNotesPoly } = await import('/node_modules/@spotify/basic-pitch/dist/basic-pitch.js');
    
    const notes = noteFramesToTime(
      addPitchBendsToNoteEvents(
        contours,
        outputToNotesPoly(frames, onsets, onsetThreshold, frameThreshold, 2)
      )
    );
    
    // Step 6: Limit polyphony
    self.postMessage({ type: 'progress', progress: 85, message: 'Limiting polyphony...' });
    
    const limitedNotes = limitPolyphony(notes, maxPolyphony);
    
    // Step 7: Sanitize and validate
    self.postMessage({ type: 'progress', progress: 90, message: 'Validating notes...' });
    
    const correctedNotes = sanitizeNotes(limitedNotes);
    const validationError = validateNotes(correctedNotes);
    if (validationError) {
      throw new Error(`Validation error: ${validationError}`);
    }
    
    // Step 8: Generate MIDI
    self.postMessage({ type: 'progress', progress: 95, message: 'Generating MIDI file...' });
    
    const { Midi } = await import('/node_modules/@tonejs/midi/dist/Midi.js');
    const midi = new Midi();
    const track = midi.addTrack();
    
    correctedNotes.forEach((note) => {
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
        note.pitchBends.forEach((bend, i) => {
          const clampedBend = Math.max(-1, Math.min(1, bend));
          track.addPitchBend({
            time: startTime + (duration * i) / note.pitchBends.length,
            value: clampedBend,
          });
        });
      }
    });
    
    // Step 9: Complete
    self.postMessage({ type: 'progress', progress: 100, message: 'Conversion complete!' });
    
    return midi.toArray();
    
  } catch (error) {
    throw new Error(`Audio to MIDI conversion failed: ${error.message}`);
  }
}

/**
 * Convert audio to notes (for direct MIDI player integration)
 */
async function convertAudioToNotes(audioData) {
  try {
    // Step 1: Load model
    const model = await loadBasicPitchModel();
    
    // Step 2: Preprocess audio
    const processedBuffer = await preprocessAudio(audioData);
    
    // Step 3: Initialize arrays for model output
    const frames = [];
    const onsets = [];
    const contours = [];
    
    // Step 4: Process audio with BasicPitch
    self.postMessage({ type: 'progress', progress: 30, message: 'Analyzing audio with BasicPitch...' });
    
    await model.evaluateModel(
      processedBuffer,
      (f, o, c) => {
        frames.push(...f);
        onsets.push(...o);
        contours.push(...c);
      },
      (progress) => {
        // Map BasicPitch progress (0-1) to our progress range (30-70)
        const mappedProgress = 30 + (progress * 40);
        self.postMessage({ 
          type: 'progress', 
          progress: Math.round(mappedProgress), 
          message: `Processing audio... ${Math.round(progress * 100)}%` 
        });
      }
    );
    
    // Step 5: Convert frames to notes
    self.postMessage({ type: 'progress', progress: 75, message: 'Converting to notes...' });
    
    const { noteFramesToTime, addPitchBendsToNoteEvents, outputToNotesPoly } = await import('/node_modules/@spotify/basic-pitch/dist/basic-pitch.js');
    
    const notesResult = noteFramesToTime(
      addPitchBendsToNoteEvents(
        contours,
        outputToNotesPoly(frames, onsets, 0.35, 0.9, 2)
      )
    );
    
    // Step 6: Convert to MIDI note format
    self.postMessage({ type: 'progress', progress: 85, message: 'Formatting notes...' });
    
    const convertedNotes = notesResult.map((note) => ({
      note: note.name,
      midi: note.midi,
      time: note.start,
      duration: note.end - note.start,
      velocity: note.velocity || 0.8,
      channel: 0
    }));
    
    // Step 7: Limit polyphony (reduced to 4)
    const limitedNotes = limitPolyphony(convertedNotes, 4);
    
    // Step 8: Calculate duration
    let duration = 0;
    if (limitedNotes.length > 0) {
      duration = Math.max(...limitedNotes.map(n => (n.time ?? 0) + (n.duration ?? 0)));
      if (!isFinite(duration) || isNaN(duration)) duration = 0;
    }
    
    // Step 9: Create MIDI data structure
    const midiData = {
      duration,
      tracks: [{
        name: 'Audio Track',
        notes: limitedNotes,
        channel: 0
      }],
      tempo: 120,
      timeSignature: [4, 4]
    };
    
    self.postMessage({ type: 'progress', progress: 100, message: 'Conversion complete!' });
    
    return midiData;
    
  } catch (error) {
    throw new Error(`Audio to notes conversion failed: ${error.message}`);
  }
}

// Handle messages from main thread
self.addEventListener('message', async (event) => {
  const { type, data } = event.data;
  
  try {
    switch (type) {
      case 'convert-audio-to-midi':
        const midiArray = await convertAudioToMidi(data.audioBuffer, data.options);
        self.postMessage({ 
          type: 'conversion-complete', 
          result: midiArray,
          originalType: 'midi'
        });
        break;
        
      case 'convert-audio-to-notes':
        const midiData = await convertAudioToNotes(data.audioBuffer);
        self.postMessage({ 
          type: 'conversion-complete', 
          result: midiData,
          originalType: 'notes'
        });
        break;
        
      case 'cancel':
        // Handle cancellation if needed
        self.postMessage({ type: 'cancelled' });
        break;
        
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({ 
      type: 'error', 
      error: error.message 
    });
  }
});

// Handle worker errors
self.addEventListener('error', (error) => {
  self.postMessage({ 
    type: 'error', 
    error: `Worker error: ${error.message}` 
  });
}); 