// Centralized frontend configuration for backend base URL
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000';

export const getFullAudioUrl = (audioUrl) => {
  if (!audioUrl) return '';
  if (audioUrl.startsWith('http://') || audioUrl.startsWith('https://')) {
    return audioUrl;
  }
  return `${BACKEND_URL}${audioUrl.startsWith('/') ? '' : '/'}${audioUrl}`;
};
