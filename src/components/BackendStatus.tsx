import { CloudOff, Server } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useBackendStatus, BackendMode } from '@/hooks/use-backend-status';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const STATUS_CONFIG: Record<BackendMode, {
  icon: typeof Server;
  label: string;
  shortLabel: string;
  className: string;
}> = {
  backend: {
    icon: Server,
    label: 'Backend Connected',
    shortLabel: 'API',
    className: 'border-green-500/50 text-green-600 dark:text-green-400 bg-green-500/10',
  },
  demo: {
    icon: CloudOff,
    label: 'Demo Mode',
    shortLabel: 'Demo',
    className: 'border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/10',
  },
};

export function BackendStatus() {
  const { mode, isLoading, backendUrl, error, retry } = useBackendStatus();

  if (isLoading) {
    return (
      <Badge variant="outline" className="gap-1.5 text-xs font-normal px-2 py-0.5 border-muted-foreground/30 text-muted-foreground">
        <span className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
        <span className="hidden sm:inline">Connecting...</span>
      </Badge>
    );
  }

  const config = STATUS_CONFIG[mode];
  const Icon = config.icon;

  const tooltipContent = mode === 'backend' 
    ? `Connected to: ${backendUrl}` 
    : error || 'Click to retry connection';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant="outline" 
          className={cn(
            'gap-1.5 text-xs font-normal px-2 py-0.5 cursor-pointer hover:opacity-80 transition-opacity',
            config.className
          )}
          onClick={retry}
        >
          <Icon className="h-3 w-3" />
          <span className="hidden sm:inline">{config.label}</span>
          <span className="sm:hidden">{config.shortLabel}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">{tooltipContent}</p>
        {mode === 'demo' && <p className="text-xs text-muted-foreground">Click to retry</p>}
      </TooltipContent>
    </Tooltip>
  );
}
