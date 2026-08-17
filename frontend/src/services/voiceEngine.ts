import { Language } from '../i18n/translations.js';

export type VoiceState =
  | 'IDLE'
  | 'LISTENING'
  | 'PROCESSING'
  | 'UNDERSTANDING'
  | 'CONFIRMING'
  | 'SAVING'
  | 'SUCCESS'
  | 'ERROR';

// Real-time normalization of Urdu/English number words & identifiers
export function normalizeSpokenText(text: string): string {
  let cleaned = text.trim();

  // Urdu & English word to digit mappings
  const wordMap: Record<string, string> = {
    zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9',
    sifar: '0', ek: '1', aik: '1', do: '2', teen: '3', char: '4', chaar: '4', panch: '5', paanch: '5',
    che: '6', chhe: '6', saat: '7', aath: '8', nau: '9', das: '10',
  };

  // Convert Urdu "PO chaar paanch do" or "PO 452" -> "PO-452"
  const numberWordsPattern = '(?:zero|one|two|three|four|five|six|seven|eight|nine|sifar|ek|aik|do|teen|char|chaar|panch|paanch|che|chhe|saat|aath|nau)';
  const poRegex = new RegExp(`\\b(?:po|pee oh|پی او)\\s*(\\d+|(${numberWordsPattern}\\s*)+)`, 'gi');

  cleaned = cleaned.replace(poRegex, (match, digitsOrWords) => {
    let converted = digitsOrWords.trim();
    for (const [word, digit] of Object.entries(wordMap)) {
      const reg = new RegExp(`\\b${word}\\b`, 'gi');
      converted = converted.replace(reg, digit);
    }
    const digitsOnly = converted.replace(/\s+/g, '').match(/\d+/);
    if (digitsOnly) {
      return `PO-${digitsOnly[0]}`;
    }
    return match;
  });

  // Convert "J eight zero one" -> "J-801"
  cleaned = cleaned.replace(/\b(?:j|je)\s+(?:eight\s+zero\s+one|801|aath\s+sifar\s+ek)\b/gi, 'J-801');
  cleaned = cleaned.replace(/\b(?:j|je)\s*(\d{3,4})\b/gi, 'J-$1');

  // Convert "paanch sau" -> "500"
  cleaned = cleaned.replace(/\b(?:paanch|panch|five)\s+(?:sau|hundred)\b/gi, '500');
  cleaned = cleaned.replace(/\b(?:teen|three)\s+(?:sau|hundred)\b/gi, '300');
  cleaned = cleaned.replace(/\b(?:ek|aik|one)\s+(?:hazar|hazaar|thousand)\b/gi, '1000');

  // Standardize PO-XXXX formatting
  cleaned = cleaned.replace(/\bPO\s*(\d+)/gi, 'PO-$1');

  return cleaned;
}

export function detectVoiceCommand(text: string): { type: 'CONFIRM' | 'CANCEL' | 'CORRECTION' | 'QUERY' | 'UNKNOWN'; payload?: any } {
  const lower = text.toLowerCase().trim();

  // 1. Correction commands (e.g. "quantity 500 nahi 550 hai", "500 nahi, 550", "change quantity to 600", "nahi 550")
  const notMatch = lower.match(/\d+\s*(?:nahi|not|nay)\s*,?\s*(\d+)/i);
  if (notMatch && notMatch[1]) {
    return { type: 'CORRECTION', payload: { quantity: parseInt(notMatch[1], 10) } };
  }

  const directNahiMatch = lower.match(/(?:nahi|not|actually|instead)\s*,?\s*(\d+)/i);
  if (directNahiMatch && directNahiMatch[1]) {
    return { type: 'CORRECTION', payload: { quantity: parseInt(directNahiMatch[1], 10) } };
  }

  const qtyMatch = lower.match(/(?:quantity|qty|pieces|pece)\s*(?:change\s*karo|to|hai|kar\s*do)?\s*(\d+)/i);
  if (qtyMatch && qtyMatch[1]) {
    return { type: 'CORRECTION', payload: { quantity: parseInt(qtyMatch[1], 10) } };
  }

  // 2. Confirmation commands
  if (
    /(?:\bconfirm\b|\byes\b|\btheek\s*hai\b|\bsave\s*karo\b|\bhaan\b|\bok\b|\bsahi\s*hai\b|\bcommit\b|\bmanzoor\b)/i.test(lower)
  ) {
    return { type: 'CONFIRM' };
  }

  // 3. Cancel commands
  if (
    /(?:\bcancel\b|\bnahi\b|\bdiscard\b|\bkhatam\s*karo\b|\bundo\b|\bno\b)/i.test(lower)
  ) {
    return { type: 'CANCEL' };
  }

  return { type: 'UNKNOWN' };
}

// Text-to-Speech Engine with Immediate Interruption Cancellation
let currentUtterance: SpeechSynthesisUtterance | null = null;

export function speakVoiceResponse(text: string, language: Language = 'en', onStart?: () => void, onEnd?: () => void) {
  if (!('speechSynthesis' in window)) return;

  // Immediately cancel any currently playing utterance (Interruption Support)
  cancelSpeech();

  const clean = text
    .replace(/[*#_`•]/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/https?:\/\/\S+/g, '');

  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = language === 'ur' ? 'ur-PK' : 'en-US';
  utterance.rate = 1.05;
  utterance.pitch = 1.0;

  if (onStart) utterance.onstart = onStart;
  utterance.onend = () => {
    currentUtterance = null;
    if (onEnd) onEnd();
  };
  utterance.onerror = () => {
    currentUtterance = null;
    if (onEnd) onEnd();
  };

  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

export function cancelSpeech() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    currentUtterance = null;
  }
}
