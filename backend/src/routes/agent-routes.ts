import { Router } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth-middleware.js';
import { agentRegistry } from '../agents/agent-registry.js';
import { AgentContext } from '../agents/base-agent.js';

const router = Router();

// Chat / Voice transcript processing
router.post('/chat', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { department, message, sessionState } = req.body;
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Missing or invalid message parameter.' });
      return;
    }

    const targetDept = (department || req.user!.departmentCode).toUpperCase();
    const isExec = req.user!.roleCode === 'CEO' || req.user!.roleCode === 'GENERAL_MANAGER';

    // Department isolation: standard departmental users can only chat with their assigned agent
    if (!isExec && req.user!.departmentCode !== targetDept) {
      res.status(403).json({
        error: `Forbidden. Departmental user (${req.user!.departmentCode}) cannot access the ${targetDept} AI Agent.`,
      });
      return;
    }

    const context: AgentContext = {
      userId: req.user!.id,
      userRole: req.user!.roleCode,
      departmentCode: targetDept,
      language: req.user!.selectedLanguage,
    };

    const intentResult = await agentRegistry.routeMessage(targetDept, message, context, sessionState);
    res.json(intentResult);
  } catch (err: any) {
    console.error('Agent chat error:', err);
    res.status(500).json({ error: err.message || 'Internal agent processing error' });
  }
});

// Explicit action confirmation
router.post('/confirm', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { department, payload } = req.body;
    if (!payload) {
      res.status(400).json({ error: 'Missing payload for confirmation.' });
      return;
    }

    const targetDept = (department || req.user!.departmentCode).toUpperCase();
    const isExec = req.user!.roleCode === 'CEO' || req.user!.roleCode === 'GENERAL_MANAGER';

    if (!isExec && req.user!.departmentCode !== targetDept) {
      res.status(403).json({
        error: `Forbidden. Departmental user (${req.user!.departmentCode}) cannot execute actions in ${targetDept}.`,
      });
      return;
    }

    const context: AgentContext = {
      userId: req.user!.id,
      userRole: req.user!.roleCode,
      departmentCode: targetDept,
      language: req.user!.selectedLanguage,
    };

    const executionResult = await agentRegistry.executeConfirmation(targetDept, payload, context);
    res.json(executionResult);
  } catch (err: any) {
    console.error('Agent confirmation error:', err);
    res.status(500).json({ error: err.message || 'Action execution failed' });
  }
});

export default router;
