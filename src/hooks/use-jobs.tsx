import { useState, useCallback, useEffect, useRef } from 'react';
import { Job, JobDetail } from '@/lib/types';
import { mockJobs, mockJobDetail, mockCommands, mockArtifacts, mockFlagCandidates } from '@/lib/mock-data';
import * as api from '@/lib/api';
import { useNotifications } from './use-notifications';

// Check if we're connected to a real backend
async function isBackendAvailable(): Promise<boolean> {
  try {
    const response = await fetch('/api/health', { method: 'GET' });
    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    if (!response.ok) return false;

    // Vite/dev preview often serves index.html for unknown routes (looks "OK" but it's not an API)
    const isHtml = text.trimStart().startsWith('<!') || text.trimStart().startsWith('<html');
    if (isHtml) return false;

    // Expect JSON from a real backend health endpoint
    if (!contentType.includes('application/json')) {
      try {
        JSON.parse(text);
      } catch {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

// Simulate running a mock analysis with progress updates
function runMockAnalysis(
  jobId: string,
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>,
  mockIntervalsRef: React.MutableRefObject<Map<string, number>>,
  onComplete?: (job: Job) => void,
  onStart?: (job: Job) => void,
): void {
  // Ensure only one runner per job
  const existing = mockIntervalsRef.current.get(jobId);
  if (existing !== undefined) {
    window.clearInterval(existing);
    mockIntervalsRef.current.delete(jobId);
  }

  // Start running
  setJobs(prev => {
    const updated = prev.map(job =>
      job.id === jobId
        ? { ...job, status: 'running' as const, startedAt: new Date().toISOString(), progress: 0, errorMessage: undefined }
        : job,
    );
    // Notify about start
    const startedJob = updated.find(j => j.id === jobId);
    if (startedJob && onStart) {
      onStart(startedJob);
    }
    return updated;
  });

  let progress = 0;
  const intervalId = window.setInterval(() => {
    progress += 15 + Math.random() * 10;

    if (progress >= 100) {
      progress = 100;
      window.clearInterval(intervalId);
      mockIntervalsRef.current.delete(jobId);

      setJobs(prev => {
        const updated = prev.map(job =>
          job.id === jobId
            ? { ...job, status: 'done' as const, completedAt: new Date().toISOString(), progress: 100 }
            : job,
        );
        // Notify about completion
        const completedJob = updated.find(j => j.id === jobId);
        if (completedJob && onComplete) {
          onComplete(completedJob);
        }
        return updated;
      });

      // Also update mockJobs array
      const idx = mockJobs.findIndex(j => j.id === jobId);
      if (idx !== -1) {
        mockJobs[idx] = { ...mockJobs[idx], status: 'done', completedAt: new Date().toISOString(), progress: 100 };
      }

      return;
    }

    setJobs(prev => prev.map(job => (job.id === jobId ? { ...job, progress: Math.floor(progress) } : job)));
  }, 600);

  mockIntervalsRef.current.set(jobId, intervalId);
}

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [useApi, setUseApi] = useState<boolean | null>(null);

  const mockIntervalsRef = useRef<Map<string, number>>(new Map());
  const mockStartTimeoutRef = useRef<Map<string, number>>(new Map());

  // Get notification functions - will be null if not wrapped in provider
  let addNotification: ((notification: { type: 'success' | 'error' | 'info' | 'warning'; title: string; message: string }) => void) | null = null;
  try {
    const notifications = useNotifications();
    addNotification = notifications.addNotification;
  } catch {
    // Not wrapped in NotificationProvider
  }

  // Callbacks for mock job notifications
  const handleMockJobComplete = useCallback((job: Job) => {
    if (addNotification) {
      addNotification({
        type: 'success',
        title: 'Analysis Complete',
        message: `${job.title} finished successfully`,
      });
    }
  }, [addNotification]);

  const handleMockJobStart = useCallback((job: Job) => {
    if (addNotification) {
      addNotification({
        type: 'info',
        title: 'Analysis Started',
        message: `${job.title} is now running`,
      });
    }
  }, [addNotification]);

  // Check backend availability on mount
  useEffect(() => {
    isBackendAvailable().then(available => {
      setUseApi(available);
      if (!available) {
        setJobs(mockJobs);
      }
    });
  }, []);

  const fetchJobs = useCallback(async () => {
    setIsLoading(true);
    
    if (useApi) {
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
        // If the backend isn't actually available, switch to mock mode
        setUseApi(false);
        setJobs(mockJobs);
      }
    } else {
      await new Promise(resolve => setTimeout(resolve, 500));
      setJobs(mockJobs);
    }
    
    setIsLoading(false);
  }, [useApi]);

  const createJob = useCallback(async (
    title: string,
    description: string,
    flagFormat: string,
    files: File[],
    category?: string,
    challengeUrl?: string
  ): Promise<Job> => {
    setIsLoading(true);
    
    if (useApi) {
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
        setIsLoading(false);
        return newJob;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const backendDown =
          /Backend API not available/i.test(message) ||
          /Failed to fetch/i.test(message) ||
          /HTTP 404/i.test(message);

        if (!backendDown) {
          setIsLoading(false);
          throw error;
        }

        // Backend isn't reachable in this environment; switch to mock mode and continue below
        setUseApi(false);
      }
    }
    
    // Fallback to mock
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const newJob: Job = {
      id: `job-${Date.now()}`,
      title,
      description,
      flagFormat,
      category,
      challengeUrl,
      status: 'queued',
      createdAt: new Date().toISOString(),
      progress: 0,
    };
    
    mockJobs.unshift(newJob);
    setJobs(prev => [newJob, ...prev]);
    setIsLoading(false);

    // Auto-run analysis in mock mode after creation
    const timeoutId = window.setTimeout(() => {
      mockStartTimeoutRef.current.delete(newJob.id);
      runMockAnalysis(newJob.id, setJobs, mockIntervalsRef, handleMockJobComplete, handleMockJobStart);
    }, 500);
    mockStartTimeoutRef.current.set(newJob.id, timeoutId);

    return newJob;
  }, [useApi, handleMockJobComplete, handleMockJobStart]);

  const runJob = useCallback(async (jobId: string) => {
    if (useApi) {
      try {
        await api.runJob(jobId);
        setJobs(prev => prev.map(job => 
          job.id === jobId 
            ? { ...job, status: 'running' as const, startedAt: new Date().toISOString(), progress: 0 }
            : job
        ));
        
        // Poll for status updates
        const pollInterval = setInterval(async () => {
          try {
            const detail = await api.getJob(jobId);
            const status = detail.status === 'completed' ? 'done' : detail.status === 'pending' ? 'queued' : detail.status;
            
            setJobs(prev => prev.map(job =>
              job.id === jobId
                ? { 
                    ...job, 
                    status: status as Job['status'],
                    progress: detail.status === 'completed' ? 100 : detail.status === 'running' ? 50 : 0,
                    completedAt: detail.completed_at,
                  }
                : job
            ));
            
            if (detail.status === 'completed' || detail.status === 'failed') {
              clearInterval(pollInterval);
            }
          } catch {
            clearInterval(pollInterval);
          }
        }, 2000);
        
        return;
      } catch (error) {
        console.error('Failed to run job:', error);
      }
    }

    // Fallback to mock simulation
    const pendingStart = mockStartTimeoutRef.current.get(jobId);
    if (pendingStart !== undefined) {
      window.clearTimeout(pendingStart);
      mockStartTimeoutRef.current.delete(jobId);
    }

    runMockAnalysis(jobId, setJobs, mockIntervalsRef, handleMockJobComplete, handleMockJobStart);
  }, [useApi, handleMockJobComplete, handleMockJobStart]);

  const stopJob = useCallback((jobId: string) => {
    const pendingStart = mockStartTimeoutRef.current.get(jobId);
    if (pendingStart !== undefined) {
      window.clearTimeout(pendingStart);
      mockStartTimeoutRef.current.delete(jobId);
    }

    const intervalId = mockIntervalsRef.current.get(jobId);
    if (intervalId !== undefined) {
      window.clearInterval(intervalId);
      mockIntervalsRef.current.delete(jobId);
    }

    setJobs(prev =>
      prev.map(job =>
        job.id === jobId
          ? { ...job, status: 'failed' as const, errorMessage: 'Analysis cancelled by user', progress: job.progress }
          : job,
      ),
    );

    // Update mock data too
    const idx = mockJobs.findIndex(j => j.id === jobId);
    if (idx !== -1) {
      mockJobs[idx] = { ...mockJobs[idx], status: 'failed', errorMessage: 'Analysis cancelled by user' };
    }
  }, []);

  const deleteJob = useCallback((jobId: string) => {
    const pendingStart = mockStartTimeoutRef.current.get(jobId);
    if (pendingStart !== undefined) {
      window.clearTimeout(pendingStart);
      mockStartTimeoutRef.current.delete(jobId);
    }

    const intervalId = mockIntervalsRef.current.get(jobId);
    if (intervalId !== undefined) {
      window.clearInterval(intervalId);
      mockIntervalsRef.current.delete(jobId);
    }

    setJobs(prev => prev.filter(job => job.id !== jobId));

    // Remove from mock data too
    const idx = mockJobs.findIndex(j => j.id === jobId);
    if (idx !== -1) {
      mockJobs.splice(idx, 1);
    }
  }, []);

  return {
    jobs,
    isLoading,
    fetchJobs,
    createJob,
    runJob,
    stopJob,
    deleteJob,
    isBackendConnected: useApi,
  };
}

export function useJobDetail(jobId: string) {
  const [jobDetail, setJobDetail] = useState<JobDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [useApi, setUseApi] = useState<boolean | null>(null);

  useEffect(() => {
    isBackendAvailable().then(setUseApi);
  }, []);

  const fetchJobDetail = useCallback(async () => {
    setIsLoading(true);
    
    if (useApi) {
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
      } catch (error) {
        console.error('Failed to fetch job detail:', error);
        // Fallback to mock
        if (jobId === 'job-001') {
          setJobDetail(mockJobDetail);
        }
      }
    } else {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (jobId === 'job-001') {
        setJobDetail(mockJobDetail);
      } else {
        const job = mockJobs.find(j => j.id === jobId);
        if (job) {
          setJobDetail({
            ...job,
            commands: [],
            artifacts: [],
            flagCandidates: [],
          });
        }
      }
    }
    
    setIsLoading(false);
  }, [jobId, useApi]);

  return {
    jobDetail,
    isLoading,
    fetchJobDetail,
  };
}
