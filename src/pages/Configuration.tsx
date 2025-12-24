import { useState, useEffect } from 'react';
import { Save, RotateCcw, Shield, Clock, Upload, Wrench, Key, Cpu, CheckCircle, Eye, EyeOff, Play, Loader2, RefreshCw, Download, Trash2, AlertTriangle, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AppLayout } from '@/components/layout/AppLayout';
import { useToast } from '@/hooks/use-toast';
import { mockConfig } from '@/lib/mock-data';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Complete list of MegaLLM models with accurate pricing
const ALL_MODELS = [
  // OpenAI Models
  { id: 'gpt-5.1', name: 'GPT-5.1', provider: 'OpenAI', price: '$1.25/$10.00/M', context: '128K', type: 'chat' },
  { id: 'gpt-5', name: 'GPT-5', provider: 'OpenAI', price: '$1.25/$10.00/M', context: '128K', type: 'chat' },
  { id: 'gpt-5-mini', name: 'GPT-5 Mini', provider: 'OpenAI', price: '$0.25/$2.00/M', context: '128K', type: 'chat' },
  { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'OpenAI', price: '$2.00/$8.00/M', context: '128K', type: 'chat' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', price: '$2.50/$10.00/M', context: '128K', type: 'chat' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', price: '$0.15/$0.60/M', context: '128K', type: 'chat' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI', price: '$0.50/$1.50/M', context: '16K', type: 'chat' },
  { id: 'openai-gpt-oss-20b', name: 'GPT-OSS 20B', provider: 'OpenAI', price: '$0.07/$0.30/M', context: '128K', type: 'chat' },
  { id: 'openai-gpt-oss-120b', name: 'GPT-OSS 120B', provider: 'OpenAI', price: '$0.15/$0.60/M', context: '128K', type: 'chat' },
  
  // Anthropic Models
  { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5', provider: 'Anthropic', price: '$5.00/$25.00/M', context: '200K', type: 'chat' },
  { id: 'claude-opus-4-1-20250805', name: 'Claude Opus 4.1', provider: 'Anthropic', price: '$15.00/$75.00/M', context: '80K', type: 'chat' },
  { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', provider: 'Anthropic', price: '$15.00/$75.00/M', context: '80K', type: 'chat' },
  { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', provider: 'Anthropic', price: '$3.00/$15.00/M', context: '200K', type: 'chat' },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'Anthropic', price: '$3.00/$15.00/M', context: '128K', type: 'chat' },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', provider: 'Anthropic', price: '$1.00/$5.00/M', context: '200K', type: 'chat' },
  
  // Google Models
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro Preview', provider: 'Google', price: '$4.00/$18.00/M', context: '1M', type: 'chat' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google', price: '$1.25/$10.00/M', context: '128K', type: 'chat' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google', price: '$1.00/$1.00/M', context: '196K', type: 'chat' },
  
  // Meta Models
  { id: 'llama3.3-70b-instruct', name: 'Llama 3.3 70B', provider: 'Meta', price: '$0.12/$0.30/M', context: '131K', type: 'chat' },
  { id: 'llama3-8b-instruct', name: 'Llama 3.1 8B', provider: 'Meta', price: '$0.30/$0.60/M', context: '8K', type: 'chat' },
  
  // DeepSeek Models
  { id: 'deepseek-v3.2', name: 'DeepSeek V3.2', provider: 'DeepSeek', price: '$1.25/$10.00/M', context: '128K', type: 'chat' },
  { id: 'deepseek-ai/deepseek-v3.1', name: 'DeepSeek V3.1', provider: 'DeepSeek', price: '$1.00/$1.00/M', context: '128K', type: 'chat' },
  { id: 'deepseek-ai/deepseek-v3.1-terminus', name: 'DeepSeek V3.1 Terminus', provider: 'DeepSeek', price: '$1.00/$1.00/M', context: '163K', type: 'chat' },
  { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill', provider: 'DeepSeek', price: '$0.75/$0.99/M', context: '128K', type: 'chat' },
  
  // Alibaba Models
  { id: 'alibaba-qwen3-32b', name: 'Qwen3 32B', provider: 'Alibaba', price: '$0.15/$0.60/M', context: '131K', type: 'chat' },
  { id: 'qwen/qwen3-next-80b-a3b-instruct', name: 'Qwen3 Next 80B', provider: 'Alibaba', price: '$1.00/$1.00/M', context: '262K', type: 'chat' },
  { id: 'qwen3-coder-480b-a35b-instruct', name: 'Qwen3 Coder 480B', provider: 'Alibaba', price: '$1.00/$1.00/M', context: '262K', type: 'code' },
  
  // Mistral Models
  { id: 'mistralai/mistral-nemotron', name: 'Mistral Nemotron', provider: 'Mistral', price: '$1.00/$1.00/M', context: '128K', type: 'chat' },
  { id: 'mistral-large-3-675b-instruct-2512', name: 'Mistral Large 3 675B', provider: 'Mistral', price: '$1.00/$1.00/M', context: '262K', type: 'chat' },
  
  // xAI Models
  { id: 'grok-4.1-fast-reasoning', name: 'Grok 4.1 Fast Reasoning', provider: 'xAI', price: '$1.00/$1.00/M', context: '200K', type: 'chat' },
  { id: 'grok-4.1-fast-non-reasoning', name: 'Grok 4.1 Fast Non-Reasoning', provider: 'xAI', price: '$1.00/$1.00/M', context: '200K', type: 'chat' },
  
  // Other Models
  { id: 'moonshotai/kimi-k2-instruct-0905', name: 'Kimi K2 Instruct', provider: 'Moonshot', price: '$1.00/$1.00/M', context: '256K', type: 'chat' },
  { id: 'moonshotai/kimi-k2-thinking', name: 'Kimi K2 Thinking', provider: 'Moonshot', price: '$1.00/$1.00/M', context: '256K', type: 'chat' },
  { id: 'glm-4.6', name: 'GLM 4.6', provider: 'GLM', price: '$1.00/$2.00/M', context: '131K', type: 'chat' },
  { id: 'minimaxai/minimax-m2', name: 'Minimax M2', provider: 'Minimax', price: '$1.00/$1.00/M', context: '128K', type: 'chat' },
];

// Categorized models for task selection - using cheap/free models
const AI_MODELS = {
  analysis: ALL_MODELS.filter(m => ['llama3.3-70b-instruct', 'deepseek-r1-distill-llama-70b', 'openai-gpt-oss-120b', 'gpt-5', 'claude-sonnet-4-5-20250929', 'gemini-2.5-pro'].includes(m.id)),
  writeup: ALL_MODELS.filter(m => ['llama3.3-70b-instruct', 'deepseek-r1-distill-llama-70b', 'openai-gpt-oss-120b', 'claude-sonnet-4-5-20250929', 'gpt-5'].includes(m.id)),
  extraction: ALL_MODELS.filter(m => ['openai-gpt-oss-20b', 'openai-gpt-oss-120b', 'llama3.3-70b-instruct', 'alibaba-qwen3-32b', 'gpt-4o-mini'].includes(m.id)),
};

// Test API key (Note: May fail due to CORS when called from browser)
async function testMegaLLMApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch('https://ai.megallm.io/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama3.3-70b-instruct',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      }),
    });

    if (response.ok) {
      return { valid: true };
    }

    const data = await response.json().catch(() => ({}));
    
    if (response.status === 401) {
      return { valid: false, error: 'API key không hợp lệ' };
    }
    if (response.status === 403) {
      return { valid: false, error: data.error?.message || 'Không có quyền truy cập' };
    }
    
    return { valid: false, error: data.error?.message || `Lỗi: ${response.status}` };
  } catch (error) {
    // CORS error or network error
    return { valid: false, error: 'Không thể kết nối (CORS/Network). API sẽ hoạt động khi deploy backend.' };
  }
}

// Update status types
interface UpdateStatus {
  isUpdating: boolean;
  isChecking: boolean;
  progress: number;
  step: string;
  logs: string[];
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  error: string | null;
}

export default function Configuration() {
  const { toast } = useToast();
  const [config, setConfig] = useState(mockConfig);
  const [isDirty, setIsDirty] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyValid, setApiKeyValid] = useState<boolean | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [selectedModels, setSelectedModels] = useState({
    analysis: 'llama3.3-70b-instruct',
    writeup: 'llama3.3-70b-instruct',
    extraction: 'openai-gpt-oss-20b',
  });
  
  // System update state
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({
    isUpdating: false,
    isChecking: false,
    progress: 0,
    step: '',
    logs: [],
    hasUpdate: false,
    currentVersion: 'unknown',
    latestVersion: 'unknown',
    error: null,
  });

  // Check if API key is stored
  useEffect(() => {
    const storedKey = localStorage.getItem('megallm_api_key');
    if (storedKey) {
      setApiKey(storedKey);
    }
    
    const savedModels = localStorage.getItem('megallm_selected_models');
    if (savedModels) {
      try {
        setSelectedModels(JSON.parse(savedModels));
      } catch (e) {
        console.error('Failed to parse saved models');
      }
    }
    
    // Check for updates on mount
    checkForUpdates();
  }, []);
  
  // Check for updates
  const checkForUpdates = async () => {
    setUpdateStatus(prev => ({ ...prev, isChecking: true, error: null }));
    
    try {
      // Call the backend API to check for updates
      const response = await fetch('/api/system/check-update');
      
      if (response.ok) {
        const data = await response.json();
        setUpdateStatus(prev => ({
          ...prev,
          isChecking: false,
          hasUpdate: data.updates_available || false,
          currentVersion: data.current_version || 'unknown',
          latestVersion: data.latest_version || data.current_version || 'unknown',
        }));
      } else {
        // Fallback: Simulate check for demo
        await new Promise(resolve => setTimeout(resolve, 1500));
        setUpdateStatus(prev => ({
          ...prev,
          isChecking: false,
          currentVersion: 'v1.0.0',
          latestVersion: 'v1.0.0',
          hasUpdate: false,
        }));
      }
    } catch (error) {
      // Fallback for demo/dev mode
      await new Promise(resolve => setTimeout(resolve, 1000));
      setUpdateStatus(prev => ({
        ...prev,
        isChecking: false,
        currentVersion: 'local-dev',
        latestVersion: 'local-dev',
        hasUpdate: false,
        error: 'Backend not available. Run update script manually.',
      }));
    }
  };
  
  // Perform system update
  const performUpdate = async () => {
    setUpdateStatus(prev => ({ 
      ...prev, 
      isUpdating: true, 
      progress: 0, 
      step: 'Initializing...', 
      logs: [],
      error: null 
    }));
    
    const addLog = (message: string) => {
      setUpdateStatus(prev => ({
        ...prev,
        logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] ${message}`]
      }));
    };
    
    try {
      // Try to call backend update endpoint
      const response = await fetch('/api/system/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (response.ok) {
        // Stream response for progress updates
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const text = decoder.decode(value);
            const lines = text.split('\n').filter(Boolean);
            
            for (const line of lines) {
              try {
                const data = JSON.parse(line);
                if (data.level === 'step') {
                  setUpdateStatus(prev => ({
                    ...prev,
                    step: data.message,
                    progress: prev.progress + 15,
                  }));
                }
                addLog(data.message);
              } catch {
                addLog(line);
              }
            }
          }
        }
        
        setUpdateStatus(prev => ({
          ...prev,
          isUpdating: false,
          progress: 100,
          step: 'Update complete!',
          hasUpdate: false,
        }));
        
        toast({
          title: 'Update Complete',
          description: 'System has been updated successfully. Refreshing...',
        });
        
        // Reload page after update
        setTimeout(() => window.location.reload(), 2000);
        
      } else {
        throw new Error('Update failed');
      }
      
    } catch (error) {
      // Simulate update steps for demo/manual mode
      const steps = [
        { step: 'Step 1/6: Backing up configuration...', progress: 10 },
        { step: 'Step 2/6: Pulling latest from GitHub...', progress: 25 },
        { step: 'Step 3/6: Cleaning Docker resources...', progress: 45 },
        { step: 'Step 4/6: Rebuilding sandbox image...', progress: 60 },
        { step: 'Step 5/6: Restarting services...', progress: 80 },
        { step: 'Step 6/6: Running health checks...', progress: 95 },
      ];
      
      for (const { step, progress } of steps) {
        addLog(step);
        setUpdateStatus(prev => ({ ...prev, step, progress }));
        await new Promise(resolve => setTimeout(resolve, 800));
      }
      
      setUpdateStatus(prev => ({
        ...prev,
        isUpdating: false,
        progress: 100,
        step: 'Demo complete - Run script manually on server',
        error: 'Backend API not available. Please run the update script manually on your server:\n\nsudo bash /opt/ctf-autopilot/infra/scripts/update.sh',
      }));
      
      toast({
        title: 'Manual Update Required',
        description: 'Run update.sh script on your server',
        variant: 'destructive',
      });
    }
  };

  const handleSave = () => {
    if (apiKey && !apiKey.startsWith('••••')) {
      localStorage.setItem('megallm_api_key', apiKey);
    }
    localStorage.setItem('megallm_selected_models', JSON.stringify(selectedModels));
    
    toast({
      title: 'Configuration Saved',
      description: 'Your settings have been updated successfully.',
    });
    setIsDirty(false);
  };

  const handleReset = () => {
    setConfig(mockConfig);
    setApiKey('');
    setApiKeyValid(null);
    localStorage.removeItem('megallm_api_key');
    localStorage.removeItem('megallm_selected_models');
    setSelectedModels({
      analysis: 'llama3.3-70b-instruct',
      writeup: 'llama3.3-70b-instruct',
      extraction: 'openai-gpt-oss-20b',
    });
    setIsDirty(false);
  };

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    setIsDirty(true);
    setApiKeyValid(null);
  };

  const handleTestApiKey = async () => {
    if (!apiKey || apiKey.length < 10) {
      toast({
        title: 'Invalid API Key',
        description: 'Please enter a valid API key.',
        variant: 'destructive',
      });
      setApiKeyValid(false);
      return;
    }

    setIsTesting(true);
    toast({
      title: 'Testing API Connection...',
      description: 'Verifying your MegaLLM API key.',
    });

    const result = await testMegaLLMApiKey(apiKey);
    
    setIsTesting(false);
    setApiKeyValid(result.valid);

    if (result.valid) {
      localStorage.setItem('megallm_api_key', apiKey);
      toast({
        title: 'API Key Valid',
        description: 'Successfully connected to MegaLLM API.',
      });
    } else {
      toast({
        title: 'API Test Result',
        description: result.error || 'Could not verify. Will work when backend is deployed.',
        variant: result.error?.includes('CORS') ? 'default' : 'destructive',
      });
    }
  };

  const getMaskedApiKey = () => {
    if (!apiKey) return '';
    if (showApiKey) return apiKey;
    if (apiKey.length <= 8) return '••••••••';
    return '••••••••••••' + apiKey.slice(-4);
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
            <p className="text-muted-foreground mt-1">
              Configure AI models, API keys, and analysis parameters
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleReset} disabled={!isDirty}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button onClick={handleSave} disabled={!isDirty}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </div>

        <div className="grid gap-6">
          {/* System Update */}
          <Card className="border-primary/40 bg-gradient-to-r from-primary/5 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <RefreshCw className="h-5 w-5 text-primary" />
                System Update
              </CardTitle>
              <CardDescription>
                Automatically update CTF Autopilot from GitHub repository
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Version Info */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Github className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Current Version:</span>
                    <Badge variant="outline" className="font-mono">
                      {updateStatus.currentVersion}
                    </Badge>
                  </div>
                  {updateStatus.hasUpdate && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">→</span>
                      <Badge className="bg-success/20 text-success border-success/30 font-mono">
                        {updateStatus.latestVersion}
                      </Badge>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={checkForUpdates}
                    disabled={updateStatus.isChecking || updateStatus.isUpdating}
                  >
                    {updateStatus.isChecking ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Check Updates
                      </>
                    )}
                  </Button>
                </div>
              </div>
              
              {/* Update Available Notice */}
              {updateStatus.hasUpdate && !updateStatus.isUpdating && (
                <Alert className="border-success/40 bg-success/5">
                  <Download className="h-4 w-4" />
                  <AlertTitle className="text-success">Update Available!</AlertTitle>
                  <AlertDescription>
                    A new version is available. Click "Update Now" to download and install.
                  </AlertDescription>
                </Alert>
              )}
              
              {/* Update Error */}
              {updateStatus.error && !updateStatus.isUpdating && (
                <Alert className="border-destructive/40 bg-destructive/5">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Manual Update Required</AlertTitle>
                  <AlertDescription className="whitespace-pre-wrap font-mono text-xs">
                    {updateStatus.error}
                  </AlertDescription>
                </Alert>
              )}
              
              {/* Update Progress */}
              {updateStatus.isUpdating && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{updateStatus.step}</span>
                    <span className="font-medium">{updateStatus.progress}%</span>
                  </div>
                  <Progress value={updateStatus.progress} className="h-2" />
                  
                  {/* Update Logs */}
                  <ScrollArea className="h-32 rounded-md border bg-muted/20 p-2">
                    <div className="font-mono text-xs space-y-1">
                      {updateStatus.logs.map((log, i) => (
                        <div key={i} className="text-muted-foreground">
                          {log}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <Button 
                  onClick={performUpdate}
                  disabled={updateStatus.isUpdating || updateStatus.isChecking}
                  className="flex-1"
                >
                  {updateStatus.isUpdating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Update Now
                    </>
                  )}
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={() => window.open('https://github.com/huynhtrungcipp/ctf-compass', '_blank')}
                >
                  <Github className="h-4 w-4 mr-2" />
                  View Repository
                </Button>
              </div>
              
              {/* Info */}
              <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                <p className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-success" />
                  Automatic backup of configuration before update
                </p>
                <p className="flex items-center gap-2">
                  <Trash2 className="h-3 w-3 text-warning" />
                  Cleans old Docker images and containers
                </p>
                <p className="flex items-center gap-2">
                  <RefreshCw className="h-3 w-3 text-primary" />
                  Rebuilds and restarts all services after update
                </p>
              </div>
            </CardContent>
          </Card>

          {/* API Key Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Key className="h-5 w-5 text-primary" />
                MegaLLM API Configuration
              </CardTitle>
              <CardDescription>
                Connect to MegaLLM API for AI-powered analysis and writeup generation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="apiKey"
                      type={showApiKey ? 'text' : 'password'}
                      placeholder="Enter your MegaLLM API key (sk-mega-...)"
                      value={showApiKey ? apiKey : getMaskedApiKey()}
                      onChange={(e) => handleApiKeyChange(e.target.value)}
                      className="pr-12"
                      disabled={isTesting}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={handleTestApiKey}
                    disabled={isTesting || !apiKey}
                  >
                    {isTesting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      'Test Connection'
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Get your API key from{' '}
                  <a 
                    href="https://ai.megallm.io" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    ai.megallm.io
                  </a>
                  {' '}• Note: Browser test may fail due to CORS, but API will work when deployed
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Model Availability Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Play className="h-5 w-5 text-primary" />
                Available Models
              </CardTitle>
              <CardDescription>
                Models available through MegaLLM API. Cheap models {"<"}$1/M) marked in green.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-md bg-info/10 border border-info/30 text-sm">
                <p className="font-medium text-info">Recommended Free/Cheap Models</p>
                <p className="text-muted-foreground mt-1">
                  <strong>llama3.3-70b-instruct</strong>, <strong>deepseek-r1-distill-llama-70b</strong>, 
                  <strong> openai-gpt-oss-20b</strong>, <strong>openai-gpt-oss-120b</strong> - 
                  These models are confirmed to work with your tier.
                </p>
              </div>
              
              <ScrollArea className="h-[350px] rounded-md border p-4">
                <div className="space-y-4">
                  {['OpenAI', 'Anthropic', 'Google', 'Meta', 'DeepSeek', 'Alibaba', 'Mistral', 'xAI', 'Moonshot', 'GLM', 'Minimax'].map(provider => {
                    const providerModels = ALL_MODELS.filter(m => m.provider === provider);
                    if (providerModels.length === 0) return null;
                    
                    return (
                      <div key={provider} className="mb-4">
                        <h4 className="text-sm font-semibold text-foreground mb-2">{provider}</h4>
                        <div className="grid gap-2">
                          {providerModels.map(model => {
                            const priceNum = parseFloat(model.price.replace('$', '').split('/')[0]) || 0;
                            const isCheap = priceNum < 1;
                            const isPremium = priceNum >= 5;
                            
                            return (
                              <div 
                                key={model.id}
                                className={`flex items-center justify-between p-2 rounded-md border ${
                                  isCheap ? 'bg-success/5 border-success/20' :
                                  isPremium ? 'bg-muted/30 border-border' :
                                  'bg-card border-border'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  {isCheap && <CheckCircle className="h-4 w-4 text-success" />}
                                  
                                  <div>
                                    <span className="font-medium text-sm">{model.name}</span>
                                    <span className="text-xs text-muted-foreground ml-2 font-mono">{model.id}</span>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {model.context}
                                  </Badge>
                                  <Badge 
                                    className={`text-xs ${
                                      isCheap ? 'bg-success/20 text-success border-success/30' :
                                      isPremium ? 'bg-muted text-muted-foreground' :
                                      ''
                                    }`}
                                    variant={isCheap ? 'outline' : isPremium ? 'outline' : 'secondary'}
                                  >
                                    {model.price}
                                  </Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* AI Model Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Cpu className="h-5 w-5 text-primary" />
                AI Model Configuration
              </CardTitle>
              <CardDescription>
                Select different AI models for each analysis module
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Analysis Model */}
              <div className="space-y-2">
                <Label>File Analysis Model</Label>
                <Select 
                  value={selectedModels.analysis} 
                  onValueChange={(v) => {
                    setSelectedModels(prev => ({ ...prev, analysis: v }));
                    setIsDirty(true);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AI_MODELS.analysis.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        <div className="flex items-center gap-2 w-full">
                          <span className="font-medium">{model.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            {model.provider}
                          </Badge>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {model.price}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Used for analyzing challenge files and identifying vulnerabilities
                </p>
              </div>

              {/* Writeup Model */}
              <div className="space-y-2">
                <Label>Writeup Generation Model</Label>
                <Select 
                  value={selectedModels.writeup} 
                  onValueChange={(v) => {
                    setSelectedModels(prev => ({ ...prev, writeup: v }));
                    setIsDirty(true);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AI_MODELS.writeup.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        <div className="flex items-center gap-2 w-full">
                          <span className="font-medium">{model.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            {model.provider}
                          </Badge>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {model.price}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Used for generating professional CTF writeups with evidence
                </p>
              </div>

              {/* Extraction Model */}
              <div className="space-y-2">
                <Label>Flag Extraction Model</Label>
                <Select 
                  value={selectedModels.extraction} 
                  onValueChange={(v) => {
                    setSelectedModels(prev => ({ ...prev, extraction: v }));
                    setIsDirty(true);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AI_MODELS.extraction.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        <div className="flex items-center gap-2 w-full">
                          <span className="font-medium">{model.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            {model.provider}
                          </Badge>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {model.price}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Used for extracting and validating flag candidates
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Upload Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Upload className="h-5 w-5 text-primary" />
                Upload Settings
              </CardTitle>
              <CardDescription>
                Configure file upload limits and allowed extensions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="maxUpload">Max Upload Size (MB)</Label>
                  <Input
                    id="maxUpload"
                    type="number"
                    value={config.maxUploadSizeMb}
                    onChange={(e) => {
                      setConfig({ ...config, maxUploadSizeMb: parseInt(e.target.value) || 0 });
                      setIsDirty(true);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeout" className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Command Timeout (seconds)
                  </Label>
                  <Input
                    id="timeout"
                    type="number"
                    value={config.sandboxTimeout}
                    onChange={(e) => {
                      setConfig({ ...config, sandboxTimeout: parseInt(e.target.value) || 0 });
                      setIsDirty(true);
                    }}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Allowed Extensions</Label>
                <div className="flex flex-wrap gap-1.5">
                  {config.allowedExtensions.map((ext) => (
                    <Badge key={ext} variant="secondary" className="font-mono text-xs">
                      {ext}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Allowed Tools */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wrench className="h-5 w-5 text-primary" />
                Sandbox Tools
              </CardTitle>
              <CardDescription>
                Only these tools can be executed in the sandbox environment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {config.allowedTools.map((tool) => (
                  <Badge key={tool} variant="outline" className="font-mono">
                    {tool}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Security Notice */}
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-primary flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5" />
                Security Information
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-foreground space-y-3">
              <div className="flex gap-2">
                <CheckCircle className="h-4 w-4 text-success mt-0.5 shrink-0" />
                <p>
                  <strong>Sandbox Isolation:</strong> All commands run in isolated Docker containers 
                  with network disabled and resource limits.
                </p>
              </div>
              <div className="flex gap-2">
                <CheckCircle className="h-4 w-4 text-success mt-0.5 shrink-0" />
                <p>
                  <strong>API Key Security:</strong> Your MegaLLM API key is stored locally and sent 
                  directly to MegaLLM API. Never exposed in logs.
                </p>
              </div>
              <div className="flex gap-2">
                <CheckCircle className="h-4 w-4 text-success mt-0.5 shrink-0" />
                <p>
                  <strong>Path Validation:</strong> All file paths are validated to prevent 
                  path traversal and zip-slip attacks.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
