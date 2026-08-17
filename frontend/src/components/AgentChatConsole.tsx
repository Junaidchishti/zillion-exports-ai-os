import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, CheckCircle2, XCircle, AlertTriangle, Volume2 } from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { translations } from '../i18n/translations.js';
import { VoiceMicButton, speakText } from './VoiceMicButton.js';
import confetti from 'canvas-confetti';

interface Message {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  intent?: any;
}

interface AgentChatConsoleProps {
  department: string;
  title?: string;
  onActionCommitted?: (result: any) => void;
}

export const AgentChatConsole: React.FC<AgentChatConsoleProps> = ({
  department,
  title,
  onActionCommitted,
}) => {
  const { user, language } = useAuth();
  const t = translations[language];

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'msg-init',
      sender: 'agent',
      text:
        language === 'ur'
          ? `خوش آمدید! میں ${department} ڈیپارٹمنٹ کا AI ایجنٹ ہوں۔ آپ بول کر یا لکھ کر کٹنگ اینٹری یا ہدایات درج کر سکتے ہیں۔`
          : `Hello! I am the ${department} Department AI Agent. You can speak or type cutting entries, lay plans, or commands.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputVal, setInputVal] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<any | null>(null);
  const [sessionDraft, setSessionDraft] = useState<any>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, pendingConfirmation]);

  const handleSendMessage = async (textToSend?: string) => {
    const message = textToSend || inputVal.trim();
    if (!message || isProcessing) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputVal('');
    setIsProcessing(true);

    try {
      const intentRes = await api.chatWithAgent(department, message, {
        draftData: sessionDraft,
      });

      // Update draft state
      if (intentRes.extractedParams) {
        setSessionDraft((prev: any) => ({ ...prev, ...intentRes.extractedParams }));
      }

      const agentText =
        intentRes.followUpPrompt ||
        intentRes.summaryText ||
        (intentRes.requiresConfirmation ? 'Please review and confirm this payload.' : 'Processed.');

      const agentMsg: Message = {
        id: `agent-${Date.now()}`,
        sender: 'agent',
        text: agentText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        intent: intentRes,
      };

      setMessages((prev) => [...prev, agentMsg]);

      // Automatically speak response
      speakText(agentText, language);

      if (intentRes.requiresConfirmation && intentRes.proposedActionPayload) {
        setPendingConfirmation(intentRes.proposedActionPayload);
      } else {
        setPendingConfirmation(null);
      }
    } catch (err: any) {
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        sender: 'agent',
        text: `⚠️ Error: ${err.message || 'Failed to process input'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!pendingConfirmation || isProcessing) return;
    setIsProcessing(true);

    try {
      const res = await api.confirmAgentAction(department, pendingConfirmation);

      // Celebration effect on successful commit
      try {
        confetti({ particleCount: 60, spread: 70, origin: { y: 0.8 } });
      } catch (e) {
        // ignore
      }

      const confirmationMsg: Message = {
        id: `agent-confirm-${Date.now()}`,
        sender: 'agent',
        text: res.message || '✅ Transaction successfully saved and recorded in audit log.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, confirmationMsg]);
      speakText(confirmationMsg.text, language);

      setPendingConfirmation(null);
      setSessionDraft({});

      if (onActionCommitted) {
        onActionCommitted(res.resultData);
      }
    } catch (err: any) {
      const errorMsg: Message = {
        id: `err-confirm-${Date.now()}`,
        sender: 'agent',
        text: `❌ Execution Failed: ${err.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelAction = () => {
    setPendingConfirmation(null);
    setSessionDraft({});
    const cancelMsg: Message = {
      id: `agent-cancel-${Date.now()}`,
      sender: 'agent',
      text: language === 'ur' ? 'اینٹری منسوخ کر دی گئی۔' : 'Action cancelled. Ready for new input.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, cancelMsg]);
  };

  return (
    <div className="agent-console-container">
      <div className="console-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
            <div style={{ fontWeight: 700, fontSize: '15px' }}>
              {title || `${department} Department Agent`}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {language === 'ur' ? 'اردو اور انگلش وائس معاون' : 'Dual Voice & Text Assistant'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-info">{language.toUpperCase()}</span>
          <span className="badge badge-success">ONLINE</span>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="console-messages">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`msg-bubble ${m.sender === 'user' ? 'msg-user' : 'msg-agent'}`}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', opacity: 0.8, fontWeight: 600 }}>
                {m.sender === 'user' ? user?.fullName || 'Operator' : `${department} Agent`}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '10px', opacity: 0.6 }}>{m.timestamp}</span>
                {m.sender === 'agent' && (
                  <button
                    type="button"
                    onClick={() => speakText(m.text, language)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    title="Speak Aloud"
                  >
                    <Volume2 size={12} />
                  </button>
                )}
              </div>
            </div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
          </div>
        ))}

        {/* Structured Confirmation Card */}
        {pendingConfirmation && (
          <div className="msg-summary-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontWeight: 700, marginBottom: '10px' }}>
              <AlertTriangle size={18} />
              <span>{language === 'ur' ? 'برائے مہربانی تصدیق فرمائیں' : 'Action Confirmation Required'}</span>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
              <button
                type="button"
                id="btn-confirm-action"
                className="btn btn-success"
                onClick={handleConfirmAction}
                disabled={isProcessing}
                style={{ flex: 1 }}
              >
                <CheckCircle2 size={16} />
                <span>{t.confirmAction}</span>
              </button>
              <button
                type="button"
                id="btn-cancel-action"
                className="btn btn-secondary"
                onClick={handleCancelAction}
                disabled={isProcessing}
              >
                <XCircle size={16} />
                <span>{t.cancelAction}</span>
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar with Voice Mic */}
      <div className="console-input-bar">
        <VoiceMicButton
          language={language}
          onTranscript={(spokenText) => handleSendMessage(spokenText)}
          disabled={isProcessing}
        />
        <input
          type="text"
          id="input-agent-msg"
          className="console-input"
          placeholder={
            language === 'ur'
              ? 'یہاں لکھیں یا مائیک کا بٹن دبا کر بولیں...'
              : 'Type or click microphone to speak...'
          }
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          disabled={isProcessing}
        />
        <button
          type="button"
          id="btn-send-agent-msg"
          className="btn btn-primary"
          onClick={() => handleSendMessage()}
          disabled={!inputVal.trim() || isProcessing}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};
