import { Response, Request } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { FileService } from '../services/file.service';
import { sseService } from '../services/sse.service';

export class FileController {
  private fileService: FileService;

  constructor(fileService: FileService) {
    this.fileService = fileService;
  }

  /**
   * GET /api/files
   * Retrieves all file documents associated with the authenticated user.
   */
  getUserFiles = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user?.uid;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized: Missing user authentication context' });
      }

      const files = await this.fileService.getUserFiles(userId);
      return res.status(200).json(files);
    } catch (error) {
      console.error('Controller Error in getUserFiles:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  };

  /**
   * POST /api/files/signed-url
   * Initiates the upload flow by creating a pending db document and returning a GCS upload URL.
   */
  initiateUpload = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user?.uid;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized: Missing user authentication context' });
      }

      const { fileName, fileType, contentType } = req.body;

      // Request validation
      if (!fileName || typeof fileName !== 'string' || fileName.trim() === '') {
        return res.status(400).json({ error: 'Bad Request: Missing or invalid fileName' });
      }

      if (!fileType || (fileType !== 'pdf' && fileType !== 'video')) {
        return res.status(400).json({ error: "Bad Request: fileType must be 'pdf' or 'video'" });
      }

      const result = await this.fileService.initiateUpload(
        userId,
        fileName.trim(),
        fileType,
        contentType
      );
      return res.status(201).json(result);
    } catch (error) {
      console.error('Controller Error in initiateUpload:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  };

  /**
   * POST /api/files/:id/complete
   * Called by the system (AI Worker) to signal task completion and save AI results.
   * Shifts status to ready or failed and broadcasts the updated metadata over SSE.
   */
  completeUpload = async (req: Request, res: Response): Promise<Response> => {
    try {
      const fileId = req.params.id;
      const { userId, status, summary, transcription } = req.body;

      if (!fileId) {
        return res.status(400).json({ error: 'Bad Request: Missing file parameter ID' });
      }
      if (!userId) {
        return res.status(400).json({ error: 'Bad Request: Missing userId in request body' });
      }

      const targetStatus = status === 'failed' ? 'failed' : 'ready';

      const fileDoc = await this.fileService.completeUpload(userId, fileId, targetStatus, {
        summary,
        transcription,
      });

      // Broadcast the completed file metadata via SSE (updates status on UI)
      sseService.sendToUser(userId, 'file-created', fileDoc);

      return res.status(200).json({ message: `Upload marked as ${targetStatus}`, file: fileDoc });
    } catch (error: any) {
      console.error('Controller Error in completeUpload:', error);
      const status = error.statusCode || 500;
      const message = error.statusCode ? error.message : 'Internal Server Error';
      return res.status(status).json({ error: message });
    }
  };

  /**
   * POST /api/files/:id/processing
   * Called by the Workflow to transition status to processing.
   */
  startProcessing = async (req: Request, res: Response): Promise<Response> => {
    try {
      const fileId = req.params.id;
      const { userId } = req.body;

      if (!fileId) {
        return res.status(400).json({ error: 'Bad Request: Missing file parameter ID' });
      }
      if (!userId) {
        return res.status(400).json({ error: 'Bad Request: Missing userId in request body' });
      }

      const fileDoc = await this.fileService.startProcessing(userId, fileId);

      // Broadcast the processing file metadata via SSE
      sseService.sendToUser(userId, 'file-created', fileDoc);

      return res.status(200).json({ message: 'File status updated to processing', file: fileDoc });
    } catch (error: any) {
      console.error('Controller Error in startProcessing:', error);
      const status = error.statusCode || 500;
      const message = error.statusCode ? error.message : 'Internal Server Error';
      return res.status(status).json({ error: message });
    }
  };

  /**
   * GET /api/files/:id
   * Retrieves specific file details and generates a temporary GET URL for display/streaming.
   */
  getFileForViewer = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user?.uid;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized: Missing user authentication context' });
      }

      const fileId = req.params.id;
      if (!fileId) {
        return res.status(400).json({ error: 'Bad Request: Missing file parameter ID' });
      }

      const fileDetails = await this.fileService.getFileForViewer(userId, fileId);
      return res.status(200).json(fileDetails);
    } catch (error: any) {
      console.error('Controller Error in getFileForViewer:', error);

      const status = error.statusCode || 500;
      const message = error.statusCode ? error.message : 'Internal Server Error';

      return res.status(status).json({ error: message });
    }
  };

  /**
   * POST /api/files/create
   * Called by the system (Cloud Workflows) when GCS upload is detected.
   * Creates/updates the Firestore record and broadcasts a 'file-created' event via SSE.
   */
  createFileRecord = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { bucket, storagePath } = req.body;
      if (!bucket || !storagePath) {
        return res.status(400).json({ error: 'Bad Request: Missing bucket or storagePath in payload' });
      }

      const fileDoc = await this.fileService.createOrUpdateFileRecord(bucket, storagePath);

      // Broadcast file created event to the user
      sseService.sendToUser(fileDoc.userId, 'file-created', fileDoc);

      return res.status(200).json(fileDoc);
    } catch (error: any) {
      console.error('Controller Error in createFileRecord:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  };
}
