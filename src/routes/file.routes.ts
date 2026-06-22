import { Router, RequestHandler } from 'express';
import { FileRepository } from '../repositories/file.repository';
import { StorageService } from '../services/storage.service';
import { FileService } from '../services/file.service';
import { FileController } from '../controllers/file.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { systemAuthMiddleware } from '../middlewares/system-auth.middleware';

const fileRouter = Router();

const fileRepository = new FileRepository();
const storageService = new StorageService();
const fileService = new FileService(fileRepository, storageService);
const fileController = new FileController(fileService);

// 1. GET /api/files -> Get all user files from Firestore DB 'omnibrief-db'
fileRouter.get('/files', authMiddleware as RequestHandler, fileController.getUserFiles as RequestHandler);

// 2. POST /api/files/signed-url -> Initiate upload and return a PUT Signed URL for custom bucket
fileRouter.post('/files/signed-url', authMiddleware as RequestHandler, fileController.initiateUpload as RequestHandler);

// 3. POST /api/files/:id/complete -> Mark the file status as ready upon worker callback completion
fileRouter.post('/files/:id/complete', systemAuthMiddleware as RequestHandler, fileController.completeUpload as RequestHandler);

// POST /api/files/:id/processing -> Move the file status to processing called by workflow
fileRouter.post('/files/:id/processing', systemAuthMiddleware as RequestHandler, fileController.startProcessing as RequestHandler);

// 4. GET /api/files/:id -> Get file details and GET Signed URL for secure viewing
fileRouter.get('/files/:id', authMiddleware as RequestHandler, fileController.getFileForViewer as RequestHandler);

// 5. POST /api/files/create -> Create or update file details called by workflows system webhook
fileRouter.post('/files/create', systemAuthMiddleware as RequestHandler, fileController.createFileRecord as RequestHandler);
//Testing
export { fileRouter };
