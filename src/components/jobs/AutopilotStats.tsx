import { Terminal, Clock, Brain, Target, Zap, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface AutopilotStatsProps {
  commandsRun: number;
  analysisTimeMs: number;
  aiAccuracy: number;
  flagsFound: number;
  category: string;
  isRunning: boolean;
}

export function AutopilotStats({
  commandsRun,
  analysisTimeMs,
  aiAccuracy,
  flagsFound,
  category,
  isRunning,
}: AutopilotStatsProps) {
  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  };

  const getCategoryColor = (cat: string) => {
    switch (cat.toLowerCase()) {
      case 'crypto': return 'text-amber-500 bg-amber-500/10 border-amber-500/30';
      case 'forensics': return 'text-blue-500 bg-blue-500/10 border-blue-500/30';
      case 'pwn': return 'text-red-500 bg-red-500/10 border-red-500/30';
      case 'rev': return 'text-purple-500 bg-purple-500/10 border-purple-500/30';
      case 'web': return 'text-green-500 bg-green-500/10 border-green-500/30';
      default: return 'text-cyan-500 bg-cyan-500/10 border-cyan-500/30';
    }
  };

  const getAccuracyColor = (acc: number) => {
    if (acc >= 0.9) return 'text-success';
    if (acc >= 0.7) return 'text-amber-500';
    return 'text-muted-foreground';
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {/* Commands Run */}
      <Card className={cn(
        "border transition-all duration-300",
        isRunning && "animate-pulse border-primary/30"
      )}>
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10">
              <Terminal className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className={cn(
                "text-xl font-bold tabular-nums",
                isRunning && "animate-pulse"
              )}>
                {commandsRun}
              </p>
              <p className="text-xs text-muted-foreground truncate">Commands</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analysis Time */}
      <Card className="border">
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-info/10">
              <Clock className="h-4 w-4 text-info" />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold tabular-nums">
                {formatTime(analysisTimeMs)}
              </p>
              <p className="text-xs text-muted-foreground truncate">Analysis Time</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Accuracy */}
      <Card className="border">
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-success/10">
              <TrendingUp className="h-4 w-4 text-success" />
            </div>
            <div className="min-w-0">
              <p className={cn("text-xl font-bold tabular-nums", getAccuracyColor(aiAccuracy))}>
                {(aiAccuracy * 100).toFixed(0)}%
              </p>
              <p className="text-xs text-muted-foreground truncate">AI Confidence</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category */}
      <Card className={cn("border", getCategoryColor(category))}>
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className={cn("p-1.5 rounded-md", getCategoryColor(category).split(' ')[1])}>
              <Target className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold capitalize truncate">
                {category || 'Unknown'}
              </p>
              <p className="text-xs text-muted-foreground truncate">Category</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
