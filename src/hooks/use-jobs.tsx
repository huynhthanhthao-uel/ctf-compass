import { useState, useCallback } from 'react';
import { Job, JobDetail } from '@/lib/types';
import { mockJobs, mockJobDetail } from '@/lib/mock-data';

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>(mockJobs);
  const [isLoading, setIsLoading] = useState(false);

  const fetchJobs = useCallback(async () => {
    setIsLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    setJobs(mockJobs);
    setIsLoading(false);
  }, []);

  const createJob = useCallback(async (
    title: string,
    description: string,
    flagFormat: string,
    _files: File[]
  ): Promise<Job> => {
    setIsLoading(true);
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
  }, []);

  const runJob = useCallback(async (jobId: string) => {
    setJobs(prev => prev.map(job => 
      job.id === jobId 
        ? { ...job, status: 'running' as const, startedAt: new Date().toISOString(), progress: 0 }
        : job
    ));

    // Simulate progress updates
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
  }, []);

  return {
    jobs,
    isLoading,
    fetchJobs,
    createJob,
    runJob,
  };
}

export function useJobDetail(jobId: string) {
  const [jobDetail, setJobDetail] = useState<JobDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchJobDetail = useCallback(async () => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Mock: Return mock detail if job-001, otherwise create from mock
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
    setIsLoading(false);
  }, [jobId]);

  return {
    jobDetail,
    isLoading,
    fetchJobDetail,
  };
}
