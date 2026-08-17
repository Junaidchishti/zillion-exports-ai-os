import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { Language } from '../i18n/translations.js';

interface VoiceMicButtonProps {
  language: Language;
  onTranscript: (transcript: string) => void;
  disabled?: boolean;
}

export const VoiceMicButton: React.FC<VoiceMicButtonProps> = ({
  language,
  onTranscript,
  disabled = false,
}) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [hasSupport, setHasSupport] = useState<boolean>(true);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setHasSupport(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = language === 'ur' ? 'ur-PK' : 'en-US';

    rec.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        onTranscript(transcript);
      }
      setIsRecording(false);
    };

    rec.onerror = (event: any) => {
      console.warn('Speech recognition error:', event.error);
      setIsRecording(false);
    };

    rec.onend = () => {
      setIsRecording(false);
    };

    setRecognition(rec);
  }, [language, onTranscript]);

  const toggleRecording = () => {
    if (!recognition) return;

    if (isRecording) {
      recognition.stop();
      setIsRecording(false);
    } else {
      try {
        recognition.lang = language === 'ur' ? 'ur-PK' : 'en-US';
        recognition.start();
        setIsRecording(true);
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
      }
    }
  };

  return (
    <button
      type="button"
      id="btn-voice-mic"
      onClick={toggleRecording}
      disabled={disabled || !hasSupport}
      className={`voice-mic-btn ${isRecording ? 'recording' : ''}`}
      title={
        !hasSupport
          ? 'Voice input not supported in this browser'
          : isRecording
          ? 'Listening... Click to Stop'
          : `Click to Speak (${language === 'ur' ? 'اردو وائس' : 'English Voice'})`
      }
    >
      {isRecording ? <MicOff size={22} /> : <Mic size={22} />}
    </button>
  );
};

export function speakText(text: string, language: Language = 'en') {
  if (!('speechSynthesis' in window)) return;

  // Clean markdown tags for natural speech
  const clean = text.replace(/[*#_`•]/g, '').replace(/\[.*?\]/g, '');
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = language === 'ur' ? 'ur-PK' : 'en-US';
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
