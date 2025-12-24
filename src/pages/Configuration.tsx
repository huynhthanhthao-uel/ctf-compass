import { useState } from 'react';
import { Save, RotateCcw, Shield, Clock, Upload, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AppLayout } from '@/components/layout/AppLayout';
import { useToast } from '@/hooks/use-toast';
import { mockConfig } from '@/lib/mock-data';

export default function Configuration() {
  const { toast } = useToast();
  const [config, setConfig] = useState(mockConfig);
  const [isDirty, setIsDirty] = useState(false);

  const handleSave = () => {
    // Mock save - in production this calls the API
    toast({
      title: 'Configuration Saved',
      description: 'Your settings have been updated successfully.',
    });
    setIsDirty(false);
  };

  const handleReset = () => {
    setConfig(mockConfig);
    setIsDirty(false);
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Configuration</h1>
            <p className="text-muted-foreground">
              Manage analysis settings and security policies
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
          {/* Upload Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
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
              </div>
              
              <div className="space-y-2">
                <Label>Allowed Extensions</Label>
                <div className="flex flex-wrap gap-1">
                  {config.allowedExtensions.map((ext) => (
                    <Badge key={ext} variant="secondary" className="font-mono text-xs">
                      {ext}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sandbox Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Sandbox Settings
              </CardTitle>
              <CardDescription>
                Configure sandbox isolation and resource limits
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
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
            </CardContent>
          </Card>

          {/* Allowed Tools */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Allowed Analysis Tools
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
          <Card className="border-warning/50 bg-warning/5">
            <CardHeader>
              <CardTitle className="text-warning flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Notice
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                <strong>Sandbox Isolation:</strong> All commands run in isolated Docker containers 
                with network disabled, memory limits, and read-only filesystems where possible.
              </p>
              <p>
                <strong>Tool Allowlist:</strong> Only explicitly allowed tools can be executed. 
                All tool arguments are sanitized to prevent command injection.
              </p>
              <p>
                <strong>Path Validation:</strong> All file paths are validated to prevent 
                path traversal and zip-slip attacks.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
