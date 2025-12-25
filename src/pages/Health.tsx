import { useState, useEffect, useCallback } from 'react';
import { 
  RefreshCw, 
  Server, 
  Cloud, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Trash2,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AppLayout } from '@/components/layout/AppLayout';
import { getSupabaseClient, isSupabaseConfigured } from '@/integrations/supabase/safe-client';
import { getBackendUrlFromStorage, getBackendUrlHeaders } from '@/lib/backend-url';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface HealthCheck {
  name: string;
  status: 'checking' | 'ok' | 'error' | 'warning';
  message: string;
  details?: string;
  timestamp?: Date;
}

export default function Health() {
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [backendUrl, setBackendUrl] = useState<string | null>(null);
  const [rawStoredValue, setRawStoredValue] = useState<string | null>(null);
  const [edgeFunctionLogs, setEdgeFunctionLogs] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const runHealthChecks = useCallback(async () => {
    setIsChecking(true);
    setChecks([]);
    setEdgeFunctionLogs([]);

    const newChecks: HealthCheck[] = [];

    // 1. Check localStorage value
    const raw = localStorage.getItem('ctf_backend_url');
    setRawStoredValue(raw);
    const normalized = getBackendUrlFromStorage();
    setBackendUrl(normalized);

    newChecks.push({
      name: 'LocalStorage Backend URL',
      status: normalized ? 'ok' : raw ? 'error' : 'warning',
      message: normalized 
        ? `Valid: ${normalized}` 
        : raw 
          ? `Invalid value: "${raw}"` 
          : 'Not configured',
      details: raw && !normalized 
        ? 'The stored value is not a valid URL. Go to Settings to set a proper URL.'
        : undefined,
      timestamp: new Date(),
    });

    // 2. Check Docker backend direct connection
    if (normalized) {
      try {
        const response = await fetch(`${normalized}/api/health`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(10000),
        });
        
        if (response.ok) {
          const data = await response.json();
          newChecks.push({
            name: 'Docker Backend Direct',
            status: data.status === 'healthy' ? 'ok' : 'warning',
            message: data.status === 'healthy' ? 'Connected and healthy' : `Status: ${data.status}`,
            details: JSON.stringify(data, null, 2),
            timestamp: new Date(),
          });
        } else {
          newChecks.push({
            name: 'Docker Backend Direct',
            status: 'error',
            message: `HTTP ${response.status}`,
            details: await response.text(),
            timestamp: new Date(),
          });
        }
      } catch (err) {
        newChecks.push({
          name: 'Docker Backend Direct',
          status: 'error',
          message: err instanceof Error ? err.message : 'Connection failed',
          details: 'Could not reach the backend directly. Check if it is running and the URL is correct.',
          timestamp: new Date(),
        });
      }
    } else {
      newChecks.push({
        name: 'Docker Backend Direct',
        status: 'warning',
        message: 'Skipped - no valid backend URL',
        timestamp: new Date(),
      });
    }

    // 3. Check Edge Function (sandbox-terminal)
    if (!isSupabaseConfigured()) {
      newChecks.push({
        name: 'Cloud Function (sandbox-terminal)',
        status: 'warning',
        message: 'Skipped - cloud mode is not configured in this deployment',
        timestamp: new Date(),
      });
    } else {
      const supabase = await getSupabaseClient();

      if (!supabase) {
        newChecks.push({
          name: 'Cloud Function (sandbox-terminal)',
          status: 'warning',
          message: 'Skipped - cloud client unavailable',
          timestamp: new Date(),
        });
      } else {
        try {
          const headers = getBackendUrlHeaders();
          const { data, error } = await supabase.functions.invoke('sandbox-terminal', {
            body: { job_id: 'health-check', tool: 'echo', args: ['health-test'] },
            headers,
          });

          if (error) {
            newChecks.push({
              name: 'Cloud Function (sandbox-terminal)',
              status: 'error',
              message: error.message,
              timestamp: new Date(),
            });
            setEdgeFunctionLogs(prev => [...prev, `Error: ${error.message}`]);
          } else if (data?.error) {
            newChecks.push({
              name: 'Cloud Function (sandbox-terminal)',
              status: 'error',
              message: data.error,
              details: data.stderr || data.hint,
              timestamp: new Date(),
            });
            setEdgeFunctionLogs(prev => [...prev, `Response error: ${data.error}`, data.stderr || '']);
          } else if (data?.exit_code === 0) {
            newChecks.push({
              name: 'Cloud Function (sandbox-terminal)',
              status: 'ok',
              message: 'Working correctly',
              details: `stdout: ${data.stdout}`,
              timestamp: new Date(),
            });
            setEdgeFunctionLogs(prev => [...prev, `Success: exit_code=0, stdout="${data.stdout}"`]);
          } else {
            newChecks.push({
              name: 'Cloud Function (sandbox-terminal)',
              status: 'warning',
              message: `exit_code: ${data?.exit_code}`,
              details: data?.stderr || JSON.stringify(data),
              timestamp: new Date(),
            });
            setEdgeFunctionLogs(prev => [...prev, `Warning: ${JSON.stringify(data)}`]);
          }
        } catch (err) {
          newChecks.push({
            name: 'Cloud Function (sandbox-terminal)',
            status: 'error',
            message: err instanceof Error ? err.message : 'Unknown error',
            timestamp: new Date(),
          });
          setEdgeFunctionLogs(prev => [...prev, `Exception: ${err}`]);
        }
      }
    }

    // 4. Check WebSocket (job-progress)
    if (!isSupabaseConfigured()) {
      newChecks.push({
        name: 'WebSocket (job-progress)',
        status: 'warning',
        message: 'Skipped - cloud mode is not configured in this deployment',
        timestamp: new Date(),
      });
    } else {
      try {
        const ws = new WebSocket(
          `wss://mjnunfojcevetemeynut.supabase.co/functions/v1/job-progress?job_id=health-test`
        );

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            ws.close();
            reject(new Error('WebSocket connection timeout'));
          }, 5000);

          ws.onopen = () => {
            clearTimeout(timeout);
            newChecks.push({
              name: 'WebSocket (job-progress)',
              status: 'ok',
              message: 'Connection successful',
              timestamp: new Date(),
            });
            ws.close();
            resolve();
          };

          ws.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('WebSocket connection failed'));
          };
        });
      } catch (err) {
        newChecks.push({
          name: 'WebSocket (job-progress)',
          status: 'error',
          message: err instanceof Error ? err.message : 'Connection failed',
          timestamp: new Date(),
        });
      }
    }

    setChecks(newChecks);
    setIsChecking(false);
  }, []);

  useEffect(() => {
    runHealthChecks();
  }, [runHealthChecks]);

  const handleClearBackendUrl = () => {
    localStorage.removeItem('ctf_backend_url');
    setRawStoredValue(null);
    setBackendUrl(null);
    runHealthChecks();
  };

  const handleCopyDebugInfo = () => {
    const debugInfo = {
      timestamp: new Date().toISOString(),
      rawStoredValue,
      normalizedUrl: backendUrl,
      checks: checks.map(c => ({
        name: c.name,
        status: c.status,
        message: c.message,
        details: c.details,
      })),
      edgeFunctionLogs,
    };
    navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusIcon = (status: HealthCheck['status']) => {
    switch (status) {
      case 'ok':
        return <CheckCircle className="h-5 w-5 text-success" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-warning" />;
      default:
        return <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: HealthCheck['status']) => {
    switch (status) {
      case 'ok':
        return <Badge className="bg-success/20 text-success border-success/30">OK</Badge>;
      case 'error':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Error</Badge>;
      case 'warning':
        return <Badge className="bg-warning/20 text-warning border-warning/30">Warning</Badge>;
      default:
        return <Badge className="bg-muted text-muted-foreground">Checking...</Badge>;
    }
  };

  const overallStatus = checks.length === 0 
    ? 'checking' 
    : checks.every(c => c.status === 'ok') 
      ? 'ok' 
      : checks.some(c => c.status === 'error') 
        ? 'error' 
        : 'warning';

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">System Health</h1>
            <p className="text-muted-foreground mt-1">
              Debug backend connectivity and edge function status
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleCopyDebugInfo}>
              {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {copied ? 'Copied!' : 'Copy Debug Info'}
            </Button>
            <Button onClick={runHealthChecks} disabled={isChecking}>
              <RefreshCw className={cn("h-4 w-4 mr-2", isChecking && "animate-spin")} />
              Re-check
            </Button>
          </div>
        </div>

        {/* Overall Status */}
        <Card className={cn(
          "border-2",
          overallStatus === 'ok' && "border-success/50 bg-success/5",
          overallStatus === 'error' && "border-destructive/50 bg-destructive/5",
          overallStatus === 'warning' && "border-warning/50 bg-warning/5",
          overallStatus === 'checking' && "border-muted"
        )}>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              {getStatusIcon(overallStatus)}
              Overall Status: {overallStatus === 'checking' ? 'Checking...' : overallStatus.toUpperCase()}
            </CardTitle>
          </CardHeader>
        </Card>

        {/* Backend URL Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Backend URL Configuration
            </CardTitle>
            <CardDescription>
              Current stored value and validation status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30">
                <span className="text-sm font-medium">Raw localStorage value:</span>
                <code className="text-xs bg-background px-2 py-1 rounded max-w-[300px] truncate">
                  {rawStoredValue || '(not set)'}
                </code>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30">
                <span className="text-sm font-medium">Normalized URL:</span>
                <code className="text-xs bg-background px-2 py-1 rounded max-w-[300px] truncate">
                  {backendUrl || '(invalid or not set)'}
                </code>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleClearBackendUrl}>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Stored URL
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/configuration">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Go to Settings
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Health Checks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5" />
              Health Checks
            </CardTitle>
            <CardDescription>
              Status of each system component
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {checks.map((check, index) => (
              <div 
                key={index} 
                className={cn(
                  "p-4 rounded-lg border",
                  check.status === 'ok' && "bg-success/5 border-success/20",
                  check.status === 'error' && "bg-destructive/5 border-destructive/20",
                  check.status === 'warning' && "bg-warning/5 border-warning/20",
                  check.status === 'checking' && "bg-muted/30 border-muted"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(check.status)}
                    <span className="font-medium">{check.name}</span>
                  </div>
                  {getStatusBadge(check.status)}
                </div>
                <p className="text-sm text-muted-foreground">{check.message}</p>
                {check.details && (
                  <pre className="mt-2 p-2 rounded bg-background/50 text-xs overflow-auto max-h-32">
                    {check.details}
                  </pre>
                )}
                {check.timestamp && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Checked at: {check.timestamp.toLocaleTimeString()}
                  </p>
                )}
              </div>
            ))}

            {checks.length === 0 && isChecking && (
              <div className="text-center py-8 text-muted-foreground">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                Running health checks...
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edge Function Logs */}
        {edgeFunctionLogs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Edge Function Logs</CardTitle>
              <CardDescription>
                Recent responses from sandbox-terminal edge function
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-40 rounded-md border bg-muted/20 p-3">
                <div className="font-mono text-xs space-y-1">
                  {edgeFunctionLogs.map((log, i) => (
                    <div key={i} className="text-muted-foreground">
                      {log}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Quick Fix Suggestions */}
        {overallStatus === 'error' && (
          <Alert className="border-destructive/40 bg-destructive/5">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Issues Detected</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>Here are some steps to fix common issues:</p>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Go to <Link to="/configuration" className="underline font-medium">Settings</Link> and set a valid Docker Backend URL</li>
                <li>Make sure your backend is running: <code className="bg-muted px-1 rounded">docker compose up -d</code></li>
                <li>Verify the backend is reachable from your browser</li>
                <li>Check that port 8000 (or your configured port) is open</li>
              </ol>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </AppLayout>
  );
}
