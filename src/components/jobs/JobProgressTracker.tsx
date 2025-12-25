import { useEffect, useState } from 'react';
import { Check, Loader2, AlertCircle, Circle, ChevronDown, ChevronUp, Wifi, WifiOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useJobProgress, JobProgress, ProgressStep } from '@/hooks/use-job-progress';

interface JobProgressTrackerProps {
  jobId: string;
  enabled?: boolean;
  onComplete?: (progress: JobProgress) => void;
  className?: string;
}

const stepIcons: Record<ProgressStep['status'], React.ReactNode> = {
  pending: <Circle className="h-4 w-4 text-muted-foreground" />,
  running: <Loader2 className="h-4 w-4 text-primary animate-spin" />,
  completed: <Check className="h-4 w-4 text-success" />,
  failed: <AlertCircle className="h-4 w-4 text-destructive" />,
};

const statusColors: Record<JobProgress['status'], string> = {
  pending: 'bg-muted text-muted-foreground',
  running: 'bg-primary/20 text-primary border-primary/30',
  analyzing: 'bg-amber-500/20 text-amber-500 border-amber-500/30',
  completed: 'bg-success/20 text-success border-success/30',
  failed: 'bg-destructive/20 text-destructive border-destructive/30',
};

export function JobProgressTracker({ 
  jobId, 
  enabled = true, 
  onComplete,
  className 
}: JobProgressTrackerProps) {
  const [logsOpen, setLogsOpen] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  const {
    progress,
    isConnected,
    connectionError,
    reconnect,
  } = useJobProgress({
    jobId,
    enabled,
    onComplete,
  });

  // Auto-scroll logs when new entries arrive
  useEffect(() => {
    if (autoScroll && logsOpen && progress?.logs.length) {
      const logsContainer = document.getElementById('progress-logs');
      if (logsContainer) {
        logsContainer.scrollTop = logsContainer.scrollHeight;
      }
    }
  }, [progress?.logs.length, autoScroll, logsOpen]);

  if (!progress) {
    return (
      <Card className={cn("border-border/50 bg-card/50 backdrop-blur", className)}>
        <CardContent className="flex items-center justify-center py-8">
          {connectionError ? (
            <div className="text-center space-y-2">
              <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
              <p className="text-sm text-muted-foreground">{connectionError}</p>
              <Button variant="outline" size="sm" onClick={reconnect}>
                Reconnect
              </Button>
            </div>
          ) : (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-border/50 bg-card/50 backdrop-blur", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            Analysis Progress
            <Badge className={cn("ml-2", statusColors[progress.status])}>
              {progress.status.charAt(0).toUpperCase() + progress.status.slice(1)}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Badge variant="outline" className="text-success border-success/30 gap-1">
                <Wifi className="h-3 w-3" />
                Live
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground gap-1">
                <WifiOff className="h-3 w-3" />
                Offline
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{progress.currentStep}</span>
            <span className="font-mono text-primary">{progress.progress}%</span>
          </div>
          <Progress value={progress.progress} className="h-2" />
        </div>

        {/* Steps List */}
        <div className="space-y-2">
          {progress.steps.map((step, index) => (
            <div
              key={step.id}
              className={cn(
                "flex items-center gap-3 p-2 rounded-lg transition-colors",
                step.status === 'running' && "bg-primary/5 border border-primary/20",
                step.status === 'completed' && "opacity-60",
                step.status === 'failed' && "bg-destructive/5 border border-destructive/20"
              )}
            >
              <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                {stepIcons[step.status]}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm font-medium",
                  step.status === 'running' && "text-primary",
                  step.status === 'failed' && "text-destructive"
                )}>
                  {step.name}
                </p>
                {step.output && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {step.output}
                  </p>
                )}
              </div>
              {step.completedAt && (
                <span className="text-xs text-muted-foreground">
                  {new Date(step.completedAt).toLocaleTimeString()}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Error Display */}
        {progress.error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive">Error</p>
                <p className="text-xs text-destructive/80">{progress.error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Logs Section */}
        <Collapsible open={logsOpen} onOpenChange={setLogsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between h-8 px-2">
              <span className="text-xs text-muted-foreground">
                Logs ({progress.logs.length})
              </span>
              {logsOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ScrollArea
              id="progress-logs"
              className="h-40 mt-2 rounded-lg bg-zinc-950 border border-zinc-800 p-2"
            >
              <div className="space-y-1 font-mono text-xs">
                {progress.logs.length === 0 ? (
                  <p className="text-zinc-500">No logs yet...</p>
                ) : (
                  progress.logs.map((log, i) => (
                    <p
                      key={i}
                      className={cn(
                        "text-zinc-400",
                        log.toLowerCase().includes('error') && "text-red-400",
                        log.toLowerCase().includes('success') && "text-green-400",
                        log.toLowerCase().includes('flag') && "text-yellow-400 font-bold"
                      )}
                    >
                      {log}
                    </p>
                  ))
                )}
              </div>
            </ScrollArea>
            <div className="flex justify-end mt-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => setAutoScroll(!autoScroll)}
              >
                {autoScroll ? 'Auto-scroll: ON' : 'Auto-scroll: OFF'}
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Timestamps */}
        <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
          <span>Started: {new Date(progress.startedAt).toLocaleTimeString()}</span>
          <span>Updated: {new Date(progress.updatedAt).toLocaleTimeString()}</span>
        </div>
      </CardContent>
    </Card>
  );
}
