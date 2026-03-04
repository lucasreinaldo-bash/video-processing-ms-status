import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MinioService } from '../minio/minio.service';
import { JobStatusDto, ProcessingStatus, StatusUpdateEvent } from './dto/job-status.dto';

@Injectable()
export class StatusService {
  private readonly logger = new Logger(StatusService.name);

  // Track job subscriptions: jobId -> Set of socketIds
  private subscriptions: Map<string, Set<string>> = new Map();

  // Track previous job statuses for change detection
  private jobStatusCache: Map<string, ProcessingStatus> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
  ) {}

  async getJobById(jobId: string, userId: string): Promise<JobStatusDto> {
    const job = await this.prisma.processingJob.findFirst({
      where: { id: jobId, userId },
    });

    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    return this.mapToDto(job);
  }

  async getJobsByUser(userId: string): Promise<JobStatusDto[]> {
    const jobs = await this.prisma.processingJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(jobs.map((job) => this.mapToDto(job)));
  }

  async getJobByVideoId(videoId: string, userId: string): Promise<JobStatusDto | null> {
    const job = await this.prisma.processingJob.findFirst({
      where: { videoId, userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!job) return null;
    return this.mapToDto(job);
  }

  async getDownloadUrl(jobId: string, userId: string): Promise<string> {
    const job = await this.prisma.processingJob.findFirst({
      where: { id: jobId, userId },
    });

    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    if (job.status !== 'COMPLETED') {
      throw new NotFoundException('Job is not completed yet');
    }

    if (!job.outputStorageKey) {
      throw new NotFoundException('No output file available');
    }

    return this.minio.getPresignedDownloadUrl(job.outputStorageKey);
  }

  // Subscription management
  subscribe(socketId: string, jobId: string): void {
    if (!this.subscriptions.has(jobId)) {
      this.subscriptions.set(jobId, new Set());
    }
    this.subscriptions.get(jobId)!.add(socketId);
    this.logger.debug(`Socket ${socketId} subscribed to job ${jobId}`);
  }

  unsubscribe(socketId: string, jobId?: string): void {
    if (jobId) {
      this.subscriptions.get(jobId)?.delete(socketId);
      this.logger.debug(`Socket ${socketId} unsubscribed from job ${jobId}`);
    } else {
      // Remove from all subscriptions
      for (const [jId, sockets] of this.subscriptions.entries()) {
        sockets.delete(socketId);
        if (sockets.size === 0) {
          this.subscriptions.delete(jId);
        }
      }
      this.logger.debug(`Socket ${socketId} unsubscribed from all jobs`);
    }
  }

  getSubscribedSocketIds(jobId: string): Set<string> {
    return this.subscriptions.get(jobId) || new Set();
  }

  getAllSubscribedJobIds(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  // Check for status changes and return updates
  async checkForUpdates(): Promise<StatusUpdateEvent[]> {
    const updates: StatusUpdateEvent[] = [];
    const jobIds = this.getAllSubscribedJobIds();

    if (jobIds.length === 0) return updates;

    const jobs = await this.prisma.processingJob.findMany({
      where: { id: { in: jobIds } },
    });

    for (const job of jobs) {
      const cachedStatus = this.jobStatusCache.get(job.id);
      const currentStatus = job.status as ProcessingStatus;

      if (cachedStatus !== currentStatus) {
        this.jobStatusCache.set(job.id, currentStatus);

        let downloadUrl: string | null = null;
        if (currentStatus === ProcessingStatus.COMPLETED && job.outputStorageKey) {
          try {
            downloadUrl = await this.minio.getPresignedDownloadUrl(job.outputStorageKey);
          } catch {
            this.logger.warn(`Failed to get download URL for job ${job.id}`);
          }
        }

        updates.push({
          jobId: job.id,
          status: currentStatus,
          framesExtracted: job.framesExtracted,
          outputStorageKey: job.outputStorageKey,
          errorMessage: job.errorMessage,
          updatedAt: job.updatedAt,
          downloadUrl,
        });
      }
    }

    return updates;
  }

  private async mapToDto(job: any): Promise<JobStatusDto> {
    let downloadUrl: string | null = null;

    if (job.status === 'COMPLETED' && job.outputStorageKey) {
      try {
        downloadUrl = await this.minio.getPresignedDownloadUrl(job.outputStorageKey);
      } catch {
        this.logger.warn(`Failed to get download URL for job ${job.id}`);
      }
    }

    return {
      id: job.id,
      videoId: job.videoId,
      userId: job.userId,
      status: job.status as ProcessingStatus,
      framesExtracted: job.framesExtracted,
      outputStorageKey: job.outputStorageKey,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      updatedAt: job.updatedAt,
      downloadUrl,
    };
  }
}
