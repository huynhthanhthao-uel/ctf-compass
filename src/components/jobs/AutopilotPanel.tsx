import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Brain, 
  Terminal, 
  Flag, 
  AlertTriangle,
  CheckCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { getMultiFileSuggestions, detectFlags, getFileCategory } from '@/lib/ctf-tools';
import * as api from '@/lib/api';

interface AnalysisStep {
  id: string;
  command: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  output?: string;
  error?: string;
  flagsFound?: string[];
  duration?: number;
  aiAnalysis?: string;
  nextSteps?: string[];
}

interface AutopilotPanelProps {
  jobId: string;
  files: string[];
  expectedFormat?: string;
  onFlagFound?: (flag: string) => void;
}

export function AutopilotPanel({ 
  jobId, 
  files, 
  expectedFormat,
  onFlagFound 
}: AutopilotPanelProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [steps, setSteps] = useState<AnalysisStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [foundFlags, setFoundFlags] = useState<string[]>([]);
  const [analysisPhase, setAnalysisPhase] = useState<string>('idle');
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [maxAttempts] = useState(50); // Safety limit
  
  const abortRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest step
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [steps]);

  const addStep = useCallback((step: Omit<AnalysisStep, 'id'>) => {
    const newStep: AnalysisStep = {
      ...step,
      id: `step-${Date.now()}-${Math.random()}`,
    };
    setSteps(prev => [...prev, newStep]);
    setExpandedSteps(prev => new Set([...prev, newStep.id]));
    return newStep.id;
  }, []);

  const updateStep = useCallback((id: string, updates: Partial<AnalysisStep>) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, []);

  // Execute a command and analyze results
  const executeAndAnalyze = useCallback(async (
    command: string,
    tool: string,
    args: string[]
  ): Promise<{ output: string; flags: string[]; error?: string }> => {
    try {
      const result = await api.executeTerminalCommand(jobId, tool, args);
      const output = result.stdout || '';
      const error = result.stderr || result.error;
      
      // Detect flags in output
      const flags = detectFlags(output);
      
      return { output, flags, error };
    } catch (err) {
      return { 
        output: '', 
        flags: [], 
        error: err instanceof Error ? err.message : 'Command failed' 
      };
    }
  }, [jobId]);

  // Generate next commands based on file analysis and previous results
  const generateNextCommands = useCallback((
    fileCategories: Record<string, string[]>,
    previousOutputs: string[],
    attemptCount: number
  ): { tool: string; args: string[]; reason: string }[] => {
    const commands: { tool: string; args: string[]; reason: string }[] = [];
    
    // Phase 1: Initial reconnaissance (attempts 0-5)
    if (attemptCount < 5) {
      // Basic file analysis
      files.forEach(file => {
        if (attemptCount === 0) {
          commands.push({ tool: 'file', args: [file], reason: 'Identify file type' });
        }
      });
      
      // Strings extraction
      if (attemptCount === 1) {
        files.forEach(file => {
          commands.push({ tool: 'strings', args: ['-n', '8', file], reason: 'Extract readable strings' });
        });
      }
      
      // Hex dump
      if (attemptCount === 2) {
        files.forEach(file => {
          commands.push({ tool: 'xxd', args: ['-l', '512', file], reason: 'Check file header and structure' });
        });
      }
      
      // Metadata
      if (attemptCount === 3) {
        files.forEach(file => {
          commands.push({ tool: 'exiftool', args: ['-a', '-u', file], reason: 'Extract metadata' });
        });
      }
      
      // Binwalk scan
      if (attemptCount === 4) {
        files.forEach(file => {
          commands.push({ tool: 'binwalk', args: [file], reason: 'Scan for embedded files' });
        });
      }
    }
    
    // Phase 2: Category-specific analysis (attempts 5-20)
    else if (attemptCount < 20) {
      for (const [category, categoryFiles] of Object.entries(fileCategories)) {
        const suggestions = getMultiFileSuggestions(categoryFiles);
        const stepIndex = attemptCount - 5;
        
        if (stepIndex < suggestions.length) {
          const suggestion = suggestions[stepIndex];
          commands.push({
            tool: suggestion.tool,
            args: suggestion.args,
            reason: suggestion.description,
          });
        }
      }
    }
    
    // Phase 3: Deep analysis and extraction (attempts 20-35)
    else if (attemptCount < 35) {
      // Try extraction tools
      const extractionCommands = [
        { tool: 'binwalk', args: ['-e', '-M', files[0]], reason: 'Deep recursive extraction' },
        { tool: 'foremost', args: ['-v', '-i', files[0]], reason: 'File carving' },
        { tool: 'steghide', args: ['extract', '-sf', files[0], '-p', ''], reason: 'Steghide with empty password' },
        { tool: 'zsteg', args: ['-a', files[0]], reason: 'LSB analysis' },
        { tool: 'strings', args: ['-e', 'l', files[0]], reason: 'Unicode strings (little-endian)' },
        { tool: 'strings', args: ['-e', 'b', files[0]], reason: 'Unicode strings (big-endian)' },
      ];
      
      const idx = attemptCount - 20;
      if (idx < extractionCommands.length) {
        commands.push(extractionCommands[idx]);
      }
    }
    
    // Phase 4: Encoding/Decoding attempts (attempts 35-50)
    else {
      const decodingCommands = [
        { tool: 'base64', args: ['-d', files[0]], reason: 'Base64 decode' },
        { tool: 'base32', args: ['-d', files[0]], reason: 'Base32 decode' },
        { tool: 'xxd', args: ['-r', '-p', files[0]], reason: 'Hex decode' },
        { tool: 'grep', args: ['-aoE', '[A-Z]+\\{[^}]+\\}', files[0]], reason: 'Grep for flag pattern' },
      ];
      
      const idx = attemptCount - 35;
      if (idx < decodingCommands.length) {
        commands.push(decodingCommands[idx]);
      }
    }
    
    return commands;
  }, [files]);

  // Main autopilot loop
  const runAutopilot = useCallback(async () => {
    setIsRunning(true);
    setIsPaused(false);
    abortRef.current = false;
    setAnalysisPhase('Starting analysis...');
    
    // Group files by category
    const fileCategories: Record<string, string[]> = {};
    files.forEach(file => {
      const cat = getFileCategory(file);
      if (!fileCategories[cat]) fileCategories[cat] = [];
      fileCategories[cat].push(file);
    });
    
    const previousOutputs: string[] = [];
    let localFoundFlags: string[] = [];
    let attempts = 0;
    
    while (!abortRef.current && attempts < maxAttempts && localFoundFlags.length === 0) {
      // Check if paused
      if (isPaused) {
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }
      
      setTotalAttempts(attempts + 1);
      
      // Get next commands to try
      const nextCommands = generateNextCommands(fileCategories, previousOutputs, attempts);
      
      if (nextCommands.length === 0) {
        setAnalysisPhase('No more strategies to try');
        break;
      }
      
      // Execute each command
      for (const cmd of nextCommands) {
        if (abortRef.current || localFoundFlags.length > 0) break;
        
        const commandStr = `${cmd.tool} ${cmd.args.join(' ')}`;
        setAnalysisPhase(`Trying: ${cmd.reason}`);
        
        const stepId = addStep({
          command: commandStr,
          status: 'running',
          aiAnalysis: cmd.reason,
        });
        
        const startTime = Date.now();
        const result = await executeAndAnalyze(commandStr, cmd.tool, cmd.args);
        const duration = Date.now() - startTime;
        
        // Check for flags
        if (result.flags.length > 0) {
          localFoundFlags = [...localFoundFlags, ...result.flags];
          setFoundFlags(prev => [...new Set([...prev, ...result.flags])]);
          
          updateStep(stepId, {
            status: 'success',
            output: result.output,
            error: result.error,
            flagsFound: result.flags,
            duration,
          });
          
          result.flags.forEach(flag => {
            onFlagFound?.(flag);
          });
          
          setAnalysisPhase(`🎉 FLAG FOUND: ${result.flags.join(', ')}`);
          break;
        }
        
        // Update step
        updateStep(stepId, {
          status: result.error && !result.output ? 'failed' : 'success',
          output: result.output,
          error: result.error,
          duration,
        });
        
        // Store output for context
        if (result.output) {
          previousOutputs.push(result.output.slice(0, 1000));
        }
        
        // Small delay between commands
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      attempts++;
    }
    
    if (localFoundFlags.length === 0 && !abortRef.current) {
      setAnalysisPhase('Analysis complete - no flags found automatically. Try manual analysis.');
    }
    
    setIsRunning(false);
  }, [files, isPaused, maxAttempts, addStep, updateStep, executeAndAnalyze, generateNextCommands, onFlagFound]);

  const handlePause = () => {
    setIsPaused(true);
  };

  const handleResume = () => {
    setIsPaused(false);
  };

  const handleStop = () => {
    abortRef.current = true;
    setIsRunning(false);
    setIsPaused(false);
    setAnalysisPhase('Stopped');
  };

  const handleReset = () => {
    setSteps([]);
    setFoundFlags([]);
    setTotalAttempts(0);
    setAnalysisPhase('idle');
  };

  const toggleStep = (id: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Control Panel */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">AI Autopilot</CardTitle>
              {isRunning && (
                <Badge variant="secondary" className="animate-pulse">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Running
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!isRunning ? (
                <Button onClick={runAutopilot} disabled={files.length === 0}>
                  <Zap className="h-4 w-4 mr-2" />
                  Start Autopilot
                </Button>
              ) : (
                <>
                  {isPaused ? (
                    <Button variant="outline" onClick={handleResume}>
                      <Play className="h-4 w-4 mr-2" />
                      Resume
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={handlePause}>
                      <Pause className="h-4 w-4 mr-2" />
                      Pause
                    </Button>
                  )}
                  <Button variant="destructive" onClick={handleStop}>
                    Stop
                  </Button>
                </>
              )}
              <Button variant="ghost" size="icon" onClick={handleReset} disabled={isRunning}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{analysisPhase}</span>
              <span className="font-medium">{totalAttempts}/{maxAttempts} attempts</span>
            </div>
            <Progress value={(totalAttempts / maxAttempts) * 100} className="h-2" />
          </div>
          
          {/* Found Flags */}
          {foundFlags.length > 0 && (
            <div className="mt-4 p-3 rounded-lg bg-success/10 border border-success/30">
              <div className="flex items-center gap-2 text-success font-medium mb-2">
                <Flag className="h-4 w-4" />
                Flags Found!
              </div>
              <div className="space-y-1">
                {foundFlags.map((flag, i) => (
                  <code key={i} className="block px-2 py-1 bg-success/20 rounded font-mono text-sm">
                    {flag}
                  </code>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Steps */}
      {steps.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Terminal className="h-4 w-4" />
              Analysis Steps ({steps.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]" ref={scrollRef}>
              <div className="space-y-2 pr-4">
                {steps.map((step, index) => (
                  <Collapsible
                    key={step.id}
                    open={expandedSteps.has(step.id)}
                    onOpenChange={() => toggleStep(step.id)}
                  >
                    <CollapsibleTrigger className="w-full">
                      <div className={cn(
                        "flex items-center gap-3 p-3 rounded-lg transition-colors text-left",
                        "hover:bg-muted/50 cursor-pointer",
                        expandedSteps.has(step.id) && "bg-muted/50"
                      )}>
                        {expandedSteps.has(step.id) ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        
                        <span className="text-xs text-muted-foreground w-6">
                          #{index + 1}
                        </span>
                        
                        {step.status === 'running' && (
                          <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                        )}
                        {step.status === 'success' && !step.flagsFound?.length && (
                          <CheckCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        {step.status === 'success' && step.flagsFound?.length && (
                          <Sparkles className="h-4 w-4 text-success shrink-0" />
                        )}
                        {step.status === 'failed' && (
                          <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                        )}
                        
                        <code className="text-sm font-mono text-foreground/80 truncate flex-1">
                          {step.command}
                        </code>
                        
                        {step.duration && (
                          <span className="text-xs text-muted-foreground shrink-0">
                            {step.duration}ms
                          </span>
                        )}
                        
                        {step.flagsFound?.length ? (
                          <Badge variant="default" className="bg-success shrink-0">
                            <Flag className="h-3 w-3 mr-1" />
                            Flag!
                          </Badge>
                        ) : null}
                      </div>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                      <div className="ml-10 mr-2 mb-2 space-y-2">
                        {step.aiAnalysis && (
                          <div className="text-xs text-muted-foreground italic">
                            💡 {step.aiAnalysis}
                          </div>
                        )}
                        
                        {step.output && (
                          <div className="rounded-lg overflow-hidden">
                            <pre className="bg-terminal-bg p-3 text-xs font-mono text-foreground/90 overflow-x-auto whitespace-pre-wrap max-h-48">
                              {step.output.slice(0, 2000)}
                              {step.output.length > 2000 && '\n... (truncated)'}
                            </pre>
                          </div>
                        )}
                        
                        {step.error && (
                          <div className="text-xs text-warning bg-warning/10 rounded p-2">
                            {step.error}
                          </div>
                        )}
                        
                        {step.flagsFound?.length ? (
                          <div className="space-y-1">
                            {step.flagsFound.map((flag, i) => (
                              <code key={i} className="block px-2 py-1 bg-success/20 text-success rounded font-mono text-sm">
                                🚩 {flag}
                              </code>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
