import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Square,
  Loader2,
  User,
  RotateCcw,
} from 'lucide-react';
import { BACKEND_URL, getFullAudioUrl } from '../config';
import ResponseReadyCard from './ResponseReadyCard';

export default function VoiceAssistant({ serverOnline, onError }) {
  // Recording state: 'idle' | 'recording' | 'processing'
  const [recordingStatus, setRecordingStatus] = useState('idle');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0); // Real mic volume 0..100
  const [processingMessage, setProcessingMessage] = useState('Preparing your response...');

  // Multiple questions history
  const [interactions, setInteractions] = useState([]);
  const [visibleAnswers, setVisibleAnswers] = useState({});

  // Refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const audioContextRef = useRef(null);
  const animFrameRef = useRef(null);
  const newestIdRef = useRef(null);

  // Format seconds into mm:ss
  const formatTime = (totalSec) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Supported recording MIME types
  const getSupportedMimeType = () => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      'audio/wav',
    ];
    for (const t of types) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) {
        return t;
      }
    }
    return '';
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTracksAndAudioContext();
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const stopTracksAndAudioContext = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  };

  // Toggle answer visibility for a specific question ID
  const handleToggleAnswer = (id) => {
    setVisibleAnswers((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Start recording
  const startRecording = async () => {
    onError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      onError('Microphone access is not supported by your browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      // Real microphone volume analyzer using Web Audio API
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;
        const sourceNode = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        sourceNode.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateLevel = () => {
          if (analyser && audioContextRef.current) {
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            const norm = Math.min(100, Math.round((avg / 128) * 100));
            setAudioLevel(norm);
            animFrameRef.current = requestAnimationFrame(updateLevel);
          }
        };
        updateLevel();
      } catch (audioErr) {
        console.warn('Real audio level metering unavailable:', audioErr);
      }

      const mimeType = getSupportedMimeType();
      const options = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        stopTracksAndAudioContext();
        setAudioLevel(0);

        const chunks = audioChunksRef.current;
        if (!chunks || chunks.length === 0) {
          onError('No audio recorded. Please hold the microphone and speak clearly.');
          setRecordingStatus('idle');
          return;
        }

        const audioBlob = new Blob(chunks, { type: mimeType || 'audio/webm' });
        if (audioBlob.size < 100) {
          onError('Recording was too short or empty. Please try again.');
          setRecordingStatus('idle');
          return;
        }

        await submitVoiceQuestion(audioBlob, mimeType);
      };

      mediaRecorder.start(250);
      setRecordingStatus('recording');
      setRecordingSeconds(0);

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        onError('Microphone access was denied. Please allow microphone permissions in your browser.');
      } else {
        onError(`Could not access audio device: ${err.message || 'Unknown error'}`);
      }
      setRecordingStatus('idle');
    }
  };

  // Stop recording -> immediately triggers onstop -> submit
  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  // Submit audio question to FastAPI backend
  const submitVoiceQuestion = async (audioBlob, mimeType) => {
    setRecordingStatus('processing');
    setProcessingMessage('Transcribing your question & generating response...');

    try {
      const ext = mimeType.includes('webm')
        ? 'webm'
        : mimeType.includes('ogg')
        ? 'ogg'
        : mimeType.includes('mp4')
        ? 'm4a'
        : mimeType.includes('wav')
        ? 'wav'
        : 'webm';

      const audioFile = new File([audioBlob], `recording.${ext}`, {
        type: mimeType || 'audio/webm',
      });

      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('language_code', 'en-IN');

      const response = await fetch(`${BACKEND_URL}/voice/ask/audio`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorDetail = 'Support assistant could not answer at this moment.';
        try {
          const errData = await response.json();
          errorDetail = errData.detail || errorDetail;
        } catch {}
        throw new Error(errorDetail);
      }

      const data = await response.json();
      const newId = `voice_${Date.now()}`;
      newestIdRef.current = newId;

      const newInteraction = {
        id: newId,
        question: data.transcript || 'Voice inquiry',
        answer: data.answer || "I couldn't find an answer in the store policies.",
        audioUrl: data.audio_url ? getFullAudioUrl(data.audio_url) : '',
        audioFilename: data.audio_filename || 'response.wav',
        ttsFailed: !data.audio_url,
      };

      // Add to conversation history
      setInteractions((prev) => [...prev, newInteraction]);
      // Hidden by default!
      setVisibleAnswers((prev) => ({ ...prev, [newId]: false }));
      setRecordingStatus('idle');
    } catch (err) {
      console.error('Voice submission error:', err);
      onError(err.message || 'An error occurred while communicating with the support assistant.');
      setRecordingStatus('idle');
    }
  };

  // Clear voice history
  const handleClearHistory = () => {
    if (window.__currentActiveAudio) {
      window.__currentActiveAudio.pause();
      window.__currentActiveAudio = null;
    }
    setInteractions([]);
    setVisibleAnswers({});
    onError(null);
  };

  const sampleQuestions = [
    'Can I return a damaged product?',
    'What are the ZentroMart Plus benefits?',
    'How do I track my order?',
    'What is the return window for electronics?',
  ];

  return (
    <div className="voice-container-wrapper">
      {/* Central Voice Recording Controller */}
      <div className="panel-card voice-panel">
        <div className="voice-heading-area">
          <h2 className="voice-title">
            {recordingStatus === 'recording'
              ? 'Listening...'
              : recordingStatus === 'processing'
              ? 'Processing your request...'
              : 'How can we help?'}
          </h2>
          <p className="voice-description">
            {recordingStatus === 'recording'
              ? 'Speak clearly into your microphone. Click stop when finished.'
              : recordingStatus === 'processing'
              ? processingMessage
              : 'Ask a question about your order, returns, or store policies.'}
          </p>
        </div>

        {/* Microphone action area */}
        <div className="mic-interactive-area">
          {recordingStatus === 'processing' ? (
            <div className="voice-processing-status" role="status">
              <Loader2 size={30} className="spinner" />
              <span>{processingMessage}</span>
            </div>
          ) : recordingStatus === 'recording' ? (
            <>
              <button
                type="button"
                className="mic-circle-btn recording"
                onClick={stopRecording}
                aria-label="Stop recording"
                title="Click to stop recording and get response"
              >
                <Square size={30} fill="currentColor" />
              </button>

              {/* Real microphone audio meter & elapsed timer */}
              <div className="real-audio-indicator" aria-live="polite">
                <div className="live-meter" aria-hidden="true">
                  <span
                    className="meter-bar"
                    style={{ height: `${Math.max(4, audioLevel * 0.16)}px` }}
                  />
                  <span
                    className="meter-bar"
                    style={{ height: `${Math.max(4, audioLevel * 0.22)}px` }}
                  />
                  <span
                    className="meter-bar"
                    style={{ height: `${Math.max(4, audioLevel * 0.18)}px` }}
                  />
                  <span
                    className="meter-bar"
                    style={{ height: `${Math.max(4, audioLevel * 0.12)}px` }}
                  />
                </div>
                <span>{formatTime(recordingSeconds)}</span>
              </div>

              <button type="button" className="stop-voice-btn" onClick={stopRecording}>
                <Square size={14} fill="currentColor" />
                <span>Finish & Get Response</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="mic-circle-btn"
                onClick={startRecording}
                disabled={!serverOnline}
                aria-label="Start recording your question"
                title={serverOnline ? 'Click to speak' : 'Waiting for service...'}
              >
                <Mic size={36} />
              </button>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Click microphone to speak
              </span>
            </>
          )}
        </div>

        {/* Common suggestion chips when idle */}
        {recordingStatus === 'idle' && interactions.length === 0 && (
          <div className="quick-prompts">
            <span className="quick-prompts-label">Common questions</span>
            <div className="prompt-chips-wrap">
              {sampleQuestions.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="prompt-chip"
                  onClick={() => startRecording()}
                  title="Click to start recording this question"
                >
                  "{q}"
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Clear conversation action if multiple questions exist */}
        {interactions.length > 0 && recordingStatus === 'idle' && (
          <div style={{ marginTop: 4 }}>
            <button
              type="button"
              className="new-chat-btn"
              onClick={handleClearHistory}
              title="Clear question history"
            >
              <RotateCcw size={12} />
              <span>Clear history</span>
            </button>
          </div>
        )}
      </div>

      {/* Voice Questions & Responses History */}
      {interactions.length > 0 && (
        <div className="voice-history-stream">
          {interactions.map((item) => (
            <div key={item.id} className="voice-turn-card">
              {/* Customer's Question Display Only */}
              <div className="conversation-bubble-card user-card">
                <span className="bubble-role">
                  <User size={14} />
                  <span>You asked</span>
                </span>
                <p className="bubble-text">"{item.question}"</p>
              </div>

              {/* Creative Response-Ready Card (Answer hidden by default, View Answer toggle, immediate audio playback) */}
              <ResponseReadyCard
                id={item.id}
                answer={item.answer}
                audioUrl={item.audioUrl}
                audioFilename={item.audioFilename}
                isAnswerVisible={!!visibleAnswers[item.id]}
                onToggleAnswer={handleToggleAnswer}
                autoPlay={item.id === newestIdRef.current}
                isVoiceMode={true}
                ttsFailed={item.ttsFailed}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
