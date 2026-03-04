import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private client: Minio.Client;
  private bucket: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const endpoint = this.configService.get<string>('MINIO_ENDPOINT', 'localhost:9000');
    const [host, portStr] = endpoint.split(':');
    const port = portStr ? parseInt(portStr, 10) : 9000;

    this.bucket = this.configService.get<string>('MINIO_BUCKET_PROCESSED', 'processed-zips');

    this.client = new Minio.Client({
      endPoint: host,
      port,
      useSSL: false,
      accessKey: this.configService.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: this.configService.get<string>('MINIO_SECRET_KEY', 'minioadmin123'),
    });

    this.logger.log(`MinIO client initialized → ${endpoint}`);
  }

  async getPresignedDownloadUrl(objectKey: string, expiresInSeconds = 3600): Promise<string> {
    try {
      const url = await this.client.presignedGetObject(
        this.bucket,
        objectKey,
        expiresInSeconds,
      );
      return url;
    } catch (error) {
      this.logger.error(`Failed to generate presigned URL for ${objectKey}: ${error.message}`);
      throw error;
    }
  }

  async objectExists(objectKey: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, objectKey);
      return true;
    } catch {
      return false;
    }
  }
}
