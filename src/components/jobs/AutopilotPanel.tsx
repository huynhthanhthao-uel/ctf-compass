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
  Zap,
  Cpu,
  Lightbulb,
  Target
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { detectFlags } from '@/lib/ctf-tools';
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

interface AIInsight {
  analysis: string;
  category: string;
  confidence: number;
  findings: string[];
  isRuleBased: boolean;
}

interface AutopilotPanelProps {
  jobId: string;
  files: string[];
  description?: string;
  expectedFormat?: string;
  onFlagFound?: (flag: string) => void;
}

export function AutopilotPanel({ 
  jobId, 
  files, 
  description = "",
  expectedFormat = "CTF{...}",
  onFlagFound 
}: AutopilotPanelProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [steps, setSteps] = useState<AnalysisStep[]>([]);
  const [foundFlags, setFoundFlags] = useState<string[]>([]);
  const [analysisPhase, setAnalysisPhase] = useState<string>('idle');
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [maxAttempts] = useState(100); // Increased for AI-driven analysis
  const [aiInsight, setAiInsight] = useState<AIInsight | null>(null);
  const [detectedCategory, setDetectedCategory] = useState<string>('unknown');
  
  const abortRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const commandHistoryRef = useRef<api.CommandOutput[]>([]);

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

  // Execute a command in sandbox
  const executeCommand = useCallback(async (
    tool: string,
    args: string[]
  ): Promise<{ output: string; flags: string[]; error?: string; exitCode: number }> => {
    try {
      const result = await api.executeTerminalCommand(jobId, tool, args);
      const output = result.stdout || '';
      const error = result.stderr || result.error;
      
      // Detect flags in output
      const flags = detectFlags(output);
      
      // Store in history for AI context
      commandHistoryRef.current.push({
        tool,
        args,
        stdout: output,
        stderr: error || '',
        exit_code: result.exit_code,
      });
      
      // Keep last 20 commands for context
      if (commandHistoryRef.current.length > 20) {
        commandHistoryRef.current = commandHistoryRef.current.slice(-20);
      }
      
      return { output, flags, error, exitCode: result.exit_code };
    } catch (err) {
      return { 
        output: '', 
        flags: [], 
        error: err instanceof Error ? err.message : 'Command failed',
        exitCode: -1,
      };
    }
  }, [jobId]);

  // Initial reconnaissance to detect category
  const runReconnaissance = useCallback(async (): Promise<{
    category: string;
    confidence: number;
    fileOutputs: Record<string, string>;
    stringsOutputs: Record<string, string>;
  }> => {
    const fileOutputs: Record<string, string> = {};
    const stringsOutputs: Record<string, string> = {};
    
    setAnalysisPhase('🔍 Running initial reconnaissance...');
    
    for (const file of files.slice(0, 5)) { // Limit to first 5 files
      if (abortRef.current) break;
      
      // Run file command
      const stepId = addStep({
        command: `file ${file}`,
        status: 'running',
        aiAnalysis: 'Identifying file type',
      });
      
      const fileResult = await executeCommand('file', [file]);
      fileOutputs[file] = fileResult.output;
      
      updateStep(stepId, {
        status: fileResult.error && !fileResult.output ? 'failed' : 'success',
        output: fileResult.output,
        error: fileResult.error,
      });
      
      // Run strings command
      const stringsStepId = addStep({
        command: `strings -n 8 ${file}`,
        status: 'running',
        aiAnalysis: 'Extracting readable strings',
      });
      
      const stringsResult = await executeCommand('strings', ['-n', '8', file]);
      stringsOutputs[file] = stringsResult.output;
      
      // Check for flags in strings
      if (stringsResult.flags.length > 0) {
        setFoundFlags(prev => [...new Set([...prev, ...stringsResult.flags])]);
        stringsResult.flags.forEach(flag => onFlagFound?.(flag));
      }
      
      updateStep(stringsStepId, {
        status: stringsResult.error && !stringsResult.output ? 'failed' : 'success',
        output: stringsResult.output,
        error: stringsResult.error,
        flagsFound: stringsResult.flags,
      });
    }
    
    // Detect category using AI
    setAnalysisPhase('🧠 AI analyzing file types...');
    try {
      const categoryResult = await api.detectCategory(files, fileOutputs, stringsOutputs);
      return {
        category: categoryResult.category,
        confidence: categoryResult.confidence,
        fileOutputs,
        stringsOutputs,
      };
    } catch {
      // Fallback detection
      return {
        category: 'misc',
        confidence: 0.3,
        fileOutputs,
        stringsOutputs,
      };
    }
  }, [files, addStep, updateStep, executeCommand, onFlagFound]);

  // Get AI suggestions for next commands
  const getAISuggestions = useCallback(async (
    attemptNumber: number,
    currentCategory: string
  ): Promise<api.AIAnalysisResponse | null> => {
    try {
      const response = await api.analyzeWithAI(
        jobId,
        files,
        commandHistoryRef.current,
        description,
        expectedFormat,
        currentCategory,
        attemptNumber
      );
      
      // Update AI insight display
      setAiInsight({
        analysis: response.analysis,
        category: response.category,
        confidence: response.confidence,
        findings: response.findings,
        isRuleBased: response.rule_based,
      });
      
      // Check for AI-found flag candidates
      if (response.flag_candidates.length > 0) {
        setFoundFlags(prev => [...new Set([...prev, ...response.flag_candidates])]);
        response.flag_candidates.forEach(flag => onFlagFound?.(flag));
      }
      
      return response;
    } catch (err) {
      console.error('AI analysis failed:', err);
      return null;
    }
  }, [jobId, files, description, expectedFormat, onFlagFound]);

  // Main autopilot loop with AI integration
  const runAutopilot = useCallback(async () => {
    setIsRunning(true);
    setIsPaused(false);
    abortRef.current = false;
    commandHistoryRef.current = [];
    
    // Phase 1: Reconnaissance
    setAnalysisPhase('Phase 1: Reconnaissance');
    const recon = await runReconnaissance();
    
    if (abortRef.current) {
      setIsRunning(false);
      return;
    }
    
    setDetectedCategory(recon.category);
    
    // Check if we already found flags
    if (foundFlags.length > 0) {
      setAnalysisPhase(`🎉 FLAG FOUND during reconnaissance!`);
      setIsRunning(false);
      return;
    }
    
    // Phase 2: AI-Driven Analysis Loop
    setAnalysisPhase(`Phase 2: AI Analysis (${recon.category} detected)`);
    
    let attempts = 0;
    let currentCategory = recon.category;
    let localFoundFlags: string[] = [];
    
    while (!abortRef.current && attempts < maxAttempts && localFoundFlags.length === 0) {
      // Check if paused
      while (isPaused && !abortRef.current) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (abortRef.current) break;
      
      setTotalAttempts(attempts + 1);
      setAnalysisPhase(`🧠 AI analyzing... (attempt ${attempts + 1})`);
      
      // Get AI suggestions
      const aiResponse = await getAISuggestions(attempts + 1, currentCategory);
      
      if (!aiResponse) {
        setAnalysisPhase('AI unavailable, using fallback strategies');
        attempts++;
        continue;
      }
      
      // Update category if AI detected different
      if (aiResponse.category !== 'unknown') {
        currentCategory = aiResponse.category;
        setDetectedCategory(currentCategory);
      }
      
      // Check if AI says to stop
      if (!aiResponse.should_continue && aiResponse.flag_candidates.length === 0) {
        setAnalysisPhase('AI recommends stopping - no more strategies');
        break;
      }
      
      // Execute AI-suggested commands
      const commands = aiResponse.next_commands;
      
      if (commands.length === 0) {
        setAnalysisPhase('No more commands to try');
        break;
      }
      
      for (const cmd of commands) {
        if (abortRef.current || localFoundFlags.length > 0) break;
        
        const commandStr = `${cmd.tool} ${cmd.args.join(' ')}`;
        setAnalysisPhase(`💻 ${cmd.reason}`);
        
        const stepId = addStep({
          command: commandStr,
          status: 'running',
          aiAnalysis: cmd.reason,
        });
        
        const startTime = Date.now();
        const result = await executeCommand(cmd.tool, cmd.args);
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
          
          result.flags.forEach(flag => onFlagFound?.(flag));
          setAnalysisPhase(`🎉 FLAG FOUND: ${result.flags.join(', ')}`);
          break;
        }
        
        updateStep(stepId, {
          status: result.error && !result.output ? 'failed' : 'success',
          output: result.output,
          error: result.error,
          duration,
        });
        
        // Small delay between commands
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      attempts++;
      
      // Pause between AI iterations
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    if (localFoundFlags.length === 0 && !abortRef.current) {
      setAnalysisPhase('Analysis complete - try manual investigation');
    }
    
    setIsRunning(false);
  }, [files, isPaused, maxAttempts, foundFlags.length, addStep, updateStep, executeCommand, onFlagFound, runReconnaissance, getAISuggestions]);

  const handlePause = () => setIsPaused(true);
  const handleResume = () => setIsPaused(false);
  
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
    setAiInsight(null);
    setDetectedCategory('unknown');
    commandHistoryRef.current = [];
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
              {detectedCategory !== 'unknown' && (
                <Badge variant="outline" className="capitalize">
                  <Target className="h-3 w-3 mr-1" />
                  {detectedCategory}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!isRunning ? (
                <Button onClick={runAutopilot} disabled={files.length === 0}>
                  <Zap className="h-4 w-4 mr-2" />
                  Start AI Analysis
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
          
          {/* AI Insight Panel */}
          {aiInsight && (
            <div className="mt-4 p-3 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-2 mb-2">
                <Cpu className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">
                  AI Analysis {aiInsight.isRuleBased && <Badge variant="outline" className="ml-2 text-xs">Rule-based</Badge>}
                </span>
                <Badge variant="secondary" className="ml-auto text-xs">
                  {Math.round(aiInsight.confidence * 100)}% confident
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-2">{aiInsight.analysis}</p>
              {aiInsight.findings.length > 0 && (
                <div className="mt-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                    <Lightbulb className="h-3 w-3" />
                    Findings:
                  </div>
                  <ul className="text-xs space-y-1">
                    {aiInsight.findings.slice(0, 3).map((finding, i) => (
                      <li key={i} className="text-muted-foreground">• {finding}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          
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
                          <div className="text-xs text-muted-foreground italic flex items-center gap-1">
                            <Brain className="h-3 w-3" />
                            {step.aiAnalysis}
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
                          <div className="text-xs text-warning bg-warning/10 p-2 rounded">
                            {step.error}
                          </div>
                        )}
                        
                        {step.flagsFound?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {step.flagsFound.map((flag, i) => (
                              <Badge key={i} className="bg-success font-mono text-xs">
                                {flag}
                              </Badge>
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
