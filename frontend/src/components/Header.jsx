import React from 'react';
import { Mic, MessageSquare } from 'lucide-react';

export default function Header({ currentMode, onSelectMode, serverOnline, checkingServer }) {
  return (
    <header className="app-header">
      <div className="brand-wrapper">
        <h1 className="brand-title">ZentroMart</h1>
        <span className="brand-subtitle">Customer Support</span>
      </div>

      <div className="header-controls">
        <nav className="mode-nav" aria-label="Support interaction mode">
          <button
            type="button"
            className={`nav-tab ${currentMode === 'voice' ? 'active' : ''}`}
            onClick={() => onSelectMode('voice')}
            aria-label="Switch to Voice Assistant mode"
          >
            <Mic size={15} />
            <span>Voice Assistant</span>
          </button>
          <button
            type="button"
            className={`nav-tab ${currentMode === 'chat' ? 'active' : ''}`}
            onClick={() => onSelectMode('chat')}
            aria-label="Switch to Text Chat mode"
          >
            <MessageSquare size={15} />
            <span>Text Chat</span>
          </button>
        </nav>

        <div
          className="status-pill"
          title={serverOnline ? 'Support system connected and ready' : 'Connecting to support service'}
          aria-live="polite"
        >
          <span
            className={`status-dot ${
              checkingServer ? '' : serverOnline ? 'online' : 'offline'
            }`}
          />
          <span>
            {checkingServer ? 'Connecting' : serverOnline ? 'Ready' : 'Offline'}
          </span>
        </div>
      </div>
    </header>
  );
}
