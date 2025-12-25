import { useState, useRef, useCallback, useEffect } from 'react';
import { Wifi, WifiOff, Send, Play, Square, Terminal, Sparkles, Copy, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getSupabaseClient } from '@/integrations/supabase/safe-client';
import { getBackendUrlHeaders } from '@/lib/backend-url';

interface NetcatLine {
  id: string;
  type: 'sent' | 'received' | 'system' | 'flag';
  content: string;
  timestamp: Date;
}

interface NetcatPanelProps {
  jobId: string;
  onFlagFound?: (flag: string) => void;
  onGenerateSolveScript?: (host: string, port: string, interactions: string[]) => void;
}

export function NetcatPanel({ jobId, onFlagFound, onGenerateSolveScript }: NetcatPanelProps) {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lines, setLines] = useState<NetcatLine[]>([]);
  const [input, setInput] = useState('');
  const [interactions, setInteractions] = useState<string[]>([]);
  const [solveScript, setSolveScript] = useState('');
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load saved netcat config for this job
  useEffect(() => {
    const saved = localStorage.getItem(`job-${jobId}-netcat`);
    if (saved) {
      try {
        const { host: savedHost, port: savedPort } = JSON.parse(saved);
        if (savedHost) setHost(savedHost);
        if (savedPort) setPort(savedPort);
      } catch {}
    }
  }, [jobId]);

  const addLine = useCallback((type: NetcatLine['type'], content: string) => {
    setLines(prev => [...prev, {
      id: `${Date.now()}-${Math.random()}`,
      type,
      content,
      timestamp: new Date(),
    }]);

    // Check for flags
    if (content && onFlagFound) {
      const flagPattern = /(flag\{[^}]+\}|CTF\{[^}]+\}|[A-Z]{3,5}\{[^}]+\})/gi;
      const matches = content.match(flagPattern);
      if (matches) {
        matches.forEach(flag => onFlagFound(flag));
      }
    }
  }, [onFlagFound]);

  const handleConnect = async () => {
    if (!host || !port) {
      toast.error('Please enter host and port');
      return;
    }

    setIsConnecting(true);
    addLine('system', `Connecting to ${host}:${port}...`);

    const supabase = await getSupabaseClient();
    if (!supabase) {
      addLine('system', 'Cloud mode is not configured in this deployment.');
      toast.error('Cloud mode not configured');
      setIsConnecting(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('sandbox-terminal', {
        body: {
          job_id: jobId,
          tool: 'nc',
          args: [host, port],
        },
        headers: getBackendUrlHeaders(),
      });

      if (error) throw error;

      setIsConnected(true);
      addLine('system', `Connected to ${host}:${port}`);
      
      if (data.stdout) {
        data.stdout.split('\n').forEach((line: string) => {
          if (line.trim()) {
            const isFlag = /flag\{|CTF\{/i.test(line);
            addLine(isFlag ? 'flag' : 'received', line);
          }
        });
      }

      toast.success(`Connected to ${host}:${port}`);
      inputRef.current?.focus();
    } catch (err) {
      addLine('system', `Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      toast.error('Connection failed');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    addLine('system', 'Disconnected');
    toast.info('Disconnected');
  };

  const handleSend = async () => {
    if (!input.trim() || !isConnected) return;

    const message = input.trim();
    setInput('');
    addLine('sent', `> ${message}`);
    setInteractions(prev => [...prev, message]);

    try {
      const supabase = await getSupabaseClient();
      if (!supabase) {
        throw new Error('Cloud mode not configured');
      }

      // Get backend URL from localStorage
      const backendUrl = localStorage.getItem('ctf_backend_url');
      const headers = backendUrl ? { 'x-backend-url': backendUrl } : undefined;

      const { data, error } = await supabase.functions.invoke('sandbox-terminal', {
        body: {
          job_id: jobId,
          tool: 'nc_interact',
          args: [host, port],
          payload: message,
          interaction_script: [...interactions, message],
        },
        headers,
      });

      if (error) throw error;

      if (data.stdout) {
        data.stdout.split('\n').forEach((line: string) => {
          if (line.trim() && !line.startsWith('>')) {
            const isFlag = /flag\{|CTF\{/i.test(line);
            addLine(isFlag ? 'flag' : 'received', line);
          }
        });
      }
    } catch (err) {
      addLine('system', `Error: ${err instanceof Error ? err.message : 'Send failed'}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleGenerateSolveScript = async () => {
    if (!host || !port) {
      toast.error('Connect to a server first');
      return;
    }

    setIsGeneratingScript(true);

    try {
      const supabase = await getSupabaseClient();
      if (!supabase) {
        throw new Error('Cloud mode not configured');
      }

      const { data, error } = await supabase.functions.invoke('ai-solve-script', {
        body: {
          host,
          port,
          interactions,
          interaction_log: lines.map(l => `[${l.type}] ${l.content}`).join('\n'),
          job_id: jobId,
        }
      });

      if (error) throw error;

      setSolveScript(data.script || '# No script generated');
      toast.success('Solve script generated!');
      
      if (onGenerateSolveScript) {
        onGenerateSolveScript(host, port, interactions);
      }
    } catch (err) {
      // Fallback to basic template
      const fallbackScript = generateFallbackScript(host, port, interactions);
      setSolveScript(fallbackScript);
      toast.info('Generated basic solve script template');
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const generateFallbackScript = (host: string, port: string, interactions: string[]) => {
    return `#!/usr/bin/env python3
"""
CTF Netcat Solve Script
Auto-generated from CTF Autopilot
Target: ${host}:${port}
"""
from pwn import *

# Connection settings
HOST = "${host}"
PORT = ${port}

def solve():
    # Connect to the server
    r = remote(HOST, PORT)
    
    # Receive initial banner
    print(r.recvuntil(b":"))
    
${interactions.map((cmd, i) => `    # Interaction ${i + 1}
    r.sendline(b"${cmd}")
    response = r.recvline()
    print(f"Response: {response}")
`).join('\n')}
    
    # Try to receive flag
    try:
        flag = r.recvall(timeout=2)
        print(f"Flag: {flag}")
    except:
        pass
    
    r.close()

if __name__ == "__main__":
    solve()
`;
  };

  const handleCopyScript = async () => {
    await navigator.clipboard.writeText(solveScript);
    setCopied(true);
    toast.success('Script copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Terminal className="h-5 w-5 text-primary" />
          Netcat Terminal
          {isConnected ? (
            <Badge variant="default" className="ml-auto bg-success/20 text-success border-success/30">
              <Wifi className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          ) : (
            <Badge variant="secondary" className="ml-auto">
              <WifiOff className="h-3 w-3 mr-1" />
              Disconnected
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Form */}
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Label htmlFor="nc-host" className="text-xs text-muted-foreground">Host</Label>
            <Input
              id="nc-host"
              placeholder="pwn.example.com"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              disabled={isConnected}
              className="bg-background/50"
            />
          </div>
          <div className="w-24">
            <Label htmlFor="nc-port" className="text-xs text-muted-foreground">Port</Label>
            <Input
              id="nc-port"
              placeholder="9999"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              disabled={isConnected}
              className="bg-background/50"
            />
          </div>
          {isConnected ? (
            <Button variant="destructive" size="sm" onClick={handleDisconnect}>
              <Square className="h-4 w-4 mr-1" />
              Disconnect
            </Button>
          ) : (
            <Button onClick={handleConnect} disabled={isConnecting} size="sm">
              {isConnecting ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-1" />
              )}
              Connect
            </Button>
          )}
        </div>

        <Tabs defaultValue="terminal" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="terminal">Terminal</TabsTrigger>
            <TabsTrigger value="script">Solve Script</TabsTrigger>
          </TabsList>

          <TabsContent value="terminal" className="mt-3">
            {/* Terminal Output */}
            <div className="bg-zinc-950 rounded-lg border border-zinc-800 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border-b border-zinc-800">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                </div>
                <span className="text-xs text-zinc-500 font-mono">
                  nc {host || 'host'}:{port || 'port'}
                </span>
              </div>
              
              <ScrollArea className="h-64 p-3" ref={scrollRef}>
                <div className="text-sm font-mono space-y-1">
                  {lines.length === 0 && (
                    <p className="text-zinc-500">Enter host:port and click Connect to start...</p>
                  )}
                  {lines.map((line) => (
                    <div
                      key={line.id}
                      className={cn(
                        "whitespace-pre-wrap break-all",
                        line.type === 'sent' && "text-cyan-400",
                        line.type === 'received' && "text-zinc-300",
                        line.type === 'system' && "text-zinc-500 italic",
                        line.type === 'flag' && "text-green-400 font-bold bg-green-500/20 px-2 py-0.5 rounded",
                      )}
                    >
                      {line.content}
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="flex gap-2 p-2 bg-zinc-900/50 border-t border-zinc-800">
                <Input
                  ref={inputRef}
                  placeholder={isConnected ? "Type message and press Enter..." : "Connect first..."}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={!isConnected}
                  className="flex-1 bg-zinc-950 border-zinc-700 font-mono text-sm"
                />
                <Button 
                  size="sm" 
                  onClick={handleSend} 
                  disabled={!isConnected || !input.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="script" className="mt-3 space-y-3">
            <div className="flex gap-2">
              <Button 
                onClick={handleGenerateSolveScript} 
                disabled={isGeneratingScript}
                className="flex-1"
              >
                {isGeneratingScript ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Generate AI Solve Script
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyScript}
                disabled={!solveScript}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>

            <Textarea
              value={solveScript}
              onChange={(e) => setSolveScript(e.target.value)}
              placeholder="Click 'Generate AI Solve Script' to create a pwntools script based on your interactions..."
              className="h-64 font-mono text-xs bg-zinc-950 border-zinc-800"
            />

            {interactions.length > 0 && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Recorded interactions:</span>{' '}
                {interactions.slice(0, 3).join(', ')}
                {interactions.length > 3 && ` +${interactions.length - 3} more`}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
