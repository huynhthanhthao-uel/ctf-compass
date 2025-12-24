import { useState, useCallback, useEffect } from 'react';
import { Job, JobDetail } from '@/lib/types';
import { mockJobs, mockJobDetail } from '@/lib/mock-data';
import * as api from '@/lib/api';

// Check if we're connected to a real backend
async function isBackendAvailable(): Promise<boolean> {
  try {
    const response = await fetch('/api/health', { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
}

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [useApi, setUseApi] = useState<boolean | null>(null);

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
    files: File[]
  ): Promise<Job> => {
    setIsLoading(true);
    
    if (useApi) {
      try {
        const response = await api.createJob(title, description, flagFormat, files);
        const newJob: Job = {
          id: response.id,
          title: response.title,
          description,
          flagFormat,
          status: 'queued',
          createdAt: response.created_at,
          progress: 0,
        };
        setJobs(prev => [newJob, ...prev]);
        setIsLoading(false);
        return newJob;
      } catch (error) {
        setIsLoading(false);
        throw error;
      }
    }
    
    // Fallback to mock
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const newJob: Job = {
      id: `job-${Date.now()}`,
      title,
      description,
      flagFormat,
      status: 'queued',
      createdAt: new Date().toISOString(),
      progress: 0,
    };
    
    setJobs(prev => [newJob, ...prev]);
    setIsLoading(false);
    return newJob;
  }, [useApi]);

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
    setJobs(prev => prev.map(job => 
      job.id === jobId 
        ? { ...job, status: 'running' as const, startedAt: new Date().toISOString(), progress: 0 }
        : job
    ));

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 20;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setJobs(prev => prev.map(job =>
          job.id === jobId
            ? { ...job, status: 'done' as const, completedAt: new Date().toISOString(), progress: 100 }
            : job
        ));
      } else {
        setJobs(prev => prev.map(job =>
          job.id === jobId ? { ...job, progress } : job
        ));
      }
    }, 500);
  }, [useApi]);

  return {
    jobs,
    isLoading,
    fetchJobs,
    createJob,
    runJob,
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
