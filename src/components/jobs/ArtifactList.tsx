import { File, FileText, FileImage, FileArchive, Download, Folder } from 'lucide-react';
import { Artifact } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ArtifactListProps {
  artifacts: Artifact[];
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

export function ArtifactList({ artifacts }: ArtifactListProps) {
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
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => {
                    // Mock download - in production this calls the API
                    console.log('Download:', artifact.path);
                  }}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
