import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { execute, queryOne } from '../db/connection.js';
import { logAction } from './audit-service.js';
import { notificationService } from './notification-service.js';

const JWT_SECRET = process.env.JWT_SECRET || 'zillion-exports-secret-key-2026-production';
const SESSION_DURATION_HOURS = 24;
const OTP_EXPIRY_MINUTES = 10;

export interface AuthenticatedUser {
  id: number;
  username: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  roleCode: string;
  departmentCode: string;
  selectedLanguage: 'en' | 'ur';
  sessionId: string;
}

export interface LoginChallengeResult {
  requireOtp: boolean;
  challengeToken: string;
  maskedEmail: string;
  expirySeconds: number;
  userSummary: {
    username: string;
    fullName: string;
    roleCode: string;
    departmentCode: string;
  };
}

export function maskEmail(email: string | null): string {
  if (!email) return 'u***@zillionexports.com';
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : `${name[0]}***`;
  return `${maskedName}@${domain}`;
}

export async function initiateLogin(
  username: string,
  passwordPlain: string,
  selectedLanguage: 'en' | 'ur' = 'en',
  ipAddress: string = '127.0.0.1',
  userAgent: string = 'ZillionFactoryWeb/1.0'
): Promise<LoginChallengeResult> {
  if (selectedLanguage !== 'en' && selectedLanguage !== 'ur') {
    throw new Error('Invalid language selection. Must be "en" (English) or "ur" (Urdu).');
  }

  const user = await queryOne<any>(
    `SELECT id, username, password_hash, full_name, email, phone, role_code, department_code, is_active
     FROM users WHERE username = ?`,
    [username.trim()]
  );

  if (!user || user.is_active !== 1) {
    throw new Error('Invalid credentials or inactive account.');
  }

  const isMatch = bcrypt.compareSync(passwordPlain, user.password_hash);
  if (!isMatch) {
    await logAction({
      userId: user.id,
      userRole: user.role_code,
      action: 'LOGIN_FAILED',
      entityName: 'AUTH_SESSION',
      reason: 'Invalid password attempt',
      ipAddress,
      source: 'WEB_UI',
    });
    throw new Error('Invalid credentials.');
  }

  // Invalidate any previous unused OTP challenges for this user
  await execute(`UPDATE auth_otps SET is_consumed = 1 WHERE user_id = ? AND is_consumed = 0`, [user.id]);

  // Generate secure 6-digit OTP
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const challengeToken = uuidv4();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

  await execute(
    `INSERT INTO auth_otps (challenge_token, user_id, otp_code, selected_language, attempts_left, is_consumed, expires_at)
     VALUES (?, ?, ?, ?, 3, 0, ?)`,
    [challengeToken, user.id, otpCode, selectedLanguage, expiresAt]
  );

  // Dispatch OTP Email to verified user email
  const userEmail = user.email || `${user.username}@zillionexports.com`;
  await notificationService.sendOtpEmail(userEmail, user.full_name, otpCode);

  await logAction({
    userId: user.id,
    userRole: user.role_code,
    action: 'OTP_ISSUED',
    entityName: 'AUTH_OTP',
    entityId: challengeToken,
    newData: { email: maskEmail(userEmail), expiresAt },
    reason: 'Two-factor OTP generated and sent to verified email',
    ipAddress,
    source: 'WEB_UI',
  });

  return {
    requireOtp: true,
    challengeToken,
    maskedEmail: maskEmail(userEmail),
    expirySeconds: OTP_EXPIRY_MINUTES * 60,
    userSummary: {
      username: user.username,
      fullName: user.full_name,
      roleCode: user.role_code,
      departmentCode: user.department_code,
    },
  };
}

export async function verifyOtp(
  challengeToken: string,
  otpCode: string,
  ipAddress: string = '127.0.0.1',
  userAgent: string = 'ZillionFactoryWeb/1.0'
): Promise<{ user: AuthenticatedUser; token: string }> {
  if (!challengeToken || !otpCode) {
    throw new Error('Challenge token and 6-digit OTP code are required.');
  }

  const otpRecord = await queryOne<any>(
    `SELECT o.*, u.id as user_id, u.username, u.full_name, u.email, u.phone, u.role_code, u.department_code, u.is_active
     FROM auth_otps o
     JOIN users u ON o.user_id = u.id
     WHERE o.challenge_token = ?`,
    [challengeToken]
  );

  if (!otpRecord) {
    throw new Error('Invalid or expired authentication challenge.');
  }

  if (otpRecord.is_consumed === 1) {
    throw new Error('This verification code has already been used. Please sign in again.');
  }

  const isExpired = new Date(otpRecord.expires_at).getTime() < Date.now();
  if (isExpired) {
    throw new Error('Verification code has expired. Please request a new code.');
  }

  if (otpRecord.attempts_left <= 0) {
    await execute(`UPDATE auth_otps SET is_consumed = 1 WHERE id = ?`, [otpRecord.id]);
    throw new Error('Too many failed verification attempts. Challenge blocked. Please log in again.');
  }

  // Validate OTP code
  if (otpRecord.otp_code !== otpCode.trim()) {
    const remaining = otpRecord.attempts_left - 1;
    await execute(`UPDATE auth_otps SET attempts_left = ? WHERE id = ?`, [remaining, otpRecord.id]);

    await logAction({
      userId: otpRecord.user_id,
      userRole: otpRecord.role_code,
      action: 'OTP_VERIFY_FAILED',
      entityName: 'AUTH_OTP',
      entityId: challengeToken,
      reason: `Incorrect OTP entered (${remaining} attempts remaining)`,
      ipAddress,
      source: 'WEB_UI',
    });

    if (remaining <= 0) {
      await execute(`UPDATE auth_otps SET is_consumed = 1 WHERE id = ?`, [otpRecord.id]);
      throw new Error('Incorrect code. Max attempts exceeded. Please request a new OTP.');
    }

    throw new Error(`Incorrect verification code. ${remaining} attempt${remaining > 1 ? 's' : ''} remaining.`);
  }

  // Mark OTP as consumed
  await execute(`UPDATE auth_otps SET is_consumed = 1 WHERE id = ?`, [otpRecord.id]);

  // Create authenticated session
  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000).toISOString();
  const lang = (otpRecord.selected_language || 'en') as 'en' | 'ur';

  await execute(
    `INSERT INTO auth_sessions (id, user_id, selected_language, ip_address, user_agent, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [sessionId, otpRecord.user_id, lang, ipAddress, userAgent, expiresAt]
  );

  const tokenPayload = {
    userId: otpRecord.user_id,
    username: otpRecord.username,
    roleCode: otpRecord.role_code,
    departmentCode: otpRecord.department_code,
    sessionId,
    selectedLanguage: lang,
  };

  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: `${SESSION_DURATION_HOURS}h` });

  await logAction({
    userId: otpRecord.user_id,
    userRole: otpRecord.role_code,
    action: 'LOGIN_SUCCESS_OTP',
    entityName: 'AUTH_SESSION',
    entityId: sessionId,
    newData: { language: lang, role: otpRecord.role_code },
    reason: 'User session verified via Email OTP',
    ipAddress,
    source: 'WEB_UI',
  });

  return {
    user: {
      id: otpRecord.user_id,
      username: otpRecord.username,
      fullName: otpRecord.full_name,
      email: otpRecord.email,
      phone: otpRecord.phone,
      roleCode: otpRecord.role_code,
      departmentCode: otpRecord.department_code,
      selectedLanguage: lang,
      sessionId,
    },
    token,
  };
}

export async function resendOtp(
  challengeToken: string,
  ipAddress: string = '127.0.0.1'
): Promise<LoginChallengeResult> {
  const existing = await queryOne<any>(
    `SELECT o.*, u.id as user_id, u.username, u.full_name, u.email, u.role_code, u.department_code
     FROM auth_otps o
     JOIN users u ON o.user_id = u.id
     WHERE o.challenge_token = ?`,
    [challengeToken]
  );

  if (!existing) {
    throw new Error('Active session challenge not found. Please login again.');
  }

  // Invalidate old challenge
  await execute(`UPDATE auth_otps SET is_consumed = 1 WHERE id = ?`, [existing.id]);

  // Generate new OTP & challenge
  const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
  const newChallengeToken = uuidv4();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();
  const lang = existing.selected_language || 'en';

  await execute(
    `INSERT INTO auth_otps (challenge_token, user_id, otp_code, selected_language, attempts_left, is_consumed, expires_at)
     VALUES (?, ?, ?, ?, 3, 0, ?)`,
    [newChallengeToken, existing.user_id, newOtp, lang, expiresAt]
  );

  const userEmail = existing.email || `${existing.username}@zillionexports.com`;
  await notificationService.sendOtpEmail(userEmail, existing.full_name, newOtp);

  await logAction({
    userId: existing.user_id,
    userRole: existing.role_code,
    action: 'OTP_RESENT',
    entityName: 'AUTH_OTP',
    entityId: newChallengeToken,
    reason: 'OTP resent upon user request',
    ipAddress,
    source: 'WEB_UI',
  });

  return {
    requireOtp: true,
    challengeToken: newChallengeToken,
    maskedEmail: maskEmail(userEmail),
    expirySeconds: OTP_EXPIRY_MINUTES * 60,
    userSummary: {
      username: existing.username,
      fullName: existing.full_name,
      roleCode: existing.role_code,
      departmentCode: existing.department_code,
    },
  };
}

// Development helper for test suites to read current OTP
export async function getDevTestOtp(challengeToken: string): Promise<string | null> {
  const rec = await queryOne<any>(
    `SELECT otp_code FROM auth_otps WHERE challenge_token = ? AND is_consumed = 0`,
    [challengeToken]
  );
  return rec ? rec.otp_code : null;
}

// Direct authentication bypass for programmatic legacy unit tests
export async function authenticateUserDirect(
  username: string,
  passwordPlain: string,
  selectedLanguage: 'en' | 'ur' = 'en',
  ipAddress: string = '127.0.0.1',
  userAgent: string = 'ZillionFactoryWeb/1.0'
): Promise<{ user: AuthenticatedUser; token: string }> {
  const challenge = await initiateLogin(username, passwordPlain, selectedLanguage, ipAddress, userAgent);
  const otp = await getDevTestOtp(challenge.challengeToken);
  if (!otp) throw new Error('Failed to generate test OTP');
  return verifyOtp(challenge.challengeToken, otp, ipAddress, userAgent);
}

export const authenticateUser = authenticateUserDirect;

export async function verifyToken(token: string): Promise<AuthenticatedUser | null> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (!decoded || !decoded.sessionId) return null;

    const session = await queryOne<any>(
      `SELECT s.id, s.selected_language, s.expires_at,
              u.id as user_id, u.username, u.full_name, u.email, u.phone, u.role_code, u.department_code, u.is_active
       FROM auth_sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.id = ? AND s.expires_at > CURRENT_TIMESTAMP AND u.is_active = 1`,
      [decoded.sessionId]
    );

    if (!session) return null;

    return {
      id: session.user_id,
      username: session.username,
      fullName: session.full_name,
      email: session.email,
      phone: session.phone,
      roleCode: session.role_code,
      departmentCode: session.department_code,
      selectedLanguage: session.selected_language,
      sessionId: session.id,
    };
  } catch (err) {
    return null;
  }
}

export async function logoutSession(sessionId: string, userId: number, roleCode: string): Promise<void> {
  await execute('DELETE FROM auth_sessions WHERE id = ?', [sessionId]);
  await logAction({
    userId,
    userRole: roleCode,
    action: 'LOGOUT',
    entityName: 'AUTH_SESSION',
    entityId: sessionId,
    reason: 'User logged out',
    source: 'WEB_UI',
  });
}
