import { useState } from 'react';
import { ChevronDown, ChevronRight, Terminal, Check, X, Clock } from 'lucide-react';
import { Command } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface CommandLogProps {
  commands: Command[];
}

export function CommandLog({ commands }: CommandLogProps) {
  const [openCommands, setOpenCommands] = useState<Set<string>>(new Set());

  const toggleCommand = (id: string) => {
    setOpenCommands(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (commands.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Terminal className="h-12 w-12 mb-4 opacity-50" />
        <p>No commands executed yet</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[500px]">
      <div className="space-y-2 p-1">
        {commands.map((cmd) => (
          <Collapsible
            key={cmd.id}
            open={openCommands.has(cmd.id)}
            onOpenChange={() => toggleCommand(cmd.id)}
          >
            <CollapsibleTrigger className="w-full">
              <div
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg transition-colors",
                  "hover:bg-muted/50 cursor-pointer text-left",
                  openCommands.has(cmd.id) && "bg-muted/50"
                )}
              >
                {openCommands.has(cmd.id) ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                )}

                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Badge variant="outline" className="font-mono shrink-0">
                    {cmd.tool}
                  </Badge>
                  <code className="text-sm font-mono text-muted-foreground truncate">
                    {cmd.args.join(' ')}
                  </code>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {cmd.exitCode === 0 ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <X className="h-4 w-4 text-destructive" />
                  )}
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {cmd.duration.toFixed(2)}s
                  </span>
                </div>
              </div>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="ml-7 mr-2 mb-2 space-y-2">
                {cmd.stdout && (
                  <div className="rounded-lg overflow-hidden">
                    <div className="bg-terminal-bg px-3 py-1 text-xs text-terminal flex items-center gap-1">
                      <Terminal className="h-3 w-3" />
                      stdout
                    </div>
                    <pre className="bg-terminal-bg p-3 text-xs font-mono text-foreground/90 overflow-x-auto whitespace-pre-wrap">
                      {cmd.stdout}
                    </pre>
                  </div>
                )}

                {cmd.stderr && (
                  <div className="rounded-lg overflow-hidden">
                    <div className="bg-destructive/20 px-3 py-1 text-xs text-destructive flex items-center gap-1">
                      <Terminal className="h-3 w-3" />
                      stderr
                    </div>
                    <pre className="bg-destructive/10 p-3 text-xs font-mono text-destructive overflow-x-auto whitespace-pre-wrap">
                      {cmd.stderr}
                    </pre>
                  </div>
                )}

                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>Exit code: <code className="font-mono">{cmd.exitCode}</code></span>
                  <span>Executed: {new Date(cmd.executedAt).toLocaleString()}</span>
                  {cmd.artifactHash && (
                    <span>Artifact: <code className="font-mono">{cmd.artifactHash.slice(0, 8)}...</code></span>
                  )}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </ScrollArea>
  );
}
