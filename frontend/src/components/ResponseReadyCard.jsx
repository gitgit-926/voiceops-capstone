import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Eye,
  EyeOff,
  Play,
  Pause,
  RotateCcw,
  Download,
  Volume2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import MarkdownText from './MarkdownText';
import { BACKEND_URL } from '../config';

export default function ResponseReadyCard({
  id,
  answer,
  audioUrl,
  audioFilename,
  isAnswerVisible,
  onToggleAnswer,
  autoPlay = false,
  isVoiceMode = false,
  ttsFailed = false,
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [synthesizingSpeech, setSynthesizingSpeech] = useState(false);
  const [activeAudioUrl, setActiveAudioUrl] = useState(audioUrl || '');
  const [activeAudioFilename, setActiveAudioFilename] = useState(audioFilename || '');
  const audioRef = useRef(null);

  // Update active audio URL if prop changes
  useEffect(() => {
    if (audioUrl) {
      setActiveAudioUrl(audioUrl);
      setActiveAudioFilename(audioFilename || 'response.wav');
    }
  }, [audioUrl, audioFilename]);

  // Attempt autoplay when newly ready in voice mode
  useEffect(() => {
    if (autoPlay && activeAudioUrl && audioRef.current) {
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setAutoplayBlocked(false);
        })
        .catch(() => {
          // Autoplay blocked by browser policy
          setAutoplayBlocked(true);
          setIsPlaying(false);
        });
    }
  }, [autoPlay, activeAudioUrl]);

  // Pause this audio if another audio starts elsewhere in the app
  const handlePlayAudio = () => {
    if (!audioRef.current) return;

    if (window.__currentActiveAudio && window.__currentActiveAudio !== audioRef.current) {
      window.__currentActiveAudio.pause();
    }
    window.__currentActiveAudio = audioRef.current;

    audioRef.current
      .play()
      .then(() => {
        setIsPlaying(true);
        setAutoplayBlocked(false);
      })
      .catch((err) => {
        console.warn('Playback error:', err);
      });
  };

  const handlePauseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleReplayAudio = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      handlePlayAudio();
    }
  };

  // On-demand speech synthesis for text-chat responses
  const handleSynthesizeAndPlay = async () => {
    if (activeAudioUrl) {
      handlePlayAudio();
      return;
    }

    setSynthesizingSpeech(true);
    try {
      const response = await fetch(`${BACKEND_URL}/voice/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: answer, language: 'en-IN' }),
      });

      if (!response.ok) {
        throw new Error('TTS synthesis failed');
      }

      const audioBlob = await response.blob();
      const newAudioUrl = URL.createObjectURL(audioBlob);
      setActiveAudioUrl(newAudioUrl);
      setActiveAudioFilename(`chat_response_${Date.now()}.wav`);

      // Play as soon as audio element loads
      setTimeout(() => {
        if (audioRef.current) {
          handlePlayAudio();
        }
      }, 50);
    } catch (err) {
      console.error('TTS synthesis error:', err);
    } finally {
      setSynthesizingSpeech(false);
    }
  };

  // Download response audio WAV
  const handleDownload = async () => {
    if (!activeAudioUrl) return;
    try {
      const res = await fetch(activeAudioUrl);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = activeAudioFilename || 'zentromart_response.wav';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      const link = document.createElement('a');
      link.href = activeAudioUrl;
      link.download = activeAudioFilename || 'zentromart_response.wav';
      link.target = '_blank';
      link.click();
    }
  };

  return (
    <div className="response-ready-card" aria-live="polite">
      {/* Hidden audio element */}
      {activeAudioUrl && (
        <audio
          ref={audioRef}
          src={activeAudioUrl}
          onPlay={() => {
            if (window.__currentActiveAudio && window.__currentActiveAudio !== audioRef.current) {
              window.__currentActiveAudio.pause();
            }
            window.__currentActiveAudio = audioRef.current;
            setIsPlaying(true);
          }}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          preload="auto"
        />
      )}

      {/* Card Header & Status */}
      <div className="ready-card-header">
        <div className="ready-icon-wrap" aria-hidden="true">
          <Sparkles size={18} className="ready-sparkle-icon" />
        </div>
        <div className="ready-text-content">
          <h3 className="ready-title">Your response is ready</h3>
          <p className="ready-subtitle">
            Your ZentroMart assistant has prepared an answer to your question.
          </p>
        </div>
      </div>

      {/* Voice controls when audio is available */}
      {activeAudioUrl && (
        <div className="ready-audio-controls">
          <div className="audio-action-buttons">
            {isPlaying ? (
              <button
                type="button"
                className="btn-audio-action primary"
                onClick={handlePauseAudio}
                aria-label="Pause spoken response"
              >
                <Pause size={15} fill="currentColor" />
                <span>Pause</span>
              </button>
            ) : (
              <button
                type="button"
                className="btn-audio-action primary"
                onClick={handlePlayAudio}
                aria-label="Play spoken response"
              >
                <Play size={15} fill="currentColor" />
                <span>{autoplayBlocked ? 'Play Response' : 'Play Response'}</span>
              </button>
            )}

            <button
              type="button"
              className="btn-audio-action secondary"
              onClick={handleReplayAudio}
              title="Replay from beginning"
              aria-label="Replay spoken response"
            >
              <RotateCcw size={14} />
              <span>Replay</span>
            </button>

            <button
              type="button"
              className="btn-audio-action secondary"
              onClick={handleDownload}
              title="Download audio as WAV file"
              aria-label="Download audio as WAV file"
            >
              <Download size={14} />
              <span>Download (.wav)</span>
            </button>
          </div>
        </div>
      )}

      {/* Audio synthesis failure notification (if text answer succeeded but TTS failed) */}
      {ttsFailed && !activeAudioUrl && (
        <div className="tts-notice" role="status">
          <AlertCircle size={14} />
          <span>Spoken audio could not be generated, but your text answer is ready below.</span>
        </div>
      )}

      {/* On-demand listen button for chat messages when audio wasn't pre-generated */}
      {!isVoiceMode && !activeAudioUrl && !ttsFailed && (
        <div className="ready-chat-audio-hint">
          <button
            type="button"
            className="btn-audio-action secondary"
            onClick={handleSynthesizeAndPlay}
            disabled={synthesizingSpeech}
            title="Listen to this answer"
          >
            {synthesizingSpeech ? (
              <>
                <Loader2 size={13} className="spinner" />
                <span>Preparing audio...</span>
              </>
            ) : (
              <>
                <Volume2 size={14} />
                <span>Listen to Spoken Answer</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* View Answer / Hide Answer Button */}
      <div className="ready-card-footer">
        <button
          type="button"
          className="toggle-answer-btn"
          onClick={() => onToggleAnswer(id)}
          aria-expanded={isAnswerVisible}
          aria-label={isAnswerVisible ? 'Hide Answer text' : 'View Answer text'}
        >
          {isAnswerVisible ? (
            <>
              <EyeOff size={15} />
              <span>Hide Answer</span>
            </>
          ) : (
            <>
              <Eye size={15} />
              <span>View Answer</span>
            </>
          )}
        </button>
      </div>

      {/* Revealed Answer Content */}
      {isAnswerVisible && (
        <div className="revealed-answer-panel" tabIndex={0}>
          <div className="revealed-header">
            <span className="revealed-label">ZentroMart Assistant Response</span>
          </div>
          <MarkdownText text={answer} />
        </div>
      )}
    </div>
  );
}
