export enum ProcessingStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export class JobStatusDto {
  id: string;
  videoId: string;
  userId: string;
  status: ProcessingStatus;
  framesExtracted: number | null;
  outputStorageKey: string | null;
  errorMessage: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  updatedAt: Date;
  downloadUrl?: string | null;
}

export class SubscribeToJobDto {
  jobId: string;
}

export class UnsubscribeFromJobDto {
  jobId: string;
}

export class StatusUpdateEvent {
  jobId: string;
  status: ProcessingStatus;
  framesExtracted: number | null;
  outputStorageKey: string | null;
  errorMessage: string | null;
  updatedAt: Date;
  downloadUrl?: string | null;
}
