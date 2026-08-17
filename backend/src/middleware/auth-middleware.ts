import { Request, Response, NextFunction } from 'express';
import { verifyToken, AuthenticatedUser } from '../services/auth-service.js';

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
    return;
  }

  const token = authHeader.substring(7);
  const user = await verifyToken(token);

  if (!user) {
    res.status(401).json({ error: 'Invalid or expired session token. Please re-authenticate.' });
    return;
  }

  req.user = user;
  next();
}

export function requireRoles(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.roleCode)) {
      res.status(403).json({
        error: `Forbidden. Role "${req.user.roleCode}" is not authorized for this operation. Required: ${allowedRoles.join(', ')}`,
      });
      return;
    }

    next();
  };
}

export function requireExecutive() {
  return requireRoles('CEO', 'GENERAL_MANAGER');
}

export function requireFinanceOrExecutive() {
  return requireRoles('CEO', 'FINANCE_OFFICER');
}

export function requireDepartmentOrExecutive(departmentCode: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const isExec = req.user.roleCode === 'CEO' || req.user.roleCode === 'GENERAL_MANAGER';
    const isDeptUser = req.user.departmentCode === departmentCode;

    if (!isExec && !isDeptUser) {
      res.status(403).json({
        error: `Forbidden. Department "${req.user.departmentCode}" cannot access ${departmentCode} departmental resources.`,
      });
      return;
    }

    next();
  };
}
