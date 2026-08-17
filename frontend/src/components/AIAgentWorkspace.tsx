import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Send,
  Bot,
  User as UserIcon,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Volume2,
  VolumeX,
  Plus,
  Clock,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldAlert,
  Search,
  Sliders,
  Check,
  RotateCcw,
} from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { translations } from '../i18n/translations.js';
import {
  VoiceState,
  normalizeSpokenText,
  detectVoiceCommand,
  speakVoiceResponse,
  cancelSpeech,
} from '../services/voiceEngine.js';
import confetti from 'canvas-confetti';

interface Message {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  intent?: any;
}

interface ConversationSession {
  id: string;
  title: string;
  department: string;
  timestamp: string;
  category: 'TODAY' | 'YESTERDAY' | 'OLDER';
  messages: Message[];
  activeDraft?: any;
}

interface AIAgentWorkspaceProps {
  department?: string;
  onActionCommitted?: (result: any) => void;
  onNavigateToPO?: (poNumber: string) => void;
}

export const AIAgentWorkspace: React.FC<AIAgentWorkspaceProps> = ({
  department,
  onActionCommitted,
  onNavigateToPO,
}) => {
  const { user, language } = useAuth();
  const t = translations[language];

  const currentDept = department || user?.departmentCode || 'CUTTING';

  // Sessions list (Left Panel)
  const [sessions, setSessions] = useState<ConversationSession[]>([
    {
      id: 'sess-today-1',
      title: `${currentDept} Lay & Roll Allocation - PO-452`,
      department: currentDept,
      timestamp: '10:45 AM',
      category: 'TODAY',
      messages: [
        {
          id: 'msg-init',
          sender: 'agent',
          text:
            language === 'ur'
              ? `السلام علیکم ${user?.fullName || 'ماسٹر'}! میں ${currentDept} کا AI اسسٹنٹ ہوں۔ بول کر یا لکھ کر اینٹری کریں۔`
              : `Assalam-o-Alaikum ${user?.fullName || ''}. I am your ${currentDept} AI Assistant. You can speak or type your operational entry.`,
          timestamp: '10:45 AM',
        },
      ],
      activeDraft: { poNumber: 'PO-452', styleName: 'J-801' },
    },
    {
      id: 'sess-today-2',
      title: `Material Handover Request - PO-501`,
      department: currentDept,
      timestamp: '09:15 AM',
      category: 'TODAY',
      messages: [],
    },
    {
      id: 'sess-yest-1',
      title: `Daily Production Summary & Waste Audit`,
      department: currentDept,
      timestamp: 'Yesterday',
      category: 'YESTERDAY',
      messages: [],
    },
  ]);

  const [activeSessionId, setActiveSessionId] = useState<string>('sess-today-1');
  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];

  const [messages, setMessages] = useState<Message[]>(activeSession.messages);
  const [inputVal, setInputVal] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<any | null>(null);
  const [sessionDraft, setSessionDraft] = useState<any>(activeSession.activeDraft || {});

  // Voice Engine State
  const [voiceMode, setVoiceMode] = useState<'PUSH_TO_TALK' | 'HANDS_FREE'>('PUSH_TO_TALK');
  const [voiceState, setVoiceState] = useState<VoiceState>('IDLE');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [isSpeechSynthesisActive, setIsSpeechSynthesisActive] = useState<boolean>(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [hasVoiceSupport, setHasVoiceSupport] = useState<boolean>(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, pendingConfirmation, voiceState]);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setHasVoiceSupport(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = voiceMode === 'HANDS_FREE';
    rec.interimResults = true;
    rec.lang = language === 'ur' ? 'ur-PK' : 'en-US';

    rec.onstart = () => {
      setVoiceState('LISTENING');
    };

    rec.onresult = (event: any) => {
      // User speech automatically interrupts any ongoing AI speech synthesis
      cancelSpeech();
      setIsSpeechSynthesisActive(false);

      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      if (interim) {
        setInterimTranscript(normalizeSpokenText(interim));
      }

      if (final) {
        const normalizedFinal = normalizeSpokenText(final);
        setInterimTranscript('');
        setVoiceState('PROCESSING');
        handleVoiceInput(normalizedFinal);
      }
    };

    rec.onerror = (event: any) => {
      console.warn('Speech recognition event error:', event.error);
      setVoiceState('IDLE');
      setInterimTranscript('');
    };

    rec.onend = () => {
      if (voiceMode === 'HANDS_FREE' && voiceState === 'LISTENING') {
        try {
          rec.start();
        } catch (e) {
          setVoiceState('IDLE');
        }
      } else {
        setVoiceState('IDLE');
      }
    };

    setRecognition(rec);

    return () => {
      try {
        rec.stop();
      } catch (e) {}
      cancelSpeech();
    };
  }, [language, voiceMode]);

  // Voice Input Processing & Command Detection
  const handleVoiceInput = async (spokenText: string) => {
    // Check if user is confirming or canceling an existing pending confirmation
    const cmd = detectVoiceCommand(spokenText);

    if (cmd.type === 'CONFIRM' && pendingConfirmation) {
      handleConfirmAction();
      return;
    }

    if (cmd.type === 'CANCEL' && pendingConfirmation) {
      handleDiscardAction();
      return;
    }

    if (cmd.type === 'CORRECTION' && pendingConfirmation) {
      const updatedPayload = { ...pendingConfirmation, ...cmd.payload };
      setPendingConfirmation(updatedPayload);
      const reply =
        language === 'ur'
          ? `مقدار ${cmd.payload.quantity} کر دی گئی۔ کیا میں یہ کنفرم کر دوں؟`
          : `Quantity updated to ${cmd.payload.quantity}. Shall I confirm and save?`;
      addAgentMessage(reply);
      speakVoiceResponse(reply, language, () => setIsSpeechSynthesisActive(true), () => setIsSpeechSynthesisActive(false));
      return;
    }

    // Normal conversational query / data entry
    await handleSendMessage(spokenText);
  };

  const toggleListening = () => {
    if (!recognition) return;

    if (voiceState === 'LISTENING') {
      recognition.stop();
      setVoiceState('IDLE');
      setInterimTranscript('');
    } else {
      cancelSpeech();
      setIsSpeechSynthesisActive(false);
      try {
        recognition.lang = language === 'ur' ? 'ur-PK' : 'en-US';
        recognition.start();
        setVoiceState('LISTENING');
      } catch (err) {
        console.error('Failed to start voice recognition:', err);
      }
    }
  };

  const addAgentMessage = (text: string, intent?: any) => {
    const agentMsg: Message = {
      id: `agent-${Date.now()}`,
      sender: 'agent',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      intent,
    };
    setMessages((prev) => [...prev, agentMsg]);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const message = textToSend || inputVal.trim();
    if (!message || isProcessing) return;

    cancelSpeech();
    setIsSpeechSynthesisActive(false);

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputVal('');
    setIsProcessing(true);
    setVoiceState('UNDERSTANDING');

    try {
      const intentRes = await api.chatWithAgent(currentDept, message, {
        draftData: sessionDraft,
      });

      // Update draft state
      if (intentRes.extractedParams) {
        setSessionDraft((prev: any) => ({ ...prev, ...intentRes.extractedParams }));
      }

      const agentText =
        intentRes.followUpPrompt ||
        intentRes.summaryText ||
        (intentRes.requiresConfirmation ? 'Please review the confirmation card below.' : 'Processed successfully.');

      addAgentMessage(agentText, intentRes);

      if (intentRes.requiresConfirmation && intentRes.proposedActionPayload) {
        setPendingConfirmation(intentRes.proposedActionPayload);
        setVoiceState('CONFIRMING');
      } else {
        setPendingConfirmation(null);
        setVoiceState('IDLE');
      }

      // Speak response naturally
      speakVoiceResponse(agentText, language, () => setIsSpeechSynthesisActive(true), () => setIsSpeechSynthesisActive(false));
    } catch (err: any) {
      console.error('Agent chat error:', err);
      const errText = `Error: ${err.message || 'Could not process request.'}`;
      addAgentMessage(errText);
      setVoiceState('ERROR');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!pendingConfirmation || isProcessing) return;
    setIsProcessing(true);
    setVoiceState('SAVING');

    try {
      const result = await api.confirmAgentAction(currentDept, pendingConfirmation);
      try {
        confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 } });
      } catch (e) {}

      const successText =
        language === 'ur'
          ? `کامیابی سے ریکارڈ محفوظ ہو گیا ہے۔ (اینٹری کوڈ: ${result.resultData?.entry_code || 'CONFIRMED'})`
          : `Entry successfully committed to factory ledger. Code: ${result.resultData?.entry_code || 'SAVED'}.`;

      addAgentMessage(successText);
      speakVoiceResponse(successText, language, () => setIsSpeechSynthesisActive(true), () => setIsSpeechSynthesisActive(false));

      setPendingConfirmation(null);
      setSessionDraft({});
      setVoiceState('SUCCESS');

      if (onActionCommitted) {
        onActionCommitted(result);
      }
    } catch (err: any) {
      const failText = `Submission error: ${err.message}`;
      addAgentMessage(failText);
      speakVoiceResponse(failText, language);
      setVoiceState('ERROR');
    } finally {
      setIsProcessing(false);
      setTimeout(() => setVoiceState('IDLE'), 2000);
    }
  };

  const handleDiscardAction = () => {
    setPendingConfirmation(null);
    setSessionDraft({});
    const cancelText = language === 'ur' ? 'اینٹری منسوخ کر دی گئی۔' : 'Operation cancelled.';
    addAgentMessage(cancelText);
    speakVoiceResponse(cancelText, language);
    setVoiceState('IDLE');
  };

  const handleNewSession = () => {
    const newSess: ConversationSession = {
      id: `sess-${Date.now()}`,
      title: `New ${currentDept} Session`,
      department: currentDept,
      timestamp: 'Just now',
      category: 'TODAY',
      messages: [
        {
          id: `msg-${Date.now()}`,
          sender: 'agent',
          text:
            language === 'ur'
              ? `نئی سیشن شروع ہو گئی ہے۔ آپ کیا ریکارڈ کرنا چاہتے ہیں؟`
              : `New session started. How can I assist with ${currentDept} today?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ],
    };
    setSessions([newSess, ...sessions]);
    setActiveSessionId(newSess.id);
    setMessages(newSess.messages);
    setPendingConfirmation(null);
    setSessionDraft({});
  };

  return (
    <div className="page-body" style={{ height: 'calc(100vh - 84px)', padding: '0', display: 'flex', flexDirection: 'column' }}>
      {/* Top Workspace Header */}
      <div
        style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-secondary)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
            }}
          >
            <Bot size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{currentDept} AI Agent Workspace</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#10b981', fontWeight: 600 }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                Online
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Operator: {user?.fullName} ({user?.roleCode}) • Session: {activeSession.title}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Voice Mode Selector */}
          <div style={{ display: 'flex', backgroundColor: 'var(--bg-primary)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
            <button
              type="button"
              className={`btn btn-sm ${voiceMode === 'PUSH_TO_TALK' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '11px', padding: '4px 10px' }}
              onClick={() => setVoiceMode('PUSH_TO_TALK')}
            >
              Push-to-Talk
            </button>
            <button
              type="button"
              className={`btn btn-sm ${voiceMode === 'HANDS_FREE' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '11px', padding: '4px 10px' }}
              onClick={() => setVoiceMode('HANDS_FREE')}
            >
              Hands-Free Mode
            </button>
          </div>

          <button type="button" className="btn btn-secondary btn-sm" onClick={handleNewSession}>
            <Plus size={14} />
            <span>New Session</span>
          </button>
        </div>
      </div>

      {/* 3-Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 300px', flex: 1, overflow: 'hidden' }}>
        {/* LEFT PANEL: Conversation Session History */}
        <div
          style={{
            borderRight: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-secondary)',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
          }}
        >
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Conversation History
          </div>

          <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {sessions.map((sess) => (
              <div
                key={sess.id}
                onClick={() => {
                  setActiveSessionId(sess.id);
                  setMessages(sess.messages.length > 0 ? sess.messages : messages);
                }}
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: sess.id === activeSessionId ? 'rgba(2, 132, 199, 0.12)' : 'transparent',
                  border: `1px solid ${sess.id === activeSessionId ? '#0284c7' : 'transparent'}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ fontSize: '12.5px', fontWeight: 600, color: sess.id === activeSessionId ? '#38bdf8' : '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {sess.title}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  <span>{sess.department}</span>
                  <span>{sess.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CENTER PANEL: AI Conversation & Voice Engine */}
        <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)', overflow: 'hidden', position: 'relative' }}>
          {/* Messages Scroll Area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  gap: '10px',
                  alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '78%',
                }}
              >
                {msg.sender === 'agent' && (
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: '#0284c7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      flexShrink: 0,
                      marginTop: '2px',
                    }}
                  >
                    <Bot size={15} />
                  </div>
                )}

                <div>
                  <div
                    style={{
                      backgroundColor: msg.sender === 'user' ? '#0284c7' : 'var(--bg-secondary)',
                      color: msg.sender === 'user' ? '#ffffff' : 'var(--text-primary)',
                      border: msg.sender === 'agent' ? '1px solid var(--border-subtle)' : 'none',
                      borderRadius: '12px',
                      padding: '12px 16px',
                      fontSize: '13.5px',
                      lineHeight: 1.5,
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    {msg.text}
                  </div>
                  <div
                    style={{
                      fontSize: '10px',
                      color: 'var(--text-muted)',
                      marginTop: '4px',
                      textAlign: msg.sender === 'user' ? 'right' : 'left',
                      padding: '0 4px',
                    }}
                  >
                    {msg.timestamp}
                  </div>
                </div>
              </div>
            ))}

            {/* Live Interim Transcription Bubble */}
            {interimTranscript && (
              <div style={{ display: 'flex', gap: '10px', alignSelf: 'flex-end', maxWidth: '78%' }}>
                <div
                  style={{
                    backgroundColor: 'rgba(2, 132, 199, 0.25)',
                    border: '1px dashed #38bdf8',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    fontSize: '13px',
                    color: '#38bdf8',
                    fontStyle: 'italic',
                  }}
                >
                  🎙️ {interimTranscript}...
                </div>
              </div>
            )}

            {/* Voice Confirmation Card */}
            {pendingConfirmation && (
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid #0284c7',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  marginTop: '8px',
                  boxShadow: 'var(--shadow-md)',
                  maxWidth: '520px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={16} />
                    <span>STRUCTURED ENTRY CONFIRMATION</span>
                  </div>
                  <span className="badge badge-info">{pendingConfirmation.departmentCode || currentDept}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12.5px', marginBottom: '14px', backgroundColor: 'var(--bg-primary)', padding: '12px', borderRadius: '6px' }}>
                  <div><strong>PO Number:</strong> <span className="mono" style={{ color: '#38bdf8' }}>{pendingConfirmation.poNumber}</span></div>
                  <div><strong>Style:</strong> {pendingConfirmation.styleName || 'J-801'}</div>
                  <div><strong>Roll / Lot:</strong> {pendingConfirmation.rollBarcode || 'ROLL-101'}</div>
                  <div><strong>Total Quantity:</strong> <span style={{ fontWeight: 800, color: '#10b981' }}>{pendingConfirmation.totalPiecesCut || pendingConfirmation.quantity} pcs</span></div>
                  {pendingConfirmation.wasteMeters !== undefined && (
                    <div><strong>Scrap Waste:</strong> <span style={{ color: '#f59e0b' }}>{pendingConfirmation.wasteMeters}m ({pendingConfirmation.wastePercentage}%)</span></div>
                  )}
                  {pendingConfirmation.isExcessException && (
                    <div style={{ gridColumn: '1 / -1', color: '#f87171', fontWeight: 600 }}>
                      ⚠️ 5% Excess Threshold Exceeded ({pendingConfirmation.excessPercentage}%). Requires GM approval.
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleDiscardAction} disabled={isProcessing}>
                    <XCircle size={14} />
                    <span>Discard (یا بولیں: Cancel)</span>
                  </button>
                  <button type="button" className="btn btn-primary btn-sm" onClick={handleConfirmAction} disabled={isProcessing}>
                    <CheckCircle2 size={14} />
                    <span>Confirm & Save (یا بولیں: Confirm)</span>
                  </button>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Voice Orb & Controls Footer */}
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-secondary)',
            }}
          >
            {/* Live Audio Activity / State Indicator Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor:
                      voiceState === 'LISTENING'
                        ? '#ef4444'
                        : voiceState === 'PROCESSING' || voiceState === 'UNDERSTANDING'
                        ? '#f59e0b'
                        : voiceState === 'CONFIRMING'
                        ? '#0284c7'
                        : '#10b981',
                    animation: voiceState === 'LISTENING' ? 'pulse 1s infinite' : 'none',
                  }}
                />
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {voiceState === 'LISTENING'
                    ? language === 'ur' ? 'سن رہا ہوں... (بولیں)' : 'Listening... Speak naturally'
                    : voiceState === 'UNDERSTANDING'
                    ? 'Understanding intent & normalizing parameters...'
                    : voiceState === 'CONFIRMING'
                    ? 'Awaiting Confirmation (Say "Confirm" or "Cancel")'
                    : voiceState === 'SAVING'
                    ? 'Writing to Immutable Ledger...'
                    : voiceState === 'SUCCESS'
                    ? 'Saved successfully!'
                    : language === 'ur' ? 'مائیکروفون دبائیں یا لکھیں' : 'Click Mic to Speak or Type below'}
                </span>
              </div>

              {isSpeechSynthesisActive && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '11px', padding: '2px 8px', color: '#f87171' }}
                  onClick={cancelSpeech}
                >
                  <VolumeX size={13} />
                  <span>Interrupt Speech</span>
                </button>
              )}
            </div>

            {/* Input Bar with Voice Mic Orb */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                type="button"
                id="btn-voice-orb"
                onClick={toggleListening}
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: voiceState === 'LISTENING' ? '#ef4444' : '#0284c7',
                  color: '#fff',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                  boxShadow: voiceState === 'LISTENING' ? '0 0 16px rgba(239, 68, 68, 0.6)' : 'var(--shadow-sm)',
                  transition: 'all 0.2s ease',
                }}
                title={voiceState === 'LISTENING' ? 'Stop Listening' : 'Speak (Urdu / English)'}
              >
                {voiceState === 'LISTENING' ? <MicOff size={20} /> : <Mic size={20} />}
              </button>

              <input
                type="text"
                className="console-input"
                style={{ flex: 1, padding: '10px 14px' }}
                placeholder={
                  language === 'ur'
                    ? 'مثال: "PO 452 mein 500 pieces cut kiye hain" یا سوال پوچھیں...'
                    : 'Type or speak naturally (e.g., "PO 452, cut 500 pieces, sizes 30, 32")...'
                }
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendMessage();
                }}
                disabled={isProcessing}
              />

              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: '10px 16px' }}
                onClick={() => handleSendMessage()}
                disabled={!inputVal.trim() || isProcessing}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Live Factory Context & Parameter Tracking */}
        <div
          style={{
            borderLeft: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-secondary)',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            padding: '16px',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px' }}>
            Active Factory Context
          </div>

          <div style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '12px', marginBottom: '14px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Department Scope</div>
            <div style={{ fontWeight: 700, fontSize: '13px', color: '#38bdf8' }}>{currentDept} Workstation</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>Active User</div>
            <div style={{ fontWeight: 600, fontSize: '12.5px' }}>{user?.fullName} ({user?.roleCode})</div>
          </div>

          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
            Extracted Operational Draft
          </div>

          <div style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '12px', fontSize: '12px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>PO Number:</span>
              <span className="mono" style={{ fontWeight: 700, color: sessionDraft.poNumber ? '#38bdf8' : 'var(--text-muted)' }}>
                {sessionDraft.poNumber || 'Not specified'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Style Code:</span>
              <span style={{ fontWeight: 600 }}>{sessionDraft.styleName || 'Pending'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Quantity:</span>
              <span style={{ fontWeight: 700, color: sessionDraft.quantity ? '#10b981' : 'var(--text-muted)' }}>
                {sessionDraft.quantity ? `${sessionDraft.quantity} pcs` : 'Pending'}
              </span>
            </div>
          </div>

          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
            Quick Voice / Text Prompts
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[
              'PO 452 ka status batao',
              'Aaj kitni cutting hui?',
              'Kitna fabric baqi hai?',
              'Pending requests dikhao',
            ].map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ textAlign: 'left', justifyContent: 'flex-start', fontSize: '11.5px', padding: '6px 10px' }}
                onClick={() => handleSendMessage(prompt)}
              >
                <ArrowRight size={12} color="#0284c7" />
                <span>"{prompt}"</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
