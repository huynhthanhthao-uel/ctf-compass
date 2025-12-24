import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
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
  TerminalSquare,
  Brain,
  History,
  Archive,
  FileDown,
  PlayCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AppLayout } from '@/components/layout/AppLayout';
import { CommandLog } from '@/components/jobs/CommandLog';
import { ArtifactList } from '@/components/jobs/ArtifactList';
import { FlagValidator } from '@/components/jobs/FlagValidator';
import { WriteupView } from '@/components/jobs/WriteupView';
import { SandboxTerminal } from '@/components/jobs/SandboxTerminal';
import { AutopilotPanel } from '@/components/jobs/AutopilotPanel';
import { AnalysisHistory } from '@/components/jobs/AnalysisHistory';
import { useJobDetail } from '@/hooks/use-jobs';
import { useJobWebSocket, JobUpdate } from '@/hooks/use-websocket';
import { cn } from '@/lib/utils';
import { generatePDFReport } from '@/lib/pdf-report';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

const statusConfig = {
  queued: { icon: Clock, label: 'Queued', className: 'bg-secondary text-secondary-foreground' },
  running: { icon: Loader2, label: 'Running', className: 'bg-info/15 text-info' },
  analyzing: { icon: Brain, label: 'AI Analyzing', className: 'bg-primary/15 text-primary' },
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
  const [isStartingAnalysis, setIsStartingAnalysis] = useState(false);
  
  // AI Analysis state - managed by AutopilotPanel
  const [foundFlags, setFoundFlags] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('analysis');
  
  const handleJobUpdate = useCallback((update: JobUpdate) => {
    if (update.type === 'job_update' && update.job_id === id) {
      if (update.data.progress !== undefined) {
        setRealtimeProgress(update.data.progress);
      }
      if (update.data.status) {
        const mappedStatus = update.data.status === 'completed' ? 'done' : 
                            update.data.status === 'pending' ? 'queued' : update.data.status;
        setRealtimeStatus(mappedStatus);
        
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

  // Poll for updates when job is running (for mock mode without WebSocket)
  useEffect(() => {
    const currentStatus = realtimeStatus || jobDetail?.status;
    if (currentStatus === 'running' && !wsConnected) {
      const interval = setInterval(() => {
        fetchJobDetail();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [realtimeStatus, jobDetail?.status, wsConnected, fetchJobDetail]);

  // Start analysis for queued jobs
  const handleStartAnalysis = useCallback(async () => {
    if (!id || !jobDetail || jobDetail.status !== 'queued') return;
    
    setIsStartingAnalysis(true);
    try {
      // Try API first
      const response = await fetch(`/api/jobs/${id}/run`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (response.ok) {
        setRealtimeStatus('running');
        setRealtimeProgress(0);
        toast.success('Analysis started');
      } else {
        // Mock mode - simulate analysis
        setRealtimeStatus('running');
        setRealtimeProgress(0);
        toast.success('Analysis started (mock mode)');
        
        // Simulate progress
        let progress = 0;
        const interval = setInterval(() => {
          progress += 15 + Math.random() * 10;
          if (progress >= 100) {
            progress = 100;
            setRealtimeProgress(100);
            setRealtimeStatus('done');
            clearInterval(interval);
            fetchJobDetail();
            toast.success('Analysis completed!');
          } else {
            setRealtimeProgress(Math.floor(progress));
          }
        }, 600);
      }
    } catch {
      // Mock mode fallback
      setRealtimeStatus('running');
      setRealtimeProgress(0);
      toast.success('Analysis started (mock mode)');
      
      let progress = 0;
      const interval = setInterval(() => {
        progress += 15 + Math.random() * 10;
        if (progress >= 100) {
          progress = 100;
          setRealtimeProgress(100);
          setRealtimeStatus('done');
          clearInterval(interval);
          fetchJobDetail();
          toast.success('Analysis completed!');
        } else {
          setRealtimeProgress(Math.floor(progress));
        }
      }, 600);
    } finally {
      setIsStartingAnalysis(false);
    }
  }, [id, jobDetail, fetchJobDetail]);

  // Handle flag found
  const handleFlagFound = useCallback((flag: string) => {
    setFoundFlags(prev => {
      if (!prev.includes(flag)) {
        toast.success(`🎉 Flag found: ${flag}`);
        return [...prev, flag];
      }
      return prev;
    });
  }, []);

  // Apply strategy from history
  const handleApplyStrategy = useCallback((tools: string[]) => {
    toast.info(`Applying strategy with ${tools.length} tools: ${tools.slice(0, 3).join(', ')}...`);
    setActiveTab('analysis');
  }, []);

  // Download All - uses backend ZIP endpoint for fast batch download
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const handleDownloadAll = useCallback(async () => {
    if (!jobDetail) return;
    
    setIsDownloadingAll(true);
    try {
      if (jobDetail.artifacts.length === 0) {
        toast.error('No artifacts to download');
        return;
      }

      // Use backend ZIP bundle endpoint
      const response = await fetch(`/api/jobs/${jobDetail.id}/download/bundle`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `job_${jobDetail.id}_bundle.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success(`Downloaded all artifacts as ZIP`);
    } catch (err) {
      console.error('Download error:', err);
      toast.error('Failed to download artifacts');
    } finally {
      setIsDownloadingAll(false);
    }
  }, [jobDetail]);

  // Export Report - JSON format
  const [isExportingReport, setIsExportingReport] = useState(false);
  const handleExportJSON = useCallback(async () => {
    if (!jobDetail) return;
    
    setIsExportingReport(true);
    try {
      const report = {
        meta: {
          title: jobDetail.title,
          id: jobDetail.id,
          status: jobDetail.status,
          createdAt: jobDetail.createdAt,
          exportedAt: new Date().toISOString(),
          flagFormat: jobDetail.flagFormat,
        },
        summary: {
          totalCommands: jobDetail.commands.length,
          totalArtifacts: jobDetail.artifacts.length,
          flagsFound: [...foundFlags, ...jobDetail.flagCandidates.map(c => c.value)],
        },
        flags: [
          ...foundFlags.map((f) => ({ 
            value: f, 
            confidence: 1, 
            source: 'AI Analysis' 
          })),
          ...jobDetail.flagCandidates.map(c => ({
            value: c.value,
            confidence: c.confidence,
            source: c.source,
          }))
        ],
        commands: jobDetail.commands.map(cmd => ({
          tool: cmd.tool,
          args: cmd.args,
          exitCode: cmd.exitCode,
          stdout: cmd.stdout,
          stderr: cmd.stderr,
          executedAt: cmd.executedAt,
          duration: cmd.duration,
        })),
        artifacts: jobDetail.artifacts.map(a => ({
          name: a.name,
          path: a.path,
          size: a.size,
          type: a.type,
        })),
        writeup: jobDetail.writeup || 'No writeup generated',
      };

      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ctf-report-${jobDetail.id}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('JSON report exported successfully');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Failed to export report');
    } finally {
      setIsExportingReport(false);
    }
  }, [jobDetail, foundFlags]);

  // Export Report - PDF format
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const handleExportPDF = useCallback(async () => {
    if (!jobDetail) return;
    
    setIsExportingPDF(true);
    try {
      generatePDFReport({
        job: jobDetail,
        foundFlags,
      });
      toast.success('PDF report exported successfully');
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error('Failed to export PDF report');
    } finally {
      setIsExportingPDF(false);
    }
  }, [jobDetail, foundFlags]);

  if (isLoading || !jobDetail) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  // Determine display status
  const currentStatus = (realtimeStatus as keyof typeof statusConfig) || jobDetail.status;
  const currentProgress = realtimeProgress ?? jobDetail.progress;
  
  const status = statusConfig[currentStatus] || statusConfig.queued;
  const StatusIcon = status.icon;

  const hasFoundFlags = foundFlags.length > 0 || jobDetail.flagCandidates.length > 0;

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

          {/* Action Buttons - Always show when there's something to export */}
          {(hasFoundFlags || jobDetail.artifacts.length > 0 || jobDetail.commands.length > 0) && (
            <div className="flex items-center gap-2 shrink-0 ml-12 lg:ml-0">
              <Button 
                variant="secondary" 
                className="gap-2"
                onClick={handleDownloadAll}
                disabled={isDownloadingAll || jobDetail.artifacts.length === 0}
              >
                {isDownloadingAll ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Archive className="h-4 w-4" />
                )}
                Download ZIP
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="gap-2" disabled={isExportingReport || isExportingPDF}>
                    {(isExportingReport || isExportingPDF) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileDown className="h-4 w-4" />
                    )}
                    Export Report
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportPDF} className="gap-2">
                    <FileText className="h-4 w-4" />
                    Export as PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportJSON} className="gap-2">
                    <FileText className="h-4 w-4" />
                    Export as JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* Found Flags Banner */}
        {foundFlags.length > 0 && (
          <Card className="border-success/50 bg-success/5">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-success/20 flex items-center justify-center">
                  <Flag className="h-5 w-5 text-success" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-success">Flags Found!</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {foundFlags.map((flag, i) => (
                      <code key={i} className="px-2 py-0.5 bg-success/20 rounded font-mono text-sm text-foreground">
                        {flag}
                      </code>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Queued Job - Start Analysis Prompt */}
        {currentStatus === 'queued' && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Job Queued</p>
                    <p className="text-sm text-muted-foreground">
                      This job is waiting to be analyzed. Click "Start Analysis" to begin.
                    </p>
                  </div>
                </div>
                <Button 
                  onClick={handleStartAnalysis}
                  disabled={isStartingAnalysis}
                  size="lg"
                  className="gap-2"
                >
                  {isStartingAnalysis ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <PlayCircle className="h-4 w-4" />
                      Start Analysis
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

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
                <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <Flag className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">
                    {Math.max(foundFlags.length, jobDetail.flagCandidates.length)}
                  </p>
                  <p className="text-xs text-muted-foreground">Flags Found</p>
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-secondary/50 p-1">
            <TabsTrigger value="analysis" className="flex items-center gap-2 data-[state=active]:bg-background">
              <Brain className="h-4 w-4" />
              AI Analysis
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2 data-[state=active]:bg-background">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
            <TabsTrigger value="terminal" className="flex items-center gap-2 data-[state=active]:bg-background">
              <TerminalSquare className="h-4 w-4" />
              Terminal
            </TabsTrigger>
            <TabsTrigger value="commands" className="flex items-center gap-2 data-[state=active]:bg-background">
              <Terminal className="h-4 w-4" />
              Commands
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

          <TabsContent value="analysis">
            <AutopilotPanel 
              jobId={jobDetail.id} 
              files={jobDetail.inputFiles || []}
              description={jobDetail.description}
              expectedFormat={jobDetail.flagFormat}
              onFlagFound={handleFlagFound}
            />
          </TabsContent>

          <TabsContent value="history">
            <AnalysisHistory
              jobId={jobDetail.id}
              onApplyStrategy={handleApplyStrategy}
            />
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

          <TabsContent value="artifacts">
            <Card>
              <CardHeader className="border-b border-border">
                <CardTitle className="text-base">Extracted Artifacts</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <ArtifactList artifacts={jobDetail.artifacts} jobId={jobDetail.id} />
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
                  candidates={[
                    ...foundFlags.map((f, i) => ({ 
                      id: `ai-${i}`, 
                      value: f, 
                      confidence: 1, 
                      source: 'AI Analysis',
                      context: 'Found by AI autopilot'
                    })),
                    ...jobDetail.flagCandidates.filter(c => !foundFlags.includes(c.value))
                  ]} 
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
