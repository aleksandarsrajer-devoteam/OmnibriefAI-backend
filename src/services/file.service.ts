import { FileRepository } from '../repositories/file.repository';
import { StorageService } from './storage.service';
import { FileDocument } from '../models/file.model';

export class FileService {
  private fileRepository: FileRepository;
  private storageService: StorageService;

  constructor(fileRepository: FileRepository, storageService: StorageService) {
    this.fileRepository = fileRepository;
    this.storageService = storageService;
  }

  /**
   * Retrieves all files belonging to a specific user.
   */
  async getUserFiles(userId: string): Promise<FileDocument[]> {
    try {
      return await this.fileRepository.getFilesByUserId(userId);
    } catch (error) {
      console.error(`Error in FileService.getUserFiles for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Initiates the file upload workflow.
   * Generates a unique GCS object path and PUT URL, tracks it in Firestore DB with status 'pending'.
   */
  async initiateUpload(
    userId: string,
    fileName: string,
    fileType: 'pdf' | 'video',
    contentType?: string
  ): Promise<{ uploadUrl: string; fileId: string }> {
    try {
      // 1. Determine content type
      const determinedContentType = contentType || (fileType === 'pdf' ? 'application/pdf' : 'video/mp4');

      // 2. Generate unique storage path and signed URL via StorageService
      const prefix = `users/${userId}`;
      const uploadData = await this.storageService.generateUploadUrl(determinedContentType, prefix);


      const storagePath = uploadData.fileName;
      const fileId = storagePath.split('/').pop() as string;

      // 3. Write document tracking record to Firestore
      const fileDoc: FileDocument = {
        id: fileId,
        userId,
        fileName, // display name
        storagePath,
        status: 'pending',
        createdAt: new Date().toISOString(),
        fileType,
      };

      await this.fileRepository.createFile(fileDoc);

      return { uploadUrl: uploadData.uploadUrl, fileId };
    } catch (error) {
      console.error(`Error in FileService.initiateUpload for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Confirms upload completion, shifting file status from pending to ready in the database.
   */
  async completeUpload(userId: string, fileId: string): Promise<void> {
    try {
      const file = await this.fileRepository.getFileById(fileId);
      if (!file) {
        const notFoundError = new Error('File not found');
        (notFoundError as any).statusCode = 404;
        throw notFoundError;
      }

      if (file.userId !== userId) {
        const forbiddenError = new Error('Forbidden: You do not own this file');
        (forbiddenError as any).statusCode = 403;
        throw forbiddenError;
      }

      await this.fileRepository.updateFileStatus(fileId, 'ready');
    } catch (error) {
      console.error(`Error in FileService.completeUpload for file ${fileId}:`, error);
      throw error;
    }
  }

  /**
   * Fetches file details and verifies ownership.
   * If authorized, generates a GCS V4 GET Signed URL (expires in 1 hour) for secure streaming/viewing.
   */
  async getFileForViewer(
    userId: string,
    fileId: string
  ): Promise<FileDocument & { url: string }> {
    try {
      // 1. Fetch file record from repository
      const file = await this.fileRepository.getFileById(fileId);
      if (!file) {
        const notFoundError = new Error('File not found');
        (notFoundError as any).statusCode = 404;
        throw notFoundError;
      }

      // 2. Validate owner authorization
      if (file.userId !== userId) {
        const forbiddenError = new Error('Forbidden: You do not own this file');
        (forbiddenError as any).statusCode = 403;
        throw forbiddenError;
      }

      // 3. Generate GCS V4 GET signed URL (Expires in 1 hour) via StorageService
      const url = await this.storageService.generateDownloadUrl(file.storagePath);

      return {
        ...file,
        url,
      };
    } catch (error) {
      console.error(`Error in FileService.getFileForViewer for file ${fileId}:`, error);
      throw error;
    }
  }
}
