import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  PlayCircle,
  ChevronRight,
  Square,
  Trash2,
  MoreHorizontal,
  ExternalLink,
  Tag
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Job } from '@/lib/types';
import { cn } from '@/lib/utils';

interface JobCardProps {
  job: Job;
  onRun?: (jobId: string) => void;
  onStop?: (jobId: string) => void;
  onDelete?: (jobId: string) => void;
}

const statusConfig = {
  queued: {
    icon: Clock,
    label: 'Queued',
    variant: 'secondary' as const,
    className: 'bg-muted text-muted-foreground',
  },
  running: {
    icon: Loader2,
    label: 'Running',
    variant: 'default' as const,
    className: 'bg-info/15 text-info border-info/30',
  },
  done: {
    icon: CheckCircle,
    label: 'Completed',
    variant: 'default' as const,
    className: 'bg-success/15 text-success border-success/30',
  },
  failed: {
    icon: XCircle,
    label: 'Failed',
    variant: 'destructive' as const,
    className: 'bg-destructive/15 text-destructive border-destructive/30',
  },
};

const categoryLabels: Record<string, { label: string; color: string }> = {
  crypto: { label: 'Crypto', color: 'bg-violet-500/15 text-violet-500 border-violet-500/30' },
  pwn: { label: 'Pwn', color: 'bg-red-500/15 text-red-500 border-red-500/30' },
  web: { label: 'Web', color: 'bg-blue-500/15 text-blue-500 border-blue-500/30' },
  rev: { label: 'Rev', color: 'bg-orange-500/15 text-orange-500 border-orange-500/30' },
  forensics: { label: 'Forensics', color: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' },
  misc: { label: 'Misc', color: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
};

export function JobCard({ job, onRun, onStop, onDelete }: JobCardProps) {
  const navigate = useNavigate();
  const status = statusConfig[job.status];
  const StatusIcon = status.icon;
  const category = job.category ? categoryLabels[job.category] : null;

  return (
    <Card 
      className={cn(
        "group relative overflow-hidden transition-all duration-200",
        "bg-card border border-border hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5",
        job.status === 'running' && "border-info/40 shadow-info/10"
      )}
    >
      {/* Status indicator line */}
      <div className={cn(
        "absolute top-0 left-0 right-0 h-0.5",
        job.status === 'running' && "bg-info",
        job.status === 'done' && "bg-success",
        job.status === 'failed' && "bg-destructive",
        job.status === 'queued' && "bg-muted-foreground/30"
      )} />
      
      <CardContent className="p-5">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div 
              className="min-w-0 flex-1 cursor-pointer"
              onClick={() => navigate(`/jobs/${job.id}`)}
            >
              <div className="flex items-center gap-2 mb-1">
                {category && (
                  <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", category.color)}>
                    <Tag className="h-2.5 w-2.5 mr-1" />
                    {category.label}
                  </Badge>
                )}
              </div>
              <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                {job.title}
              </h3>
              {job.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                  {job.description}
                </p>
              )}
            </div>
            
            {/* Actions Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-popover z-[100]">
                <DropdownMenuItem onSelect={() => navigate(`/jobs/${job.id}`)}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Details
                </DropdownMenuItem>
                {job.status === 'queued' && (
                  <DropdownMenuItem onSelect={() => navigate(`/jobs/${job.id}?autostart=true`)}>
                    <PlayCircle className="h-4 w-4 mr-2" />
                    Run Full Autopilot
                  </DropdownMenuItem>
                )}
                {job.status === 'running' && onStop && (
                  <DropdownMenuItem onSelect={() => onStop(job.id)} className="text-warning">
                    <Square className="h-4 w-4 mr-2" />
                    Stop Analysis
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {onDelete && (
                  <DropdownMenuItem 
                    onSelect={() => onDelete(job.id)} 
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Job
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Progress (if applicable) */}
          {(job.status === 'running' || (job.status === 'failed' && job.progress)) && job.progress !== undefined && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Progress</span>
                <span className={cn(
                  "font-medium",
                  job.status === 'running' ? "text-info" : "text-foreground"
                )}>
                  {Math.round(job.progress)}%
                </span>
              </div>
              <Progress 
                value={job.progress} 
                className={cn(
                  "h-1.5",
                  job.status === 'running' && "[&>div]:bg-info"
                )} 
              />
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <div className="flex items-center gap-2">
              <Badge 
                variant="outline"
                className={cn("text-xs font-medium", status.className)}
              >
                <StatusIcon className={cn(
                  "h-3 w-3 mr-1.5",
                  job.status === 'running' && "animate-spin"
                )} />
                {status.label}
              </Badge>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
              </span>
              
              {job.status === 'queued' && (
                <Button 
                  size="sm" 
                  className="h-7 text-xs gap-1.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Navigate to job detail with autostart param to trigger Full Autopilot
                    navigate(`/jobs/${job.id}?autostart=true`);
                  }}
                >
                  <PlayCircle className="h-3.5 w-3.5" />
                  Solve
                </Button>
              )}
              
              {job.status === 'running' && onStop && (
                <Button 
                  size="sm" 
                  variant="outline"
                  className="h-7 text-xs gap-1.5 border-warning/50 text-warning hover:bg-warning/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStop(job.id);
                  }}
                >
                  <Square className="h-3 w-3" />
                  Stop
                </Button>
              )}
            </div>
          </div>

          {/* Error message */}
          {job.errorMessage && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">
                {job.errorMessage}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
