# YouTube MP3 Downloader Integration

This project includes a complete YouTube to MP3 downloader integration using the RapidAPI YouTube to MP3 service.

## Features

- 🎵 Convert YouTube videos to high-quality MP3 files
- 🔗 Support for various YouTube URL formats
- ⚡ Fast conversion with direct download links
- 🛡️ Secure API integration with error handling
- 📱 Responsive UI with loading states
- 🔧 Developer-friendly service with TypeScript support

## Quick Start

### 1. Access the Downloader

Navigate to `/youtube-mp3` in your application to use the web interface.

### 2. Programmatic Usage

```typescript
import { youtubeMp3Service, YouTubeMP3Service } from '@/utils/youtubeMp3Service';

// Download by video ID
const response = await youtubeMp3Service.downloadMP3({ 
  videoId: 'K4xl1T_lyiM' 
});

// Download from URL
const response = await youtubeMp3Service.downloadMP3FromUrl(
  'https://www.youtube.com/watch?v=K4xl1T_lyiM'
);

// Extract video ID from URL
const videoId = YouTubeMP3Service.extractVideoId(url);

// Get download URL and title
const downloadUrl = YouTubeMP3Service.getDownloadUrl(response);
const title = YouTubeMP3Service.getVideoTitle(response);

// Trigger browser download
YouTubeMP3Service.triggerDownload(downloadUrl, 'filename.mp3');
```

## API Reference

### YouTubeMP3Service

#### Methods

- `downloadMP3(options: YouTubeMP3DownloadOptions): Promise<YouTubeMP3Response>`
  - Downloads MP3 from a YouTube video ID
  - Returns API response with download URL and metadata

- `downloadMP3FromUrl(url: string, apiKey?: string): Promise<YouTubeMP3Response>`
  - Downloads MP3 from a YouTube URL
  - Automatically extracts video ID from URL

- `extractVideoId(url: string): string | null`
  - Extracts video ID from various YouTube URL formats
  - Returns null if URL is invalid

- `getDownloadUrl(response: YouTubeMP3Response): string | null`
  - Extracts download URL from API response
  - Returns null if response is invalid

- `getVideoTitle(response: YouTubeMP3Response): string | null`
  - Extracts video title from API response
  - Returns null if response is invalid

- `triggerDownload(url: string, filename?: string): void`
  - Triggers browser download from URL
  - Optional filename parameter

### useYouTubeMP3 Hook

React hook for managing YouTube MP3 downloads with loading states and error handling.

```typescript
import { useYouTubeMP3 } from '@/hooks/useYouTubeMP3';

const {
  downloadMP3,
  downloadMP3FromUrl,
  extractVideoId,
  getDownloadUrl,
  getVideoTitle,
  triggerDownload,
  isLoading,
  error,
  clearError,
} = useYouTubeMP3();
```

## Supported URL Formats

- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://youtube.com/embed/VIDEO_ID`
- `https://youtube.com/v/VIDEO_ID`

## API Configuration

### Environment Variables

To use the YouTube MP3 downloader, you need to set up your RapidAPI key:

1. **Get a RapidAPI Key**:
   - Sign up at [RapidAPI](https://rapidapi.com)
   - Subscribe to the [YouTube to MP3 API](https://rapidapi.com/ytdlfree/api/youtube-v31)
   - Copy your API key from the dashboard

2. **Set up Environment Variables**:
   Create a `.env.local` file in your project root:
   ```bash
   # RapidAPI YouTube to MP3 API Key
   NEXT_PUBLIC_RAPIDAPI_KEY=your_rapidapi_key_here
   ```

3. **Security Notes**:
   - Never commit your `.env.local` file to version control
   - The `.env.local` file is already in `.gitignore`
   - For production, consider using server-side API calls instead of client-side

### API Key Management

The service will:
- Use the environment variable if available
- Fall back to user-provided API key in the modal
- Show an error if no API key is available

### Rate Limits

- 100 requests per minute per API key
- Consider implementing retry logic for rate limit errors

## Error Handling

The service handles various error scenarios:

- **400 Bad Request**: Invalid video ID or missing parameter
- **405 Method Not Allowed**: Incorrect HTTP method
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server-side issues

## Components

### YouTubeMP3Downloader

Main UI component for the downloader interface.

```typescript
import YouTubeMP3Downloader from '@/components/YouTubeMP3Downloader';

<YouTubeMP3Downloader className="custom-styles" />
```

### YouTubeMP3Example

Developer example component showing programmatic usage.

```typescript
import YouTubeMP3Example from '@/components/YouTubeMP3Example';

<YouTubeMP3Example />
```

## TypeScript Types

```typescript
interface YouTubeMP3Request {
  videoId: string;
}

interface YouTubeMP3Result {
  videoId: string;
  title: string;
  dlurl: string;
}

interface YouTubeMP3SuccessResponse {
  status: 'success';
  result: YouTubeMP3Result[];
}

interface YouTubeMP3ErrorResponse {
  error: string;
}

type YouTubeMP3Response = YouTubeMP3SuccessResponse | YouTubeMP3ErrorResponse;

interface YouTubeMP3DownloadOptions {
  videoId: string;
  apiKey?: string;
}
```

## File Structure

```
src/
├── types/
│   └── youtube-mp3.d.ts          # TypeScript definitions
├── utils/
│   └── youtubeMp3Service.ts      # Core service logic
├── hooks/
│   └── useYouTubeMP3.ts          # React hook
├── components/
│   ├── YouTubeMP3Downloader.tsx  # Main UI component
│   └── YouTubeMP3Example.tsx     # Developer example
└── app/
    └── youtube-mp3/
        └── page.tsx              # Dedicated page
```

## Security Considerations

1. **API Key Protection**: Store API keys securely using environment variables
2. **Rate Limiting**: Implement proper rate limiting to avoid API abuse
3. **Input Validation**: Always validate user input before making API calls
4. **Error Handling**: Don't expose sensitive information in error messages

## Legal Considerations

- Respect YouTube's Terms of Service
- Ensure compliance with copyright laws
- Only download content you have permission to use
- Consider implementing content filtering

## Troubleshooting

### Common Issues

1. **Rate Limit Exceeded**
   - Wait before making additional requests
   - Consider using a different API key

2. **Invalid Video ID**
   - Verify the YouTube URL is correct
   - Check if the video is available

3. **Network Errors**
   - Check internet connection
   - Verify API endpoint accessibility

### Debug Mode

Enable debug logging by setting the environment variable:

```bash
DEBUG_YOUTUBE_MP3=true
```

## Contributing

When contributing to the YouTube MP3 integration:

1. Follow TypeScript best practices
2. Add proper error handling
3. Include unit tests for new features
4. Update documentation for API changes
5. Consider security implications

## License

This integration is part of the main project license. Please refer to the project's main LICENSE file for details. 