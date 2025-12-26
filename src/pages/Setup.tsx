import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Server, Wifi, WifiOff, CheckCircle, AlertCircle, ArrowRight, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { getBackendUrlFromStorage, normalizeBackendUrl, setBackendUrlToStorage } from '@/lib/backend-url';

type ConnectionStatus = 'idle' | 'testing' | 'connected' | 'error';

export default function Setup() {
  const navigate = useNavigate();
  const [backendUrl, setBackendUrl] = useState('http://localhost:8000');
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [corsHeaders, setCorsHeaders] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    const stored = getBackendUrlFromStorage();
    if (stored) {
      setBackendUrl(stored);
      // Auto-test on load if URL exists
      testConnection(stored);
    }
  }, []);

  const testConnection = async (url?: string) => {
    const testUrl = url || backendUrl;
    const normalized = normalizeBackendUrl(testUrl);
    
    if (!normalized) {
      setStatus('error');
      setError('Invalid URL format. Use http://IP:PORT or http://domain:PORT');
      return;
    }

    setStatus('testing');
    setError(null);
    setCorsHeaders(null);

    try {
      // First, test preflight (OPTIONS)
      const preflightResponse = await fetch(`${normalized}/api/health`, {
        method: 'OPTIONS',
        headers: {
          'Origin': window.location.origin,
          'Access-Control-Request-Method': 'GET',
        },
      });

      const headers: Record<string, string> = {};
      preflightResponse.headers.forEach((value, key) => {
        if (key.toLowerCase().startsWith('access-control')) {
          headers[key] = value;
        }
      });
      setCorsHeaders(headers);

      // Then test actual GET
      const response = await fetch(`${normalized}/api/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data?.status === 'healthy') {
        setStatus('connected');
        setBackendUrlToStorage(normalized);
        setBackendUrl(normalized);
      } else {
        throw new Error('Backend not healthy');
      }
    } catch (err) {
      setStatus('error');
      const msg = err instanceof Error ? err.message : 'Connection failed';
      
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        setError(`CORS blocked or server unreachable. Check that CORS_ORIGINS includes: ${window.location.origin}`);
      } else {
        setError(msg);
      }
    }
  };

  const handleContinue = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-50">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--border)) 1px, transparent 0)`,
          backgroundSize: '32px 32px'
        }} />
      </div>

      <Card className="w-full max-w-lg relative border-border shadow-lg animate-fade-in">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="flex justify-center">
            <div className="h-14 w-14 rounded-xl bg-primary flex items-center justify-center shadow-lg">
              <Server className="h-7 w-7 text-primary-foreground" />
            </div>
          </div>
          <div className="space-y-1">
            <CardTitle className="text-xl font-semibold text-foreground">
              CTF Autopilot Setup
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Connect to your Docker backend server
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-6">
          {/* Backend URL Input */}
          <div className="space-y-2">
            <Label htmlFor="backend-url" className="text-foreground">
              Docker Backend URL
            </Label>
            <div className="flex gap-2">
              <Input
                id="backend-url"
                type="text"
                value={backendUrl}
                onChange={(e) => setBackendUrl(e.target.value)}
                placeholder="http://192.168.1.100:8000"
                className="flex-1"
              />
              <Button 
                onClick={() => testConnection()} 
                disabled={status === 'testing'}
                variant="secondary"
              >
                {status === 'testing' ? (
                  <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Test'
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter the IP/hostname and port of your Docker backend (e.g., http://YOUR_SERVER_IP:8000)
            </p>
          </div>

          {/* Status Badge */}
          <div className="flex justify-center">
            {status === 'connected' && (
              <Badge variant="outline" className="gap-1.5 text-emerald-600 border-emerald-600/30 bg-emerald-500/10">
                <Wifi className="h-3 w-3" />
                Backend Connected
              </Badge>
            )}
            {status === 'error' && (
              <Badge variant="outline" className="gap-1.5 text-destructive border-destructive/30 bg-destructive/10">
                <WifiOff className="h-3 w-3" />
                Connection Failed
              </Badge>
            )}
            {status === 'testing' && (
              <Badge variant="outline" className="gap-1.5 text-amber-600 border-amber-600/30 bg-amber-500/10">
                <span className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Testing...
              </Badge>
            )}
            {status === 'idle' && (
              <Badge variant="outline" className="gap-1.5 text-muted-foreground">
                <Settings2 className="h-3 w-3" />
                Not configured
              </Badge>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* CORS Headers Display */}
          {corsHeaders && Object.keys(corsHeaders).length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">CORS Headers Received:</Label>
              <div className="bg-muted/50 rounded-md p-3 text-xs font-mono space-y-1 max-h-32 overflow-auto">
                {Object.entries(corsHeaders).map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <span className="text-primary">{key}:</span>
                    <span className={value === '*' ? 'text-amber-500' : 'text-emerald-500'}>{value}</span>
                  </div>
                ))}
              </div>
              {corsHeaders['access-control-allow-origin'] === '*' && (
                <p className="text-xs text-amber-500">
                  ⚠️ Wildcard origin (*) detected. For better security, set CORS_ORIGINS={window.location.origin} in your .env
                </p>
              )}
            </div>
          )}

          {/* Success Info */}
          {status === 'connected' && (
            <Alert className="border-emerald-600/30 bg-emerald-500/10">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-emerald-600">
                Backend is healthy and CORS is configured correctly!
              </AlertDescription>
            </Alert>
          )}

          {/* Continue Button */}
          <Button 
            onClick={handleContinue} 
            className="w-full"
            disabled={status !== 'connected'}
          >
            Continue to Dashboard
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          {/* Skip for demo */}
          <div className="text-center">
            <Button 
              variant="link" 
              className="text-muted-foreground text-sm"
              onClick={() => navigate('/dashboard')}
            >
              Skip and use Demo Mode
            </Button>
          </div>

          {/* Help Links */}
          <div className="pt-4 border-t border-border flex justify-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/cors-tester')}>
              CORS Tester
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/config')}>
              Full Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
