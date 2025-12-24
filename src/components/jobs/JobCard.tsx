import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  PlayCircle,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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
    variant: 'secondary' as const,
  },
  running: {
    icon: Loader2,
    label: 'Running',
    variant: 'default' as const,
  },
  done: {
    icon: CheckCircle,
    label: 'Completed',
    variant: 'default' as const,
  },
  failed: {
    icon: XCircle,
    label: 'Failed',
    variant: 'destructive' as const,
  },
};

export function JobCard({ job, onRun }: JobCardProps) {
  const navigate = useNavigate();
  const status = statusConfig[job.status];
  const StatusIcon = status.icon;

  return (
    <Card 
      className={cn(
        "group cursor-pointer transition-all duration-200",
        "hover:shadow-md hover:border-primary/40",
        job.status === 'running' && "border-info/50"
      )}
      onClick={() => navigate(`/jobs/${job.id}`)}
    >
      <CardContent className="p-5">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                {job.title}
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {job.description}
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </div>

          {/* Progress (if applicable) */}
          {(job.status === 'running' || job.status === 'failed') && job.progress !== undefined && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Progress</span>
                <span className="text-foreground font-medium">{Math.round(job.progress)}%</span>
              </div>
              <Progress value={job.progress} className="h-1.5" />
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              <Badge 
                variant={status.variant}
                className={cn(
                  "text-xs",
                  job.status === 'done' && "bg-success/15 text-success hover:bg-success/20",
                  job.status === 'running' && "bg-info/15 text-info hover:bg-info/20"
                )}
              >
                <StatusIcon className={cn(
                  "h-3 w-3 mr-1",
                  job.status === 'running' && "animate-spin"
                )} />
                {status.label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
              </span>
            </div>

            {job.status === 'queued' && onRun && (
              <Button 
                size="sm" 
                variant="outline"
                className="h-7 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onRun(job.id);
                }}
              >
                <PlayCircle className="h-3 w-3 mr-1" />
                Run
              </Button>
            )}
          </div>

          {/* Error message */}
          {job.errorMessage && (
            <p className="text-xs text-destructive bg-destructive/10 p-2 rounded border border-destructive/20">
              {job.errorMessage}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
