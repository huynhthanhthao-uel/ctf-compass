import { useState, useEffect } from 'react';
import { Cloud, CloudOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Check if real backend is available
async function checkBackend(): Promise<boolean> {
  try {
    const response = await fetch('/api/health', { method: 'GET' });
    const text = await response.text();
    
    // Vite returns HTML for unknown routes
    if (text.trimStart().startsWith('<!') || text.trimStart().startsWith('<html')) {
      return false;
    }
    
    // Try parsing JSON
    try {
      JSON.parse(text);
      return true;
    } catch {
      return false;
    }
  } catch {
    return false;
  }
}

export function BackendStatus() {
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    checkBackend().then(setConnected);
    
    // Re-check every 30 seconds
    const interval = setInterval(() => {
      checkBackend().then(setConnected);
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  if (connected === null) return null;

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 text-xs font-normal px-2 py-0.5",
        connected
          ? "border-green-500/50 text-green-600 dark:text-green-400 bg-green-500/10"
          : "border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/10"
      )}
    >
      {connected ? (
        <>
          <Cloud className="h-3 w-3" />
          <span className="hidden sm:inline">Backend Connected</span>
          <span className="sm:hidden">API</span>
        </>
      ) : (
        <>
          <CloudOff className="h-3 w-3" />
          <span className="hidden sm:inline">Demo Mode</span>
          <span className="sm:hidden">Demo</span>
        </>
      )}
    </Badge>
  );
}
