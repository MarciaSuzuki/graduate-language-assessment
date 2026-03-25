'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ── Logo component with fallback ─────────────────────────────────────────────

function UofNLogo({ className, size = 52 }) {
  const [err, setErr] = useState(false);
  if (err) {
    // Inline SVG fallback — always visible
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" className={className}
        fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" stroke="rgba(201,168,76,0.6)" strokeWidth="2"/>
        <circle cx="50" cy="50" r="40" stroke="rgba(201,168,76,0.3)" strokeWidth="1"/>
        <text x="50" y="44" textAnchor="middle" fontSize="13" fontWeight="700"
          fill="rgba(201,168,76,0.9)" fontFamily="serif">UofN</text>
        <text x="50" y="60" textAnchor="middle" fontSize="7" fill="rgba(201,168,76,0.6)"
          fontFamily="serif">YWAM</text>
      </svg>
    );
  }
  return (
    <img
      src="/uofn-logo.png"
      alt="University of the Nations"
      className={className}
      width={size}
      height={size}
      onError={() => setErr(true)}
      style={{ objectFit: 'contain' }}
    />
  );
}

// ── Constants ────────────────────────────────────────────────────────────────

const LANGUAGES = [
  { id: 'english',    label: 'English',    flag: '🇺🇸', sttLang: 'en-US', ttsLang: 'en' },
  { id: 'spanish',    label: 'Español',    flag: '🇪🇸', sttLang: 'es-ES', ttsLang: 'es' },
  { id: 'portuguese', label: 'Português',  flag: '🇧🇷', sttLang: 'pt-BR', ttsLang: 'pt' },
  { id: 'french',     label: 'Français',   flag: '🇫🇷', sttLang: 'fr-FR', ttsLang: 'fr' },
  { id: 'korean',     label: '한국어',      flag: '🇰🇷', sttLang: 'ko-KR', ttsLang: 'ko' },
];

const INITIAL_ASSESSMENT_STATE = {
  currentLevel: 'novice_low',
  questionsAtLevel: 0,
  totalQuestions: 0,
  highestSustainedLevel: null,
  breakdownLevel: null,
  ladderJourney: ['novice_low'],
  scoringNotes: [],
  userName: '',
};

const LEVEL_DISPLAY = {
  novice_low: 'Novice Low', novice_mid: 'Novice Mid', novice_high: 'Novice High',
  intermediate_low: 'Intermediate Low', intermediate_mid: 'Intermediate Mid',
  intermediate_high: 'Intermediate High', advanced_low: 'Advanced Low',
  advanced_mid: 'Advanced Mid', advanced_high: 'Advanced High',
  superior: 'Superior', distinguished: 'Distinguished',
};

// ── Main Component ───────────────────────────────────────────────────────────

export default function App() {
  // Screen / flow
  const [screen, setScreen]     = useState('welcome');   // welcome | interview | results
  const [phase, setPhase]       = useState('intake');     // intake | transition | interview | report
  const [language, setLanguage] = useState(LANGUAGES[0]);

  // Assessment state (sent to agent on each call)
  const [assessState, setAssessState] = useState(INITIAL_ASSESSMENT_STATE);

  // Conversation display
  const [messages, setMessages] = useState([]);

  // Intake history (for intake + transition agents)
  const [intakeHistory, setIntakeHistory] = useState([]);
  // Interview history (separate, for interviewer agent)
  const [interviewHistory, setInterviewHistory] = useState([]);

  // Voice
  const [voiceStatus, setVoiceStatus]   = useState('idle');  // idle|speaking|listening|processing
  const [transcript, setTranscript]     = useState('');
  const [isListening, setIsListening]   = useState(false);
  const [useTextInput, setUseTextInput] = useState(false);
  const [textInput, setTextInput]       = useState('');
  const [voiceSupported, setVoiceSupported] = useState(true);

  // Results
  const [results, setResults] = useState(null);

  // Refs
  const recognitionRef  = useRef(null);
  const messagesEndRef  = useRef(null);
  const phaseRef        = useRef(phase);
  const assessStateRef  = useRef(assessState);
  const interviewHRef   = useRef(interviewHistory);

  // Keep refs in sync
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { assessStateRef.current = assessState; }, [assessState]);
  useEffect(() => { interviewHRef.current = interviewHistory; }, [interviewHistory]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check voice API support
  useEffect(() => {
    const supported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    setVoiceSupported(supported);
    if (!supported) setUseTextInput(true);
  }, []);

  // ── Message helpers ────────────────────────────────────────────────────────

  const addMessage = useCallback((role, content) => {
    setMessages(prev => [...prev, { role, content, id: Date.now() + Math.random() }]);
  }, []);

  // ── Text-to-Speech ─────────────────────────────────────────────────────────

  const browserSpeak = useCallback((text, sttLang) => {
    return new Promise(resolve => {
      if (!window.speechSynthesis) { resolve(); return; }
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = sttLang;
      utter.rate = 0.92;
      utter.onend = resolve;
      utter.onerror = resolve;
      window.speechSynthesis.speak(utter);
    });
  }, []);

  const speakText = useCallback(async (text) => {
    setVoiceStatus('speaking');
    try {
      const resp = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language: language.id }),
      });
      if (resp.headers.get('content-type')?.startsWith('audio/')) {
        const blob = await resp.blob();
        const url  = URL.createObjectURL(blob);
        await new Promise(resolve => {
          const audio = new Audio(url);
          audio.onended = resolve;
          audio.onerror = resolve;
          audio.play().catch(resolve);
        });
        URL.revokeObjectURL(url);
      } else {
        // JSON response: fallback
        await browserSpeak(text, language.sttLang);
      }
    } catch {
      await browserSpeak(text, language.sttLang);
    }
    setVoiceStatus('idle');
  }, [language, browserSpeak]);

  // ── Speech-to-Text ─────────────────────────────────────────────────────────

  const startListening = useCallback(() => {
    if (!voiceSupported) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = language.sttLang;
    recognition.continuous = true;      // keep recording until user taps orb
    recognition.interimResults = true;

    let accumulated = '';               // build up final text across pauses

    recognition.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          accumulated += e.results[i][0].transcript + ' ';
        } else {
          interim += e.results[i][0].transcript;
        }
      }
      setTranscript((accumulated + interim).trim());
    };

    recognition.onend = () => {
      setIsListening(false);
      setVoiceStatus(prev => prev === 'listening' ? 'idle' : prev);
    };

    recognition.onerror = (e) => {
      console.warn('STT error:', e.error);
      setIsListening(false);
      setVoiceStatus('idle');
      if (e.error === 'not-allowed') {
        setUseTextInput(true);
        addMessage('system', 'Microphone access denied. Please use text input below.');
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setVoiceStatus('listening');
    setTranscript('');
  }, [voiceSupported, language.sttLang, addMessage]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  // ── Agent calls ───────────────────────────────────────────────────────────

  const callAgent = useCallback(async (callPhase, userInput, currentAssessState, currentInterviewH) => {
    const history = callPhase === 'interview' ? currentInterviewH : intakeHistory;
    const resp = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phase: callPhase,
        language: language.id,
        history,
        state: currentAssessState ?? assessStateRef.current,
        userInput: userInput ?? null,
      }),
    });
    if (!resp.ok) throw new Error(`Agent API error: ${resp.status}`);
    return resp.json();
  }, [language, intakeHistory]);

  // ── Flow: Intake ──────────────────────────────────────────────────────────

  const handleIntakeResponse = useCallback(async (userInput) => {
    if (userInput) addMessage('user', userInput);
    setVoiceStatus('processing');

    try {
      const newHistory = userInput
        ? [...intakeHistory, { role: 'user', content: userInput }]
        : intakeHistory;

      const result = await callAgent('intake', userInput, null, null);
      if (!result.success) throw new Error(result.error);

      const { agentText, isComplete } = result.data;
      addMessage('agent', agentText);
      const agentHistory = [...newHistory, { role: 'assistant', content: agentText }];
      setIntakeHistory(agentHistory);

      await speakText(agentText);

      if (isComplete) {
        await runTransition(agentHistory);
      }
    } catch (err) {
      console.error('Intake error:', err);
      addMessage('system', 'Connection error. Please check your API key and try again.');
      setVoiceStatus('idle');
    }
  }, [intakeHistory, callAgent, addMessage, speakText]);

  // ── Flow: Transition ──────────────────────────────────────────────────────

  const runTransition = useCallback(async (finalIntakeHistory) => {
    setPhase('transition');
    setVoiceStatus('processing');

    try {
      const resp = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase: 'transition',
          language: language.id,
          history: finalIntakeHistory,
          state: assessStateRef.current,
        }),
      });
      const result = await resp.json();
      if (!result.success) throw new Error(result.error);

      const { startingLevel, transitionText } = result.data;
      const newState = { ...INITIAL_ASSESSMENT_STATE, currentLevel: startingLevel };
      setAssessState(newState);

      addMessage('agent', transitionText);
      await speakText(transitionText);

      setPhase('interview');
      await startInterview(newState, []);
    } catch (err) {
      console.error('Transition error:', err);
      addMessage('system', 'Setup error. Starting at Novice Low.');
      setPhase('interview');
      await startInterview(INITIAL_ASSESSMENT_STATE, []);
    }
  }, [language, addMessage, speakText]);

  // ── Flow: Interview ───────────────────────────────────────────────────────

  const startInterview = useCallback(async (initState, initHistory) => {
    setVoiceStatus('processing');
    try {
      const resp = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase: 'interview',
          language: language.id,
          history: initHistory,
          state: initState,
          userInput: null,
        }),
      });
      const result = await resp.json();
      if (!result.success) throw new Error(result.error);

      const { agentText } = result.data;
      setAssessState(result.newState ?? initState);
      addMessage('agent', agentText);
      const newH = [{ role: 'assistant', content: agentText }];
      setInterviewHistory(newH);
      await speakText(agentText);
    } catch (err) {
      console.error('Interview start error:', err);
      addMessage('system', 'Error starting interview. Please refresh and try again.');
      setVoiceStatus('idle');
    }
  }, [language, addMessage, speakText]);

  const handleInterviewResponse = useCallback(async (userInput) => {
    if (!userInput?.trim()) return;
    addMessage('user', userInput);
    setVoiceStatus('processing');

    const currentH = interviewHRef.current;
    const currentState = assessStateRef.current;

    try {
      const newH = [...currentH, { role: 'user', content: userInput }];

      const resp = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase: 'interview',
          language: language.id,
          history: currentH,
          state: currentState,
          userInput,
        }),
      });
      const result = await resp.json();
      if (!result.success) throw new Error(result.error);

      const { agentText, shouldEnd } = result.data;
      const updatedState = result.newState ?? currentState;

      setAssessState(updatedState);
      addMessage('agent', agentText);
      const updatedH = [...newH, { role: 'assistant', content: agentText }];
      setInterviewHistory(updatedH);

      if (shouldEnd) {
        await speakText(agentText);
        await runReport(updatedState);
      } else {
        await speakText(agentText);
      }
    } catch (err) {
      console.error('Interview response error:', err);
      addMessage('system', 'Error processing response. Please try again.');
      setVoiceStatus('idle');
    }
  }, [language, addMessage, speakText]);

  // ── Flow: Report ──────────────────────────────────────────────────────────

  const runReport = useCallback(async (finalState) => {
    setPhase('report');
    setVoiceStatus('processing');

    try {
      const resp = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase: 'report',
          language: language.id,
          history: interviewHRef.current,
          state: finalState,
        }),
      });
      const result = await resp.json();
      if (!result.success) throw new Error(result.error);

      setResults(result.data);
      addMessage('agent', result.data.closingText);
      await speakText(result.data.closingText);
      setScreen('results');
    } catch (err) {
      console.error('Report error:', err);
      addMessage('system', 'Error generating report. Please try again or contact the assessment team.');
      setVoiceStatus('idle');
    }
  }, [language, addMessage, speakText]);

  // ── User input submission ──────────────────────────────────────────────────

  const submitInput = useCallback(async (value) => {
    const text = (value || transcript || textInput).trim();
    if (!text) return;
    setTranscript('');
    setTextInput('');

    if (phaseRef.current === 'intake') {
      await handleIntakeResponse(text);
    } else if (phaseRef.current === 'interview') {
      await handleInterviewResponse(text);
    }
  }, [transcript, textInput, handleIntakeResponse, handleInterviewResponse]);

  // Handle Enter key in text area
  const handleTextKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitInput(textInput);
    }
  };

  // ── Start Assessment ───────────────────────────────────────────────────────

  const startAssessment = useCallback(async () => {
    setScreen('interview');
    setPhase('intake');
    setMessages([]);
    setIntakeHistory([]);
    setInterviewHistory([]);
    setAssessState(INITIAL_ASSESSMENT_STATE);
    setResults(null);
    setTranscript('');
    setTextInput('');
    await handleIntakeResponse(null);
  }, [handleIntakeResponse]);

  // ── Orb click ──────────────────────────────────────────────────────────────

  const handleOrbClick = useCallback(() => {
    if (voiceStatus === 'speaking' || voiceStatus === 'processing') return;
    if (isListening) {
      stopListening();
      if (transcript) submitInput(transcript);
    } else {
      startListening();
    }
  }, [voiceStatus, isListening, transcript, stopListening, submitInput, startListening]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const isAgentBusy = voiceStatus === 'speaking' || voiceStatus === 'processing';
  const orbState = isListening ? 'listening' : voiceStatus === 'speaking' ? 'speaking' : voiceStatus === 'processing' ? 'processing' : 'idle';
  const ringActive = orbState !== 'idle';
  const ringClass  = orbState === 'listening' ? 'listen' : '';

  const StatusText = () => {
    const map = {
      speaking:   ['speaking', 'Speaking…'],
      listening:  ['listening', 'Listening — tap orb to stop'],
      processing: ['processing', 'Processing…'],
      idle:       ['', voiceStatus === 'idle' && (phase === 'intake' || phase === 'interview') ? 'Tap the orb to speak' : ''],
    };
    const [cls, label] = map[voiceStatus] || ['', ''];
    return <div className={`voice-status-text ${cls}`}>{label}</div>;
  };

  // ──────────────────────────────────────────────────────────────────────────
  // WELCOME SCREEN
  // ──────────────────────────────────────────────────────────────────────────
  if (screen === 'welcome') {
    return (
      <div className="app-wrapper">
        <header className="app-header">
          <UofNLogo className="header-logo" size={52} />
          <div className="header-titles">
            <span className="header-title">University of the Nations</span>
            <span className="header-subtitle">YWAM</span>
          </div>
        </header>

        <main className="welcome-screen">
          <UofNLogo className="welcome-seal" size={140} />

          <h1 className="welcome-title">Language Assessment<br />Interview</h1>
          <p className="welcome-subtitle">Oral Proficiency Interview</p>

          <p className="welcome-intro">
            This voice-based interview measures your current oral proficiency in the selected
            language using the Oral Proficiency Interview methodology. It begins at Novice Low and
            climbs step by step until it finds the highest level you can sustain. Speak naturally —
            there are no right or wrong answers. The interview takes 15–25 minutes.
          </p>

          <div className="divider" />

          <div className="lang-section">
            <div className="lang-section-label">Select the language being assessed</div>
            <div className="lang-grid">
              {LANGUAGES.map(lang => (
                <button
                  key={lang.id}
                  className={`lang-card ${language.id === lang.id ? 'active' : ''}`}
                  onClick={() => setLanguage(lang)}
                >
                  <span className="lang-flag">{lang.flag}</span>
                  <span className="lang-name">{lang.label}</span>
                </button>
              ))}
            </div>
          </div>

          <button className="start-btn" onClick={startAssessment}>
            Begin Interview →
          </button>

          <p className="browser-note">
            Voice input requires Chrome or Edge. A text input fallback is available for all browsers.
          </p>
        </main>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // RESULTS SCREEN
  // ──────────────────────────────────────────────────────────────────────────
  if (screen === 'results' && results) {
    return (
      <div className="app-wrapper">
        <header className="app-header">
          <UofNLogo className="header-logo" size={52} />
          <div className="header-titles">
            <span className="header-title">University of the Nations</span>
            <span className="header-subtitle">Assessment Complete</span>
          </div>
          <div className="header-lang-badge">
            {language.flag} {language.label}
          </div>
        </header>

        <main className="results-screen">
          {/* Level Badge */}
          <div className="results-level-badge">
            <span className="badge-label">Current Assessed Oral Proficiency</span>
            <span className="badge-level">{results.levelDisplay}</span>
            <span className="badge-name">
              {results.rangeLabel ?? `Novice Low -> ${LEVEL_DISPLAY[results.finalLevel] ?? results.levelDisplay}`}
            </span>
          </div>

          <div className="results-section">
            <div className="results-section-title">Assessment Path</div>
            <p className="results-summary">{results.progressionSummary}</p>
            {results.nextTarget && (
              <p className="results-meta">
                Next stretch target: {LEVEL_DISPLAY[results.nextTarget] ?? results.nextTarget}
              </p>
            )}
          </div>

          {/* Summary */}
          <div className="results-section">
            <div className="results-section-title">Performance Summary</div>
            <p className="results-summary">{results.summary}</p>
          </div>

          {/* Strengths */}
          <div className="results-section">
            <div className="results-section-title">Strengths</div>
            <div className="results-list">
              {(results.strengths || []).map((s, i) => (
                <div key={i} className="results-list-item">
                  <span className="list-dot" />
                  {s}
                </div>
              ))}
            </div>
          </div>

          {/* Areas for growth */}
          <div className="results-section">
            <div className="results-section-title">Areas for Growth</div>
            <div className="results-list">
              {(results.areasForGrowth || []).map((a, i) => (
                <div key={i} className="results-list-item">
                  <span className="list-dot blue" />
                  {a}
                </div>
              ))}
            </div>
          </div>

          {/* Examiner note */}
          <div className="results-section">
            <div className="results-section-title">Examiner Note</div>
            <p className="examiner-note">{results.examinerNote}</p>
          </div>

          <div className="results-actions">
            <button className="start-btn" style={{ marginTop: 0 }} onClick={() => window.print()}>
              Print Report
            </button>
            <button className="btn-outline" onClick={() => {
              setScreen('welcome');
              setPhase('intake');
              setMessages([]);
              setIntakeHistory([]);
              setInterviewHistory([]);
              setAssessState(INITIAL_ASSESSMENT_STATE);
              setResults(null);
              setTranscript('');
              setTextInput('');
            }}>
              New Assessment
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // INTERVIEW SCREEN
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="app-wrapper">
      <header className="app-header">
        <UofNLogo className="header-logo" size={52} />
        <div className="header-titles">
          <span className="header-title">Language Assessment Interview</span>
          <span className="header-subtitle">University of the Nations · YWAM</span>
        </div>
        <div className="header-lang-badge">
          {language.flag} {language.label}
        </div>
      </header>

      <main className="interview-screen">
        {/* Message list */}
        <div className="message-list">
          {messages.map(msg => (
            <div key={msg.id} className={`message ${msg.role}`}>
              {msg.role === 'agent' && (
                <div className="msg-avatar">
                  <UofNLogo size={24} />
                </div>
              )}
              {msg.role === 'user' && (
                <div className="msg-avatar">👤</div>
              )}
              <div className="msg-bubble">{msg.content}</div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Voice control panel */}
        <div className="voice-panel">
          <StatusText />

          {/* Voice Orb */}
          <div className="orb-container">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className={`orb-ring ${ringClass} ${ringActive ? '' : 'idle'}`}
                style={{ animationDelay: `${(i - 1) * 0.8}s` }}
              />
            ))}
            <button
              className={`orb-core ${orbState}`}
              onClick={handleOrbClick}
              disabled={isAgentBusy}
              title={isListening ? 'Tap to stop & submit' : 'Tap to speak'}
            >
              {orbState === 'speaking'   && '🔊'}
              {orbState === 'listening'  && '🎙️'}
              {orbState === 'processing' && '⟳'}
              {orbState === 'idle'       && '🎙️'}
            </button>
          </div>

          {/* Live transcript */}
          {transcript && (
            <div className="transcript-preview">"{transcript}"</div>
          )}

          {/* Submit / Cancel when transcript is ready */}
          {transcript && !isListening && (
            <div className="submit-row">
              <button
                className="submit-btn"
                onClick={() => submitInput(transcript)}
                disabled={isAgentBusy}
              >
                ✓ Submit Response
              </button>
              <button className="cancel-btn" onClick={() => setTranscript('')}>
                ✕ Discard
              </button>
            </div>
          )}

          {/* Text input fallback */}
          {useTextInput && (
            <div className="text-input-area">
              <textarea
                className="text-input"
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                onKeyDown={handleTextKeyDown}
                placeholder="Type your response and press Enter…"
                rows={2}
                disabled={isAgentBusy}
              />
              <button
                className="submit-btn"
                onClick={() => submitInput(textInput)}
                disabled={isAgentBusy || !textInput.trim()}
              >
                Send
              </button>
            </div>
          )}

          {/* Toggle between voice and text */}
          {voiceSupported && (
            <button
              className="input-mode-toggle"
              onClick={() => setUseTextInput(p => !p)}
            >
              {useTextInput ? 'Switch to voice input' : 'Switch to text input'}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
