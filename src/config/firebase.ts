import * as admin from 'firebase-admin';
import dotenv from 'dotenv';

// Ensure environment variables are loaded
dotenv.config();

const projectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT

// Initialize Firebase Admin SDK for default app connection context (used strictly for auth verification)
try {
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: projectId,
    });
    console.log(`[Backend Configuration] Firebase Admin SDK initialized for project "${projectId}".`);
  }
} catch (error) {
  console.error('Error initializing Firebase Admin SDK:', error);
}

export { admin };

