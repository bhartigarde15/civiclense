import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private storage: Storage | null = null;
  private bucketName: string;
  private readonly maxSizeBytes = 5 * 1024 * 1024; // 5 MB
  private readonly allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.get<string>('GCS_BUCKET') || '';
    const projectId =
      this.configService.get<string>('GOOGLE_CLOUD_PROJECT') ||
      this.configService.get<string>('GCP_PROJECT_ID');

    try {
      this.storage = new Storage(projectId ? { projectId } : {});
      if (this.bucketName) {
        this.logger.log(`StorageService configured with GCS bucket: ${this.bucketName}`);
      } else {
        this.logger.log('StorageService running in local storage fallback mode (GCS_BUCKET not set).');
      }
    } catch (err) {
      this.logger.warn(`Cloud Storage client initialization deferred: ${err.message}`);
    }
  }

  validateImage(file: Express.Multer.File): void {
    if (!file) return;

    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type '${file.mimetype}'. Allowed types: JPEG, PNG, WEBP.`,
      );
    }

    if (file.size > this.maxSizeBytes) {
      throw new BadRequestException(
        `File size (${(file.size / 1024 / 1024).toFixed(2)} MB) exceeds maximum allowed 5 MB limit.`,
      );
    }
  }

  async uploadComplaintImage(file: Express.Multer.File): Promise<string> {
    this.validateImage(file);

    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const uniqueId = crypto.randomBytes(8).toString('hex');
    const objectName = `complaints/${Date.now()}-${uniqueId}${ext}`;

    // If GCS bucket is configured, upload to Google Cloud Storage
    if (this.storage && this.bucketName) {
      try {
        const bucket = this.storage.bucket(this.bucketName);
        const gcsFile = bucket.file(objectName);

        await gcsFile.save(file.buffer, {
          contentType: file.mimetype,
          resumable: false,
          metadata: {
            cacheControl: 'public, max-age=31536000',
          },
        });

        const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${objectName}`;
        this.logger.log(`Uploaded complaint image to GCS: ${publicUrl}`);
        return publicUrl;
      } catch (error) {
        this.logger.warn(`GCS upload failed, falling back to local storage: ${error.message}`);
      }
    }

    // Fallback: save to local uploads directory and return path / data URL
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const localFilePath = path.join(uploadDir, `${Date.now()}-${uniqueId}${ext}`);
    fs.writeFileSync(localFilePath, file.buffer);
    const mockUrl = `/uploads/${path.basename(localFilePath)}`;
    this.logger.log(`Saved complaint image locally: ${mockUrl}`);
    return mockUrl;
  }
}
