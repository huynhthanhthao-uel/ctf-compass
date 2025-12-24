import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, LayoutGrid, List, Search, Wifi, WifiOff, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AppLayout } from '@/components/layout/AppLayout';
import { JobCard } from '@/components/jobs/JobCard';
import { useJobs } from '@/hooks/use-jobs';
import { useAuth } from '@/hooks/use-auth';
import { useJobsWithWebSocket } from '@/hooks/use-websocket';
import { cn } from '@/lib/utils';
import { Job } from '@/lib/types';

export default function Dashboard() {
  const navigate = useNavigate();
  const { jobs, isLoading, fetchJobs, runJob, isBackendConnected } = useJobs();
  const { retryBackendConnection } = useAuth();
  const { isConnected: wsConnected, getJobUpdate } = useJobsWithWebSocket();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleRetryConnection = async () => {
    setIsRetrying(true);
    await retryBackendConnection();
    setIsRetrying(false);
  };

  // Merge WebSocket updates with job data
  const getEnhancedJobs = useCallback((): Job[] => {
    return jobs.map(job => {
      const wsUpdate = getJobUpdate(job.id);
      if (!wsUpdate) return job;
      
      // Apply WebSocket updates
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
      <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
              
              {/* Connection Status Badge */}
              {isBackendConnected ? (
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-xs gap-1.5 cursor-default",
                    wsConnected 
                      ? "border-emerald-600/30 text-emerald-600 bg-emerald-500/10" 
                      : "border-amber-600/30 text-amber-600 bg-amber-500/10"
                  )}
                >
                  {wsConnected ? (
                    <>
                      <Radio className="h-3 w-3 animate-pulse" />
                      Live
                    </>
                  ) : (
                    <>
                      <Wifi className="h-3 w-3" />
                      Connected
                    </>
                  )}
                </Badge>
              ) : (
                <Badge 
                  variant="outline" 
                  className="text-xs gap-1.5 border-amber-600/30 text-amber-600 bg-amber-500/10 cursor-pointer hover:bg-amber-500/20 transition-colors"
                  onClick={handleRetryConnection}
                >
                  {isRetrying ? (
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
            <p className="text-muted-foreground mt-1">
              {isBackendConnected 
                ? 'Manage and monitor your CTF challenge analyses'
                : 'Running in demo mode • Click badge to retry connection'
              }
            </p>
          </div>
          <Button onClick={() => navigate('/jobs/new')} size="lg">
            <Plus className="h-4 w-4 mr-2" />
            New Analysis
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="p-4 rounded-lg bg-card border border-border">
            <p className="text-sm text-muted-foreground">Total Jobs</p>
            <p className="text-2xl font-semibold text-foreground mt-1">{stats.total}</p>
          </div>
          <div className="p-4 rounded-lg bg-card border border-border">
            <p className="text-sm text-muted-foreground">Queued</p>
            <p className="text-2xl font-semibold text-foreground mt-1">{stats.queued}</p>
          </div>
          <div className="p-4 rounded-lg bg-info/10 border border-info/30">
            <p className="text-sm text-info">Running</p>
            <p className="text-2xl font-semibold text-info mt-1">{stats.running}</p>
          </div>
          <div className="p-4 rounded-lg bg-success/10 border border-success/30">
            <p className="text-sm text-success">Completed</p>
            <p className="text-2xl font-semibold text-success mt-1">{stats.done}</p>
          </div>
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30">
            <p className="text-sm text-destructive">Failed</p>
            <p className="text-2xl font-semibold text-destructive mt-1">{stats.failed}</p>
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
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={fetchJobs} 
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
            <div className="flex items-center border border-border rounded-lg p-0.5 bg-secondary/50">
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
          <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-lg">
            <div className="h-14 w-14 rounded-full bg-secondary flex items-center justify-center mb-4">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-1">
              {searchQuery ? 'No results found' : 'No analyses yet'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? 'Try a different search term' : 'Create your first CTF challenge analysis'}
            </p>
            {!searchQuery && (
              <Button onClick={() => navigate('/jobs/new')}>
                <Plus className="h-4 w-4 mr-2" />
                New Analysis
              </Button>
            )}
          </div>
        ) : (
          <div className={cn(
            viewMode === 'grid' 
              ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" 
              : "space-y-3"
          )}>
            {filteredJobs.map(job => (
              <JobCard key={job.id} job={job} onRun={runJob} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
