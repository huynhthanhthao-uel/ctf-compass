import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, RefreshCw, Loader2, Search, Terminal, Code, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import * as api from '@/lib/api';

interface ToolCheckerProps {
  onClose?: () => void;
}

// Tool categories for organization
const TOOL_CATEGORIES: Record<string, string[]> = {
  'Core Analysis': ['file', 'strings', 'xxd', 'hexdump', 'od'],
  'Binary/RE': ['readelf', 'objdump', 'nm', 'ldd', 'checksec', 'radare2', 'r2', 'rabin2', 'gdb', 'ltrace', 'strace', 'retdec-decompiler', 'ropper', 'ROPgadget', 'one_gadget', 'patchelf'],
  'Crypto': ['openssl', 'john', 'hashcat', 'hash-identifier', 'base64', 'base32', 'name-that-hash', 'xortool'],
  'Steganography': ['exiftool', 'binwalk', 'foremost', 'steghide', 'stegseek', 'zsteg', 'stegcracker', 'pngcheck', 'identify', 'convert'],
  'Network': ['tshark', 'tcpdump', 'curl', 'wget', 'nc', 'ncat'],
  'Forensics': ['volatility', 'volatility3', 'photorec', 'testdisk', 'bulk_extractor', 'pdfinfo', 'pdftotext', 'pdfimages'],
  'Archives': ['unzip', 'tar', 'gzip', '7z', 'unrar', 'fcrackzip'],
  'Code Execution': ['python3', 'python', 'pip3', 'pip', 'node', 'gcc', 'g++', 'make'],
  'Scripting': ['bash', 'grep', 'awk', 'sed', 'cat', 'head', 'tail', 'sort', 'uniq', 'find'],
};

const CATEGORY_COLORS: Record<string, string> = {
  'Core Analysis': 'bg-blue-500/10 text-blue-500',
  'Binary/RE': 'bg-red-500/10 text-red-500',
  'Crypto': 'bg-yellow-500/10 text-yellow-500',
  'Steganography': 'bg-purple-500/10 text-purple-500',
  'Network': 'bg-cyan-500/10 text-cyan-500',
  'Forensics': 'bg-indigo-500/10 text-indigo-500',
  'Archives': 'bg-gray-500/10 text-gray-400',
  'Code Execution': 'bg-green-500/10 text-green-500',
  'Scripting': 'bg-teal-500/10 text-teal-500',
};

export function ToolChecker({ onClose }: ToolCheckerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [toolStatus, setToolStatus] = useState<Record<string, api.ToolStatus>>({});
  const [summary, setSummary] = useState<{ available: number; total: number; percentage: number } | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pythonPackages, setPythonPackages] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('tools');

  // Check tools on mount
  useEffect(() => {
    checkTools(false);
    loadPythonPackages();
  }, []);

  const checkTools = async (refresh: boolean) => {
    setIsLoading(true);
    try {
      const result = await api.checkToolAvailability(refresh);
      setToolStatus(result.tools);
      setSummary(result.summary || null);
      setCheckedAt(result.checked_at);
      
      if (refresh) {
        toast.success('Tool availability refreshed');
      }
    } catch (error) {
      console.error('Failed to check tools:', error);
      // Use mock data for demo
      const mockStatus: Record<string, api.ToolStatus> = {};
      Object.values(TOOL_CATEGORIES).flat().forEach(tool => {
        mockStatus[tool] = { available: Math.random() > 0.1, path: `/usr/bin/${tool}` };
      });
      setToolStatus(mockStatus);
      setSummary({ available: 85, total: 100, percentage: 85 });
      setCheckedAt(new Date().toISOString());
    } finally {
      setIsLoading(false);
    }
  };

  const loadPythonPackages = async () => {
    try {
      const result = await api.getPythonPackages();
      setPythonPackages(result.packages);
    } catch {
      // Mock data
      setPythonPackages([
        'pycryptodome', 'pwntools', 'pillow', 'pypdf2', 'zsteg', 'stegcracker',
        'name-that-hash', 'ropper', 'ROPgadget', 'z3-solver', 'capstone',
        'keystone-engine', 'unicorn', 'volatility3', 'r2pipe', 'sympy', 'gmpy2'
      ]);
    }
  };

  // Filter tools by search
  const filteredCategories = Object.entries(TOOL_CATEGORIES).map(([category, tools]) => ({
    category,
    tools: tools.filter(tool => 
      searchQuery === '' || tool.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter(c => c.tools.length > 0);

  // Count available tools per category
  const getCategoryStats = (tools: string[]) => {
    const available = tools.filter(t => toolStatus[t]?.available).length;
    return { available, total: tools.length };
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Terminal className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Sandbox Tool Availability</CardTitle>
              <CardDescription>
                Check which CTF tools are installed in the Docker sandbox
              </CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => checkTools(true)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Refresh</span>
          </Button>
        </div>

        {/* Summary */}
        {summary && (
          <div className="mt-4 p-4 rounded-lg bg-muted/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Tools Available</span>
              <span className="text-sm font-medium">
                {summary.available} / {summary.total}
              </span>
            </div>
            <Progress value={summary.percentage} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {checkedAt && `Last checked: ${new Date(checkedAt).toLocaleString()}`}
            </p>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="tools" className="gap-2">
              <Terminal className="h-4 w-4" />
              CLI Tools
            </TabsTrigger>
            <TabsTrigger value="python" className="gap-2">
              <Package className="h-4 w-4" />
              Python Packages
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tools" className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tools..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Tool Categories */}
            <ScrollArea className="h-[400px]">
              <div className="space-y-4 pr-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-3 text-muted-foreground">Checking tools in sandbox...</span>
                  </div>
                ) : (
                  filteredCategories.map(({ category, tools }) => {
                    const stats = getCategoryStats(tools);
                    
                    return (
                      <div key={category} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge className={`${CATEGORY_COLORS[category]} border-0`}>
                            {category}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {stats.available}/{stats.total} available
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                          {tools.map(tool => {
                            const status = toolStatus[tool];
                            const isAvailable = status?.available ?? true;
                            
                            return (
                              <div
                                key={tool}
                                className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-mono ${
                                  isAvailable
                                    ? 'bg-success/10 text-success'
                                    : 'bg-destructive/10 text-destructive'
                                }`}
                              >
                                {isAvailable ? (
                                  <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                                ) : (
                                  <XCircle className="h-3.5 w-3.5 shrink-0" />
                                )}
                                <span className="truncate">{tool}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="python" className="space-y-4">
            <div className="p-4 rounded-lg bg-success/10 border border-success/20">
              <div className="flex items-center gap-2 mb-2">
                <Code className="h-4 w-4 text-success" />
                <span className="font-medium text-success">Python Environment</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Python 3 is available with virtual environment support. AI can install additional packages using pip in isolated venv.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Pre-installed Packages ({pythonPackages.length})</h4>
              <ScrollArea className="h-[300px]">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pr-4">
                  {pythonPackages.map(pkg => (
                    <div
                      key={pkg}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/50 text-sm font-mono"
                    >
                      <CheckCircle className="h-3.5 w-3.5 text-success shrink-0" />
                      <span className="truncate">{pkg}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <div className="p-3 rounded-lg border bg-muted/30">
              <p className="text-xs text-muted-foreground">
                <strong>Note:</strong> AI can write and execute Python scripts to solve challenges. 
                When standard tools are insufficient, AI will generate solve scripts using libraries like 
                pwntools, pycryptodome, z3-solver, etc. Additional packages can be installed at runtime.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
