import { Flag, Sparkles, Link, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { FlagCandidate } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface FlagCandidatesProps {
  candidates: FlagCandidate[];
}

export function FlagCandidates({ candidates }: FlagCandidatesProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (candidates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Flag className="h-12 w-12 mb-4 opacity-50" />
        <p>No flag candidates found</p>
        <p className="text-sm">Run the analysis to extract potential flags</p>
      </div>
    );
  }

  // Sort by confidence
  const sortedCandidates = [...candidates].sort((a, b) => b.confidence - a.confidence);

  return (
    <ScrollArea className="h-[500px]">
      <div className="space-y-3 p-1">
        {sortedCandidates.map((candidate) => (
          <div
            key={candidate.id}
            className={cn(
              "p-4 rounded-lg border transition-all",
              candidate.confidence >= 0.9 
                ? "border-success/50 bg-success/5" 
                : "border-border bg-card"
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {candidate.confidence >= 0.9 && (
                    <Sparkles className="h-4 w-4 text-success" />
                  )}
                  <code className="px-2 py-1 rounded bg-muted font-mono text-sm break-all">
                    {candidate.value}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => copyToClipboard(candidate.value, candidate.id)}
                  >
                    {copiedId === candidate.id ? (
                      <Check className="h-3 w-3 text-success" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Confidence:</span>
                    <Progress 
                      value={candidate.confidence * 100} 
                      className="w-20 h-2"
                    />
                    <span className="font-medium">
                      {Math.round(candidate.confidence * 100)}%
                    </span>
                  </div>
                  
                  <Badge variant="outline" className="text-xs">
                    {candidate.source}
                  </Badge>

                  {candidate.commandId && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Link className="h-3 w-3" />
                      {candidate.commandId}
                    </span>
                  )}
                </div>

                {candidate.context && (
                  <div className="rounded bg-terminal-bg p-2">
                    <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap overflow-x-auto">
                      {candidate.context}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
