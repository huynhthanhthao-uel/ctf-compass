import { useState } from 'react';
import { FileText, Copy, Check, Download, Code, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface WriteupViewProps {
  writeup?: string;
  jobId: string;
}

// Simple markdown renderer
function renderMarkdown(content: string): string {
  return content
    // Headers
    .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-6 mb-2">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-8 mb-3">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-8 mb-4">$1</h1>')
    // Code blocks
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="bg-terminal-bg rounded-lg p-4 my-4 overflow-x-auto"><code class="text-sm font-mono">$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-muted font-mono text-sm">$1</code>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Tables
    .replace(/\|(.+)\|/g, (match) => {
      const cells = match.split('|').filter(Boolean);
      const row = cells.map(cell => 
        cell.includes('---') 
          ? '' 
          : `<td class="border border-border px-3 py-2">${cell.trim()}</td>`
      ).join('');
      return row ? `<tr>${row}</tr>` : '';
    })
    // Paragraphs
    .replace(/\n\n/g, '</p><p class="mb-4">')
    // Line breaks
    .replace(/\n/g, '<br />');
}

export function WriteupView({ writeup, jobId }: WriteupViewProps) {
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<'preview' | 'source'>('preview');

  const copyToClipboard = async () => {
    if (!writeup) return;
    await navigator.clipboard.writeText(writeup);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadWriteup = () => {
    if (!writeup) return;
    const blob = new Blob([writeup], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${jobId}-writeup.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!writeup) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FileText className="h-12 w-12 mb-4 opacity-50" />
        <p>No writeup generated yet</p>
        <p className="text-sm">Complete the analysis to generate a writeup</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Tabs value={view} onValueChange={(v) => setView(v as 'preview' | 'source')}>
          <TabsList>
            <TabsTrigger value="preview" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="source" className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              Source
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={copyToClipboard}>
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={downloadWriteup}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </div>

      <ScrollArea className="h-[500px] rounded-lg border border-border">
        {view === 'preview' ? (
          <div 
            className="p-6 prose prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(writeup) }}
          />
        ) : (
          <pre className="p-6 text-sm font-mono whitespace-pre-wrap">
            {writeup}
          </pre>
        )}
      </ScrollArea>
    </div>
  );
}
