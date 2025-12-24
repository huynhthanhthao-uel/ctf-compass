import { useState, useEffect } from 'react';
import { Cloud, CloudOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

type Status = 'backend' | 'cloud' | 'demo';

// Check if real Docker backend is available
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

async function checkCloud(): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('sandbox-terminal', {
      body: { job_id: 'health', tool: 'ls', args: [] },
    });
    if (error) return false;
    return typeof data?.exit_code === 'number';
  } catch {
    return false;
  }
}

export function BackendStatus() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    const run = async () => {
      const backendOk = await checkBackend();
      if (backendOk) return setStatus('backend');

      const cloudOk = await checkCloud();
      setStatus(cloudOk ? 'cloud' : 'demo');
    };

    run();

    const interval = setInterval(run, 30000);
    return () => clearInterval(interval);
  }, []);

  if (status === null) return null;

  const cls =
    status === 'backend'
      ? 'border-green-500/50 text-green-600 dark:text-green-400 bg-green-500/10'
      : status === 'cloud'
        ? 'border-primary/40 text-primary bg-primary/10'
        : 'border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/10';

  const label = status === 'backend' ? 'Backend Connected' : status === 'cloud' ? 'Cloud Mode' : 'Demo Mode';
  const short = status === 'backend' ? 'API' : status === 'cloud' ? 'Cloud' : 'Demo';

  return (
    <Badge variant="outline" className={cn('gap-1.5 text-xs font-normal px-2 py-0.5', cls)}>
      {status === 'demo' ? <CloudOff className="h-3 w-3" /> : <Cloud className="h-3 w-3" />}
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{short}</span>
    </Badge>
  );
}
