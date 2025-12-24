// CTF Autopilot Types

export type JobStatus = 'queued' | 'running' | 'done' | 'failed';

export interface Job {
  id: string;
  title: string;
  description: string;
  flagFormat: string;
  category?: string;
  challengeUrl?: string;
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  progress?: number;
  errorMessage?: string;
}

export interface Command {
  id: string;
  jobId: string;
  tool: string;
  args: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
  executedAt: string;
  duration: number;
  artifactHash?: string;
}

export interface Artifact {
  name: string;
  path: string;
  size: number;
  type: string;
  createdAt: string;
}

export interface FlagCandidate {
  id: string;
  value: string;
  confidence: number;
  source: string;
  commandId?: string;
  context: string;
}

export interface JobDetail extends Job {
  commands: Command[];
  artifacts: Artifact[];
  flagCandidates: FlagCandidate[];
  writeup?: string;
  inputFiles?: string[];
}

export interface User {
  isAuthenticated: boolean;
  username?: string;
}

export interface Config {
  maxUploadSizeMb: number;
  allowedExtensions: string[];
  sandboxTimeout: number;
  allowedTools: string[];
}
