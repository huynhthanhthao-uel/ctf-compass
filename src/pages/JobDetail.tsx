import { useEffect, useState, useCallback } from 'react';
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
  Copy,
  Wifi,
  WifiOff,
  TerminalSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AppLayout } from '@/components/layout/AppLayout';
import { CommandLog } from '@/components/jobs/CommandLog';
import { ArtifactList } from '@/components/jobs/ArtifactList';
import { FlagValidator } from '@/components/jobs/FlagValidator';
import { WriteupView } from '@/components/jobs/WriteupView';
import { SandboxTerminal } from '@/components/jobs/SandboxTerminal';
import { useJobDetail } from '@/hooks/use-jobs';
import { useJobWebSocket, JobUpdate } from '@/hooks/use-websocket';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

const statusConfig = {
  queued: { icon: Clock, label: 'Queued', className: 'bg-secondary text-secondary-foreground' },
  running: { icon: Loader2, label: 'Running', className: 'bg-info/15 text-info' },
  done: { icon: CheckCircle, label: 'Completed', className: 'bg-success/15 text-success' },
  failed: { icon: XCircle, label: 'Failed', className: 'bg-destructive/15 text-destructive' },
};

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { jobDetail, isLoading, fetchJobDetail } = useJobDetail(id || '');
  
  // Real-time updates
  const [realtimeProgress, setRealtimeProgress] = useState<number | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<string | null>(null);
  const [realtimeLogs, setRealtimeLogs] = useState<string[]>([]);
  
  const handleJobUpdate = useCallback((update: JobUpdate) => {
    if (update.type === 'job_update' && update.job_id === id) {
      if (update.data.progress !== undefined) {
        setRealtimeProgress(update.data.progress);
      }
      if (update.data.status) {
        const mappedStatus = update.data.status === 'completed' ? 'done' : 
                            update.data.status === 'pending' ? 'queued' : update.data.status;
        setRealtimeStatus(mappedStatus);
        
        // Refresh job detail when completed
        if (update.data.completed) {
          fetchJobDetail();
        }
      }
    } else if (update.type === 'job_log' && update.job_id === id) {
      setRealtimeLogs(prev => [...prev, `[${update.data.level}] ${update.data.message}`]);
    }
  }, [id, fetchJobDetail]);
  
  const { isConnected: wsConnected } = useJobWebSocket({
    jobId: id,
    onJobUpdate: handleJobUpdate,
  });

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

  // Use realtime status/progress if available
  const currentStatus = (realtimeStatus as keyof typeof statusConfig) || jobDetail.status;
  const currentProgress = realtimeProgress ?? jobDetail.progress;
  
  const status = statusConfig[currentStatus];
  const StatusIcon = status.icon;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/dashboard')}
              className="shrink-0 mt-0.5"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-semibold text-foreground">{jobDetail.title}</h1>
                <Badge className={cn("text-xs", status.className)}>
                  <StatusIcon className={cn("h-3 w-3 mr-1", currentStatus === 'running' && "animate-spin")} />
                  {status.label}
                </Badge>
                <Badge variant="outline" className={cn(
                  "text-xs",
                  wsConnected 
                    ? "border-success/50 text-success" 
                    : "border-muted text-muted-foreground"
                )}>
                  {wsConnected ? (
                    <>
                      <Wifi className="h-3 w-3 mr-1" />
                      Live
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-3 w-3 mr-1" />
                      Offline
                    </>
                  )}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1">{jobDetail.description}</p>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span>Created {formatDistanceToNow(new Date(jobDetail.createdAt), { addSuffix: true })}</span>
                <button 
                  className="font-mono text-xs hover:text-foreground flex items-center gap-1 transition-colors"
                  onClick={() => navigator.clipboard.writeText(jobDetail.id)}
                >
                  <Copy className="h-3 w-3" />
                  {jobDetail.id}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-12 lg:ml-0">
            {currentStatus === 'queued' && (
              <Button>
                <PlayCircle className="h-4 w-4 mr-2" />
                Start Analysis
              </Button>
            )}
            {currentStatus === 'done' && (
              <>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Download
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
        {(currentStatus === 'running' || currentStatus === 'failed') && currentProgress !== undefined && (
          <Card>
            <CardContent className="py-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Analysis Progress
                    {wsConnected && <span className="text-success ml-2">(Live)</span>}
                  </span>
                  <span className="font-medium text-foreground">{Math.round(currentProgress)}%</span>
                </div>
                <Progress value={currentProgress} className="h-2" />
                {jobDetail.errorMessage && (
                  <p className="text-sm text-destructive mt-2">{jobDetail.errorMessage}</p>
                )}
                
                {/* Real-time logs */}
                {realtimeLogs.length > 0 && (
                  <div className="mt-3 max-h-32 overflow-y-auto bg-muted/50 rounded p-2 font-mono text-xs">
                    {realtimeLogs.slice(-10).map((log, i) => (
                      <div key={i} className="text-muted-foreground">{log}</div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Terminal className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{jobDetail.commands.length}</p>
                  <p className="text-xs text-muted-foreground">Commands</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Folder className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{jobDetail.artifacts.length}</p>
                  <p className="text-xs text-muted-foreground">Artifacts</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Flag className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{jobDetail.flagCandidates.length}</p>
                  <p className="text-xs text-muted-foreground">Candidates</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-mono text-foreground truncate max-w-[100px]">{jobDetail.flagFormat}</p>
                  <p className="text-xs text-muted-foreground">Flag Format</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="commands" className="space-y-4">
          <TabsList className="bg-secondary/50 p-1">
            <TabsTrigger value="commands" className="flex items-center gap-2 data-[state=active]:bg-background">
              <Terminal className="h-4 w-4" />
              Commands
            </TabsTrigger>
            <TabsTrigger value="terminal" className="flex items-center gap-2 data-[state=active]:bg-background">
              <TerminalSquare className="h-4 w-4" />
              Terminal
            </TabsTrigger>
            <TabsTrigger value="artifacts" className="flex items-center gap-2 data-[state=active]:bg-background">
              <Folder className="h-4 w-4" />
              Artifacts
            </TabsTrigger>
            <TabsTrigger value="flags" className="flex items-center gap-2 data-[state=active]:bg-background">
              <Flag className="h-4 w-4" />
              Flags
            </TabsTrigger>
            <TabsTrigger value="writeup" className="flex items-center gap-2 data-[state=active]:bg-background">
              <FileText className="h-4 w-4" />
              Writeup
            </TabsTrigger>
          </TabsList>

          <TabsContent value="commands">
            <Card>
              <CardHeader className="border-b border-border">
                <CardTitle className="text-base">Command Execution Log</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <CommandLog commands={jobDetail.commands} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="terminal">
            <Card>
              <CardHeader className="border-b border-border">
                <CardTitle className="text-base">Interactive Terminal</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <SandboxTerminal 
                  jobId={jobDetail.id} 
                  files={jobDetail.inputFiles || []} 
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="artifacts">
            <Card>
              <CardHeader className="border-b border-border">
                <CardTitle className="text-base">Extracted Artifacts</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <ArtifactList artifacts={jobDetail.artifacts} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="flags">
            <Card>
              <CardHeader className="border-b border-border">
                <CardTitle className="text-base">Flag Candidates</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <FlagValidator 
                  candidates={jobDetail.flagCandidates} 
                  expectedFormat={jobDetail.flagFormat}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="writeup">
            <Card>
              <CardHeader className="border-b border-border">
                <CardTitle className="text-base">Generated Writeup</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <WriteupView writeup={jobDetail.writeup} jobId={jobDetail.id} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
