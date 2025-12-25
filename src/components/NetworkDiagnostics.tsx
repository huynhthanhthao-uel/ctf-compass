import { useState, useCallback } from 'react';
import { Activity, AlertTriangle, CheckCircle, Copy, RefreshCw, Trash2, XCircle, Globe, Server, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { getBackendUrlFromStorage } from '@/lib/backend-url';
import { useToast } from '@/hooks/use-toast';

interface DiagnosticLog {
  id: string;
  timestamp: Date;
  type: 'request' | 'response' | 'error';
  method: string;
  url: string;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: string;
  error?: string;
  corsError?: boolean;
  duration?: number;
}

interface DiagnosticResult {
  test: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  details?: string;
}

// Store logs globally so they persist across component remounts
let globalLogs: DiagnosticLog[] = [];
let logListeners: Set<() => void> = new Set();

function notifyLogListeners() {
  logListeners.forEach(fn => fn());
}

export function addDiagnosticLog(log: Omit<DiagnosticLog, 'id' | 'timestamp'>) {
  const newLog: DiagnosticLog = {
    ...log,
    id: crypto.randomUUID(),
    timestamp: new Date(),
  };
  globalLogs = [newLog, ...globalLogs].slice(0, 50); // Keep last 50 logs
  notifyLogListeners();
}

export function clearDiagnosticLogs() {
  globalLogs = [];
  notifyLogListeners();
}

export function NetworkDiagnostics() {
  const { toast } = useToast();
  const [, forceUpdate] = useState({});
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[]>([]);

  // Subscribe to log updates
  useState(() => {
    const listener = () => forceUpdate({});
    logListeners.add(listener);
    return () => { logListeners.delete(listener); };
  });

  const logs = globalLogs;

  const runDiagnostics = useCallback(async () => {
    setIsRunning(true);
    setResults([]);
    const newResults: DiagnosticResult[] = [];

    const backendUrl = getBackendUrlFromStorage();

    // Test 1: Check if backend URL is configured
    if (!backendUrl) {
      newResults.push({
        test: 'Backend URL',
        status: 'error',
        message: 'Backend URL not configured',
        details: 'Go to Settings → Docker Backend URL and enter your backend address (e.g., http://192.168.168.24:8000)',
      });
      setResults(newResults);
      setIsRunning(false);
      return;
    }

    newResults.push({
      test: 'Backend URL',
      status: 'success',
      message: `Configured: ${backendUrl}`,
    });

    // Test 2: DNS/Network reachability
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      const startTime = performance.now();
      const response = await fetch(`${backendUrl}/api/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
        mode: 'cors',
      });
      const duration = Math.round(performance.now() - startTime);
      clearTimeout(timeout);

      addDiagnosticLog({
        type: 'response',
        method: 'GET',
        url: `${backendUrl}/api/health`,
        status: response.status,
        statusText: response.statusText,
        duration,
        headers: Object.fromEntries(response.headers.entries()),
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        
        if (contentType?.includes('application/json')) {
          const data = await response.json();
          
          if (data.status === 'healthy') {
            newResults.push({
              test: 'Health Check',
              status: 'success',
              message: `Backend is healthy (${duration}ms)`,
              details: `Version: ${data.version || 'unknown'}`,
            });
          } else {
            newResults.push({
              test: 'Health Check',
              status: 'warning',
              message: `Backend responded but status is: ${data.status}`,
              details: JSON.stringify(data, null, 2),
            });
          }
        } else {
          newResults.push({
            test: 'Health Check',
            status: 'error',
            message: 'Backend returned non-JSON response',
            details: `Content-Type: ${contentType}. This usually means the URL is pointing to a web server (nginx/frontend) instead of the API.`,
          });
        }
      } else {
        newResults.push({
          test: 'Health Check',
          status: 'error',
          message: `Backend returned HTTP ${response.status}`,
          details: response.statusText,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isCors = errorMessage.includes('CORS') || 
                     errorMessage.includes('Failed to fetch') ||
                     errorMessage.includes('NetworkError');
      
      addDiagnosticLog({
        type: 'error',
        method: 'GET',
        url: `${backendUrl}/api/health`,
        error: errorMessage,
        corsError: isCors,
      });

      if (isCors) {
        newResults.push({
          test: 'CORS Check',
          status: 'error',
          message: 'CORS error detected',
          details: `The browser blocked the request due to Cross-Origin Resource Sharing (CORS) policy.

SOLUTION: Add the frontend origin to CORS_ORIGINS in your Docker environment:

1. Edit docker-compose.yml:
   environment:
     - CORS_ORIGINS=${window.location.origin},http://localhost:3000

2. Restart the backend:
   docker-compose down && docker-compose up -d

Current frontend origin: ${window.location.origin}
Backend URL: ${backendUrl}`,
        });
      } else if (errorMessage.includes('abort') || errorMessage.includes('timeout')) {
        newResults.push({
          test: 'Network Connectivity',
          status: 'error',
          message: 'Connection timed out',
          details: 'The backend did not respond within 5 seconds. Check if the server is running and the port is correct.',
        });
      } else {
        newResults.push({
          test: 'Network Connectivity',
          status: 'error',
          message: 'Failed to connect',
          details: `Error: ${errorMessage}

Possible causes:
- Backend server is not running
- Wrong IP address or port
- Firewall blocking the connection
- Network not reachable`,
        });
      }
    }

    // Test 3: Check CORS headers specifically
    try {
      const response = await fetch(`${backendUrl}/api/health`, {
        method: 'OPTIONS',
        headers: {
          'Origin': window.location.origin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type',
        },
      });

      const allowOrigin = response.headers.get('access-control-allow-origin');
      const allowMethods = response.headers.get('access-control-allow-methods');
      const allowHeaders = response.headers.get('access-control-allow-headers');

      addDiagnosticLog({
        type: 'response',
        method: 'OPTIONS',
        url: `${backendUrl}/api/health`,
        status: response.status,
        statusText: 'CORS Preflight',
        headers: {
          'Access-Control-Allow-Origin': allowOrigin || 'not set',
          'Access-Control-Allow-Methods': allowMethods || 'not set',
          'Access-Control-Allow-Headers': allowHeaders || 'not set',
        },
      });

      if (allowOrigin) {
        const originMatch = allowOrigin === '*' || allowOrigin === window.location.origin;
        newResults.push({
          test: 'CORS Headers',
          status: originMatch ? 'success' : 'warning',
          message: originMatch ? 'CORS configured correctly' : 'Origin mismatch',
          details: `Allow-Origin: ${allowOrigin}
Allow-Methods: ${allowMethods || 'not set'}
Allow-Headers: ${allowHeaders || 'not set'}
Your Origin: ${window.location.origin}`,
        });
      } else {
        newResults.push({
          test: 'CORS Headers',
          status: 'warning',
          message: 'CORS headers not found in OPTIONS response',
          details: 'The preflight response did not include CORS headers. This may cause issues with POST/PATCH requests.',
        });
      }
    } catch {
      // OPTIONS might fail if CORS is completely blocked - already covered above
    }

    // Test 4: Test actual API endpoint
    try {
      const response = await fetch(`${backendUrl}/api/config`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (response.ok) {
        newResults.push({
          test: 'API Access',
          status: 'success',
          message: 'API endpoints accessible',
        });
      } else {
        newResults.push({
          test: 'API Access',
          status: 'warning',
          message: `API returned ${response.status}`,
          details: 'Some endpoints may require authentication',
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      newResults.push({
        test: 'API Access',
        status: 'error',
        message: 'Cannot access API endpoints',
        details: errorMessage,
      });
    }

    setResults(newResults);
    setIsRunning(false);
  }, []);

  const copyLogs = () => {
    const logText = logs.map(log => {
      const time = log.timestamp.toISOString();
      if (log.type === 'error') {
        return `[${time}] ERROR ${log.method} ${log.url}\n  ${log.error}${log.corsError ? ' (CORS)' : ''}`;
      }
      return `[${time}] ${log.type.toUpperCase()} ${log.method} ${log.url} - ${log.status} ${log.statusText || ''} (${log.duration}ms)`;
    }).join('\n');

    navigator.clipboard.writeText(logText);
    toast({ title: 'Copied to clipboard' });
  };

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle>Network Diagnostics</CardTitle>
          </div>
          <Button onClick={runDiagnostics} disabled={isRunning} size="sm">
            {isRunning ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Run Diagnostics
              </>
            )}
          </Button>
        </div>
        <CardDescription>
          Test backend connectivity and diagnose CORS, network, and API issues
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-muted-foreground text-xs">Frontend Origin</div>
              <code className="text-xs">{window.location.origin}</code>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            <Server className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-muted-foreground text-xs">Backend URL</div>
              <code className="text-xs">{getBackendUrlFromStorage() || 'Not configured'}</code>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-muted-foreground text-xs">Protocol</div>
              <code className="text-xs">{window.location.protocol}</code>
            </div>
          </div>
        </div>

        {/* Diagnostic Results */}
        {results.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Diagnostic Results</h4>
              {results.map((result, index) => (
                <div key={index} className="p-3 rounded-lg border border-border/50 space-y-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(result.status)}
                    <span className="font-medium text-sm">{result.test}</span>
                    <Badge variant={result.status === 'success' ? 'default' : result.status === 'warning' ? 'secondary' : 'destructive'} className="text-xs">
                      {result.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{result.message}</p>
                  {result.details && (
                    <pre className="text-xs bg-muted/50 p-2 rounded overflow-x-auto whitespace-pre-wrap font-mono">
                      {result.details}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Request Logs */}
        <Separator />
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Request Logs ({logs.length})</h4>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyLogs} disabled={logs.length === 0}>
                <Copy className="h-3 w-3 mr-1" />
                Copy
              </Button>
              <Button variant="outline" size="sm" onClick={clearDiagnosticLogs} disabled={logs.length === 0}>
                <Trash2 className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </div>
          </div>
          
          <ScrollArea className="h-48 rounded border border-border/50">
            {logs.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No requests logged yet. Run diagnostics or perform actions (Save, Upload) to see logs.
              </div>
            ) : (
              <div className="p-2 space-y-1 font-mono text-xs">
                {logs.map(log => (
                  <div 
                    key={log.id} 
                    className={`p-2 rounded ${
                      log.type === 'error' ? 'bg-red-500/10 text-red-400' : 
                      log.status && log.status >= 400 ? 'bg-yellow-500/10 text-yellow-400' :
                      'bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {log.timestamp.toLocaleTimeString()}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1">
                        {log.method}
                      </Badge>
                      <span className="truncate flex-1">{log.url}</span>
                      {log.status && (
                        <Badge variant={log.status < 400 ? 'default' : 'destructive'} className="text-[10px]">
                          {log.status}
                        </Badge>
                      )}
                      {log.duration && (
                        <span className="text-muted-foreground">{log.duration}ms</span>
                      )}
                    </div>
                    {log.error && (
                      <div className="mt-1 text-red-400">
                        {log.corsError && <Badge variant="destructive" className="text-[10px] mr-1">CORS</Badge>}
                        {log.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
