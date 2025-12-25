import { Cloud, CloudOff, Server } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useBackendStatus, BackendMode } from '@/hooks/use-backend-status';

const STATUS_CONFIG: Record<BackendMode, {
  icon: typeof Cloud;
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
  cloud: {
    icon: Cloud,
    label: 'Cloud Mode',
    shortLabel: 'Cloud',
    className: 'border-primary/40 text-primary bg-primary/10',
  },
  demo: {
    icon: CloudOff,
    label: 'Demo Mode',
    shortLabel: 'Demo',
    className: 'border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/10',
  },
};

export function BackendStatus() {
  const { mode, isLoading, retry } = useBackendStatus();

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

  return (
    <Badge 
      variant="outline" 
      className={cn(
        'gap-1.5 text-xs font-normal px-2 py-0.5 cursor-pointer hover:opacity-80 transition-opacity',
        config.className
      )}
      onClick={retry}
      title="Click to retry connection"
    >
      <Icon className="h-3 w-3" />
      <span className="hidden sm:inline">{config.label}</span>
      <span className="sm:hidden">{config.shortLabel}</span>
    </Badge>
  );
}
