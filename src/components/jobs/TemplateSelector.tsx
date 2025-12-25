import { useState, useMemo } from 'react';
import { 
  BookTemplate, 
  ChevronDown, 
  Plus, 
  Trash2, 
  Star,
  Lock,
  KeyRound,
  Bug,
  Search,
  Globe,
  HelpCircle,
  Cpu
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { ChallengeTemplate, useChallengeTemplates } from '@/hooks/use-challenge-templates';
import { toast } from 'sonner';

interface TemplateSelectorProps {
  onSelectTemplate: (template: ChallengeTemplate) => void;
  currentData?: {
    category: string;
    title: string;
    description: string;
    flagFormat: string;
  };
  disabled?: boolean;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  crypto: <Lock className="h-4 w-4" />,
  pwn: <Bug className="h-4 w-4" />,
  rev: <Cpu className="h-4 w-4" />,
  forensics: <Search className="h-4 w-4" />,
  web: <Globe className="h-4 w-4" />,
  misc: <HelpCircle className="h-4 w-4" />,
};

const CATEGORY_LABELS: Record<string, string> = {
  crypto: 'Cryptography',
  pwn: 'Binary Exploitation',
  rev: 'Reverse Engineering',
  forensics: 'Forensics',
  web: 'Web Security',
  misc: 'Miscellaneous',
};

export function TemplateSelector({ onSelectTemplate, currentData, disabled }: TemplateSelectorProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const { templates, customTemplates, deleteTemplate, saveAsTemplate, getTemplatesByCategory } = useChallengeTemplates();

  // Group templates by category
  const templatesByCategory = useMemo(() => {
    const grouped: Record<string, ChallengeTemplate[]> = {};
    templates.forEach(t => {
      if (!grouped[t.category]) {
        grouped[t.category] = [];
      }
      grouped[t.category].push(t);
    });
    return grouped;
  }, [templates]);

  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    if (!currentData?.category) {
      toast.error('Please select a category first');
      return;
    }

    saveAsTemplate(templateName.trim(), {
      category: currentData.category,
      titlePattern: currentData.title || '',
      description: currentData.description || '',
      flagFormat: currentData.flagFormat || 'CTF{[a-zA-Z0-9_]+}'
    });

    toast.success(`Template "${templateName}" saved!`);
    setTemplateName('');
    setSaveDialogOpen(false);
  };

  const handleDeleteTemplate = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (deleteTemplate(id)) {
      toast.success(`Template "${name}" deleted`);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Template Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            disabled={disabled}
          >
            <BookTemplate className="h-4 w-4" />
            Templates
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64" align="start">
          <DropdownMenuLabel className="flex items-center gap-2">
            <Star className="h-3 w-3" />
            Built-in Templates
          </DropdownMenuLabel>
          
          {Object.entries(templatesByCategory).map(([category, categoryTemplates]) => {
            const builtIn = categoryTemplates.filter(t => t.isBuiltIn);
            if (builtIn.length === 0) return null;

            return (
              <DropdownMenuSub key={category}>
                <DropdownMenuSubTrigger className="gap-2">
                  {CATEGORY_ICONS[category]}
                  {CATEGORY_LABELS[category] || category}
                  <Badge variant="secondary" className="ml-auto text-[10px]">
                    {builtIn.length}
                  </Badge>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-56">
                  <ScrollArea className="max-h-[300px]">
                    {builtIn.map(template => (
                      <DropdownMenuItem
                        key={template.id}
                        onClick={() => onSelectTemplate(template)}
                        className="flex flex-col items-start gap-0.5 py-2"
                      >
                        <span className="font-medium">{template.name}</span>
                        <span className="text-[10px] text-muted-foreground line-clamp-1">
                          {template.description.slice(0, 60)}...
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </ScrollArea>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            );
          })}

          {customTemplates.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="flex items-center gap-2">
                <KeyRound className="h-3 w-3" />
                My Templates
              </DropdownMenuLabel>
              {customTemplates.map(template => (
                <DropdownMenuItem
                  key={template.id}
                  onClick={() => onSelectTemplate(template)}
                  className="group"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      {CATEGORY_ICONS[template.category]}
                      <span>{template.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive"
                      onClick={(e) => handleDeleteTemplate(e, template.id, template.name)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save Template Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-1 text-xs"
            disabled={disabled || !currentData?.category}
          >
            <Plus className="h-3 w-3" />
            Save as Template
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save as Template</DialogTitle>
            <DialogDescription>
              Save the current form configuration as a reusable template.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                placeholder="e.g., My Custom RSA Template"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </div>

            {currentData && (
              <div className="rounded-lg border border-border p-3 bg-secondary/30 space-y-2">
                <div className="text-xs text-muted-foreground">Preview:</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Category: </span>
                    <Badge variant="secondary">{currentData.category || 'Not set'}</Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Flag Format: </span>
                    <code className="text-xs">{currentData.flagFormat?.slice(0, 20) || 'Default'}</code>
                  </div>
                </div>
                {currentData.description && (
                  <div className="text-xs text-muted-foreground line-clamp-2">
                    {currentData.description}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate}>
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
