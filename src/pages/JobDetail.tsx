import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  PlayCircle, 
  Download, 
  Clock, 
  CheckCircle, 
  XCircle,
  Loader2,
  Terminal,
  Folder,
  Flag,
  FileText,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AppLayout } from '@/components/layout/AppLayout';
import { CommandLog } from '@/components/jobs/CommandLog';
import { ArtifactList } from '@/components/jobs/ArtifactList';
import { FlagCandidates } from '@/components/jobs/FlagCandidates';
import { WriteupView } from '@/components/jobs/WriteupView';
import { useJobDetail } from '@/hooks/use-jobs';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

const statusConfig = {
  queued: { icon: Clock, label: 'Queued', className: 'bg-muted text-muted-foreground' },
  running: { icon: Loader2, label: 'Running', className: 'bg-info/20 text-info' },
  done: { icon: CheckCircle, label: 'Completed', className: 'bg-success/20 text-success' },
  failed: { icon: XCircle, label: 'Failed', className: 'bg-destructive/20 text-destructive' },
};

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { jobDetail, isLoading, fetchJobDetail } = useJobDetail(id || '');

  useEffect(() => {
    if (id) {
      fetchJobDetail();
    }
  }, [id, fetchJobDetail]);

  if (isLoading || !jobDetail) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const status = statusConfig[jobDetail.status];
  const StatusIcon = status.icon;

  return (
    <AppLayout>
      <div className="p-6 space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{jobDetail.title}</h1>
                <Badge variant="secondary" className={cn(status.className)}>
                  <StatusIcon className={cn("h-3 w-3 mr-1", jobDetail.status === 'running' && "animate-spin")} />
                  {status.label}
                </Badge>
              </div>
              <p className="text-muted-foreground">{jobDetail.description}</p>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>Created {formatDistanceToNow(new Date(jobDetail.createdAt), { addSuffix: true })}</span>
                <span className="font-mono">ID: {jobDetail.id}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {jobDetail.status === 'queued' && (
              <Button>
                <PlayCircle className="h-4 w-4 mr-2" />
                Start Analysis
              </Button>
            )}
            {jobDetail.status === 'done' && (
              <>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Download Bundle
                </Button>
                <Button>
                  <FileText className="h-4 w-4 mr-2" />
                  Export Report
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Progress */}
        {(jobDetail.status === 'running' || jobDetail.status === 'failed') && jobDetail.progress !== undefined && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Analysis Progress</span>
                  <span className="font-medium">{Math.round(jobDetail.progress)}%</span>
                </div>
                <Progress value={jobDetail.progress} className="h-2" />
                {jobDetail.errorMessage && (
                  <p className="text-sm text-destructive mt-2">{jobDetail.errorMessage}</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                Commands
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{jobDetail.commands.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Folder className="h-4 w-4" />
                Artifacts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{jobDetail.artifacts.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Flag className="h-4 w-4" />
                Candidates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{jobDetail.flagCandidates.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Info className="h-4 w-4" />
                Flag Format
              </CardTitle>
            </CardHeader>
            <CardContent>
              <code className="text-sm font-mono">{jobDetail.flagFormat}</code>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="commands" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="commands" className="flex items-center gap-2">
              <Terminal className="h-4 w-4" />
              <span className="hidden sm:inline">Commands</span>
            </TabsTrigger>
            <TabsTrigger value="artifacts" className="flex items-center gap-2">
              <Folder className="h-4 w-4" />
              <span className="hidden sm:inline">Artifacts</span>
            </TabsTrigger>
            <TabsTrigger value="flags" className="flex items-center gap-2">
              <Flag className="h-4 w-4" />
              <span className="hidden sm:inline">Flags</span>
            </TabsTrigger>
            <TabsTrigger value="writeup" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Writeup</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="commands">
            <Card>
              <CardHeader>
                <CardTitle>Command Execution Log</CardTitle>
              </CardHeader>
              <CardContent>
                <CommandLog commands={jobDetail.commands} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="artifacts">
            <Card>
              <CardHeader>
                <CardTitle>Extracted Artifacts</CardTitle>
              </CardHeader>
              <CardContent>
                <ArtifactList artifacts={jobDetail.artifacts} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="flags">
            <Card>
              <CardHeader>
                <CardTitle>Flag Candidates</CardTitle>
              </CardHeader>
              <CardContent>
                <FlagCandidates candidates={jobDetail.flagCandidates} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="writeup">
            <Card>
              <CardHeader>
                <CardTitle>Generated Writeup</CardTitle>
              </CardHeader>
              <CardContent>
                <WriteupView writeup={jobDetail.writeup} jobId={jobDetail.id} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
