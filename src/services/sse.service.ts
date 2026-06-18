import { Response } from 'express';

interface SSEClient {
  userId: string;
  response: Response;
  createdAt: Date;
}
//Testing
export class SSEService {
  private static instance: SSEService;
  private clients: SSEClient[] = [];

  private constructor() {
    // Start active heartbeat timer to prevent Cloud Run idle timeouts (drops socket connections)
    setInterval(() => {
      this.sendHeartbeatToAll();
    }, 30000); // Send keep-alive comments every 30 seconds
  }

  public static getInstance(): SSEService {
    if (!SSEService.instance) {
      SSEService.instance = new SSEService();
    }
    return SSEService.instance;
  }

  /**
   * Registers a new client connection response object.
   */
  public registerClient(userId: string, response: Response): void {
    const client: SSEClient = {
      userId,
      response,
      createdAt: new Date()
    };
    this.clients.push(client);
    console.log(`[SSE Service] Registered new client for user: ${userId}. Total active clients: ${this.clients.length}`);

    // Send connection established handshake message
    response.write(`event: connected\ndata: ${JSON.stringify({ message: "SSE Connection Established" })}\n\n`);
  }

  /**
   * Unregisters a client connection response object.
   */
  public removeClient(response: Response): void {
    const index = this.clients.findIndex(c => c.response === response);
    if (index !== -1) {
      const client = this.clients[index];
      this.clients.splice(index, 1);
      console.log(`[SSE Service] Removed client for user: ${client.userId}. Remaining active clients: ${this.clients.length}`);
    }
  }

  /**
   * Pushes a real-time event message to all active sessions owned by a specific user.
   */
  public sendToUser(userId: string, event: string, data: any): void {
    const userClients = this.clients.filter(c => c.userId === userId);
    if (userClients.length === 0) {
      console.log(`[SSE Service] No active SSE clients found for user: ${userId}`);
      return;
    }

    console.log(`[SSE Service] Broadcasting event "${event}" to ${userClients.length} clients for user: ${userId}`);
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

    userClients.forEach(client => {
      try {
        client.response.write(message);
      } catch (err) {
        console.error(`[SSE Service] Failed to send message to client of user ${userId}:`, err);
      }
    });
  }

  /**
   * Periodically write chunk comment markers to prevent GFE/Cloud Run from severing idle connections.
   */
  private sendHeartbeatToAll(): void {
    if (this.clients.length === 0) return;

    // Write standard SSE comment marker (ignored by EventSource API, keeps socket connection alive)
    const comment = `: keep-alive\n\n`;
    this.clients.forEach(client => {
      try {
        client.response.write(comment);
      } catch (err) {
        // Safe fail, removal is handled by response.on('close')
      }
    });
  }
}

export const sseService = SSEService.getInstance();
