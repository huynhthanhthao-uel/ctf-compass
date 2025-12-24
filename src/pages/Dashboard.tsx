import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppLayout } from '@/components/layout/AppLayout';
import { JobCard } from '@/components/jobs/JobCard';
import { useJobs } from '@/hooks/use-jobs';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const navigate = useNavigate();
  const { jobs, isLoading, fetchJobs, runJob } = useJobs();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const stats = {
    total: jobs.length,
    queued: jobs.filter(j => j.status === 'queued').length,
    running: jobs.filter(j => j.status === 'running').length,
    done: jobs.filter(j => j.status === 'done').length,
    failed: jobs.filter(j => j.status === 'failed').length,
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Analysis Dashboard</h1>
            <p className="text-muted-foreground">
              Manage and monitor your CTF challenge analyses
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={fetchJobs} disabled={isLoading}>
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
            <div className="flex items-center border rounded-lg p-0.5">
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
            <Button onClick={() => navigate('/jobs/new')}>
              <Plus className="h-4 w-4 mr-2" />
              New Analysis
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="p-4 rounded-lg bg-card border">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50 border">
            <p className="text-sm text-muted-foreground">Queued</p>
            <p className="text-2xl font-bold">{stats.queued}</p>
          </div>
          <div className="p-4 rounded-lg bg-info/10 border border-info/30">
            <p className="text-sm text-info">Running</p>
            <p className="text-2xl font-bold text-info">{stats.running}</p>
          </div>
          <div className="p-4 rounded-lg bg-success/10 border border-success/30">
            <p className="text-sm text-success">Completed</p>
            <p className="text-2xl font-bold text-success">{stats.done}</p>
          </div>
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30">
            <p className="text-sm text-destructive">Failed</p>
            <p className="text-2xl font-bold text-destructive">{stats.failed}</p>
          </div>
        </div>

        {/* Jobs Grid/List */}
        {jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Plus className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No analyses yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first CTF challenge analysis
            </p>
            <Button onClick={() => navigate('/jobs/new')}>
              <Plus className="h-4 w-4 mr-2" />
              New Analysis
            </Button>
          </div>
        ) : (
          <div className={cn(
            viewMode === 'grid' 
              ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" 
              : "space-y-3"
          )}>
            {jobs.map(job => (
              <JobCard key={job.id} job={job} onRun={runJob} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
