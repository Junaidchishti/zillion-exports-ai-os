import React, { useState, useEffect, useRef } from 'react';
import { Shield, Lock, User, Globe, ArrowRight, Check, KeyRound, RefreshCw, ChevronLeft, Mail } from 'lucide-react';
import { useAuth, OTPChallenge } from '../context/AuthContext.js';
import { Language, translations } from '../i18n/translations.js';

export const LoginModal: React.FC = () => {
  const { user, initiateLogin, verifyOtp, resendOtp, language, setLanguage } = useAuth();
  const t = translations[language];

  // Auth step state: 'CREDENTIALS' | 'OTP'
  const [step, setStep] = useState<'CREDENTIALS' | 'OTP'>('CREDENTIALS');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [selectedLang, setSelectedLang] = useState<Language>(language);
  const [otpCode, setOtpCode] = useState<string>('');
  const [otpChallenge, setOtpChallenge] = useState<OTPChallenge | null>(null);

  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(60);
  const [canResend, setCanResend] = useState<boolean>(false);

  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let timer: any;
    if (step === 'OTP' && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  useEffect(() => {
    if (step === 'OTP' && otpInputRef.current) {
      otpInputRef.current.focus();
    }
  }, [step]);

  if (user) return null;

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg(
        selectedLang === 'ur'
          ? 'براہ کرم اپنا مجاز یوزر نیم اور پاس ورڈ درج کریں۔'
          : 'Please enter your authorized username and password.'
      );
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const challenge = await initiateLogin(username.trim(), password.trim(), selectedLang);
      setOtpChallenge(challenge);
      setStep('OTP');
      setCountdown(60);
      setCanResend(false);
      setOtpCode('');
    } catch (err: any) {
      setErrorMsg(
        err.message ||
          (selectedLang === 'ur'
            ? 'لاگ ان کی تصدیق ناکام ہو گئی۔ براہ کرم فیکٹری ایڈمنسٹریشن سے رابطہ کریں۔'
            : 'Authentication failed. Please verify your credentials with factory administration.')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpChallenge) return;
    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      setErrorMsg(
        selectedLang === 'ur'
          ? 'براہ کرم 6 ہندسوں کا مکمل OTP کوڈ درج کریں۔'
          : 'Please enter the complete 6-digit verification code.'
      );
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      await verifyOtp(otpChallenge.challengeToken, otpCode.trim(), selectedLang);
    } catch (err: any) {
      setErrorMsg(err.message || 'OTP verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!otpChallenge || !canResend || loading) return;
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const newChallenge = await resendOtp(otpChallenge.challengeToken);
      setOtpChallenge(newChallenge);
      setCountdown(60);
      setCanResend(false);
      setOtpCode('');
      setSuccessMsg(
        selectedLang === 'ur'
          ? 'نیا OTP کوڈ آپ کے تصدیق شدہ ای میل پر بھیج دیا گیا ہے۔'
          : `A new 6-digit verification code has been sent to ${newChallenge.maskedEmail}.`
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resend OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setStep('CREDENTIALS');
    setOtpCode('');
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleSelectLang = (lang: Language) => {
    setSelectedLang(lang);
    setLanguage(lang);
  };

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        width: '100vw',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#090d16',
        padding: '20px',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 1000,
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '36px 32px',
          backgroundColor: '#0f172a',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 20px 40px -8px rgba(0, 0, 0, 0.8)',
          borderRadius: '16px',
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #0284c7, #2563eb)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              margin: '0 auto 14px',
              boxShadow: '0 6px 20px rgba(2, 132, 199, 0.4)',
            }}
          >
            <Shield size={32} />
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#f8fafc', letterSpacing: '-0.02em' }}>
            ZILLION EXPORTS
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '2px', fontWeight: 500 }}>
            {selectedLang === 'ur' ? 'اے آئی مینوفیکچرنگ اینڈ ای آر پی پلیٹ فارم' : 'AI Factory Operating System'}
          </p>
        </div>

        {/* Status Messages */}
        {errorMsg && (
          <div
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid #ef4444',
              borderRadius: '8px',
              padding: '11px 14px',
              color: '#f87171',
              fontSize: '12.5px',
              marginBottom: '18px',
              lineHeight: 1.4,
            }}
          >
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid #10b981',
              borderRadius: '8px',
              padding: '11px 14px',
              color: '#34d399',
              fontSize: '12.5px',
              marginBottom: '18px',
              lineHeight: 1.4,
            }}
          >
            {successMsg}
          </div>
        )}

        {step === 'CREDENTIALS' ? (
          <form onSubmit={handleCredentialsSubmit}>
            {/* Language Selection Bar */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px' }}>
                <Globe size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
                <span>{selectedLang === 'ur' ? 'سسٹم کی زبان منتخب کریں' : 'Workstation Language'}</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  className={`btn ${selectedLang === 'en' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ justifyContent: 'center', padding: '8px 12px', fontSize: '12.5px' }}
                  onClick={() => handleSelectLang('en')}
                >
                  {selectedLang === 'en' && <Check size={15} />}
                  <span>English</span>
                </button>
                <button
                  type="button"
                  className={`btn ${selectedLang === 'ur' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ justifyContent: 'center', padding: '8px 12px', fontSize: '13px', fontFamily: 'var(--font-urdu)' }}
                  onClick={() => handleSelectLang('ur')}
                >
                  {selectedLang === 'ur' && <Check size={15} />}
                  <span>اردو (Urdu)</span>
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label
                htmlFor="input-login-username"
                style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}
              >
                {selectedLang === 'ur' ? 'یوزر نیم یا ای میل' : 'Authorized Username or Email'}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  id="input-login-username"
                  className="console-input"
                  style={{ width: '100%', paddingLeft: '40px' }}
                  placeholder={selectedLang === 'ur' ? 'اپنا یوزر نیم درج کریں' : 'Enter authorized username'}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
                <User size={16} style={{ position: 'absolute', left: '14px', top: '13px', color: '#64748b' }} />
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label
                htmlFor="input-login-password"
                style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}
              >
                {selectedLang === 'ur' ? 'پاس ورڈ' : 'Security Password'}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  id="input-login-password"
                  className="console-input"
                  style={{ width: '100%', paddingLeft: '40px' }}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <Lock size={16} style={{ position: 'absolute', left: '14px', top: '13px', color: '#64748b' }} />
              </div>
            </div>

            <button
              type="submit"
              id="btn-submit-login"
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', fontSize: '14px', fontWeight: 700 }}
              disabled={loading}
            >
              <span>{loading ? (selectedLang === 'ur' ? 'تصدیق جاری ہے...' : 'Verifying credentials...') : (selectedLang === 'ur' ? 'اگلا مرحلہ: ای میل OTP حاصل کریں' : 'Continue to Email OTP')}</span>
              <ArrowRight size={16} />
            </button>
          </form>
        ) : (
          <form onSubmit={handleOtpSubmit}>
            {/* Step 2: OTP Verification Card */}
            <div
              style={{
                backgroundColor: 'rgba(2, 132, 199, 0.1)',
                border: '1px solid rgba(2, 132, 199, 0.3)',
                borderRadius: '10px',
                padding: '14px',
                marginBottom: '20px',
                textAlign: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#38bdf8', fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>
                <Mail size={16} />
                <span>{selectedLang === 'ur' ? 'ای میل تصدیق کا مرحلہ' : 'Two-Factor Email Verification'}</span>
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                {selectedLang === 'ur'
                  ? `6 ہندسوں کا OTP کوڈ بھیجا گیا ہے:`
                  : 'A 6-digit verification code was sent to:'}
              </div>
              <div className="mono" style={{ fontSize: '14px', fontWeight: 800, color: '#f8fafc', marginTop: '3px' }}>
                {otpChallenge?.maskedEmail}
              </div>
              {otpChallenge?.userSummary && (
                <div style={{ fontSize: '11px', color: '#38bdf8', marginTop: '6px' }}>
                  {otpChallenge.userSummary.fullName} • {otpChallenge.userSummary.departmentCode}
                </div>
              )}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label
                htmlFor="input-login-otp"
                style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px', textAlign: 'center' }}
              >
                {selectedLang === 'ur' ? '6 ہندسوں کا OTP کوڈ درج کریں' : 'Enter 6-Digit OTP Code'}
              </label>
              <div style={{ position: 'relative', maxWidth: '260px', margin: '0 auto' }}>
                <input
                  ref={otpInputRef}
                  type="text"
                  id="input-login-otp"
                  className="console-input"
                  style={{
                    width: '100%',
                    textAlign: 'center',
                    fontSize: '22px',
                    letterSpacing: '0.3em',
                    fontWeight: 800,
                    padding: '10px 14px',
                  }}
                  placeholder="••••••"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  autoComplete="one-time-code"
                  required
                />
                <KeyRound size={16} style={{ position: 'absolute', left: '12px', top: '16px', color: '#64748b' }} />
              </div>
            </div>

            <button
              type="submit"
              id="btn-verify-otp"
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}
              disabled={loading || otpCode.length !== 6}
            >
              <span>{loading ? (selectedLang === 'ur' ? 'کوڈ کی تصدیق جاری ہے...' : 'Verifying OTP...') : (selectedLang === 'ur' ? 'لاگ ان کی تصدیق کریں' : 'Verify & Access Workstation')}</span>
              <Check size={16} />
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', fontSize: '12px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleBackToLogin}
                disabled={loading}
              >
                <ChevronLeft size={14} />
                <span>{selectedLang === 'ur' ? 'اکاؤنٹ تبدیل کریں' : 'Change Account'}</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleResend}
                disabled={!canResend || loading}
                title={!canResend ? `Available in ${countdown}s` : 'Resend code'}
              >
                <RefreshCw size={13} className={loading ? 'spinner' : ''} />
                <span>{canResend ? (selectedLang === 'ur' ? 'دوبارہ کوڈ بھیجیں' : 'Resend Code') : `${countdown}s`}</span>
              </button>
            </div>
          </form>
        )}

        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', textAlign: 'center', fontSize: '11.5px', color: '#64748b' }}>
          Single Source of Truth Enterprise Architecture • Zillion Exports Ltd.
        </div>
      </div>
    </div>
  );
};
