import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, RefreshCw, LayoutGrid, List, Search, Wifi, WifiOff, Radio, TrendingUp, Clock, CheckCircle, XCircle, Server, Cloud, AlertTriangle, Settings, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AppLayout } from '@/components/layout/AppLayout';
import { JobCard } from '@/components/jobs/JobCard';
import { BackendHealthIndicator } from '@/components/BackendHealthIndicator';
import { useJobs } from '@/hooks/use-jobs';
import { useJobsWithWebSocket } from '@/hooks/use-websocket';
import { useToast } from '@/hooks/use-toast';
import { useBackendStatus } from '@/hooks/use-backend-status';
import { getBackendUrlFromStorage, normalizeBackendUrl } from '@/lib/backend-url';
import { cn } from '@/lib/utils';
import { Job } from '@/lib/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Dashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { jobs, isLoading, fetchJobs, runJob, stopJob, deleteJob } = useJobs();
  const { mode, isConnected: backendConnected, retry: retryBackendConnection, isLoading: backendLoading } = useBackendStatus();
  const { isConnected: wsConnected, getJobUpdate, clearJobUpdate } = useJobsWithWebSocket(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<string | null>(null);
  const [backendUrl, setBackendUrl] = useState<string | null>(null);
  const [hasInvalidStoredBackendUrl, setHasInvalidStoredBackendUrl] = useState(false);

  const refreshBackendUrlState = useCallback(() => {
    const raw = localStorage.getItem('ctf_backend_url');
    setHasInvalidStoredBackendUrl(Boolean(raw && !normalizeBackendUrl(raw)));
    setBackendUrl(getBackendUrlFromStorage());
  }, []);

  useEffect(() => {
    refreshBackendUrlState();
  }, [refreshBackendUrlState]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleRetryConnection = async () => {
    await retryBackendConnection();
  };

  const handleStopJob = useCallback((jobId: string) => {
    // Prevent stale WS status/progress from overriding local stop
    clearJobUpdate(jobId);
    stopJob(jobId);
    toast({
      title: 'Analysis Stopped',
      description: 'The analysis has been cancelled.',
    });
  }, [stopJob, clearJobUpdate, toast]);

  const handleDeleteJob = useCallback((jobId: string) => {
    setJobToDelete(jobId);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (jobToDelete) {
      // Prevent stale WS updates from keeping deleted job around visually
      clearJobUpdate(jobToDelete);
      deleteJob(jobToDelete);
      toast({
        title: 'Job Deleted',
        description: 'The job has been removed.',
        variant: 'destructive',
      });
      setJobToDelete(null);
      setDeleteDialogOpen(false);
    }
  }, [jobToDelete, deleteJob, clearJobUpdate, toast]);

  // Merge WebSocket updates with job data
  const getEnhancedJobs = useCallback((): Job[] => {
    return jobs.map(job => {
      const wsUpdate = getJobUpdate(job.id);
      if (!wsUpdate) return job;
      
      return {
        ...job,
        status: wsUpdate.status === 'completed' ? 'done' : 
                wsUpdate.status === 'pending' ? 'queued' : 
                (wsUpdate.status as Job['status']) || job.status,
        progress: wsUpdate.progress ?? job.progress,
        errorMessage: wsUpdate.error_message || job.errorMessage,
      };
    });
  }, [jobs, getJobUpdate]);

  const enhancedJobs = getEnhancedJobs();

  const filteredJobs = enhancedJobs.filter(job => 
    job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: enhancedJobs.length,
    queued: enhancedJobs.filter(j => j.status === 'queued').length,
    running: enhancedJobs.filter(j => j.status === 'running').length,
    done: enhancedJobs.filter(j => j.status === 'done').length,
    failed: enhancedJobs.filter(j => j.status === 'failed').length,
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
              
              {/* Connection Status Badge */}
              {backendConnected ? (
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-xs gap-1.5 cursor-default font-medium",
                    mode === 'backend'
                      ? "border-green-500/40 text-green-600 dark:text-green-400 bg-green-500/10"
                      : "border-primary/40 text-primary bg-primary/10"
                  )}
                >
                  {mode === 'backend' ? (
                    <>
                      <Server className="h-3 w-3" />
                      Backend
                    </>
                  ) : (
                    <>
                      <Cloud className="h-3 w-3" />
                      Cloud
                    </>
                  )}
                  {wsConnected && (
                    <Radio className="h-3 w-3 animate-pulse ml-1" />
                  )}
                </Badge>
              ) : (
                <Badge 
                  variant="outline" 
                  className="text-xs gap-1.5 border-warning/40 text-warning bg-warning/10 cursor-pointer hover:bg-warning/20 transition-colors font-medium"
                  onClick={handleRetryConnection}
                >
                  {backendLoading ? (
                    <>
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-3 w-3" />
                      Demo Mode
                    </>
                  )}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1.5 text-sm">
              {backendConnected 
                ? mode === 'backend' 
                  ? 'Connected to Docker backend • Real-time analysis available'
                  : 'Connected to Lovable Cloud • AI-powered analysis available'
                : 'Running in demo mode • Click badge to retry connection'
              }
            </p>
          </div>
          <Button onClick={() => navigate('/jobs/new')} size="lg" className="shadow-sm">
            <Plus className="h-4 w-4 mr-2" />
            New Analysis
          </Button>
        </div>

        {/* Backend URL Banner */}
        {(!backendUrl || hasInvalidStoredBackendUrl) && (
          <Alert className="border-warning/50 bg-warning/10">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertTitle className="text-warning">
              {!backendUrl ? 'Backend URL Not Configured' : 'Backend URL Invalid'}
            </AlertTitle>
            <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-3">
              <span className="text-sm">
                {!backendUrl
                  ? 'Set your Docker Backend URL to enable real sandbox execution.'
                  : 'Stored backend URL is invalid. Reset it and set a proper URL in Settings.'}
              </span>
              <div className="flex gap-2">
                {hasInvalidStoredBackendUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      localStorage.removeItem('ctf_backend_url');
                      refreshBackendUrlState();
                      await retryBackendConnection();
                      toast({
                        title: 'Backend URL Reset',
                        description: 'Cleared saved backend URL. Please set it again in Settings.',
                      });
                    }}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reset Backend URL
                  </Button>
                )}
                <Button variant="outline" size="sm" asChild>
                  <Link to="/configuration#docker-backend-url">
                    <Settings className="h-4 w-4 mr-2" />
                    Docker Backend URL
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/health">
                    <Stethoscope className="h-4 w-4 mr-2" />
                    Debug Health
                  </Link>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Backend Health Indicator */}
        <BackendHealthIndicator onReset={refreshBackendUrlState} />

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="stats-card">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Total Jobs</p>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-3xl font-bold text-foreground mt-2">{stats.total}</p>
          </div>
          <div className="stats-card">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Queued</p>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-3xl font-bold text-foreground mt-2">{stats.queued}</p>
          </div>
          <div className="stats-card group border-info/30 hover:border-info/50">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-info">Running</p>
              <div className="h-2 w-2 rounded-full bg-info animate-pulse" />
            </div>
            <p className="text-3xl font-bold text-info mt-2">{stats.running}</p>
          </div>
          <div className="stats-card border-success/30 hover:border-success/50">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-success">Completed</p>
              <CheckCircle className="h-4 w-4 text-success" />
            </div>
            <p className="text-3xl font-bold text-success mt-2">{stats.done}</p>
          </div>
          <div className="stats-card border-destructive/30 hover:border-destructive/50">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-destructive">Failed</p>
              <XCircle className="h-4 w-4 text-destructive" />
            </div>
            <p className="text-3xl font-bold text-destructive mt-2">{stats.failed}</p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search analyses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="icon" 
              className="h-10 w-10"
              onClick={fetchJobs} 
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
            <div className="flex items-center border border-border rounded-lg p-1 bg-muted/50">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Jobs Grid/List */}
        {filteredJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-border rounded-xl bg-muted/20">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
              <Plus className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {searchQuery ? 'No results found' : 'No analyses yet'}
            </h3>
            <p className="text-muted-foreground mb-5 max-w-sm">
              {searchQuery ? 'Try a different search term' : 'Create your first CTF challenge analysis to get started'}
            </p>
            {!searchQuery && (
              <Button onClick={() => navigate('/jobs/new')} size="lg">
                <Plus className="h-4 w-4 mr-2" />
                Create Analysis
              </Button>
            )}
          </div>
        ) : (
          <div className={cn(
            viewMode === 'grid' 
              ? "grid gap-5 sm:grid-cols-2 xl:grid-cols-3" 
              : "space-y-4"
          )}>
            {filteredJobs.map(job => (
              <JobCard 
                key={job.id} 
                job={job} 
                onRun={runJob}
                onStop={handleStopJob}
                onDelete={handleDeleteJob}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-popover">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the job and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
