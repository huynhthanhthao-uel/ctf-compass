import { useState, useCallback, useEffect, useRef } from 'react';
import { Job, JobDetail } from '@/lib/types';
import * as api from '@/lib/api';
import { useNotifications } from './use-notifications';
import { getBackendUrlFromStorage } from '@/lib/backend-url';

// Check if Docker backend is reachable
async function isBackendAvailable(): Promise<boolean> {
  const backendUrl = getBackendUrlFromStorage();
  if (!backendUrl) return false;

  try {
    const response = await fetch(`${backendUrl}/api/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return false;

    const data = await response.json();
    return data?.status === 'healthy';
  } catch {
    return false;
  }
}

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);
  const pollingRef = useRef<Map<string, number>>(new Map());

  // Get notification functions - will be null if not wrapped in provider
  let addNotification: ((notification: { type: 'success' | 'error' | 'info' | 'warning'; title: string; message: string }) => void) | null = null;
  try {
    const notifications = useNotifications();
    addNotification = notifications.addNotification;
  } catch {
    // Not wrapped in NotificationProvider
  }

  // Check backend availability on mount
  useEffect(() => {
    isBackendAvailable().then(available => {
      setIsBackendConnected(available);
      if (!available) {
        setBackendError('Docker backend not available. Configure it in Settings → Docker Backend URL.');
      }
    });
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      pollingRef.current.forEach(id => clearInterval(id));
      pollingRef.current.clear();
    };
  }, []);

  const fetchJobs = useCallback(async () => {
    if (!isBackendConnected) {
      setJobs([]);
      return;
    }

    setIsLoading(true);
    setBackendError(null);

    try {
      const response = await api.listJobs();
      const mappedJobs: Job[] = response.jobs.map(j => ({
        id: j.id,
        title: j.title,
        description: '',
        flagFormat: '',
        status: j.status === 'completed' ? 'done' : j.status === 'pending' ? 'queued' : j.status,
        createdAt: j.created_at,
        completedAt: j.completed_at,
        progress: j.status === 'completed' ? 100 : j.status === 'running' ? 50 : 0,
      }));
      setJobs(mappedJobs);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      setBackendError(`Failed to fetch jobs: ${message}`);
      setIsBackendConnected(false);
      setJobs([]);
    } finally {
      setIsLoading(false);
    }
  }, [isBackendConnected]);

  const createJob = useCallback(async (
    title: string,
    description: string,
    flagFormat: string,
    files: File[],
    category?: string,
    challengeUrl?: string
  ): Promise<Job> => {
    if (!isBackendConnected) {
      throw new Error('Backend not connected. Please configure Docker Backend URL in Settings.');
    }

    setIsLoading(true);
    setBackendError(null);

    try {
      const response = await api.createJob(title, description, flagFormat, files, category, challengeUrl);
      const newJob: Job = {
        id: response.id,
        title: response.title,
        description,
        flagFormat,
        category,
        challengeUrl,
        status: 'queued',
        createdAt: response.created_at,
        progress: 0,
      };
      setJobs(prev => [newJob, ...prev]);
      return newJob;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setBackendError(message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [isBackendConnected]);

  const runJob = useCallback(async (jobId: string) => {
    if (!isBackendConnected) {
      console.error('Cannot run job: backend not connected');
      return;
    }

    const job = jobs.find(j => j.id === jobId);
    if (!job) {
      console.error('Job not found:', jobId);
      return;
    }

    if (job.status !== 'queued') {
      console.log('Job is not in queued status, cannot run:', job.status);
      return;
    }

    try {
      await api.runJob(jobId);
      setJobs(prev => prev.map(j =>
        j.id === jobId
          ? { ...j, status: 'running' as const, startedAt: new Date().toISOString(), progress: 0 }
          : j
      ));

      if (addNotification) {
        addNotification({
          type: 'info',
          title: 'Analysis Started',
          message: `${job.title} is now running`,
        });
      }

      // Poll for status updates
      const pollId = window.setInterval(async () => {
        try {
          const detail = await api.getJob(jobId);
          const status = detail.status === 'completed' ? 'done' : detail.status === 'pending' ? 'queued' : detail.status;

          setJobs(prev => prev.map(j =>
            j.id === jobId
              ? {
                  ...j,
                  status: status as Job['status'],
                  progress: detail.status === 'completed' ? 100 : detail.status === 'running' ? 50 : 0,
                  completedAt: detail.completed_at,
                }
              : j
          ));

          if (detail.status === 'completed' || detail.status === 'failed') {
            clearInterval(pollId);
            pollingRef.current.delete(jobId);

            if (addNotification) {
              addNotification({
                type: detail.status === 'completed' ? 'success' : 'error',
                title: detail.status === 'completed' ? 'Analysis Complete' : 'Analysis Failed',
                message: job.title,
              });
            }
          }
        } catch {
          clearInterval(pollId);
          pollingRef.current.delete(jobId);
        }
      }, 2000);

      pollingRef.current.set(jobId, pollId);
    } catch (error) {
      console.error('Failed to run job:', error);
      setBackendError(error instanceof Error ? error.message : 'Failed to run job');
    }
  }, [isBackendConnected, jobs, addNotification]);

  const stopJob = useCallback(async (jobId: string) => {
    // Clear polling if exists
    const pollId = pollingRef.current.get(jobId);
    if (pollId) {
      clearInterval(pollId);
      pollingRef.current.delete(jobId);
    }

    // Update local state
    setJobs(prev =>
      prev.map(job =>
        job.id === jobId
          ? { ...job, status: 'failed' as const, errorMessage: 'Analysis cancelled by user' }
          : job
      )
    );

    // TODO: Call backend API to cancel job when implemented
    // try {
    //   await api.cancelJob(jobId);
    // } catch (error) {
    //   console.error('Failed to cancel job:', error);
    // }
  }, []);

  const deleteJob = useCallback(async (jobId: string) => {
    // Clear polling if exists
    const pollId = pollingRef.current.get(jobId);
    if (pollId) {
      clearInterval(pollId);
      pollingRef.current.delete(jobId);
    }

    // Update local state
    setJobs(prev => prev.filter(job => job.id !== jobId));

    // TODO: Call backend API to delete job when implemented
    // try {
    //   await api.deleteJob(jobId);
    // } catch (error) {
    //   console.error('Failed to delete job:', error);
    // }
  }, []);

  const updateJobStatus = useCallback((jobId: string, status: Job['status'], progress?: number) => {
    setJobs(prev =>
      prev.map(job =>
        job.id === jobId
          ? {
              ...job,
              status,
              progress: progress ?? (status === 'done' ? 100 : job.progress),
              completedAt: status === 'done' ? new Date().toISOString() : job.completedAt
            }
          : job
      )
    );
  }, []);

  const retryBackendConnection = useCallback(async () => {
    setBackendError(null);
    const available = await isBackendAvailable();
    setIsBackendConnected(available);
    if (!available) {
      setBackendError('Docker backend not available. Configure it in Settings → Docker Backend URL.');
    }
    return available;
  }, []);

  return {
    jobs,
    isLoading,
    fetchJobs,
    createJob,
    runJob,
    stopJob,
    deleteJob,
    updateJobStatus,
    isBackendConnected,
    backendError,
    retryBackendConnection,
  };
}

export function useJobDetail(jobId: string) {
  const [jobDetail, setJobDetail] = useState<JobDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    isBackendAvailable().then(setIsBackendConnected);
  }, []);

  const fetchJobDetail = useCallback(async () => {
    if (!isBackendConnected) {
      setIsLoading(false);
      setError('Backend not connected');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const detail = await api.getJob(jobId);
      const commands = await api.getJobCommands(jobId);
      const artifacts = await api.getJobArtifacts(jobId);

      setJobDetail({
        id: detail.id,
        title: detail.title,
        description: detail.description,
        flagFormat: detail.flag_format,
        status: detail.status === 'completed' ? 'done' : detail.status === 'pending' ? 'queued' : detail.status,
        createdAt: detail.created_at,
        startedAt: detail.started_at,
        completedAt: detail.completed_at,
        progress: detail.status === 'completed' ? 100 : detail.status === 'running' ? 50 : 0,
        commands: commands.commands.map(c => ({
          id: c.id,
          jobId: jobId,
          tool: c.tool,
          args: c.arguments,
          exitCode: c.exit_code ?? 0,
          stdout: c.stdout,
          stderr: c.stderr,
          executedAt: c.started_at,
          duration: c.completed_at ? new Date(c.completed_at).getTime() - new Date(c.started_at).getTime() : 0,
        })),
        artifacts: artifacts.artifacts.map(a => ({
          name: a.path.split('/').pop() || a.path,
          path: a.path,
          size: a.size,
          type: a.type,
          createdAt: new Date().toISOString(),
        })),
        flagCandidates: detail.flag_candidates.map((f, i) => ({
          id: `flag-${i}`,
          value: f.value,
          confidence: f.confidence,
          source: f.source,
          context: '',
        })),
      });
    } catch (err) {
      console.error('Failed to fetch job detail:', err);
      setError(err instanceof Error ? err.message : 'Failed to load job details');
      setJobDetail(null);
    } finally {
      setIsLoading(false);
    }
  }, [jobId, isBackendConnected]);

  return {
    jobDetail,
    isLoading,
    fetchJobDetail,
    isBackendConnected,
    error,
  };
}
