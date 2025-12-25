import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Terminal, Play, Loader2, HelpCircle, Trash2, Lightbulb, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import * as api from '@/lib/api';

interface TerminalLine {
  id: string;
  type: 'command' | 'stdout' | 'stderr' | 'info' | 'error' | 'flag';
  content: string;
  timestamp: Date;
}

interface SandboxTerminalProps {
  jobId: string;
  files: string[];
  allowedTools?: string[];
  onFlagFound?: (flag: string) => void;
}

// Common CTF tools grouped by category with descriptions
const TOOL_CATEGORIES = {
  'Binary': [
    { name: 'strings', desc: 'Extract printable strings', example: 'strings -n 8' },
    { name: 'file', desc: 'Identify file type', example: 'file' },
    { name: 'readelf', desc: 'Display ELF info', example: 'readelf -a' },
    { name: 'objdump', desc: 'Disassemble binary', example: 'objdump -d' },
    { name: 'nm', desc: 'List symbols', example: 'nm' },
    { name: 'checksec', desc: 'Check protections', example: 'checksec --file' },
    { name: 'r2', desc: 'Radare2 analysis', example: 'r2 -A' },
    { name: 'retdec-decompiler', desc: 'Decompile binary', example: 'retdec-decompiler' },
  ],
  'Hex': [
    { name: 'xxd', desc: 'Hex dump', example: 'xxd -l 256' },
    { name: 'hexdump', desc: 'ASCII hex dump', example: 'hexdump -C' },
    { name: 'base64', desc: 'Base64 encode/decode', example: 'base64 -d' },
    { name: 'base32', desc: 'Base32 encode/decode', example: 'base32 -d' },
  ],
  'Stego': [
    { name: 'exiftool', desc: 'Read metadata', example: 'exiftool' },
    { name: 'binwalk', desc: 'Extract embedded', example: 'binwalk -e' },
    { name: 'zsteg', desc: 'PNG steganography', example: 'zsteg' },
    { name: 'steghide', desc: 'Hide/extract data', example: 'steghide extract -sf' },
    { name: 'foremost', desc: 'File carving', example: 'foremost -i' },
    { name: 'pngcheck', desc: 'PNG validation', example: 'pngcheck -v' },
  ],
  'Network': [
    { name: 'tshark', desc: 'Packet analysis', example: 'tshark -r' },
    { name: 'tcpdump', desc: 'Dump packets', example: 'tcpdump -r' },
  ],
  'Crypto': [
    { name: 'openssl', desc: 'Crypto toolkit', example: 'openssl enc -d' },
    { name: 'john', desc: 'Password cracker', example: 'john --wordlist=' },
    { name: 'hashcat', desc: 'Hash cracker', example: 'hashcat -m 0' },
  ],
  'Text': [
    { name: 'grep', desc: 'Search patterns', example: 'grep -i "flag"' },
    { name: 'awk', desc: 'Text processing', example: "awk '{print $1}'" },
    { name: 'sed', desc: 'Stream editor', example: "sed 's/old/new/g'" },
    { name: 'cat', desc: 'Concatenate files', example: 'cat' },
    { name: 'head', desc: 'First lines', example: 'head -n 20' },
    { name: 'tail', desc: 'Last lines', example: 'tail -n 20' },
    { name: 'sort', desc: 'Sort lines', example: 'sort -u' },
    { name: 'uniq', desc: 'Unique lines', example: 'uniq -c' },
  ],
};

// Syntax highlighting for terminal output
const highlightOutput = (content: string, type: TerminalLine['type']) => {
  if (type === 'command') {
    // Highlight command parts
    const parts = content.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1).join(' ');
    return (
      <>
        <span className="text-cyan-400">{cmd}</span>
        {args && <span className="text-foreground/80"> {args}</span>}
      </>
    );
  }

  if (type === 'stdout') {
    // Highlight potential flags
    const flagPattern = /(flag\{[^}]+\}|CTF\{[^}]+\}|[A-Z]{3,5}\{[^}]+\})/gi;
    const hexPattern = /(0x[0-9a-fA-F]+)/g;
    const pathPattern = /(\/[\w\-./]+)/g;
    const stringPattern = /("[^"]*"|'[^']*')/g;

    // Split and highlight
    let highlighted = content;
    
    // Flags - bright green
    highlighted = highlighted.replace(flagPattern, '<span class="text-green-400 font-bold bg-green-500/20 px-1 rounded">$1</span>');
    
    // Hex values - yellow
    highlighted = highlighted.replace(hexPattern, '<span class="text-yellow-400">$1</span>');
    
    // Strings - orange
    highlighted = highlighted.replace(stringPattern, '<span class="text-orange-400">$1</span>');

    return <span dangerouslySetInnerHTML={{ __html: highlighted }} />;
  }

  return content;
};

// Autocomplete suggestions component
interface AutocompleteProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  visible: boolean;
  selectedIndex: number;
}

function AutocompleteDropdown({ suggestions, onSelect, visible, selectedIndex }: AutocompleteProps) {
  if (!visible || suggestions.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-auto z-50">
      {suggestions.map((suggestion, index) => (
        <div
          key={suggestion}
          className={cn(
            "px-3 py-2 text-sm font-mono cursor-pointer hover:bg-muted/50",
            index === selectedIndex && "bg-primary/20 text-primary"
          )}
          onClick={() => onSelect(suggestion)}
        >
          {suggestion}
        </div>
      ))}
    </div>
  );
}

export function SandboxTerminal({ jobId, files, allowedTools, onFlagFound }: SandboxTerminalProps) {
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: 'welcome',
      type: 'info',
      content: `🔒 CTF Sandbox Terminal - Job: ${jobId}\n📁 ${files.length} files loaded\n\nType 'help' for commands or start with: strings <filename>\nUse Tab for autocomplete, ↑↓ for history`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // Autocomplete state
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<string[]>([]);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // All available tools
  const allTools = useMemo(() => {
    return Object.values(TOOL_CATEGORIES).flatMap(tools => tools.map(t => t.name));
  }, []);

  // Generate autocomplete suggestions
  const updateAutocomplete = useCallback((value: string) => {
    const parts = value.split(/\s+/);
    const lastPart = parts[parts.length - 1].toLowerCase();
    
    if (!lastPart) {
      setAutocompleteSuggestions([]);
      setShowAutocomplete(false);
      return;
    }

    // If first word, suggest tools
    if (parts.length === 1) {
      const matches = allTools.filter(t => t.toLowerCase().startsWith(lastPart));
      setAutocompleteSuggestions(matches.slice(0, 8));
    } else {
      // Suggest files
      const matches = files.filter(f => f.toLowerCase().startsWith(lastPart));
      setAutocompleteSuggestions(matches.slice(0, 8));
    }
    
    setShowAutocomplete(true);
    setAutocompleteIndex(0);
  }, [allTools, files]);

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
    
    // Check for flags
    if (type === 'stdout' && onFlagFound) {
      const flagPattern = /(flag\{[^}]+\}|CTF\{[^}]+\}|[A-Z]{3,5}\{[^}]+\})/gi;
      const matches = content.match(flagPattern);
      if (matches) {
        matches.forEach(flag => onFlagFound(flag));
      }
    }
  }, [onFlagFound]);

  const executeCommand = async (command: string) => {
    const trimmedCmd = command.trim();
    if (!trimmedCmd) return;

    // Add to history
    setCommandHistory(prev => [...prev.filter(c => c !== trimmedCmd), trimmedCmd].slice(-50));
    setHistoryIndex(-1);
    setShowAutocomplete(false);

    // Echo command
    addLine('command', `$ ${trimmedCmd}`);

    // Handle built-in commands
    if (trimmedCmd === 'help') {
      addLine('info', `📚 Available commands:

  help              Show this help message
  ls                List files in workspace
  clear             Clear terminal
  tools             List allowed sandbox tools
  history           Show command history
  <tool> <args>     Run a sandbox tool

⚡ Quick examples:
  file *            Identify all file types
  strings -n 8 *    Find strings >= 8 chars
  xxd -l 256 *      Hex dump first 256 bytes
  checksec --file * Check binary protections
  binwalk -e *      Extract embedded files
  zsteg *           Check PNG for hidden data
  grep -i flag *    Search for flags

💡 Tips:
  • Tab        Autocomplete commands/files
  • ↑/↓        Navigate command history
  • *          Wildcard for all files`);
      return;
    }

    if (trimmedCmd === 'clear') {
      setLines([]);
      return;
    }

    if (trimmedCmd === 'history') {
      addLine('info', commandHistory.length > 0 
        ? commandHistory.map((c, i) => `${i + 1}. ${c}`).join('\n')
        : '(no history)');
      return;
    }

    if (trimmedCmd === 'tools') {
      let output = '🛠️ Available sandbox tools:\n\n';
      Object.entries(TOOL_CATEGORIES).forEach(([category, tools]) => {
        output += `[${category}]\n`;
        tools.forEach(tool => {
          output += `  ${tool.name.padEnd(20)} ${tool.desc}\n`;
        });
        output += '\n';
      });
      addLine('info', output);
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
        addLine('info', `✓ Command completed (exit code ${result.exit_code})`);
      }
    } catch (err) {
      addLine('error', `❌ ${err instanceof Error ? err.message : 'Command failed'}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const applyAutocomplete = (suggestion: string) => {
    const parts = input.split(/\s+/);
    parts[parts.length - 1] = suggestion;
    setInput(parts.join(' ') + ' ');
    setShowAutocomplete(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isExecuting) {
      if (showAutocomplete && autocompleteSuggestions.length > 0) {
        e.preventDefault();
        applyAutocomplete(autocompleteSuggestions[autocompleteIndex]);
      } else {
        executeCommand(input);
        setInput('');
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (showAutocomplete) {
        setAutocompleteIndex(i => Math.max(0, i - 1));
      } else if (commandHistory.length > 0) {
        const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (showAutocomplete) {
        setAutocompleteIndex(i => Math.min(autocompleteSuggestions.length - 1, i + 1));
      } else if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
      } else {
        setHistoryIndex(-1);
        setInput('');
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (autocompleteSuggestions.length > 0) {
        applyAutocomplete(autocompleteSuggestions[autocompleteIndex]);
      } else {
        updateAutocomplete(input);
      }
    } else if (e.key === 'Escape') {
      setShowAutocomplete(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);
    updateAutocomplete(value);
  };

  const handleToolClick = (tool: { name: string; example: string }) => {
    const fileArg = files.length > 0 ? files[0] : '<file>';
    setInput(`${tool.example} ${fileArg}`);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-[600px] bg-zinc-950 rounded-lg border border-zinc-800 overflow-hidden font-mono">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <Terminal className="h-4 w-4 text-green-400 ml-2" />
          <span className="text-sm text-zinc-400">Sandbox Terminal</span>
          <Badge variant="outline" className="text-xs bg-zinc-800 border-zinc-700 text-zinc-400">
            {files.length} files
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-zinc-200">
                <Lightbulb className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 bg-zinc-900 border-zinc-700" align="end">
              <div className="space-y-3">
                <h4 className="font-medium text-zinc-200">Quick Tools</h4>
                {Object.entries(TOOL_CATEGORIES).map(([category, tools]) => (
                  <div key={category}>
                    <p className="text-xs text-zinc-500 mb-1.5 uppercase tracking-wider">{category}</p>
                    <div className="flex flex-wrap gap-1">
                      {tools.slice(0, 5).map((tool) => (
                        <Badge
                          key={tool.name}
                          variant="secondary"
                          className="cursor-pointer bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs border-0"
                          onClick={() => handleToolClick(tool)}
                          title={tool.desc}
                        >
                          {tool.name}
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
            className="h-7 w-7 text-zinc-400 hover:text-zinc-200"
            onClick={() => setLines([])}
            title="Clear terminal"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Terminal Output */}
      <ScrollArea className="flex-1 p-4 bg-zinc-950" ref={scrollRef}>
        <div className="text-sm space-y-1">
          {lines.map((line) => (
            <div
              key={line.id}
              className={cn(
                "whitespace-pre-wrap break-all leading-relaxed",
                line.type === 'command' && "text-green-400 font-semibold",
                line.type === 'stdout' && "text-zinc-300",
                line.type === 'stderr' && "text-yellow-400",
                line.type === 'info' && "text-zinc-500",
                line.type === 'error' && "text-red-400",
                line.type === 'flag' && "text-green-400 font-bold bg-green-500/20 px-2 py-1 rounded",
              )}
            >
              {highlightOutput(line.content, line.type)}
            </div>
          ))}
          {isExecuting && (
            <div className="flex items-center gap-2 text-zinc-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Executing...</span>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="relative px-4 py-3 bg-zinc-900/50 border-t border-zinc-800">
        <AutocompleteDropdown
          suggestions={autocompleteSuggestions}
          onSelect={applyAutocomplete}
          visible={showAutocomplete}
          selectedIndex={autocompleteIndex}
        />
        <div className="flex items-center gap-2">
          <span className="text-green-400 font-bold">❯</span>
          <Input
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(() => setShowAutocomplete(false), 200)}
            onFocus={() => input && updateAutocomplete(input)}
            placeholder={isExecuting ? "Executing..." : "Enter command... (Tab for autocomplete)"}
            disabled={isExecuting}
            className="flex-1 bg-transparent border-0 focus-visible:ring-0 text-zinc-200 text-sm h-8 px-0 placeholder:text-zinc-600"
          />
          <Button
            size="sm"
            variant="ghost"
            disabled={isExecuting || !input.trim()}
            onClick={() => {
              executeCommand(input);
              setInput('');
            }}
            className="text-zinc-400 hover:text-green-400"
          >
            {isExecuting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
