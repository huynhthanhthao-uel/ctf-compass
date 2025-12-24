import { useState, useEffect } from 'react';
import { Save, RotateCcw, Shield, Clock, Upload, Wrench, Key, Cpu, CheckCircle, XCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AppLayout } from '@/components/layout/AppLayout';
import { useToast } from '@/hooks/use-toast';
import { mockConfig } from '@/lib/mock-data';

// AI Models for different tasks with MegaLLM pricing
const AI_MODELS = {
  analysis: [
    { id: 'gpt-5', name: 'GPT-5', provider: 'OpenAI', price: '$1.25/$10.00/M', description: 'Most powerful, best for complex analysis' },
    { id: 'claude-opus-4-1-20250805', name: 'Claude Opus 4.1', provider: 'Anthropic', price: '$15.00/$75.00/M', description: 'Premium reasoning & analysis' },
    { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', provider: 'Anthropic', price: '$3.00/$15.00/M', description: 'Excellent reasoning, 200K context' },
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'Anthropic', price: '$3.00/$15.00/M', description: 'Great balance of speed & quality' },
    { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'OpenAI', price: '$2.00/$8.00/M', description: 'Strong performance, 128K context' },
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', price: '$2.50/$10.00/M', description: 'Multimodal capabilities' },
    { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill', provider: 'DeepSeek', price: 'Free tier', description: 'Strong reasoning, free' },
    { id: 'openai-gpt-oss-120b', name: 'GPT-OSS 120B', provider: 'OpenAI', price: 'Free tier', description: 'Large open source model' },
    { id: 'llama3.3-70b-instruct', name: 'Llama 3.3 70B', provider: 'Meta', price: 'Free tier', description: 'Open source, reliable' },
  ],
  writeup: [
    { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', provider: 'Anthropic', price: '$3.00/$15.00/M', description: 'Best for detailed writeups' },
    { id: 'claude-opus-4-1-20250805', name: 'Claude Opus 4.1', provider: 'Anthropic', price: '$15.00/$75.00/M', description: 'Premium quality writing' },
    { id: 'gpt-5', name: 'GPT-5', provider: 'OpenAI', price: '$1.25/$10.00/M', description: 'Detailed technical explanations' },
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'Anthropic', price: '$3.00/$15.00/M', description: 'Quality & speed balance' },
    { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill', provider: 'DeepSeek', price: 'Free tier', description: 'Strong reasoning, free' },
    { id: 'openai-gpt-oss-120b', name: 'GPT-OSS 120B', provider: 'OpenAI', price: 'Free tier', description: 'Large open source' },
    { id: 'llama3.3-70b-instruct', name: 'Llama 3.3 70B', provider: 'Meta', price: 'Free tier', description: 'Free, good quality' },
  ],
  extraction: [
    { id: 'gpt-5-mini', name: 'GPT-5 Mini', provider: 'OpenAI', price: '$0.25/$2.00/M', description: 'Fast & cheap, great for extraction' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', price: '$0.15/$0.60/M', description: 'Cheapest paid option' },
    { id: 'openai-gpt-oss-20b', name: 'GPT-OSS 20B', provider: 'OpenAI', price: 'Free tier', description: 'Free, fast & light' },
    { id: 'openai-gpt-oss-120b', name: 'GPT-OSS 120B', provider: 'OpenAI', price: 'Free tier', description: 'Free, more accurate' },
    { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill', provider: 'DeepSeek', price: 'Free tier', description: 'Free, good reasoning' },
    { id: 'llama3.3-70b-instruct', name: 'Llama 3.3 70B', provider: 'Meta', price: 'Free tier', description: 'Free, reliable' },
  ],
};

// Test API key by making a real call to MegaLLM
async function testMegaLLMApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch('https://ai.megallm.io/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama3.3-70b-instruct', // Use free tier model for testing
        messages: [
          { role: 'user', content: 'Hi' }
        ],
        max_tokens: 3, // Minimal tokens to save cost
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      return { valid: true };
    }

    // Handle specific error codes
    if (response.status === 401) {
      return { valid: false, error: 'API key không hợp lệ. Vui lòng kiểm tra lại.' };
    }
    if (response.status === 403) {
      const msg = data.error?.message || 'Không có quyền truy cập.';
      // Check if it's a model access issue
      if (msg.includes('tier') || msg.includes('model')) {
        return { valid: false, error: `Tài khoản không có quyền: ${msg}` };
      }
      return { valid: false, error: 'API key không có quyền truy cập.' };
    }
    if (response.status === 429) {
      return { valid: false, error: 'Vượt giới hạn request. Vui lòng thử lại sau.' };
    }
    if (response.status === 402) {
      return { valid: false, error: 'Hết credits. Vui lòng nạp thêm.' };
    }

    return { 
      valid: false, 
      error: data.error?.message || `Lỗi API: ${response.status}` 
    };
  } catch (error) {
    console.error('API test error:', error);
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Lỗi mạng. Kiểm tra kết nối internet.' 
    };
  }
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

  // Check if API key is stored
  useEffect(() => {
    const storedKey = localStorage.getItem('megallm_api_key');
    if (storedKey) {
      setApiKey(storedKey);
      // Don't auto-validate on load, user needs to test manually
    }
  }, []);

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
