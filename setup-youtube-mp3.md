# YouTube MP3 Setup Guide

## Quick Setup

1. **Get Your RapidAPI Key**:
   - Go to [RapidAPI YouTube to MP3 API](https://rapidapi.com/ytdlfree/api/youtube-v31)
   - Sign up/Login to RapidAPI
   - Subscribe to the API (free tier available)
   - Copy your API key from the dashboard

2. **Create Environment File**:
   ```bash
   # In your project root, create .env.local
   echo "NEXT_PUBLIC_RAPIDAPI_KEY=your_actual_api_key_here" > .env.local
   ```

3. **Restart Development Server**:
   ```bash
   npm run dev
   # or
   pnpm dev
   ```

4. **Test the Feature**:
   - Click the red "YouTube" button in the MIDI player
   - Paste a YouTube URL
   - Click "Convert to MP3"
   - Click "Load into Tonnext"

## Security Notes

- ✅ `.env.local` is in `.gitignore` - won't be committed
- ✅ API key is only used client-side for this feature
- ✅ No hardcoded keys in the codebase
- ⚠️ For production, consider server-side API calls

## Troubleshooting

- **"API key is required"**: Make sure `.env.local` exists and has the correct key
- **"Rate limit exceeded"**: Wait a minute and try again (100 requests/minute limit)
- **"Invalid YouTube URL"**: Check the URL format and video availability 