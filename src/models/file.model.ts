export interface FileDocument {
  id: string;
  userId: string;
  fileName: string;
  storagePath: string; // relative file path in GCS: users/${userId}/${fileId}
  status: 'pending' | 'processing' | 'ready' | 'failed' | string;
  createdAt: string; // ISO Date String
  updatedAt?: string; // ISO Date String
  fileType?: 'pdf' | 'video';
  summary?: string;
  transcription?: string;
}
