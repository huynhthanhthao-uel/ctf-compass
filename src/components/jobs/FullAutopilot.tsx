import { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import {
  Rocket,
  Pause,
  Play,
  StopCircle,
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
  Cpu,
  Lightbulb,
  Target,
  Code2,
  FileCode,
  Zap,
  Eye,
  EyeOff,
  MessageSquare,
  Clock,
  TrendingUp
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
import { toast } from 'sonner';
import { grandFinale, miniCelebrate } from '@/lib/confetti';

// Workflow phases
type Phase = 
  | 'idle' 
  | 'reconnaissance' 
  | 'category_detection' 
  | 'ai_analysis' 
  | 'script_generation' 
  | 'script_execution' 
  | 'flag_extraction' 
  | 'completed' 
  | 'failed'
  | 'cancelled';

interface WorkflowStep {
  id: string;
  phase: Phase;
  command: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  output?: string;
  error?: string;
  flagsFound?: string[];
  duration?: number;
  aiAnalysis?: string;
  isScriptStep?: boolean;
  scriptCode?: string;
}

interface AIInsight {
  analysis: string;
  category: string;
  confidence: number;
  findings: string[];
  isRuleBased: boolean;
  strategy?: string;
  alternativeApproaches?: string[];
  playbook?: string;
}

// AI Trace log entry for debugging
interface AITraceEntry {
  id: string;
  timestamp: Date;
  type: 'request' | 'response' | 'error';
  functionName: string;
  payload?: unknown;
  response?: unknown;
  error?: string;
  duration?: number;
}

interface FullAutopilotProps {
  jobId: string;
  files: string[];
  description?: string;
  expectedFormat?: string;
  onFlagFound?: (flag: string) => void;
  onComplete?: (success: boolean, flags: string[]) => void;
  onStartRef?: (startFn: () => void) => void;
}

// Category-specific solve strategies
const CATEGORY_STRATEGIES: Record<string, {
  name: string;
  description: string;
  phases: string[];
  tools: string[];
  scriptTemplate: string;
}> = {
  crypto: {
    name: 'Cryptography',
    description: 'RSA, AES, classical ciphers, encoding',
    phases: ['File analysis', 'Key extraction', 'Cipher identification', 'Decryption'],
    tools: ['openssl', 'python3', 'base64', 'xxd'],
    scriptTemplate: `#!/usr/bin/env python3
"""Auto-generated Crypto Solve Script"""
from Crypto.Util.number import long_to_bytes, inverse
import base64
import codecs

# Challenge data extracted from analysis
# TODO: Fill in values from reconnaissance

def solve():
    print("[*] Attempting crypto solve...")
    # Add your decryption logic here
    pass

if __name__ == "__main__":
    solve()
`,
  },
  forensics: {
    name: 'Forensics',
    description: 'File analysis, steganography, memory dumps',
    phases: ['File type detection', 'Metadata extraction', 'Steganography check', 'Data recovery'],
    tools: ['file', 'strings', 'binwalk', 'exiftool', 'steghide', 'foremost'],
    scriptTemplate: `#!/usr/bin/env python3
"""Auto-generated Forensics Solve Script"""
import os
import struct

def analyze_file(filepath):
    with open(filepath, 'rb') as f:
        data = f.read()
    
    # Search for flag patterns
    import re
    flags = re.findall(rb'CTF\\{[^}]+\\}|FLAG\\{[^}]+\\}|flag\\{[^}]+\\}', data)
    return [f.decode() for f in flags]

if __name__ == "__main__":
    import sys
    for f in os.listdir('.'):
        if os.path.isfile(f):
            flags = analyze_file(f)
            if flags:
                print(f"[+] Found: {flags}")
`,
  },
  pwn: {
    name: 'Binary Exploitation',
    description: 'Buffer overflow, ROP, format string',
    phases: ['Binary analysis', 'Vulnerability scan', 'Offset finding', 'Exploit development'],
    tools: ['checksec', 'objdump', 'gdb', 'python3'],
    scriptTemplate: `#!/usr/bin/env python3
"""Auto-generated PWN Solve Script"""
from pwn import *

context.arch = 'amd64'
context.log_level = 'info'

def exploit():
    binary = './challenge'
    elf = ELF(binary)
    io = process(binary)
    
    # Payload construction
    offset = 72  # TODO: Adjust based on analysis
    payload = b'A' * offset
    # payload += p64(elf.symbols['win'])  # ret2win
    
    io.sendline(payload)
    io.interactive()

if __name__ == "__main__":
    exploit()
`,
  },
  rev: {
    name: 'Reverse Engineering',
    description: 'Binary analysis, decompilation, anti-debug bypass',
    phases: ['Binary identification', 'String extraction', 'Function analysis', 'Logic reconstruction'],
    tools: ['file', 'strings', 'ltrace', 'strace', 'objdump', 'python3'],
    scriptTemplate: `#!/usr/bin/env python3
"""Auto-generated Reverse Engineering Solve Script"""
import struct
import sys

def deobfuscate_xor(data, key):
    if isinstance(key, int):
        return bytes(b ^ key for b in data)
    return bytes(b ^ key[i % len(key)] for i, b in enumerate(data))

def analyze_binary(filepath):
    with open(filepath, 'rb') as f:
        data = f.read()
    
    # Try common XOR keys
    for key in range(256):
        result = deobfuscate_xor(data[:100], key)
        if b'CTF{' in result or b'flag{' in result:
            print(f"[+] XOR key {key}: {result}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        analyze_binary(sys.argv[1])
`,
  },
  web: {
    name: 'Web Exploitation',
    description: 'SQLi, XSS, SSRF, authentication bypass',
    phases: ['Endpoint discovery', 'Parameter fuzzing', 'Vulnerability identification', 'Exploitation'],
    tools: ['curl', 'python3'],
    scriptTemplate: `#!/usr/bin/env python3
"""Auto-generated Web Solve Script"""
import requests

def exploit(url):
    # Common SQLi payloads
    payloads = ["' OR '1'='1", "admin'--", "1; DROP TABLE users--"]
    
    for payload in payloads:
        resp = requests.get(url, params={'id': payload})
        if 'CTF{' in resp.text or 'flag{' in resp.text:
            import re
            flags = re.findall(r'CTF\\{[^}]+\\}|flag\\{[^}]+\\}', resp.text)
            return flags
    return []

if __name__ == "__main__":
    # url = "http://target/vuln"
    # flags = exploit(url)
    pass
`,
  },
  misc: {
    name: 'Miscellaneous',
    description: 'Programming, trivia, puzzles',
    phases: ['File analysis', 'Pattern recognition', 'Script generation', 'Solution extraction'],
    tools: ['file', 'strings', 'python3', 'xxd'],
    scriptTemplate: `#!/usr/bin/env python3
"""Auto-generated Misc Solve Script"""
import os
import re

def find_flags(data):
    if isinstance(data, bytes):
        data = data.decode('utf-8', errors='ignore')
    return re.findall(r'CTF\\{[^}]+\\}|FLAG\\{[^}]+\\}|flag\\{[^}]+\\}', data)

if __name__ == "__main__":
    for filename in os.listdir('.'):
        if os.path.isfile(filename):
            with open(filename, 'rb') as f:
                flags = find_flags(f.read())
            if flags:
                print(f"[+] {filename}: {flags}")
`,
  },
};

export function FullAutopilot({
  jobId,
  files,
  description = "",
  expectedFormat = "CTF{...}",
  onFlagFound,
  onComplete,
  onStartRef,
}: FullAutopilotProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<Phase>('idle');
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [foundFlags, setFoundFlags] = useState<string[]>([]);
  const [phaseMessage, setPhaseMessage] = useState<string>('Ready to start');
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState(0);
  const [aiInsight, setAiInsight] = useState<AIInsight | null>(null);
  const [detectedCategory, setDetectedCategory] = useState<string>('unknown');
  const [generatedScript, setGeneratedScript] = useState<string>('');
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [maxAttempts] = useState(50);

  // Statistics tracking
  const [commandsRun, setCommandsRun] = useState(0);
  const [analysisStartTime, setAnalysisStartTime] = useState<number | null>(null);
  const [analysisTimeMs, setAnalysisTimeMs] = useState(0);
  const [aiConfidence, setAiConfidence] = useState(0);

  const abortRef = useRef(false);
  const pauseRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const commandHistoryRef = useRef<api.CommandOutput[]>([]);

  // AI Trace for debugging Cloud Mode
  const [aiTrace, setAiTrace] = useState<AITraceEntry[]>([]);
  const [showAiTrace, setShowAiTrace] = useState(false);

  const addTraceEntry = useCallback((entry: Omit<AITraceEntry, 'id' | 'timestamp'>) => {
    setAiTrace(prev => [...prev, {
      ...entry,
      id: `trace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date(),
    }]);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [steps]);

  const addStep = useCallback((step: Omit<WorkflowStep, 'id'>) => {
    const newStep: WorkflowStep = {
      ...step,
      id: `step-${Date.now()}-${Math.random()}`,
    };
    setSteps(prev => [...prev, newStep]);
    setExpandedSteps(prev => new Set([...prev, newStep.id]));
    return newStep.id;
  }, []);

  const updateStep = useCallback((id: string, updates: Partial<WorkflowStep>) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, []);

  const executeCommand = useCallback(async (
    tool: string,
    args: string[]
  ): Promise<{ output: string; flags: string[]; error?: string; exitCode: number }> => {
    try {
      const result = await api.executeTerminalCommand(jobId, tool, args);
      const output = result.stdout || '';
      const error = result.stderr || result.error;
      const flags = detectFlags(output);

      commandHistoryRef.current.push({
        tool,
        args,
        stdout: output,
        stderr: error || '',
        exit_code: result.exit_code,
      });

      // Update command count
      setCommandsRun(prev => prev + 1);

      if (commandHistoryRef.current.length > 30) {
        commandHistoryRef.current = commandHistoryRef.current.slice(-30);
      }

      // Mini confetti when flag found in command output
      if (flags.length > 0) {
        miniCelebrate();
      }

      return { output, flags, error, exitCode: result.exit_code };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Command failed';
      console.error('[FullAutopilot] Command error:', message);

      return {
        output: '',
        flags: [],
        error: message,
        exitCode: -1,
      };
    }
  }, [jobId]);

  const waitWhilePaused = async () => {
    while (pauseRef.current && !abortRef.current) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };

  // PHASE 1: Reconnaissance
  const runReconnaissance = useCallback(async (): Promise<{
    fileOutputs: Record<string, string>;
    stringsOutputs: Record<string, string>;
    earlyFlags: string[];
  }> => {
    setCurrentPhase('reconnaissance');
    setPhaseMessage('🔍 Phase 1: Running reconnaissance...');
    setProgress(10);

    const fileOutputs: Record<string, string> = {};
    const stringsOutputs: Record<string, string> = {};
    const earlyFlags: string[] = [];

    for (const file of files.slice(0, 5)) {
      if (abortRef.current) break;
      await waitWhilePaused();

      // Run file command
      const stepId = addStep({
        phase: 'reconnaissance',
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

      // Run strings
      const stringsStepId = addStep({
        phase: 'reconnaissance',
        command: `strings -n 8 ${file}`,
        status: 'running',
        aiAnalysis: 'Extracting readable strings',
      });

      const stringsResult = await executeCommand('strings', ['-n', '8', file]);
      stringsOutputs[file] = stringsResult.output;

      if (stringsResult.flags.length > 0) {
        earlyFlags.push(...stringsResult.flags);
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

    return { fileOutputs, stringsOutputs, earlyFlags };
  }, [files, addStep, updateStep, executeCommand, onFlagFound]);

  // PHASE 2: Category Detection
  const detectCategoryPhase = useCallback(async (
    fileOutputs: Record<string, string>,
    stringsOutputs: Record<string, string>
  ): Promise<{ category: string; confidence: number }> => {
    setCurrentPhase('category_detection');
    setPhaseMessage('🧠 Phase 2: Detecting challenge category...');
    setProgress(25);

    const stepId = addStep({
      phase: 'category_detection',
      command: 'AI: Analyzing challenge type',
      status: 'running',
      aiAnalysis: 'Using AI to determine challenge category',
    });

    try {
      const requestPayload = { files, file_outputs: fileOutputs, strings_outputs: stringsOutputs };
      const startTime = Date.now();
      
      addTraceEntry({
        type: 'request',
        functionName: 'detect-category',
        payload: requestPayload,
      });

      const result = await api.detectCategory(files, fileOutputs, stringsOutputs);

      addTraceEntry({
        type: 'response',
        functionName: 'detect-category',
        response: result,
        duration: Date.now() - startTime,
      });

      setDetectedCategory(result.category);

      updateStep(stepId, {
        status: 'success',
        output: `Detected: ${result.category} (${Math.round(result.confidence * 100)}% confidence)`,
      });

      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      
      addTraceEntry({
        type: 'error',
        functionName: 'detect-category',
        error: errorMsg,
      });

      // Show toast for rate-limit / payment errors
      if (err instanceof api.RateLimitError) {
        toast.error('Rate limit exceeded', { description: 'Please wait a moment and try again.' });
      } else if (err instanceof api.PaymentRequiredError) {
        toast.error('AI credits exhausted', { description: 'Please add funds to your Lovable workspace.' });
      }
      // Fallback: guess from description
      let category = 'misc';
      const lowerDesc = description.toLowerCase();
      if (lowerDesc.includes('crypto') || lowerDesc.includes('rsa') || lowerDesc.includes('cipher')) {
        category = 'crypto';
      } else if (lowerDesc.includes('pwn') || lowerDesc.includes('buffer') || lowerDesc.includes('overflow')) {
        category = 'pwn';
      } else if (lowerDesc.includes('reverse') || lowerDesc.includes('binary')) {
        category = 'rev';
      } else if (lowerDesc.includes('web') || lowerDesc.includes('sql') || lowerDesc.includes('xss')) {
        category = 'web';
      } else if (lowerDesc.includes('forensic') || lowerDesc.includes('stego')) {
        category = 'forensics';
      }

      setDetectedCategory(category);
      updateStep(stepId, {
        status: 'success',
        output: `Fallback detection: ${category}`,
      });

      return { category, confidence: 0.5 };
    }
  }, [files, description, addStep, updateStep, addTraceEntry]);

  // PHASE 3: AI Analysis Loop - Now with auto script generation and execution
  const runAIAnalysis = useCallback(async (
    category: string,
    earlyFlags: string[] = []
  ): Promise<{ flagsFound: string[]; insights: AIInsight | null }> => {
    setCurrentPhase('ai_analysis');
    setPhaseMessage(`🤖 Phase 3: AI-driven analysis (${category})...`);
    setProgress(40);

    let attempts = 0;
    let localFlags: string[] = [...earlyFlags];
    let latestInsight: AIInsight | null = null;

    while (!abortRef.current && attempts < maxAttempts && localFlags.length === 0) {
      await waitWhilePaused();
      if (abortRef.current) break;

      setTotalAttempts(attempts + 1);
      const requestScript = attempts >= 2; // Request script after 2 attempts
      setPhaseMessage(`🤖 AI analyzing... (attempt ${attempts + 1}/${maxAttempts})${requestScript ? ' - generating solve script' : ''}`);
      setProgress(40 + (attempts / maxAttempts) * 30);

      const requestPayload = {
        job_id: jobId,
        files,
        command_history: commandHistoryRef.current,
        description,
        flag_format: expectedFormat,
        current_category: category,
        attempt_number: attempts + 1,
        request_script: requestScript,
        early_flags: earlyFlags,
      };
      const startTime = Date.now();

      addTraceEntry({
        type: 'request',
        functionName: 'ai-analyze',
        payload: requestPayload,
      });

      try {
        const aiResponse = await api.analyzeWithAI(
          jobId,
          files,
          commandHistoryRef.current,
          description,
          expectedFormat,
          category,
          attempts + 1,
          requestScript,
          earlyFlags
        );

        addTraceEntry({
          type: 'response',
          functionName: 'ai-analyze',
          response: aiResponse,
          duration: Date.now() - startTime,
        });

        latestInsight = {
          analysis: aiResponse.analysis,
          category: aiResponse.category,
          confidence: aiResponse.confidence,
          findings: aiResponse.findings,
          isRuleBased: aiResponse.rule_based,
          strategy: aiResponse.strategy,
          alternativeApproaches: aiResponse.alternative_approaches,
          playbook: aiResponse.playbook,
        };
        setAiInsight(latestInsight);
        // Update AI confidence
        setAiConfidence(aiResponse.confidence);

        if (aiResponse.flag_candidates.length > 0) {
          localFlags.push(...aiResponse.flag_candidates);
          setFoundFlags(prev => [...new Set([...prev, ...aiResponse.flag_candidates])]);
          aiResponse.flag_candidates.forEach(flag => onFlagFound?.(flag));
        }

        // Execute AI-generated solve script if provided
        if (aiResponse.solve_script && aiResponse.solve_script.code) {
          setPhaseMessage(`🚀 Executing AI-generated solve script...`);
          
          const scriptStepId = addStep({
            phase: 'ai_analysis',
            command: `python3 solve.py (AI-generated)`,
            status: 'running',
            aiAnalysis: aiResponse.solve_script.description,
            isScriptStep: true,
            scriptCode: aiResponse.solve_script.code,
          });

          try {
            const scriptResult = await api.executePythonInSandbox(jobId, aiResponse.solve_script.code);
            const scriptFlags = detectFlags(scriptResult.stdout);

            if (scriptFlags.length > 0) {
              localFlags.push(...scriptFlags);
              setFoundFlags(prev => [...new Set([...prev, ...scriptFlags])]);
              scriptFlags.forEach(flag => onFlagFound?.(flag));
            }

            setGeneratedScript(aiResponse.solve_script.code);
            updateStep(scriptStepId, {
              status: scriptResult.exit_code === 0 ? 'success' : 'failed',
              output: scriptResult.stdout,
              error: scriptResult.stderr,
              flagsFound: scriptFlags,
            });

            if (scriptFlags.length > 0) break;
          } catch (scriptErr) {
            updateStep(scriptStepId, {
              status: 'failed',
              error: scriptErr instanceof Error ? scriptErr.message : 'Script failed',
            });
          }
        }

        if (!aiResponse.should_continue || aiResponse.next_commands.length === 0) {
          break;
        }

        // Execute AI-suggested commands
        for (const cmd of aiResponse.next_commands) {
          if (abortRef.current || localFlags.length > 0) break;
          await waitWhilePaused();

          const commandStr = `${cmd.tool} ${cmd.args.join(' ')}`;
          const stepId = addStep({
            phase: 'ai_analysis',
            command: commandStr,
            status: 'running',
            aiAnalysis: cmd.reason,
          });

          const cmdStartTime = Date.now();
          const result = await executeCommand(cmd.tool, cmd.args);
          const duration = Date.now() - cmdStartTime;

          if (result.flags.length > 0) {
            localFlags.push(...result.flags);
            setFoundFlags(prev => [...new Set([...prev, ...result.flags])]);
            result.flags.forEach(flag => onFlagFound?.(flag));
          }

          updateStep(stepId, {
            status: result.error && !result.output ? 'failed' : 'success',
            output: result.output,
            error: result.error,
            flagsFound: result.flags,
            duration,
          });

          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        
        addTraceEntry({
          type: 'error',
          functionName: 'ai-analyze',
          error: errorMsg,
          duration: Date.now() - startTime,
        });

        if (err instanceof api.RateLimitError) {
          toast.error('Rate limit exceeded', { description: 'Please wait a moment and try again.' });
          break;
        } else if (err instanceof api.PaymentRequiredError) {
          toast.error('AI credits exhausted', { description: 'Please add funds to your Lovable workspace.' });
          break;
        }

        console.error('AI analysis error:', err);
      }

      attempts++;
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    return { flagsFound: localFlags, insights: latestInsight };
  }, [jobId, files, description, expectedFormat, maxAttempts, addStep, updateStep, executeCommand, onFlagFound, addTraceEntry]);

  // PHASE 4: Script Generation
  const generateSolveScript = useCallback(async (
    category: string,
    insight: AIInsight | null
  ): Promise<string> => {
    setCurrentPhase('script_generation');
    setPhaseMessage('📝 Phase 4: Generating solve script...');
    setProgress(75);

    const strategy = CATEGORY_STRATEGIES[category] || CATEGORY_STRATEGIES.misc;

    const stepId = addStep({
      phase: 'script_generation',
      command: `Generating ${strategy.name} solve script`,
      status: 'running',
      aiAnalysis: `Creating customized ${category} exploit script`,
    });

    // Customize script based on analysis
    let script = strategy.scriptTemplate;

    // Add file information
    const filesList = files.map(f => `# - ${f}`).join('\n');
    script = script.replace(
      '"""',
      `"""
# Files: 
${filesList}
# Category: ${category}
# Flag Format: ${expectedFormat}
${insight ? `# AI Analysis: ${insight.analysis.slice(0, 200)}` : ''}
`
    );

    // Add command history context
    if (commandHistoryRef.current.length > 0) {
      const contextComment = commandHistoryRef.current
        .slice(-5)
        .map(cmd => `# Previous: ${cmd.tool} ${cmd.args.join(' ')} -> exit ${cmd.exit_code}`)
        .join('\n');
      script = script.replace('if __name__', `${contextComment}\n\nif __name__`);
    }

    setGeneratedScript(script);

    updateStep(stepId, {
      status: 'success',
      output: `Generated ${strategy.name} solve script (${script.split('\n').length} lines)`,
      isScriptStep: true,
      scriptCode: script,
    });

    return script;
  }, [files, expectedFormat, addStep, updateStep]);

  // PHASE 5: Script Execution
  const executeSolveScript = useCallback(async (
    script: string,
    category: string
  ): Promise<string[]> => {
    setCurrentPhase('script_execution');
    setPhaseMessage('🚀 Phase 5: Executing solve script...');
    setProgress(85);

    const strategy = CATEGORY_STRATEGIES[category] || CATEGORY_STRATEGIES.misc;
    const stepId = addStep({
      phase: 'script_execution',
      command: 'python3 solve.py',
      status: 'running',
      aiAnalysis: `Running auto-generated ${category} script`,
      isScriptStep: true,
      scriptCode: script,
    });

    try {
      const result = await api.runPythonScript({
        script,
        pip_packages: category === 'crypto' ? ['pycryptodome', 'gmpy2'] :
                      category === 'pwn' ? ['pwntools'] :
                      category === 'forensics' ? ['Pillow'] :
                      [],
        timeout: 60,
      });

      const flags = detectFlags(result.stdout);

      if (flags.length > 0) {
        setFoundFlags(prev => [...new Set([...prev, ...flags])]);
        flags.forEach(flag => onFlagFound?.(flag));
      }

      updateStep(stepId, {
        status: result.exit_code === 0 ? 'success' : 'failed',
        output: result.stdout,
        error: result.stderr,
        flagsFound: flags,
      });

      return flags;
    } catch (err) {
      updateStep(stepId, {
        status: 'failed',
        error: err instanceof Error ? err.message : 'Script execution failed',
      });
      return [];
    }
  }, [addStep, updateStep, onFlagFound]);

  // MAIN AUTOPILOT WORKFLOW
  const runFullAutopilot = useCallback(async () => {
    setIsRunning(true);
    setIsPaused(false);
    abortRef.current = false;
    pauseRef.current = false;
    commandHistoryRef.current = [];
    setSteps([]);
    setFoundFlags([]);
    setProgress(0);
    setTotalAttempts(0);
    setAiInsight(null);
    setDetectedCategory('unknown');
    setGeneratedScript('');
    
    // Reset stats
    setCommandsRun(0);
    setAnalysisStartTime(Date.now());
    setAnalysisTimeMs(0);
    setAiConfidence(0);

    let allFlags: string[] = [];

    try {
      // Phase 1: Reconnaissance (gather info, don't stop even if flags found)
      const recon = await runReconnaissance();
      if (abortRef.current) {
        setCurrentPhase('cancelled');
        setPhaseMessage('Cancelled by user');
        setIsRunning(false);
        return;
      }

      // Store early flags but continue with AI analysis
      let earlyFlags = recon.earlyFlags;
      if (earlyFlags.length > 0) {
        setFoundFlags(prev => [...new Set([...prev, ...earlyFlags])]);
        earlyFlags.forEach(flag => onFlagFound?.(flag));
        // Don't return - let AI analyze and validate
      }

      // Phase 2: Category Detection
      const { category } = await detectCategoryPhase(recon.fileOutputs, recon.stringsOutputs);
      if (abortRef.current) {
        setCurrentPhase('cancelled');
        setIsRunning(false);
        return;
      }

      // Phase 3: AI Analysis (pass early flags for context)
      const aiResult = await runAIAnalysis(category, earlyFlags);
      if (abortRef.current) {
        setCurrentPhase('cancelled');
        setIsRunning(false);
        return;
      }

      // Collect AI flags
      if (aiResult.flagsFound.length > 0) {
        allFlags = [...new Set([...earlyFlags, ...aiResult.flagsFound])];
      } else {
        allFlags = [...earlyFlags];
      }

      // If we already have flags, complete successfully
      if (allFlags.length > 0) {
        const endTime = Date.now();
        setAnalysisTimeMs(endTime - (analysisStartTime || endTime));
        setCurrentPhase('completed');
        setPhaseMessage(`🎉 SUCCESS! Found ${allFlags.length} flag(s)`);
        setProgress(100);
        // Grand finale confetti!
        grandFinale();
        onComplete?.(true, allFlags);
        setIsRunning(false);
        return;
      }

      // Phase 4: Script Generation (only if no flags yet)
      const script = await generateSolveScript(category, aiResult.insights);
      if (abortRef.current) {
        setCurrentPhase('cancelled');
        setIsRunning(false);
        return;
      }

      // Phase 5: Script Execution
      const scriptFlags = await executeSolveScript(script, category);
      if (scriptFlags.length > 0) {
        allFlags = [...scriptFlags];
      }

      // Final status
      const endTime = Date.now();
      setAnalysisTimeMs(endTime - (analysisStartTime || endTime));
      
      if (allFlags.length > 0) {
        setCurrentPhase('completed');
        setPhaseMessage(`🎉 SUCCESS! Found ${allFlags.length} flag(s)`);
        setProgress(100);
        // Grand finale confetti!
        grandFinale();
        onComplete?.(true, allFlags);
      } else {
        setCurrentPhase('completed');
        setPhaseMessage('Analysis complete - manual review recommended');
        setProgress(100);
        onComplete?.(false, []);
      }
    } catch (err) {
      console.error('Autopilot error:', err);
      const endTime = Date.now();
      setAnalysisTimeMs(endTime - (analysisStartTime || endTime));
      setCurrentPhase('failed');
      setPhaseMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      onComplete?.(false, []);
    }

    setIsRunning(false);
  }, [runReconnaissance, detectCategoryPhase, runAIAnalysis, generateSolveScript, executeSolveScript, onComplete, analysisStartTime]);

  // Expose start function to parent via callback - run immediately on mount
  useEffect(() => {
    if (onStartRef) {
      onStartRef(runFullAutopilot);
    }
  }, [onStartRef, runFullAutopilot]);

  const handlePause = () => {
    setIsPaused(true);
    pauseRef.current = true;
  };

  const handleResume = () => {
    setIsPaused(false);
    pauseRef.current = false;
  };

  const handleCancel = () => {
    abortRef.current = true;
    pauseRef.current = false;
    setIsRunning(false);
    setIsPaused(false);
    setCurrentPhase('cancelled');
    setPhaseMessage('Cancelled by user');
  };

  const handleReset = () => {
    setSteps([]);
    setFoundFlags([]);
    setProgress(0);
    setTotalAttempts(0);
    setCurrentPhase('idle');
    setPhaseMessage('Ready to start');
    setAiInsight(null);
    setDetectedCategory('unknown');
    setGeneratedScript('');
    commandHistoryRef.current = [];
  };

  const toggleStep = (id: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getPhaseIcon = (phase: Phase) => {
    switch (phase) {
      case 'reconnaissance': return <Terminal className="h-4 w-4" />;
      case 'category_detection': return <Target className="h-4 w-4" />;
      case 'ai_analysis': return <Brain className="h-4 w-4" />;
      case 'script_generation': return <Code2 className="h-4 w-4" />;
      case 'script_execution': return <FileCode className="h-4 w-4" />;
      case 'flag_extraction': return <Flag className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4 text-success" />;
      case 'failed': return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default: return <Cpu className="h-4 w-4" />;
    }
  };

  const strategy = CATEGORY_STRATEGIES[detectedCategory];

  return (
    <div className="space-y-4">
      {/* Main Control Card */}
      <Card className={cn(
        "border-2 transition-all duration-300",
        isRunning ? "border-primary/50 animate-pulse-glow" : "border-primary/20",
        currentPhase === 'completed' && "border-success/50",
        currentPhase === 'failed' && "border-destructive/50"
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg transition-all duration-300",
                isRunning ? "bg-primary/20 animate-bounce-subtle" : "bg-primary/10",
                currentPhase === 'completed' && "bg-success/20",
                currentPhase === 'failed' && "bg-destructive/20"
              )}>
                <Rocket className={cn(
                  "h-6 w-6 transition-colors",
                  isRunning ? "text-primary animate-spin-slow" : "text-primary",
                  currentPhase === 'completed' && "text-success",
                  currentPhase === 'failed' && "text-destructive"
                )} />
              </div>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  Full Autopilot
                  {isRunning && (
                    <Badge variant="secondary" className="gap-1.5 bg-primary/20 text-primary border-primary/30">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="relative">
                        Running
                        <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-primary animate-ping" />
                      </span>
                    </Badge>
                  )}
                  {currentPhase === 'completed' && foundFlags.length > 0 && (
                    <Badge className="bg-success/20 text-success border-success/30 animate-scale-in">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Solved!
                    </Badge>
                  )}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  One-click automated CTF solving with AI
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Start button - shows when idle */}
              {!isRunning && currentPhase === 'idle' && (
                <Button 
                  onClick={runFullAutopilot}
                  className="gap-2 bg-primary hover:bg-primary/90"
                >
                  <Rocket className="h-4 w-4" />
                  Start Solving
                </Button>
              )}
              {/* Solve Again button - shows when completed or failed */}
              {!isRunning && (currentPhase === 'completed' || currentPhase === 'failed' || currentPhase === 'cancelled') && (
                <Button 
                  onClick={() => {
                    handleReset();
                    setTimeout(() => runFullAutopilot(), 100);
                  }}
                  className="gap-2"
                >
                  <Zap className="h-4 w-4" />
                  Solve Again
                </Button>
              )}
              {isRunning && (
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
                  <Button variant="destructive" onClick={handleCancel}>
                    <StopCircle className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </>
              )}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleReset} 
                disabled={isRunning}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Phase Progress with enhanced animation */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className={cn(
                "flex items-center gap-2 transition-all",
                isRunning && "animate-slide-up"
              )}>
                <span className={cn(
                  "transition-transform",
                  isRunning && currentPhase === 'ai_analysis' && "animate-bounce-subtle"
                )}>
                  {getPhaseIcon(currentPhase)}
                </span>
                <span className={cn(
                  "font-medium",
                  currentPhase === 'ai_analysis' && "text-primary"
                )}>
                  {phaseMessage}
                </span>
                {currentPhase === 'ai_analysis' && (
                  <span className="inline-flex gap-0.5 ml-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                )}
              </div>
              {totalAttempts > 0 && (
                <Badge variant="outline" className="text-xs animate-fade-in">
                  <Brain className="h-3 w-3 mr-1" />
                  {totalAttempts} AI iterations
                </Badge>
              )}
            </div>
            <div className="relative">
              <Progress 
                value={progress} 
                className={cn(
                  "h-2.5 transition-all",
                  isRunning && "[&>div]:bg-gradient-to-r [&>div]:from-primary [&>div]:via-primary/80 [&>div]:to-primary"
                )} 
              />
              {isRunning && progress > 0 && progress < 100 && (
                <div 
                  className="absolute top-0 h-2.5 w-20 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer rounded-full"
                  style={{ 
                    left: `${Math.min(progress - 10, 80)}%`,
                    backgroundSize: '200% 100%'
                  }}
                />
              )}
            </div>
          </div>

          {/* Stats Display */}
          {(isRunning || currentPhase === 'completed' || currentPhase === 'failed') && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fade-in">
              {/* Commands Run */}
              <div className={cn(
                "p-3 rounded-lg border bg-card transition-all duration-300",
                isRunning && "animate-pulse border-primary/30"
              )}>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-primary/10">
                    <Terminal className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl font-bold tabular-nums">{commandsRun}</p>
                    <p className="text-xs text-muted-foreground">Commands</p>
                  </div>
                </div>
              </div>

              {/* Analysis Time */}
              <div className="p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-info/10">
                    <Clock className="h-4 w-4 text-info" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl font-bold tabular-nums">
                      {isRunning && analysisStartTime 
                        ? `${((Date.now() - analysisStartTime) / 1000).toFixed(1)}s`
                        : analysisTimeMs < 1000 
                          ? `${analysisTimeMs}ms` 
                          : `${(analysisTimeMs / 1000).toFixed(1)}s`
                      }
                    </p>
                    <p className="text-xs text-muted-foreground">Time</p>
                  </div>
                </div>
              </div>

              {/* AI Confidence */}
              <div className="p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-success/10">
                    <TrendingUp className="h-4 w-4 text-success" />
                  </div>
                  <div className="min-w-0">
                    <p className={cn(
                      "text-xl font-bold tabular-nums",
                      aiConfidence >= 0.9 && "text-success",
                      aiConfidence >= 0.7 && aiConfidence < 0.9 && "text-amber-500"
                    )}>
                      {(aiConfidence * 100).toFixed(0)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Confidence</p>
                  </div>
                </div>
              </div>

              {/* Category */}
              <div className={cn(
                "p-3 rounded-lg border bg-card",
                detectedCategory === 'crypto' && "border-amber-500/30",
                detectedCategory === 'forensics' && "border-blue-500/30",
                detectedCategory === 'pwn' && "border-red-500/30",
                detectedCategory === 'rev' && "border-purple-500/30",
                detectedCategory === 'web' && "border-green-500/30",
                detectedCategory === 'misc' && "border-cyan-500/30"
              )}>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "p-1.5 rounded-md",
                    detectedCategory === 'crypto' && "bg-amber-500/10",
                    detectedCategory === 'forensics' && "bg-blue-500/10",
                    detectedCategory === 'pwn' && "bg-red-500/10",
                    detectedCategory === 'rev' && "bg-purple-500/10",
                    detectedCategory === 'web' && "bg-green-500/10",
                    detectedCategory === 'misc' && "bg-cyan-500/10",
                    detectedCategory === 'unknown' && "bg-muted"
                  )}>
                    <Target className={cn(
                      "h-4 w-4",
                      detectedCategory === 'crypto' && "text-amber-500",
                      detectedCategory === 'forensics' && "text-blue-500",
                      detectedCategory === 'pwn' && "text-red-500",
                      detectedCategory === 'rev' && "text-purple-500",
                      detectedCategory === 'web' && "text-green-500",
                      detectedCategory === 'misc' && "text-cyan-500"
                    )} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold capitalize truncate">{detectedCategory}</p>
                    <p className="text-xs text-muted-foreground">Category</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Detected Category & Strategy */}
          {detectedCategory !== 'unknown' && strategy && (
            <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 animate-fade-in">
              <Badge variant="outline" className="capitalize text-sm bg-primary/5 border-primary/30">
                <Target className="h-3 w-3 mr-1" />
                {strategy.name}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {strategy.description}
              </span>
              <div className="ml-auto flex gap-1">
                {strategy.tools.slice(0, 4).map((tool, i) => (
                  <Badge 
                    key={tool} 
                    variant="secondary" 
                    className="text-xs animate-scale-in"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    {tool}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* AI Insight with Strategy & Playbook */}
          {aiInsight && (
            <div className="space-y-3">
              {/* Strategy & Alternative Approaches */}
              {aiInsight.strategy && (
                <div className="p-3 rounded-lg bg-info/10 border border-info/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-4 w-4 text-info" />
                    <span className="font-medium text-sm">Current Strategy</span>
                  </div>
                  <p className="text-sm font-medium text-foreground">{aiInsight.strategy}</p>
                  
                  {aiInsight.alternativeApproaches && aiInsight.alternativeApproaches.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-info/20">
                      <span className="text-xs text-muted-foreground">Alternative approaches:</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {aiInsight.alternativeApproaches.slice(0, 3).map((approach, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {approach.slice(0, 40)}{approach.length > 40 ? '...' : ''}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* AI Analysis */}
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">AI Analysis</span>
                  <Badge variant="outline" className="ml-auto text-xs">
                    {Math.round(aiInsight.confidence * 100)}% confidence
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{aiInsight.analysis}</p>
                {aiInsight.findings.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {aiInsight.findings.slice(0, 3).map((f, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        <Lightbulb className="h-3 w-3 mr-1" />
                        {f.slice(0, 50)}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Playbook (collapsible) */}
              {aiInsight.playbook && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full p-2 rounded-lg hover:bg-muted/50">
                    <FileCode className="h-4 w-4" />
                    <span>View Playbook ({aiInsight.category})</span>
                    <ChevronRight className="h-4 w-4 ml-auto transition-transform group-data-[state=open]:rotate-90" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <pre className="mt-2 p-3 bg-muted/50 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                      {aiInsight.playbook}
                    </pre>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          )}

          {/* Found Flags - Animated Success */}
          {foundFlags.length > 0 && (
            <div className="p-4 rounded-lg bg-success/10 border-2 border-success/40 animate-scale-in relative overflow-hidden">
              {/* Celebration shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-success/10 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
              
              <div className="relative">
                <div className="flex items-center gap-2 text-success font-medium mb-3">
                  <Sparkles className="h-5 w-5 animate-bounce-subtle" />
                  <span className="text-lg">🎉 FLAG FOUND!</span>
                  <Badge className="ml-auto bg-success text-success-foreground">
                    {foundFlags.length} flag{foundFlags.length > 1 ? 's' : ''}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {foundFlags.map((flag, i) => (
                    <code 
                      key={i} 
                      className="block px-4 py-3 bg-success/20 rounded-lg font-mono text-sm select-all border border-success/30 animate-fade-in hover:bg-success/30 transition-colors cursor-pointer"
                      style={{ animationDelay: `${i * 100}ms` }}
                      onClick={() => {
                        navigator.clipboard.writeText(flag);
                        toast.success('Flag copied to clipboard!');
                      }}
                    >
                      {flag}
                    </code>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Workflow Steps */}
      {steps.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Terminal className="h-4 w-4" />
              Execution Log ({steps.length} steps)
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
                        expandedSteps.has(step.id) && "bg-muted/50",
                        step.flagsFound?.length && "ring-1 ring-success/50"
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

                        {step.isScriptStep && (
                          <Badge variant="secondary" className="shrink-0">
                            <Code2 className="h-3 w-3 mr-1" />
                            Script
                          </Badge>
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

                        {step.scriptCode && (
                          <div className="rounded-lg overflow-hidden">
                            <pre className="bg-muted p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap max-h-48">
                              {step.scriptCode.slice(0, 1500)}
                              {step.scriptCode.length > 1500 && '\n... (truncated)'}
                            </pre>
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

      {/* AI Trace Panel for Cloud Mode Debugging */}
      {aiTrace.length > 0 && (
        <Card className="border-dashed border-muted-foreground/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
                <MessageSquare className="h-4 w-4" />
                AI Trace ({aiTrace.length} calls)
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAiTrace(!showAiTrace)}
                className="text-xs"
              >
                {showAiTrace ? (
                  <>
                    <EyeOff className="h-3 w-3 mr-1" />
                    Hide
                  </>
                ) : (
                  <>
                    <Eye className="h-3 w-3 mr-1" />
                    Show
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          {showAiTrace && (
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-3 pr-4">
                  {aiTrace.map((entry) => (
                    <div
                      key={entry.id}
                      className={cn(
                        'p-3 rounded-lg text-xs font-mono border',
                        entry.type === 'request' && 'bg-blue-500/5 border-blue-500/20',
                        entry.type === 'response' && 'bg-green-500/5 border-green-500/20',
                        entry.type === 'error' && 'bg-red-500/5 border-red-500/20'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px]',
                            entry.type === 'request' && 'border-blue-500/40 text-blue-600',
                            entry.type === 'response' && 'border-green-500/40 text-green-600',
                            entry.type === 'error' && 'border-red-500/40 text-red-600'
                          )}
                        >
                          {entry.type.toUpperCase()}
                        </Badge>
                        <span className="font-semibold">{entry.functionName}</span>
                        {entry.duration && (
                          <span className="text-muted-foreground ml-auto">
                            {entry.duration}ms
                          </span>
                        )}
                        <span className="text-muted-foreground">
                          {entry.timestamp.toLocaleTimeString()}
                        </span>
                      </div>

                      {entry.type === 'request' && entry.payload && (
                        <pre className="bg-muted/50 p-2 rounded text-[10px] overflow-x-auto whitespace-pre-wrap max-h-32">
                          {JSON.stringify(entry.payload, null, 2).slice(0, 1000)}
                        </pre>
                      )}

                      {entry.type === 'response' && entry.response && (
                        <pre className="bg-muted/50 p-2 rounded text-[10px] overflow-x-auto whitespace-pre-wrap max-h-32">
                          {JSON.stringify(entry.response, null, 2).slice(0, 1000)}
                        </pre>
                      )}

                      {entry.type === 'error' && entry.error && (
                        <div className="text-red-600 bg-red-500/10 p-2 rounded">
                          {entry.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
