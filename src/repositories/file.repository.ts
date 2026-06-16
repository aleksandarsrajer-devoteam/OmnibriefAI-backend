import { Firestore } from '@google-cloud/firestore';
import { FileDocument } from '../models/file.model';

const firestore = new Firestore({
  projectId: process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT,
  databaseId: process.env.FIRESTORE_DATABASE_ID,
});

export class FileRepository {
  private collection = firestore.collection('files');

  /**
   * Adds a document to the Firestore 'files' collection.
   */
  async createFile(data: FileDocument): Promise<void> {
    try {
      await this.collection.doc(data.id).set(data);
    } catch (error) {
      console.error(`Error in FileRepository.createFile for file id ${data.id}:`, error);
      throw error;
    }
  }
  //TEST
  /**
   * Fetches files where 'userId' == userId, ordered by 'createdAt' desc.
   */
  async getFilesByUserId(userId: string): Promise<FileDocument[]> {
    try {
      const snapshot = await this.collection
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();

      const files: FileDocument[] = [];
      snapshot.forEach(doc => {
        files.push(doc.data() as FileDocument);
      });
      return files;
    } catch (error) {
      console.error(`Error in FileRepository.getFilesByUserId for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Fetches a single document by its document ID.
   */
  async getFileById(fileId: string): Promise<FileDocument | null> {
    try {
      const doc = await this.collection.doc(fileId).get();
      if (!doc.exists) {
        return null;
      }
      return doc.data() as FileDocument;
    } catch (error) {
      console.error(`Error in FileRepository.getFileById for file ${fileId}:`, error);
      throw error;
    }
  }

  /**
   * Updates status/results of a file document.
   */
  async updateFileStatus(
    fileId: string,
    status: FileDocument['status'],
    extraData?: Partial<FileDocument>
  ): Promise<void> {
    try {
      const updatePayload: Record<string, any> = {
        status,
        updatedAt: new Date().toISOString(),
      };

      if (extraData) {
        // Exclude status, id, and timestamps if they're duplicated in extraData
        const { status: _, id: __, createdAt: ___, updatedAt: ____, ...rest } = extraData;
        Object.assign(updatePayload, rest);
      }

      await this.collection.doc(fileId).update(updatePayload);
    } catch (error) {
      console.error(`Error in FileRepository.updateFileStatus for file ${fileId}:`, error);
      throw error;
    }
  }
}
