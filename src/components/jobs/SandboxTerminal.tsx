import { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal, Play, X, Loader2, ChevronUp, HelpCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import * as api from '@/lib/api';

interface TerminalLine {
  id: string;
  type: 'command' | 'stdout' | 'stderr' | 'info' | 'error';
  content: string;
  timestamp: Date;
}

interface SandboxTerminalProps {
  jobId: string;
  files: string[];
  allowedTools?: string[];
}

// Common CTF tools grouped by category
const TOOL_SUGGESTIONS = {
  'Binary': ['strings', 'file', 'readelf', 'objdump', 'nm', 'checksec', 'r2', 'retdec-decompiler'],
  'Hex': ['xxd', 'hexdump', 'base64', 'base32'],
  'Stego': ['exiftool', 'binwalk', 'zsteg', 'steghide', 'foremost', 'pngcheck'],
  'Network': ['tshark', 'tcpdump', 'strings'],
  'Crypto': ['openssl', 'john', 'hashcat', 'name-that-hash'],
  'Forensics': ['volatility', 'photorec', 'bulk_extractor'],
  'Text': ['grep', 'awk', 'sed', 'cat', 'head', 'tail', 'sort', 'uniq'],
};

export function SandboxTerminal({ jobId, files, allowedTools }: SandboxTerminalProps) {
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: 'welcome',
      type: 'info',
      content: `CTF Sandbox Terminal - Job: ${jobId}\nType 'help' for available commands or start with: strings <filename>`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const addLine = useCallback((type: TerminalLine['type'], content: string) => {
    setLines(prev => [...prev, {
      id: `${Date.now()}-${Math.random()}`,
      type,
      content,
      timestamp: new Date(),
    }]);
  }, []);

  const executeCommand = async (command: string) => {
    const trimmedCmd = command.trim();
    if (!trimmedCmd) return;

    // Add to history
    setCommandHistory(prev => [...prev.filter(c => c !== trimmedCmd), trimmedCmd].slice(-50));
    setHistoryIndex(-1);

    // Echo command
    addLine('command', `$ ${trimmedCmd}`);

    // Handle built-in commands
    if (trimmedCmd === 'help') {
      addLine('info', `Available commands:
  help              - Show this help message
  ls                - List files in workspace
  clear             - Clear terminal
  tools             - List allowed sandbox tools
  <tool> <args>     - Run a sandbox tool (e.g., strings file.bin)

Quick examples:
  file *            - Identify all file types
  strings -n 8 *    - Find strings >= 8 chars
  xxd -l 256 *      - Hex dump first 256 bytes
  checksec --file * - Check binary protections
  binwalk -e *      - Extract embedded files
  zsteg *           - Check PNG for hidden data`);
      return;
    }

    if (trimmedCmd === 'clear') {
      setLines([]);
      return;
    }

    if (trimmedCmd === 'tools') {
      const tools = allowedTools || Object.values(TOOL_SUGGESTIONS).flat();
      addLine('info', `Allowed sandbox tools:\n${tools.join(', ')}`);
      return;
    }

    if (trimmedCmd === 'ls') {
      addLine('stdout', files.length > 0 ? files.join('\n') : '(no files)');
      return;
    }

    // Parse command
    const parts = trimmedCmd.split(/\s+/);
    const tool = parts[0];
    let args = parts.slice(1);

    // Expand wildcards
    args = args.flatMap(arg => {
      if (arg === '*') return files;
      if (arg.includes('*')) {
        const pattern = new RegExp('^' + arg.replace(/\*/g, '.*') + '$');
        const matches = files.filter(f => pattern.test(f));
        return matches.length > 0 ? matches : [arg];
      }
      return [arg];
    });

    setIsExecuting(true);

    try {
      const result = await api.executeTerminalCommand(jobId, tool, args);
      
      if (result.stdout) {
        addLine('stdout', result.stdout);
      }
      if (result.stderr) {
        addLine('stderr', result.stderr);
      }
      if (result.error) {
        addLine('error', result.error);
      }
      if (!result.stdout && !result.stderr && !result.error) {
        addLine('info', `Command completed with exit code ${result.exit_code}`);
      }
    } catch (err) {
      addLine('error', err instanceof Error ? err.message : 'Command failed');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isExecuting) {
      executeCommand(input);
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
      } else {
        setHistoryIndex(-1);
        setInput('');
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Simple tab completion for files
      const parts = input.split(/\s+/);
      const lastPart = parts[parts.length - 1];
      if (lastPart) {
        const matches = files.filter(f => f.toLowerCase().startsWith(lastPart.toLowerCase()));
        if (matches.length === 1) {
          parts[parts.length - 1] = matches[0];
          setInput(parts.join(' '));
        } else if (matches.length > 1) {
          addLine('info', matches.join('  '));
        }
      }
    }
  };

  const handleToolClick = (tool: string) => {
    const fileArg = files.length > 0 ? files[0] : '<file>';
    setInput(`${tool} ${fileArg}`);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-[600px] bg-terminal-bg rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Sandbox Terminal</span>
          <Badge variant="outline" className="text-xs">
            {files.length} files
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <HelpCircle className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-2">
                <h4 className="font-medium">Quick Tools</h4>
                {Object.entries(TOOL_SUGGESTIONS).map(([category, tools]) => (
                  <div key={category}>
                    <p className="text-xs text-muted-foreground mb-1">{category}</p>
                    <div className="flex flex-wrap gap-1">
                      {tools.slice(0, 5).map(tool => (
                        <Badge
                          key={tool}
                          variant="secondary"
                          className="cursor-pointer hover:bg-primary/20 text-xs"
                          onClick={() => handleToolClick(tool)}
                        >
                          {tool}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setLines([])}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Terminal Output */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="font-mono text-sm space-y-1">
          {lines.map((line) => (
            <div
              key={line.id}
              className={cn(
                "whitespace-pre-wrap break-all",
                line.type === 'command' && "text-primary font-semibold",
                line.type === 'stdout' && "text-foreground/90",
                line.type === 'stderr' && "text-warning",
                line.type === 'info' && "text-muted-foreground italic",
                line.type === 'error' && "text-destructive",
              )}
            >
              {line.content}
            </div>
          ))}
          {isExecuting && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Executing...</span>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="flex items-center gap-2 px-4 py-3 bg-muted/20 border-t border-border">
        <span className="text-primary font-mono font-semibold">$</span>
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isExecuting ? "Executing..." : "Enter command..."}
          disabled={isExecuting}
          className="flex-1 bg-transparent border-0 focus-visible:ring-0 font-mono text-sm h-8 px-0"
        />
        <Button
          size="sm"
          variant="ghost"
          disabled={isExecuting || !input.trim()}
          onClick={() => {
            executeCommand(input);
            setInput('');
          }}
        >
          {isExecuting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
