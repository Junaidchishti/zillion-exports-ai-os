import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, setAuthToken, getAuthToken } from '../services/api.js';
import { Language } from '../i18n/translations.js';

export interface User {
  id: number;
  username: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  roleCode: string;
  departmentCode: string;
  selectedLanguage: Language;
  sessionId: string;
}

export interface OTPChallenge {
  requireOtp: boolean;
  challengeToken: string;
  maskedEmail: string;
  expirySeconds: number;
  userSummary?: {
    username: string;
    fullName: string;
    roleCode: string;
    departmentCode: string;
  };
}

interface AuthContextType {
  user: User | null;
  language: Language;
  isLoading: boolean;
  setLanguage: (lang: Language) => void;
  initiateLogin: (username: string, passwordPlain: string, selectedLanguage: Language) => Promise<OTPChallenge>;
  verifyOtp: (challengeToken: string, otpCode: string, selectedLanguage?: Language) => Promise<void>;
  resendOtp: (challengeToken: string) => Promise<OTPChallenge>;
  loginDirect: (username: string, passwordPlain: string, selectedLanguage: Language) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [language, setLanguageState] = useState<Language>('en');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (lang === 'ur') {
      document.body.classList.add('lang-ur');
      document.body.setAttribute('dir', 'rtl');
    } else {
      document.body.classList.remove('lang-ur');
      document.body.setAttribute('dir', 'ltr');
    }
  };

  useEffect(() => {
    async function checkExistingAuth() {
      const token = getAuthToken();
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await api.getMe();
        if (res.user) {
          setUser(res.user);
          setLanguage(res.user.selectedLanguage || 'en');
        }
      } catch (err) {
        setAuthToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
    checkExistingAuth();
  }, []);

  const initiateLogin = async (username: string, passwordPlain: string, selectedLanguage: Language) => {
    const res = await api.initiateLogin(username, passwordPlain, selectedLanguage);
    return res;
  };

  const verifyOtp = async (challengeToken: string, otpCode: string, selectedLanguage?: Language) => {
    setIsLoading(true);
    try {
      const res = await api.verifyOtp(challengeToken, otpCode);
      setAuthToken(res.token);
      setUser(res.user);
      if (selectedLanguage) setLanguage(selectedLanguage);
      else if (res.user.selectedLanguage) setLanguage(res.user.selectedLanguage);
    } finally {
      setIsLoading(false);
    }
  };

  const resendOtp = async (challengeToken: string) => {
    const res = await api.resendOtp(challengeToken);
    return res;
  };

  const loginDirect = async (username: string, passwordPlain: string, selectedLanguage: Language) => {
    setIsLoading(true);
    try {
      const res = await api.loginDirect(username, passwordPlain, selectedLanguage);
      setAuthToken(res.token);
      setUser(res.user);
      setLanguage(selectedLanguage);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (e) {
      // ignore
    } finally {
      setAuthToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        language,
        isLoading,
        setLanguage,
        initiateLogin,
        verifyOtp,
        resendOtp,
        loginDirect,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
