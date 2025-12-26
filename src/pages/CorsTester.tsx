import { useState } from 'react';
import { Play, Copy, CheckCircle, AlertCircle, Wifi, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppLayout } from '@/components/layout/AppLayout';
import { getBackendUrlFromStorage } from '@/lib/backend-url';
import { useToast } from '@/hooks/use-toast';

interface TestResult {
  id: string;
  timestamp: Date;
  method: string;
  url: string;
  status: 'success' | 'error' | 'cors-error';
  statusCode?: number;
  duration: number;
  headers: Record<string, string>;
  error?: string;
}

export default function CorsTester() {
  const { toast } = useToast();
  const [testUrl, setTestUrl] = useState(() => {
    const stored = getBackendUrlFromStorage();
    return stored ? `${stored}/api/health` : 'http://localhost:8000/api/health';
  });
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<TestResult | null>(null);

  const runPreflightTest = async () => {
    setIsRunning(true);
    const startTime = performance.now();
    const id = crypto.randomUUID();

    try {
      const response = await fetch(testUrl, {
        method: 'OPTIONS',
        headers: {
          'Origin': window.location.origin,
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'Content-Type, Accept',
        },
      });

      const duration = Math.round(performance.now() - startTime);
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      const result: TestResult = {
        id,
        timestamp: new Date(),
        method: 'OPTIONS (Preflight)',
        url: testUrl,
        status: response.ok ? 'success' : 'error',
        statusCode: response.status,
        duration,
        headers,
      };

      setResults(prev => [result, ...prev]);
      setSelectedResult(result);
    } catch (err) {
      const duration = Math.round(performance.now() - startTime);
      const result: TestResult = {
        id,
        timestamp: new Date(),
        method: 'OPTIONS (Preflight)',
        url: testUrl,
        status: 'cors-error',
        duration,
        headers: {},
        error: err instanceof Error ? err.message : 'Network error - likely CORS blocked',
      };

      setResults(prev => [result, ...prev]);
      setSelectedResult(result);
    } finally {
      setIsRunning(false);
    }
  };

  const runGetTest = async () => {
    setIsRunning(true);
    const startTime = performance.now();
    const id = crypto.randomUUID();

    try {
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        credentials: 'include',
      });

      const duration = Math.round(performance.now() - startTime);
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      const result: TestResult = {
        id,
        timestamp: new Date(),
        method: 'GET',
        url: testUrl,
        status: response.ok ? 'success' : 'error',
        statusCode: response.status,
        duration,
        headers,
      };

      setResults(prev => [result, ...prev]);
      setSelectedResult(result);
    } catch (err) {
      const duration = Math.round(performance.now() - startTime);
      const result: TestResult = {
        id,
        timestamp: new Date(),
        method: 'GET',
        url: testUrl,
        status: 'cors-error',
        duration,
        headers: {},
        error: err instanceof Error ? err.message : 'Network error - likely CORS blocked',
      };

      setResults(prev => [result, ...prev]);
      setSelectedResult(result);
    } finally {
      setIsRunning(false);
    }
  };

  const runPostTest = async () => {
    setIsRunning(true);
    const startTime = performance.now();
    const id = crypto.randomUUID();

    try {
      const response = await fetch(testUrl.replace('/health', '/auth/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ password: 'test' }),
        credentials: 'include',
      });

      const duration = Math.round(performance.now() - startTime);
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      const result: TestResult = {
        id,
        timestamp: new Date(),
        method: 'POST (Login)',
        url: testUrl.replace('/health', '/auth/login'),
        status: response.ok || response.status === 401 ? 'success' : 'error',
        statusCode: response.status,
        duration,
        headers,
      };

      setResults(prev => [result, ...prev]);
      setSelectedResult(result);
    } catch (err) {
      const duration = Math.round(performance.now() - startTime);
      const result: TestResult = {
        id,
        timestamp: new Date(),
        method: 'POST (Login)',
        url: testUrl.replace('/health', '/auth/login'),
        status: 'cors-error',
        duration,
        headers: {},
        error: err instanceof Error ? err.message : 'Network error - likely CORS blocked',
      };

      setResults(prev => [result, ...prev]);
      setSelectedResult(result);
    } finally {
      setIsRunning(false);
    }
  };

  const copyHeaders = () => {
    if (!selectedResult) return;
    const text = Object.entries(selectedResult.headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  const clearResults = () => {
    setResults([]);
    setSelectedResult(null);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">CORS & Network Tester</h1>
          <p className="text-muted-foreground">
            Test CORS preflight requests and inspect response headers
          </p>
        </div>

        {/* Current Origin Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Current Browser Origin</CardTitle>
          </CardHeader>
          <CardContent>
            <code className="bg-muted px-3 py-2 rounded text-sm block">
              {window.location.origin}
            </code>
            <p className="text-xs text-muted-foreground mt-2">
              Your backend's CORS_ORIGINS must include this origin for requests to succeed.
            </p>
          </CardContent>
        </Card>

        {/* Test Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Test URL</CardTitle>
            <CardDescription>
              Enter the backend URL to test CORS configuration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={testUrl}
                onChange={(e) => setTestUrl(e.target.value)}
                placeholder="http://192.168.1.100:8000/api/health"
                className="flex-1 font-mono text-sm"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={runPreflightTest} disabled={isRunning} variant="outline">
                <Play className="h-4 w-4 mr-2" />
                OPTIONS (Preflight)
              </Button>
              <Button onClick={runGetTest} disabled={isRunning} variant="outline">
                <Play className="h-4 w-4 mr-2" />
                GET Request
              </Button>
              <Button onClick={runPostTest} disabled={isRunning} variant="outline">
                <Play className="h-4 w-4 mr-2" />
                POST Request
              </Button>
              <Button onClick={clearResults} variant="ghost" size="icon">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Results List */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Test Results</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                {results.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">
                    No tests run yet. Click a test button above.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {results.map((result) => (
                      <button
                        key={result.id}
                        onClick={() => setSelectedResult(result)}
                        className={`w-full p-4 text-left hover:bg-muted/50 transition-colors ${
                          selectedResult?.id === result.id ? 'bg-muted' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {result.status === 'success' && (
                              <CheckCircle className="h-4 w-4 text-emerald-500" />
                            )}
                            {result.status === 'error' && (
                              <AlertCircle className="h-4 w-4 text-amber-500" />
                            )}
                            {result.status === 'cors-error' && (
                              <AlertCircle className="h-4 w-4 text-destructive" />
                            )}
                            <span className="font-medium text-sm">{result.method}</span>
                          </div>
                          <Badge variant={
                            result.status === 'success' ? 'default' :
                            result.status === 'cors-error' ? 'destructive' : 'secondary'
                          }>
                            {result.statusCode || 'CORS'}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 truncate">
                          {result.url}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {result.duration}ms • {result.timestamp.toLocaleTimeString()}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Header Details */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Response Headers</CardTitle>
                {selectedResult && (
                  <Button variant="ghost" size="sm" onClick={copyHeaders}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                {!selectedResult ? (
                  <div className="p-6 text-center text-muted-foreground">
                    Select a test result to view headers
                  </div>
                ) : (
                  <div className="p-4 space-y-4">
                    {selectedResult.error && (
                      <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3">
                        <p className="text-sm font-medium text-destructive">Error</p>
                        <p className="text-sm text-destructive/80">{selectedResult.error}</p>
                      </div>
                    )}

                    <Tabs defaultValue="cors">
                      <TabsList className="w-full">
                        <TabsTrigger value="cors" className="flex-1">CORS Headers</TabsTrigger>
                        <TabsTrigger value="all" className="flex-1">All Headers</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="cors" className="mt-4">
                        <div className="space-y-2 font-mono text-sm">
                          {Object.entries(selectedResult.headers)
                            .filter(([key]) => key.toLowerCase().startsWith('access-control'))
                            .map(([key, value]) => (
                              <div key={key} className="flex flex-col gap-1 p-2 bg-muted/50 rounded">
                                <span className="text-primary text-xs">{key}</span>
                                <span className={
                                  value === '*' ? 'text-amber-500' : 
                                  value.includes(window.location.origin) ? 'text-emerald-500' : ''
                                }>{value}</span>
                              </div>
                            ))}
                          {Object.entries(selectedResult.headers).filter(([key]) => 
                            key.toLowerCase().startsWith('access-control')
                          ).length === 0 && (
                            <p className="text-muted-foreground text-center py-4">
                              No CORS headers in response
                            </p>
                          )}
                        </div>
                      </TabsContent>

                      <TabsContent value="all" className="mt-4">
                        <div className="space-y-2 font-mono text-xs">
                          {Object.entries(selectedResult.headers).map(([key, value]) => (
                            <div key={key} className="flex flex-col gap-1 p-2 bg-muted/50 rounded">
                              <span className="text-primary">{key}</span>
                              <span className="text-foreground break-all">{value}</span>
                            </div>
                          ))}
                          {Object.keys(selectedResult.headers).length === 0 && (
                            <p className="text-muted-foreground text-center py-4">
                              No headers received (likely CORS blocked)
                            </p>
                          )}
                        </div>
                      </TabsContent>
                    </Tabs>

                    {/* CORS Diagnosis */}
                    {selectedResult.status === 'cors-error' && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-3 mt-4">
                        <p className="text-sm font-medium text-amber-600">CORS Troubleshooting</p>
                        <ul className="text-xs text-amber-600/80 mt-2 space-y-1 list-disc list-inside">
                          <li>Check that your backend is running</li>
                          <li>Verify CORS_ORIGINS in .env includes: <code className="bg-amber-500/20 px-1 rounded">{window.location.origin}</code></li>
                          <li>Restart backend after changing .env</li>
                          <li>Check browser console for detailed error</li>
                        </ul>
                      </div>
                    )}

                    {selectedResult.headers['access-control-allow-origin'] === '*' && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-3 mt-4">
                        <p className="text-sm font-medium text-amber-600">Security Note</p>
                        <p className="text-xs text-amber-600/80 mt-1">
                          Wildcard (*) origin detected. For production, set CORS_ORIGINS to your specific origin(s).
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
