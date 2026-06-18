import { Router, Request, Response } from 'express';
import { admin } from '../config/firebase';
import { sseService } from '../services/sse.service';

const notificationRouter = Router();

/**
 * GET /api/notifications/sse
 * Establishes a Server-Sent Events (SSE) connection with the client.
 * Authenticates the connection using Firebase ID Tokens passed via either the Authorization header
 * or the query string parameter `token` (since native EventSource does not support headers).
 */
notificationRouter.get('/notifications/sse', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null) || (req.query.token as string);

  if (!token) {
    console.error('[SSE Route] Rejecting connection: Missing token');
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  try {
    // Verify the Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(token);
    const userId = decodedToken.uid;

    // Establish Server-Sent Events headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Prevent proxy buffering (e.g. Nginx)

    // Flush headers to establish the stream connection
    res.flushHeaders();

    // Register active connection
    sseService.registerClient(userId, res);

    // Clean up when client disconnects
    req.on('close', () => {
      sseService.removeClient(res);
    });

  } catch (error) {
    console.error('[SSE Route] Token verification failed:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
});

export { notificationRouter };
