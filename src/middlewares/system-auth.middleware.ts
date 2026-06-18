import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client();

/**
 * Middleware to authenticate system-to-system HTTP requests (e.g. from Cloud Workflows).
 * It verifies the Google OIDC token passed in the Authorization header.
 * In development mode, it allows bypassing verification for easier local testing.
 */
export async function systemAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // In local development, bypass authentication for testing convenience
    if (process.env.NODE_ENV === 'development') {
      console.log('[System Auth] Bypassing Google token verification in development mode.');
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid system token' });
    }

    const token = authHeader.substring(7);

    // Verify Google ID token (signature, issuer, and expiration are verified)
    const ticket = await client.verifyIdToken({
      idToken: token,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(403).json({ error: 'Forbidden: Invalid token payload' });
    }

    // Attach system payload metadata to the request
    (req as any).system = payload;
    return next();
  } catch (error) {
    console.error('[System Auth] OIDC Token verification failed:', error);
    return res.status(401).json({ error: 'Unauthorized: System authentication failed' });
  }
}
