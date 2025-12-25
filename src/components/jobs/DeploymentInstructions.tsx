import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  ChevronDown, 
  ChevronRight, 
  Terminal, 
  Server, 
  Check, 
  Copy,
  ExternalLink,
  AlertCircle,
  Rocket
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface DeploymentInstructionsProps {
  className?: string;
}

const DEPLOY_STEPS = [
  {
    id: 'clone',
    title: 'Clone Repository',
    description: 'Clone the CTF Compass repository to your server',
    command: 'git clone https://github.com/HaryLya/ctf-compass.git /opt/ctf-compass && cd /opt/ctf-compass',
  },
  {
    id: 'env',
    title: 'Configure Environment',
    description: 'Copy and configure environment variables',
    command: 'cp ctf-autopilot/infra/.env.example ctf-autopilot/infra/.env',
    note: 'Edit .env to set MEGALLM_API_KEY and other settings',
  },
  {
    id: 'sandbox',
    title: 'Build Sandbox Image',
    description: 'Build the secure Docker sandbox with CTF tools',
    command: 'docker build -t ctf-compass-sandbox:latest ctf-autopilot/sandbox/image/',
  },
  {
    id: 'start',
    title: 'Start Services',
    description: 'Launch all backend services with Docker Compose',
    command: 'cd ctf-autopilot/infra && docker compose up -d',
  },
  {
    id: 'verify',
    title: 'Verify Deployment',
    description: 'Check that all services are running',
    command: 'docker compose ps && curl -s http://localhost:8000/api/health | jq',
  },
];

const QUICK_COMMANDS = [
  { label: 'View Logs', command: 'docker compose logs -f' },
  { label: 'Restart Services', command: 'docker compose restart' },
  { label: 'Stop All', command: 'docker compose down' },
  { label: 'Clean Rebuild', command: 'docker compose down -v && docker compose up -d --build' },
];

export function DeploymentInstructions({ className }: DeploymentInstructionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  const copyToClipboard = (command: string) => {
    navigator.clipboard.writeText(command);
    setCopiedCommand(command);
    toast.success('Command copied to clipboard');
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <Card className="border-primary/20 bg-card/50">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Server className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    Deploy Docker Backend
                    <Badge variant="outline" className="text-xs">Required for Sandbox</Badge>
                  </CardTitle>
                  <CardDescription className="text-sm mt-0.5">
                    Deploy the backend for real command execution in sandbox
                  </CardDescription>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-6 pt-0">
            {/* Quick Deploy */}
            <div className="p-4 rounded-lg bg-success/10 border border-success/30">
              <div className="flex items-center gap-2 mb-2">
                <Rocket className="h-4 w-4 text-success" />
                <span className="font-medium text-success">One-Line Deploy (Ubuntu)</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 rounded bg-background/50 text-xs font-mono overflow-x-auto">
                  curl -fsSL https://raw.githubusercontent.com/HaryLya/ctf-compass/main/ctf-autopilot/infra/scripts/deploy.sh | bash
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 flex-shrink-0"
                  onClick={() => copyToClipboard('curl -fsSL https://raw.githubusercontent.com/HaryLya/ctf-compass/main/ctf-autopilot/infra/scripts/deploy.sh | bash')}
                >
                  {copiedCommand?.includes('deploy.sh') ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Manual Steps */}
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                Manual Deployment Steps
              </h4>
              <div className="space-y-3">
                {DEPLOY_STEPS.map((step, index) => (
                  <div
                    key={step.id}
                    className="p-3 rounded-lg border border-border/50 bg-background/30"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-medium flex-shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{step.title}</p>
                        <p className="text-xs text-muted-foreground mb-2">{step.description}</p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 p-2 rounded bg-muted/50 text-xs font-mono overflow-x-auto">
                            {step.command}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 flex-shrink-0"
                            onClick={() => copyToClipboard(step.command)}
                          >
                            {copiedCommand === step.command ? (
                              <Check className="h-3 w-3 text-success" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                        {step.note && (
                          <p className="text-xs text-amber-500 mt-1.5 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {step.note}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Commands */}
            <div>
              <h4 className="font-medium mb-3">Quick Commands</h4>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_COMMANDS.map((cmd) => (
                  <Button
                    key={cmd.label}
                    variant="outline"
                    size="sm"
                    className="justify-start gap-2 text-xs h-auto py-2"
                    onClick={() => copyToClipboard(cmd.command)}
                  >
                    {copiedCommand === cmd.command ? (
                      <Check className="h-3 w-3 text-success" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    {cmd.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Connect Backend Info */}
            <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
              <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                <Server className="h-4 w-4" />
                Connect your Backend
              </h4>
              <p className="text-xs text-muted-foreground mb-2">
                After deploying the backend, open <strong>Settings</strong> in this app and enter your Docker Backend URL to enable real command execution.
              </p>
              <code className="block p-2 rounded bg-background/50 text-xs font-mono">
                http://YOUR_SERVER_IP:8000
              </code>
            </div>

            {/* Documentation Link */}
            <Button variant="outline" className="w-full gap-2" asChild>
              <a 
                href="https://github.com/HaryLya/ctf-compass/blob/main/ctf-autopilot/QUICK_START.md" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4" />
                View Full Documentation
              </a>
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
