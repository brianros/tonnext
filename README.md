# Tonnext - Interactive Tonnetz Visualization

Tonnext is a web-based music visualizer that creates beautiful tonal network visualizations with real-time MIDI playback and audio-to-MIDI conversion capabilities.

## Features

- **Interactive Tonnetz Visualization**: Explore musical relationships through dynamic network visualizations
- **MIDI Playback**: Play MIDI files with real-time visualization
- **Audio-to-MIDI Conversion**: Convert audio files (MP3, WAV, OGG, FLAC) to MIDI using AI-powered pitch detection
- **Web Worker Support**: Non-blocking audio conversion using Web Workers for responsive UI
- **Polyphony Optimization**: Intelligent polyphony limiting to prevent playback issues
- **Video Export**: Export visualizations as videos with optional audio
- **Multiple Visualization Modes**: Note, chord, and arpeggio visualization modes

## Technical Implementation

### Web Worker Architecture

The audio-to-MIDI conversion process uses Web Workers to prevent UI blocking:

- **Main Thread**: Handles UI updates, file input, and MIDI player integration
- **Web Worker**: Processes CPU-intensive audio analysis using BasicPitch
- **Progress Tracking**: Real-time progress updates during conversion
- **Fallback Support**: Graceful fallback to main thread if Web Workers aren't supported

### Polyphony Optimization

To prevent polyphony overflow issues:

- **Reduced Polyphony Limit**: BasicPitch polyphony reduced from 4 to 2
- **Post-Processing**: Additional polyphony limiting to 4 simultaneous notes maximum
- **MIDI Player Optimization**: Reduced maxPolyphony from 32 to 8
- **Smart Note Prioritization**: Newer notes take priority over older ones when limiting

### Performance Optimizations

- **Chunked Processing**: Audio processing broken into manageable chunks
- **Progress Callbacks**: Real-time progress updates during conversion
- **Memory Management**: Proper cleanup of audio buffers and workers
- **Cancellation Support**: Users can cancel long-running conversions

## Usage

1. **Load MIDI Files**: Click "Load" to select MIDI files for playback
2. **Convert Audio**: Upload audio files to automatically convert them to MIDI
3. **Visualize**: Watch real-time visualization as the music plays
4. **Export**: Create video exports with custom settings

## Browser Support

- **Modern Browsers**: Full Web Worker support for optimal performance
- **Legacy Browsers**: Graceful fallback to main thread processing
- **Mobile Support**: Responsive design with touch-friendly controls

## Development

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Installation

```bash
git clone <repository-url>
cd tonnext
pnpm install
```

### Development Server

```bash
pnpm dev
```

### Building for Production

```bash
pnpm build
pnpm start
```

## Architecture

```
src/
├── app/                    # Next.js app router
├── components/             # React components
│   ├── MidiPlayerCompact.tsx  # Main MIDI player with conversion
│   ├── TonnextCanvas.tsx      # Visualization canvas
│   └── ExportVideoModal.tsx   # Video export interface
├── contexts/               # React contexts
│   └── MidiContext.tsx     # MIDI player state management
├── hooks/                  # Custom React hooks
│   ├── useMidiPlayer.ts    # MIDI playback logic
│   └── useTonnext.ts       # Visualization logic
├── utils/                  # Utility functions
│   ├── audioToMidi.ts      # Audio-to-MIDI conversion (main thread)
│   ├── audioToMidiWorker.ts # Web Worker wrapper
│   └── audioToNotes.ts     # Direct notes conversion
└── types/                  # TypeScript type definitions

public/
├── audio-to-midi-worker.js # Web Worker implementation
├── model/                  # BasicPitch AI model
└── example.mid            # Sample MIDI file
```

## Performance Considerations

- **Large Audio Files**: Conversion time scales with file duration
- **Memory Usage**: Audio buffers are processed in chunks to manage memory
- **CPU Usage**: Web Workers prevent UI blocking during conversion
- **Network**: BasicPitch model (~50MB) is loaded once and cached

## Troubleshooting

### Conversion Issues

- **Polyphony Overflow**: Reduced polyphony limits should prevent this
- **Memory Errors**: Try smaller audio files or restart the browser
- **Worker Errors**: Falls back to main thread processing automatically

### Performance Issues

- **Slow Conversion**: Normal for large files, progress is shown
- **UI Freezing**: Web Workers should prevent this, check browser support
- **Audio Quality**: BasicPitch optimizes for polyphonic music

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

[Add your license information here]
