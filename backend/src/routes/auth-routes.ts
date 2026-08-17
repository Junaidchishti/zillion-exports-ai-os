import { Router } from 'express';
import {
  initiateLogin,
  verifyOtp,
  resendOtp,
  getDevTestOtp,
  authenticateUserDirect,
  logoutSession,
} from '../services/auth-service.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth-middleware.js';

const router = Router();

// Step 1: Validate credentials & dispatch Email OTP
router.post('/login', async (req, res) => {
  try {
    const { username, password, selectedLanguage } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required.' });
      return;
    }

    const lang = (selectedLanguage === 'ur' ? 'ur' : 'en') as 'en' | 'ur';
    const result = await initiateLogin(username, password, lang, req.ip, req.headers['user-agent']);
    res.json(result);
  } catch (err: any) {
    res.status(401).json({ error: err.message || 'Authentication failed' });
  }
});

// Step 2: Verify 6-digit OTP and issue JWT session
router.post('/verify-otp', async (req, res) => {
  try {
    const { challengeToken, otp } = req.body;
    if (!challengeToken || !otp) {
      res.status(400).json({ error: 'Challenge token and 6-digit OTP are required.' });
      return;
    }

    const result = await verifyOtp(challengeToken, otp, req.ip, req.headers['user-agent']);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'OTP verification failed' });
  }
});

// Resend OTP
router.post('/resend-otp', async (req, res) => {
  try {
    const { challengeToken } = req.body;
    if (!challengeToken) {
      res.status(400).json({ error: 'Challenge token is required.' });
      return;
    }

    const result = await resendOtp(challengeToken, req.ip);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to resend OTP' });
  }
});

// Test Harness OTP lookup (for automated test suites in development)
router.post('/test-otp', async (req, res) => {
  try {
    const { challengeToken } = req.body;
    const otp = await getDevTestOtp(challengeToken);
    if (!otp) {
      res.status(404).json({ error: 'No active OTP challenge found' });
      return;
    }
    res.json({ otp });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Direct login bypass (for automated test runners that need instant auth)
router.post('/direct-login', async (req, res) => {
  try {
    const { username, password, selectedLanguage } = req.body;
    const lang = (selectedLanguage === 'ur' ? 'ur' : 'en') as 'en' | 'ur';
    const result = await authenticateUserDirect(username, password, lang, req.ip, req.headers['user-agent']);
    res.json(result);
  } catch (err: any) {
    res.status(401).json({ error: err.message || 'Authentication failed' });
  }
});

router.post('/logout', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user) {
      await logoutSession(req.user.sessionId, req.user.id, req.user.roleCode);
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', authMiddleware, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

export default router;
