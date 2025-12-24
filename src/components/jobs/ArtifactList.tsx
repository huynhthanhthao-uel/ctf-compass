import { File, FileText, FileImage, FileArchive, Download, Folder, Loader2 } from 'lucide-react';
import { Artifact } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { useState } from 'react';

interface ArtifactListProps {
  artifacts: Artifact[];
  jobId?: string;
}

const getFileIcon = (type: string) => {
  if (type.startsWith('image/')) return FileImage;
  if (type.includes('zip') || type.includes('tar') || type.includes('archive')) return FileArchive;
  if (type.startsWith('text/')) return FileText;
  return File;
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function ArtifactList({ artifacts, jobId }: ArtifactListProps) {
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (artifact: Artifact) => {
    if (!jobId) {
      toast.error('Cannot download: Job ID not available');
      return;
    }

    setDownloading(artifact.path);
    
    try {
      const response = await fetch(`/api/jobs/${jobId}/artifacts/${encodeURIComponent(artifact.path)}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = artifact.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success(`Downloaded ${artifact.name}`);
    } catch (err) {
      console.error('Download error:', err);
      toast.error(`Failed to download ${artifact.name}`);
    } finally {
      setDownloading(null);
    }
  };

  if (artifacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Folder className="h-12 w-12 mb-4 opacity-50" />
        <p>No artifacts found</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[500px]">
      <div className="space-y-1 p-1">
        {artifacts.map((artifact) => {
          const Icon = getFileIcon(artifact.type);
          const isDownloading = downloading === artifact.path;
          
          return (
            <div
              key={artifact.path}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{artifact.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {artifact.path}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right text-sm text-muted-foreground">
                  <p>{formatFileSize(artifact.size)}</p>
                  <p className="text-xs">{artifact.type}</p>
                </div>
                <Button
                  variant="secondary"
                  size="icon"
                  disabled={isDownloading}
                  onClick={() => handleDownload(artifact)}
                >
                  {isDownloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
