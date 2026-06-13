import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileRouter } from './routes/file.routes';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const frontendUrl = process.env.FRONTEND_URL

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        frontendUrl,
        frontendUrl?.replace(/^http:/, 'https:'),
        frontendUrl?.replace(/^https:/, 'http:'),
        'http://localhost:5173',
        'http://127.0.0.1:5173',
      ].filter(Boolean);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        const msg = `CORS policy doesn't endorse ${origin}`;
        return callback(new Error(msg), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)

// Enable JSON parsing middleware
app.use(express.json());

// Register endpoints mapped under /api prefix
app.use('/api', fileRouter);

// Global unhandled error handler middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global unhandled exception:', err);
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});

// Start listening for incoming connections
app.listen(port, () => {
  console.log(`[OmniBrief Backend] Server is running on port: ${port}`);
});
