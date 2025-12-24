import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  PlayCircle,
  FileText
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Job } from '@/lib/types';
import { cn } from '@/lib/utils';

interface JobCardProps {
  job: Job;
  onRun?: (jobId: string) => void;
}

const statusConfig = {
  queued: {
    icon: Clock,
    label: 'Queued',
    className: 'bg-muted text-muted-foreground',
  },
  running: {
    icon: Loader2,
    label: 'Running',
    className: 'bg-info/20 text-info',
  },
  done: {
    icon: CheckCircle,
    label: 'Completed',
    className: 'bg-success/20 text-success',
  },
  failed: {
    icon: XCircle,
    label: 'Failed',
    className: 'bg-destructive/20 text-destructive',
  },
};

export function JobCard({ job, onRun }: JobCardProps) {
  const navigate = useNavigate();
  const status = statusConfig[job.status];
  const StatusIcon = status.icon;

  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all hover:shadow-lg hover:border-primary/50",
        job.status === 'running' && "border-info/50 animate-pulse-glow"
      )}
      onClick={() => navigate(`/jobs/${job.id}`)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <CardTitle className="text-lg line-clamp-1">{job.title}</CardTitle>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {job.description}
            </p>
          </div>
          <Badge variant="secondary" className={cn("ml-2 shrink-0", status.className)}>
            <StatusIcon className={cn("h-3 w-3 mr-1", job.status === 'running' && "animate-spin")} />
            {status.label}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-3">
          {(job.status === 'running' || job.status === 'failed') && job.progress !== undefined && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span>{Math.round(job.progress)}%</span>
              </div>
              <Progress value={job.progress} className="h-1.5" />
            </div>
          )}
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              <code className="font-mono">{job.flagFormat}</code>
            </div>
            <span>
              {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
            </span>
          </div>

          {job.status === 'queued' && onRun && (
            <Button 
              size="sm" 
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                onRun(job.id);
              }}
            >
              <PlayCircle className="h-4 w-4 mr-2" />
              Start Analysis
            </Button>
          )}

          {job.errorMessage && (
            <p className="text-xs text-destructive bg-destructive/10 p-2 rounded">
              {job.errorMessage}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
