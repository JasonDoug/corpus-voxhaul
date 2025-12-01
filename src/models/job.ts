// Job-related data models

export type JobStatus = 
  | 'queued'
  | 'analyzing'
  | 'segmenting'
  | 'generating_script'
  | 'synthesizing_audio'
  | 'completed'
  | 'failed';

export interface StageStatus {
  stage: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface Job {
  jobId: string;
  status: JobStatus;
  createdAt: Date;
  updatedAt: Date;
  pdfFilename: string;
  pdfUrl: string;
  agentId?: string;
  stages: StageStatus[];
  error?: string;
}
