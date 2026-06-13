import { Request, Response, NextFunction } from 'express';
import { admin } from '../config/firebase';

/**
 * Interface extending Express Request to supply user authentication context.
 */
export interface AuthenticatedRequest extends Request {
  user?: admin.auth.DecodedIdToken;
}

/**
 * Express Middleware to authenticate incoming requests via Firebase ID Tokens.
 * Extracts the Bearer token from the Authorization header, verifies it,
 * and attaches the decoded payload to the request object.
 */
export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'Unauthorized: Missing Authorization header' });
    }

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Authorization header must use Bearer scheme' });
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: Token is empty or missing' });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    
    return next();
  } catch (error) {
    console.error('Authentication error (Firebase ID Token verification failed):', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid, expired, or revoked token' });
  }
}
