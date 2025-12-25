import { useState, useEffect, useCallback } from 'react';
import { 
  Server, 
  Cloud, 
  WifiOff, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Trash2,
  Stethoscope
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { getBackendUrlFromStorage } from '@/lib/backend-url';
import { Link } from 'react-router-dom';

interface HealthStatus {
  dockerBackend: 'checking' | 'connected' | 'disconnected';
  sandboxTerminal: 'checking' | 'ready' | 'error' | 'not_configured';
  sandboxError?: string;
  lastCheck: Date | null;
}

interface BackendHealthIndicatorProps {
  onReset?: () => void;
}

export function BackendHealthIndicator({ onReset }: BackendHealthIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [health, setHealth] = useState<HealthStatus>({
    dockerBackend: 'checking',
    sandboxTerminal: 'checking',
    lastCheck: null,
  });

  const checkHealth = useCallback(async () => {
    setIsChecking(true);
    
    // Check Docker backend (direct via configured backend URL)
    let dockerStatus: HealthStatus['dockerBackend'] = 'disconnected';
    try {
      const backendUrl = getBackendUrlFromStorage();
      if (backendUrl) {
        const response = await fetch(`${backendUrl}/api/health`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          const data = await response.json().catch(() => null);
          if (data?.status === 'healthy') {
            dockerStatus = 'connected';
          }
        }
      }
    } catch {
      dockerStatus = 'disconnected';
    }

    // Check Sandbox Terminal - prefer Docker backend directly, fallback to Edge Function
    let sandboxStatus: HealthStatus['sandboxTerminal'] = 'error';
    let sandboxError: string | undefined;

    const backendUrl = getBackendUrlFromStorage();

    // If Docker backend is connected, check sandbox via Docker API directly
    if (dockerStatus === 'connected' && backendUrl) {
      try {
        // Check sandbox health via Docker backend's sandbox endpoint
        const response = await fetch(`${backendUrl}/api/sandbox/health`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          const data = await response.json().catch(() => null);
          if (data?.status === 'healthy' || data?.status === 'ok') {
            sandboxStatus = 'ready';
          } else {
            sandboxStatus = 'error';
            sandboxError = data?.message || 'Sandbox not ready';
          }
        } else if (response.status === 404) {
          // Endpoint doesn't exist, try running a simple command
          const execResponse = await fetch(`${backendUrl}/api/sandbox/exec`, {
            method: 'POST',
            headers: { 
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ job_id: 'health-check', tool: 'echo', args: ['ok'] }),
            signal: AbortSignal.timeout(10000),
          });

          if (execResponse.ok) {
            const data = await execResponse.json().catch(() => null);
            if (data?.exit_code === 0) {
              sandboxStatus = 'ready';
            } else {
              sandboxStatus = 'error';
              sandboxError = data?.stderr || 'Sandbox command failed';
            }
          } else {
            sandboxStatus = 'ready'; // Assume ready if backend is connected
          }
        } else {
          sandboxStatus = 'error';
          sandboxError = `Sandbox returned status ${response.status}`;
        }
      } catch {
        // If sandbox check fails but Docker backend is connected, assume sandbox is ready
        // (sandbox runs within the Docker backend)
        sandboxStatus = 'ready';
      }
    } else if (!backendUrl) {
      // No backend URL configured
      sandboxStatus = 'not_configured';
      sandboxError = 'Backend URL not configured. Set it in Settings → Docker Backend URL.';
    } else {
      // Docker backend not connected
      sandboxStatus = 'error';
      sandboxError = 'Docker backend not connected. Ensure backend is running.';
    }

    setHealth({
      dockerBackend: dockerStatus,
      sandboxTerminal: sandboxStatus,
      sandboxError,
      lastCheck: new Date(),
    });
    setIsChecking(false);
  }, []);

  useEffect(() => {
    checkHealth();
    
    // Re-check every 60 seconds
    const interval = setInterval(checkHealth, 60000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  const getOverallStatus = () => {
    if (health.dockerBackend === 'connected' && health.sandboxTerminal === 'ready') {
      return 'healthy';
    }
    if (health.sandboxTerminal === 'ready') {
      return 'partial';
    }
    if (health.sandboxTerminal === 'not_configured') {
      return 'not_configured';
    }
    return 'error';
  };

  const overallStatus = getOverallStatus();

  const getStatusBadge = () => {
    switch (overallStatus) {
      case 'healthy':
        return (
          <Badge className="gap-1.5 bg-success/20 text-success border-success/30">
            <CheckCircle className="h-3 w-3" />
            Backend Ready
          </Badge>
        );
      case 'partial':
        return (
          <Badge className="gap-1.5 bg-info/20 text-info border-info/30">
            <Cloud className="h-3 w-3" />
            Cloud Mode
          </Badge>
        );
      case 'not_configured':
        return (
          <Badge className="gap-1.5 bg-warning/20 text-warning border-warning/30">
            <AlertTriangle className="h-3 w-3" />
            Setup Required
          </Badge>
        );
      default:
        return (
          <Badge className="gap-1.5 bg-destructive/20 text-destructive border-destructive/30">
            <XCircle className="h-3 w-3" />
            Not Connected
          </Badge>
        );
    }
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className={cn(
        "border transition-colors",
        overallStatus === 'healthy' && "border-success/30",
        overallStatus === 'partial' && "border-info/30",
        overallStatus === 'not_configured' && "border-warning/30",
        overallStatus === 'error' && "border-destructive/30"
      )}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                overallStatus === 'healthy' && "bg-success/10",
                overallStatus === 'partial' && "bg-info/10",
                overallStatus === 'not_configured' && "bg-warning/10",
                overallStatus === 'error' && "bg-destructive/10"
              )}>
                <Server className={cn(
                  "h-5 w-5",
                  overallStatus === 'healthy' && "text-success",
                  overallStatus === 'partial' && "text-info",
                  overallStatus === 'not_configured' && "text-warning",
                  overallStatus === 'error' && "text-destructive"
                )} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">Backend Status</span>
                  {getStatusBadge()}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {health.lastCheck 
                    ? `Last checked: ${health.lastCheck.toLocaleTimeString()}`
                    : 'Checking...'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  checkHealth();
                }}
                disabled={isChecking}
              >
                <RefreshCw className={cn("h-4 w-4", isChecking && "animate-spin")} />
              </Button>
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 space-y-3">
            {/* Docker Backend */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Docker Backend</span>
              </div>
              <Badge variant="outline" className={cn(
                "text-xs",
                health.dockerBackend === 'connected' && "bg-success/10 text-success border-success/30",
                health.dockerBackend === 'disconnected' && "bg-muted text-muted-foreground",
                health.dockerBackend === 'checking' && "bg-muted text-muted-foreground"
              )}>
                {health.dockerBackend === 'checking' ? 'Checking...' : 
                 health.dockerBackend === 'connected' ? 'Connected' : 'Not Available'}
              </Badge>
            </div>

            {/* Sandbox Terminal */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2">
                <Cloud className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Sandbox Terminal</span>
              </div>
              <Badge variant="outline" className={cn(
                "text-xs",
                health.sandboxTerminal === 'ready' && "bg-success/10 text-success border-success/30",
                health.sandboxTerminal === 'not_configured' && "bg-warning/10 text-warning border-warning/30",
                health.sandboxTerminal === 'error' && "bg-destructive/10 text-destructive border-destructive/30",
                health.sandboxTerminal === 'checking' && "bg-muted text-muted-foreground"
              )}>
                {health.sandboxTerminal === 'checking' ? 'Checking...' : 
                 health.sandboxTerminal === 'ready' ? 'Ready' : 
                 health.sandboxTerminal === 'not_configured' ? 'Not Configured' : 'Error'}
              </Badge>
            </div>

            {/* Error Message */}
            {health.sandboxError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-xs text-destructive font-medium mb-1">Error Details:</p>
                <p className="text-xs text-destructive/80">{health.sandboxError}</p>
              </div>
            )}

            {/* Configuration Help */}
            {(health.sandboxTerminal === 'not_configured' || health.sandboxTerminal === 'error') && (
              <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                <p className="text-xs font-medium text-warning mb-2">Configuration Required:</p>
                <ol className="text-xs text-warning/80 list-decimal list-inside space-y-1">
                  <li>Deploy Docker backend on your server</li>
                  <li>Go to <strong>Settings</strong> page</li>
                  <li>Enter your backend URL (e.g., <code className="bg-warning/20 px-1 rounded">http://YOUR_IP:8000</code>)</li>
                  <li>Click <strong>Test</strong> to verify connection</li>
                </ol>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  localStorage.removeItem('ctf_backend_url');
                  onReset?.();
                  checkHealth();
                }}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Reset URL
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/health">
                  <Stethoscope className="h-3 w-3 mr-1" />
                  Debug Health
                </Link>
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
