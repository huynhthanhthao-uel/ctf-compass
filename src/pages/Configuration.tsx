import { useState, useEffect } from 'react';
import { Save, RotateCcw, Shield, Clock, Upload, Wrench, Key, Cpu, CheckCircle, XCircle, Loader2, Eye, EyeOff, Play, RefreshCw } from 'lucide-react';
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

// Categorized models for task selection
const AI_MODELS = {
  analysis: ALL_MODELS.filter(m => ['gpt-5', 'gpt-5.1', 'claude-opus-4-5-20251101', 'claude-sonnet-4-5-20250929', 'gemini-2.5-pro', 'deepseek-v3.2', 'llama3.3-70b-instruct'].includes(m.id)),
  writeup: ALL_MODELS.filter(m => ['claude-sonnet-4-5-20250929', 'claude-opus-4-5-20251101', 'gpt-5', 'gemini-2.5-pro', 'deepseek-r1-distill-llama-70b'].includes(m.id)),
  extraction: ALL_MODELS.filter(m => ['gpt-5-mini', 'gpt-4o-mini', 'openai-gpt-oss-20b', 'alibaba-qwen3-32b', 'gemini-2.5-flash', 'llama3.3-70b-instruct'].includes(m.id)),
};

type ModelStatus = 'idle' | 'testing' | 'available' | 'unavailable';

interface ModelTestResult {
  id: string;
  status: ModelStatus;
  error?: string;
}

// Test a single model
async function testModel(apiKey: string, modelId: string): Promise<{ available: boolean; error?: string }> {
  try {
    const response = await fetch('https://ai.megallm.io/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      return { available: true };
    }

    if (response.status === 403) {
      return { available: false, error: data.error?.message || 'No access' };
    }
    if (response.status === 401) {
      return { available: false, error: 'Invalid API key' };
    }

    return { available: false, error: data.error?.message || `Error ${response.status}` };
  } catch (error) {
    return { available: false, error: 'Network error' };
  }
}

// Test API key by making a real call to MegaLLM
async function testMegaLLMApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  const result = await testModel(apiKey, 'llama3.3-70b-instruct');
  return { valid: result.available, error: result.error };
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
    analysis: 'gpt-5',
    writeup: 'claude-sonnet-4-5-20250929',
    extraction: 'gpt-5-mini',
  });
  
  // Model testing state
  const [modelResults, setModelResults] = useState<Record<string, ModelTestResult>>({});
  const [isTestingModels, setIsTestingModels] = useState(false);
  const [testProgress, setTestProgress] = useState({ current: 0, total: 0 });

  // Check if API key is stored
  useEffect(() => {
    const storedKey = localStorage.getItem('megallm_api_key');
    if (storedKey) {
      setApiKey(storedKey);
    }
    
    // Load saved model results
    const savedResults = localStorage.getItem('megallm_model_results');
    if (savedResults) {
      try {
        setModelResults(JSON.parse(savedResults));
      } catch (e) {
        console.error('Failed to parse saved model results');
      }
    }
  }, []);

  // Test all models
  const handleTestAllModels = async () => {
    if (!apiKey || apiKey.length < 10) {
      toast({
        title: 'API Key Required',
        description: 'Please enter your API key first.',
        variant: 'destructive',
      });
      return;
    }

    setIsTestingModels(true);
    setTestProgress({ current: 0, total: ALL_MODELS.length });
    
    const results: Record<string, ModelTestResult> = {};
    
    // Initialize all models as testing
    ALL_MODELS.forEach(model => {
      results[model.id] = { id: model.id, status: 'idle' };
    });
    setModelResults({ ...results });

    toast({
      title: 'Testing All Models',
      description: `Testing ${ALL_MODELS.length} models. This may take a few minutes...`,
    });

    // Test models in batches of 3 to avoid rate limiting
    const batchSize = 3;
    for (let i = 0; i < ALL_MODELS.length; i += batchSize) {
      const batch = ALL_MODELS.slice(i, i + batchSize);
      
      // Mark batch as testing
      batch.forEach(model => {
        results[model.id] = { id: model.id, status: 'testing' };
      });
      setModelResults({ ...results });
      
      // Test batch in parallel
      const batchResults = await Promise.all(
        batch.map(async (model) => {
          const result = await testModel(apiKey, model.id);
          return { 
            id: model.id, 
            available: result.available, 
            error: result.error 
          };
        })
      );
      
      // Update results
      batchResults.forEach(result => {
        results[result.id] = {
          id: result.id,
          status: result.available ? 'available' : 'unavailable',
          error: result.error,
        };
      });
      setModelResults({ ...results });
      setTestProgress({ current: Math.min(i + batchSize, ALL_MODELS.length), total: ALL_MODELS.length });
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < ALL_MODELS.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    setIsTestingModels(false);
    
    // Save results to localStorage
    localStorage.setItem('megallm_model_results', JSON.stringify(results));
    
    const availableCount = Object.values(results).filter(r => r.status === 'available').length;
    toast({
      title: 'Model Testing Complete',
      description: `${availableCount}/${ALL_MODELS.length} models available with your API key.`,
    });
  };

  const handleSave = () => {
    // Save API key to localStorage
    if (apiKey && !apiKey.startsWith('••••')) {
      localStorage.setItem('megallm_api_key', apiKey);
    }
    
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
    setIsDirty(false);
  };

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    setIsDirty(true);
    setApiKeyValid(null); // Reset validation status when key changes
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
        title: 'API Key Invalid',
        description: result.error || 'Failed to connect. Please check your API key.',
        variant: 'destructive',
      });
    }
  };

  // Mask API key for display
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
                      placeholder="Enter your MegaLLM API key"
                      value={showApiKey ? apiKey : getMaskedApiKey()}
                      onChange={(e) => handleApiKeyChange(e.target.value)}
                      className="pr-20"
                      disabled={isTesting}
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                      {apiKeyValid !== null && !isTesting && (
                        apiKeyValid ? (
                          <CheckCircle className="h-4 w-4 text-success" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )
                      )}
                    </div>
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
                  {' '}• Test makes a minimal API call to verify your key
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Model Availability Test */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Play className="h-5 w-5 text-primary" />
                Model Availability Test
              </CardTitle>
              <CardDescription>
                Test which AI models are available with your API key tier
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {Object.keys(modelResults).length > 0 ? (
                      <>
                        <span className="text-success font-medium">
                          {Object.values(modelResults).filter(r => r.status === 'available').length}
                        </span>
                        {' / '}
                        {ALL_MODELS.length} models available
                      </>
                    ) : (
                      `Test ${ALL_MODELS.length} models to see which ones you can use`
                    )}
                  </p>
                </div>
                <Button 
                  onClick={handleTestAllModels}
                  disabled={isTestingModels || !apiKey}
                >
                  {isTestingModels ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Testing {testProgress.current}/{testProgress.total}
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Test All Models
                    </>
                  )}
                </Button>
              </div>
              
              {Object.keys(modelResults).length > 0 && (
                <ScrollArea className="h-[400px] rounded-md border p-4">
                  <div className="space-y-2">
                    {/* Group by provider */}
                    {['OpenAI', 'Anthropic', 'Google', 'Meta', 'DeepSeek', 'Alibaba', 'Mistral', 'xAI', 'Moonshot', 'GLM', 'Minimax'].map(provider => {
                      const providerModels = ALL_MODELS.filter(m => m.provider === provider);
                      if (providerModels.length === 0) return null;
                      
                      return (
                        <div key={provider} className="mb-4">
                          <h4 className="text-sm font-semibold text-muted-foreground mb-2">{provider}</h4>
                          <div className="grid gap-2">
                            {providerModels.map(model => {
                              const result = modelResults[model.id];
                              const status = result?.status || 'idle';
                              
                              return (
                                <div 
                                  key={model.id}
                                  className={`flex items-center justify-between p-2 rounded-md border ${
                                    status === 'available' ? 'bg-success/10 border-success/30' :
                                    status === 'unavailable' ? 'bg-destructive/10 border-destructive/30' :
                                    status === 'testing' ? 'bg-muted/50 border-muted' :
                                    'bg-card border-border'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    {status === 'testing' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                                    {status === 'available' && <CheckCircle className="h-4 w-4 text-success" />}
                                    {status === 'unavailable' && <XCircle className="h-4 w-4 text-destructive" />}
                                    {status === 'idle' && <div className="h-4 w-4" />}
                                    
                                    <div>
                                      <span className="font-medium text-sm">{model.name}</span>
                                      <span className="text-xs text-muted-foreground ml-2">{model.id}</span>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">
                                      {model.context}
                                    </Badge>
                                    <Badge 
                                      variant={model.price.includes('$0.') ? 'secondary' : 'default'}
                                      className="text-xs"
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
              )}
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
                    {AI_MODELS.analysis.map((model) => {
                      const result = modelResults[model.id];
                      const isAvailable = result?.status === 'available';
                      const isTested = result?.status === 'available' || result?.status === 'unavailable';
                      
                      return (
                        <SelectItem 
                          key={model.id} 
                          value={model.id}
                          disabled={isTested && !isAvailable}
                        >
                          <div className="flex items-center gap-2 w-full">
                            {isTested && (
                              isAvailable ? 
                                <CheckCircle className="h-3 w-3 text-success" /> : 
                                <XCircle className="h-3 w-3 text-destructive" />
                            )}
                            <span className={`font-medium ${isTested && !isAvailable ? 'text-muted-foreground' : ''}`}>
                              {model.name}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {model.provider}
                            </Badge>
                            <span className="text-xs text-muted-foreground ml-auto">
                              {model.price}
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
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
                    {AI_MODELS.writeup.map((model) => {
                      const result = modelResults[model.id];
                      const isAvailable = result?.status === 'available';
                      const isTested = result?.status === 'available' || result?.status === 'unavailable';
                      
                      return (
                        <SelectItem 
                          key={model.id} 
                          value={model.id}
                          disabled={isTested && !isAvailable}
                        >
                          <div className="flex items-center gap-2 w-full">
                            {isTested && (
                              isAvailable ? 
                                <CheckCircle className="h-3 w-3 text-success" /> : 
                                <XCircle className="h-3 w-3 text-destructive" />
                            )}
                            <span className={`font-medium ${isTested && !isAvailable ? 'text-muted-foreground' : ''}`}>
                              {model.name}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {model.provider}
                            </Badge>
                            <span className="text-xs text-muted-foreground ml-auto">
                              {model.price}
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
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
                    {AI_MODELS.extraction.map((model) => {
                      const result = modelResults[model.id];
                      const isAvailable = result?.status === 'available';
                      const isTested = result?.status === 'available' || result?.status === 'unavailable';
                      
                      return (
                        <SelectItem 
                          key={model.id} 
                          value={model.id}
                          disabled={isTested && !isAvailable}
                        >
                          <div className="flex items-center gap-2 w-full">
                            {isTested && (
                              isAvailable ? 
                                <CheckCircle className="h-3 w-3 text-success" /> : 
                                <XCircle className="h-3 w-3 text-destructive" />
                            )}
                            <span className={`font-medium ${isTested && !isAvailable ? 'text-muted-foreground' : ''}`}>
                              {model.name}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {model.provider}
                            </Badge>
                            <span className="text-xs text-muted-foreground ml-auto">
                              {model.price}
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
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
