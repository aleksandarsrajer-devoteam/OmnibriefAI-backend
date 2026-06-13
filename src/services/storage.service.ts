import { Storage } from '@google-cloud/storage';
import { randomUUID, generateKeyPairSync } from 'crypto';

export class StorageService {
  private storage: Storage;
  private bucketName: string;

  constructor() {
    if (process.env.STORAGE_EMULATOR_HOST) {
      const { privateKey, publicKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem',
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      });

      this.storage = new Storage({
        projectId: process.env.GCP_PROJECT_ID,
        credentials: {
          client_email: 'fake-emulator-sa@local.iam.gserviceaccount.com',
          private_key: privateKey,
        },
      });
    } else {
      this.storage = new Storage();
    }

    // Require bucket name and throw an error in non-local environments if missing
    const bucket = process.env.GCS_BUCKET_NAME
    if (!bucket) {
      if (process.env.STORAGE_EMULATOR_HOST) {
        this.bucketName = 'default-emulator-bucket';
      } else {
        throw new Error('[Storage Service] Critical configuration error: GCS_BUCKET_NAME is not defined in the environment.');
      }
    } else {
      this.bucketName = bucket;
    }

  }

  /**
   * Dynamically rewrites internal emulator URL hosts to localhost for the frontend client browser.
   */
  private rewriteEmulatorUrl(url: string, isDownload = false): string {
    if (!process.env.STORAGE_EMULATOR_HOST) {
      return url;
    }

    try {
      let cleanUrl = url
        .replace('firebase-emulator:9199', 'localhost:9199')
        .replace('storage.googleapis.com', 'localhost:9199');

      const parsedUrl = new URL(cleanUrl);

      // 2. Ako putanja već ne sadrži zvanični Firebase JSON API ruter (/v0/b/), transformiši je
      if (!parsedUrl.pathname.startsWith('/v0/b/')) {
        const pathParts = parsedUrl.pathname.split('/').filter(Boolean);

        if (pathParts.length >= 2) {
          const bucketName = pathParts[0]; // 'omnibriefai-file-uploads-local'
          const objectName = pathParts.slice(1).join('/'); // 'users/77CU.../2ed02b22...'

          // Zvanični format koji Firebase lokalni Storage emulator zahteva za upis:
          // /v0/b/{bucketName}/o/{encodedObjectName}
          parsedUrl.pathname = `/v0/b/${bucketName}/o/${encodeURIComponent(objectName)}`;
        }
      }

      // 3. Ako je u pitanju download URL, dodaj alt=media da bi se preuzeli bajtovi a ne metapodaci
      if (isDownload) {
        parsedUrl.searchParams.set('alt', 'media');
      }

      return parsedUrl.toString();
    } catch (e) {
      // Krajnji fallback ako bilo šta u parsiranju omane
      let clean = url.replace('firebase-emulator:9199', 'localhost:9199');
      if (isDownload) {
        clean += (clean.includes('?') ? '&' : '?') + 'alt=media';
      }
      return clean;
    }
  }

  /**
   * Generates a GCS V4 Signed PUT URL for direct file uploads.
   * @param contentType The MIME content type of the file.
   * @param prefix The prefix/directory path structure (defaults to 'media').
   */
  async generateUploadUrl(contentType: string, prefix = 'media') {
    const fileName = `${prefix}/${randomUUID()}`;
    const file = this.storage.bucket(this.bucketName).file(fileName);

    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType,
      extensionHeaders: {
        'Cache-Control': 'public, max-age=31536000',
      },
    });

    const uploadUrl = this.rewriteEmulatorUrl(url);

    return {
      uploadUrl,
      fileName,
      gcsPath: `https://storage.googleapis.com/${this.bucketName}/${fileName}`,
    };
  }

  /**
   * Generates a GCS V4 Signed GET URL for downloading/viewing a file.
   * @param fileName The relative GCS storage path.
   */
  async generateDownloadUrl(fileName: string): Promise<string> {
    const file = this.storage.bucket(this.bucketName).file(fileName);
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
    });
    return this.rewriteEmulatorUrl(url, true);
  }
}
