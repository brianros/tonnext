// YouTube MP3 Service for handling YouTube URLs and video processing

export interface YouTubeMP3Request {
  videoId: string;
}

export interface YouTubeMP3Result {
  videoId: string;
  title?: string;
  dlurl: string;
}

export interface YouTubeMP3SuccessResponse {
  status: 'ok';
  result: YouTubeMP3Result[];
}

export interface YouTubeMP3ProcessingResponse {
  status: 'processing';
  msg: string;
}

export interface YouTubeMP3FailResponse {
  status: 'fail';
  msg: string;
}

export type YouTubeMP3Response = YouTubeMP3SuccessResponse | YouTubeMP3ProcessingResponse | YouTubeMP3FailResponse | { error: string };

export interface YouTubeMP3DownloadOptions {
  videoId: string;
  apiKey?: string;
  apiHost?: string;
}

export class YouTubeMP3Service {
  private static readonly API_BASE_URL = 'https://youtube-mp36.p.rapidapi.com';

  /**
   * Extract video ID from various YouTube URL formats
   */
  static extractVideoId(url: string): string | null {
    if (!url) return null;
    // Try to match v=VIDEOID in query string
    const vMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (vMatch && vMatch[1]) return vMatch[1];
    // Try to match youtu.be/VIDEOID
    const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (shortMatch && shortMatch[1]) return shortMatch[1];
    // Try to match /embed/VIDEOID or /v/VIDEOID
    const embedMatch = url.match(/\/(?:embed|v)\/([a-zA-Z0-9_-]{11})/);
    if (embedMatch && embedMatch[1]) return embedMatch[1];
    return null;
  }

  /**
   * Get download URL from API response
   */
  static getDownloadUrl(response: YouTubeMP3Response): string | null {
    if ('status' in response && response.status === 'ok' && 'result' in response && response.result.length > 0) {
      return response.result[0].dlurl;
    }
    return null;
  }

  /**
   * Get video title from API response
   */
  static getVideoTitle(response: YouTubeMP3Response): string | null {
    if ('status' in response && response.status === 'ok' && 'result' in response && response.result.length > 0) {
      return response.result[0].title || null;
    }
    return null;
  }

  /**
   * Trigger browser download from URL
   */
  static triggerDownload(url: string, filename?: string): void {
    if (!url) return;

    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'youtube-audio.mp3';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Download MP3 from a YouTube video ID
   */
  static async downloadMP3(options: YouTubeMP3DownloadOptions): Promise<YouTubeMP3Response> {
    const { videoId, apiKey, apiHost } = options;
    
    if (!videoId) {
      return { error: 'Video ID is required' };
    }

    const apiKeyToUse = apiKey || process.env.NEXT_PUBLIC_RAPIDAPI_KEY;
    const apiHostToUse = apiHost || process.env.NEXT_PUBLIC_RAPIDAPI_HOST || 'youtube-mp36.p.rapidapi.com';
    
    if (!apiKeyToUse) {
      return { error: 'API key is required. Please set NEXT_PUBLIC_RAPIDAPI_KEY or provide an API key.' };
    }

    try {
      // Use a YouTube to MP3 conversion API
      const response = await fetch(`${this.API_BASE_URL}/dl?id=${videoId}`, {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': apiKeyToUse,
          'X-RapidAPI-Host': apiHostToUse,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Handle the three possible status values
      if (data.status === 'ok' && data.link) {
        return {
          status: 'ok',
          result: [{
            videoId: videoId,
            title: data.title,
            dlurl: data.link
          }]
        };
      } else if (data.status === 'processing') {
        return {
          status: 'processing',
          msg: data.msg || 'Processing, please try again in a few seconds.'
        };
      } else if (data.status === 'fail') {
        return {
          status: 'fail',
          msg: data.msg || 'Failed to process the YouTube video.'
        };
      } else {
        return { error: 'Invalid response from YouTube API' };
      }
    } catch (error) {
      console.error('YouTube MP3 download error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  /**
   * Download MP3 from a YouTube URL
   */
  static async downloadMP3FromUrl(url: string, apiKey?: string, apiHost?: string): Promise<YouTubeMP3Response> {
    const videoId = this.extractVideoId(url);
    
    if (!videoId) {
      return { error: 'Invalid YouTube URL' };
    }

    return this.downloadMP3({ videoId, apiKey, apiHost });
  }
}

// Default service instance
export const youtubeMp3Service = new YouTubeMP3Service(); 