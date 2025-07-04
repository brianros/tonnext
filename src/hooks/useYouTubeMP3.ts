import { useState, useCallback } from 'react';
import { YouTubeMP3Service, YouTubeMP3Response, YouTubeMP3DownloadOptions } from '@/utils/youtubeMp3Service';

export function useYouTubeMP3() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const downloadMP3 = useCallback(async (options: YouTubeMP3DownloadOptions): Promise<YouTubeMP3Response> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await YouTubeMP3Service.downloadMP3(options);
      
      if ('error' in response) {
        setError(response.error);
      }
      
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      return { error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const downloadMP3FromUrl = useCallback(async (url: string, apiKey?: string): Promise<YouTubeMP3Response> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await YouTubeMP3Service.downloadMP3FromUrl(url, apiKey);
      
      if ('error' in response) {
        setError(response.error);
      }
      
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      return { error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const extractVideoId = useCallback((url: string): string | null => {
    return YouTubeMP3Service.extractVideoId(url);
  }, []);

  const getDownloadUrl = useCallback((response: YouTubeMP3Response): string | null => {
    return YouTubeMP3Service.getDownloadUrl(response);
  }, []);

  const getVideoTitle = useCallback((response: YouTubeMP3Response): string | null => {
    return YouTubeMP3Service.getVideoTitle(response);
  }, []);

  const triggerDownload = useCallback((url: string, filename?: string): void => {
    YouTubeMP3Service.triggerDownload(url, filename);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    downloadMP3,
    downloadMP3FromUrl,
    extractVideoId,
    getDownloadUrl,
    getVideoTitle,
    triggerDownload,
    isLoading,
    error,
    clearError,
  };
} 