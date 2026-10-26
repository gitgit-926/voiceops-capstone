import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import VoiceAssistant from './components/VoiceAssistant';
import TextChat from './components/TextChat';
import { BACKEND_URL } from './config';
import { AlertCircle } from 'lucide-react';

export default function App() {
  const [currentMode, setCurrentMode] = useState('voice'); // 'voice' | 'chat'
  const [serverOnline, setServerOnline] = useState(false);
  const [checkingServer, setCheckingServer] = useState(true);
  const [error, setError] = useState(null);

  // Poll backend health
  const checkHealth = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/health`);
      if (res.ok) {
        setServerOnline(true);
      } else {
        setServerOnline(false);
      }
    } catch {
      setServerOnline(false);
    } finally {
      setCheckingServer(false);
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app-shell">
      {/* Header with branding, mode tabs, and status indicator */}
      <Header
        currentMode={currentMode}
        onSelectMode={(mode) => {
          setCurrentMode(mode);
          setError(null);
        }}
        serverOnline={serverOnline}
        checkingServer={checkingServer}
      />

      {/* Global error alert if present */}
      {error && (
        <div className="alert-banner" role="alert">
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{error}</span>
          <button
            type="button"
            className="alert-close"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {/* Main active mode container */}
      <main id="main-content">
        {currentMode === 'voice' ? (
          <VoiceAssistant
            serverOnline={serverOnline}
            onError={(err) => setError(err)}
          />
        ) : (
          <TextChat
            serverOnline={serverOnline}
            onError={(err) => setError(err)}
          />
        )}
      </main>

      {/* Minimal Customer-facing Footer */}
      <footer className="app-footer">
        <p>ZentroMart Customer Support &bull; Policy-grounded assistance</p>
      </footer>
    </div>
  );
}
