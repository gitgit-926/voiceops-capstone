import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Loader2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { BACKEND_URL } from '../config';
import ResponseReadyCard from './ResponseReadyCard';

export default function TextChat({ serverOnline, onError }) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'assistant',
      isWelcome: true,
      text: 'Hi! Welcome to ZentroMart. How can I help you today?',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [visibleAnswers, setVisibleAnswers] = useState({});

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, visibleAnswers]);

  // Adjust textarea height dynamically
  const handleInputChange = (e) => {
    setInputText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(130, textareaRef.current.scrollHeight)}px`;
    }
  };

  // Toggle answer visibility for a specific message ID
  const handleToggleAnswer = (id) => {
    setVisibleAnswers((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Submit chat question
  const handleSubmit = async (textToSend) => {
    const question = (textToSend || inputText).trim();
    if (!question || loading) return;

    onError(null);
    const userMessageId = `user_${Date.now()}`;
    const userMessage = {
      id: userMessageId,
      sender: 'user',
      text: question,
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) {
      setInputText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
    setLoading(true);

    try {
      // Connect to real backend /chat endpoint
      const response = await fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question }),
      });

      if (!response.ok) {
        let errMessage = 'Support assistant could not answer at this moment.';
        try {
          const errData = await response.json();
          errMessage = errData.detail || errMessage;
        } catch {}
        throw new Error(errMessage);
      }

      const data = await response.json();
      const assistantId = `assistant_${Date.now()}`;

      const assistantMessage = {
        id: assistantId,
        sender: 'assistant',
        text: data.answer || "I couldn't find an answer to that question in our knowledge base.",
      };

      setMessages((prev) => [...prev, assistantMessage]);
      // Answer is hidden by default for this question
      setVisibleAnswers((prev) => ({ ...prev, [assistantId]: false }));
    } catch (err) {
      console.error('Chat error:', err);
      onError(err.message || 'Network error communicating with the support assistant.');
      // Restore user text if it was typed so customer doesn't lose it
      if (!textToSend) {
        setInputText(question);
      }
    } finally {
      setLoading(false);
    }
  };

  // Keyboard shortcut: Enter to send, Shift+Enter for new line
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Reset conversation
  const handleNewConversation = () => {
    if (window.__currentActiveAudio) {
      window.__currentActiveAudio.pause();
      window.__currentActiveAudio = null;
    }
    setMessages([
      {
        id: `welcome_${Date.now()}`,
        sender: 'assistant',
        isWelcome: true,
        text: 'Hi! Welcome to ZentroMart. How can I help you today?',
      },
    ]);
    setVisibleAnswers({});
    setInputText('');
    onError(null);
  };

  const samplePrompts = [
    'Can I return a damaged product?',
    'Where is my order?',
    'How do refunds work?',
  ];

  return (
    <div className="panel-card chat-container">
      {/* Chat header bar */}
      <div className="chat-header-bar">
        <div className="chat-assistant-info">
          <Sparkles size={16} style={{ color: 'var(--accent)' }} />
          <span>Support Chat</span>
        </div>

        <button
          type="button"
          className="new-chat-btn"
          onClick={handleNewConversation}
          title="Start a fresh conversation"
        >
          <RotateCcw size={13} />
          <span>New chat</span>
        </button>
      </div>

      {/* Messages stream */}
      <div className="messages-stream" aria-live="polite">
        {messages.map((msg, index) => {
          if (msg.sender === 'user') {
            return (
              <div key={msg.id} className="message-row user">
                <div className="message-bubble">
                  <p className="message-content">{msg.text}</p>
                </div>
              </div>
            );
          }

          // Welcome message
          if (msg.isWelcome) {
            return (
              <div key={msg.id} className="message-row assistant">
                <div className="message-bubble">
                  <p className="message-content">{msg.text}</p>
                  {/* Suggested questions beneath welcome message */}
                  <div className="chat-suggestions-panel">
                    {samplePrompts.map((prompt, pIdx) => (
                      <button
                        key={pIdx}
                        type="button"
                        className="chat-prompt-pill"
                        onClick={() => handleSubmit(prompt)}
                        disabled={loading}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          }

          // Regular Assistant Response: Display the Response-Ready Card (Answer hidden by default)
          return (
            <div key={msg.id} className="message-row assistant">
              <ResponseReadyCard
                id={msg.id}
                answer={msg.text}
                isAnswerVisible={!!visibleAnswers[msg.id]}
                onToggleAnswer={handleToggleAnswer}
                isVoiceMode={false}
              />
            </div>
          );
        })}

        {loading && (
          <div className="message-row assistant">
            <div className="message-bubble assistant-thinking">
              <Loader2 size={16} className="spinner" />
              <span>Preparing your response...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="chat-input-bar">
        <textarea
          ref={textareaRef}
          rows={1}
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Type your question... (Enter to send)"
          className="chat-textarea"
          disabled={loading || !serverOnline}
          aria-label="Ask a question"
        />

        <button
          type="button"
          className="chat-send-btn"
          onClick={() => handleSubmit()}
          disabled={!inputText.trim() || loading || !serverOnline}
          aria-label="Send message"
          title="Send question"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
