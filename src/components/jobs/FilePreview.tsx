import { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { 
  FileText, 
  Image as ImageIcon, 
  Archive, 
  File, 
  ChevronDown, 
  ChevronRight,
  FileCode,
  FileArchive,
  Binary,
  Music,
  Video,
  Database
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface ZipEntry {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  type: string;
}

interface FilePreviewProps {
  file: File;
  onRemove?: () => void;
}

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'ico', 'svg'];
const CODE_EXTENSIONS = ['py', 'js', 'ts', 'c', 'cpp', 'h', 'java', 'rb', 'php', 'go', 'rs', 'sh', 'bash'];
const ARCHIVE_EXTENSIONS = ['zip', 'tar', 'gz', 'rar', '7z', 'bz2'];
const BINARY_EXTENSIONS = ['exe', 'elf', 'bin', 'dll', 'so', 'o', 'out'];
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'];
const VIDEO_EXTENSIONS = ['mp4', 'avi', 'mkv', 'mov', 'webm'];
const DATABASE_EXTENSIONS = ['db', 'sqlite', 'sqlite3', 'sql'];

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  
  if (IMAGE_EXTENSIONS.includes(ext)) return <ImageIcon className="h-4 w-4 text-green-500" />;
  if (CODE_EXTENSIONS.includes(ext)) return <FileCode className="h-4 w-4 text-blue-500" />;
  if (ARCHIVE_EXTENSIONS.includes(ext)) return <FileArchive className="h-4 w-4 text-yellow-500" />;
  if (BINARY_EXTENSIONS.includes(ext)) return <Binary className="h-4 w-4 text-red-500" />;
  if (AUDIO_EXTENSIONS.includes(ext)) return <Music className="h-4 w-4 text-purple-500" />;
  if (VIDEO_EXTENSIONS.includes(ext)) return <Video className="h-4 w-4 text-pink-500" />;
  if (DATABASE_EXTENSIONS.includes(ext)) return <Database className="h-4 w-4 text-orange-500" />;
  if (ext === 'txt' || ext === 'md' || ext === 'log') return <FileText className="h-4 w-4 text-muted-foreground" />;
  
  return <File className="h-4 w-4 text-muted-foreground" />;
}

function getFileType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  if (CODE_EXTENSIONS.includes(ext)) return 'code';
  if (ARCHIVE_EXTENSIONS.includes(ext)) return 'archive';
  if (BINARY_EXTENSIONS.includes(ext)) return 'binary';
  if (AUDIO_EXTENSIONS.includes(ext)) return 'audio';
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
  if (DATABASE_EXTENSIONS.includes(ext)) return 'database';
  
  return 'file';
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FilePreview({ file }: FilePreviewProps) {
  const [zipEntries, setZipEntries] = useState<ZipEntry[]>([]);
  const [isZip, setIsZip] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const isImage = IMAGE_EXTENSIONS.includes(ext);

  useEffect(() => {
    const analyzeFile = async () => {
      setLoading(true);
      setError(null);

      try {
        // Check if it's a ZIP file
        if (ext === 'zip') {
          setIsZip(true);
          const zip = new JSZip();
          const contents = await zip.loadAsync(file);
          
          const entries: ZipEntry[] = [];
          
          for (const [relativePath, zipEntry] of Object.entries(contents.files)) {
            if (!zipEntry.dir) {
              // Get uncompressed size by reading the file
              const data = await zipEntry.async('uint8array');
              entries.push({
                name: relativePath.split('/').pop() || relativePath,
                path: relativePath,
                size: data.length,
                isDirectory: zipEntry.dir,
                type: getFileType(relativePath)
              });
            }
          }

          // Sort: directories first, then by name
          entries.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.path.localeCompare(b.path);
          });

          setZipEntries(entries);
        }

        // Generate image preview
        if (isImage) {
          const reader = new FileReader();
          reader.onload = (e) => {
            setImagePreview(e.target?.result as string);
          };
          reader.readAsDataURL(file);
        }
      } catch (err) {
        console.error('Error analyzing file:', err);
        setError('Failed to analyze file');
      } finally {
        setLoading(false);
      }
    };

    analyzeFile();
  }, [file, ext, isImage]);

  // Count file types for summary
  const typeCounts = zipEntries.reduce((acc, entry) => {
    acc[entry.type] = (acc[entry.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <div 
        className="flex items-center gap-2 p-3 bg-secondary/30 cursor-pointer hover:bg-secondary/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        
        {isZip ? (
          <Archive className="h-5 w-5 text-yellow-500" />
        ) : isImage ? (
          <ImageIcon className="h-5 w-5 text-green-500" />
        ) : (
          getFileIcon(file.name)
        )}
        
        <span className="font-medium text-sm truncate flex-1">{file.name}</span>
        <span className="text-xs text-muted-foreground">{formatSize(file.size)}</span>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="border-t border-border">
          {loading ? (
            <div className="p-4 flex items-center justify-center">
              <span className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="ml-2 text-sm text-muted-foreground">Analyzing file...</span>
            </div>
          ) : error ? (
            <div className="p-4 text-sm text-destructive">{error}</div>
          ) : (
            <>
              {/* ZIP Contents */}
              {isZip && zipEntries.length > 0 && (
                <div className="p-3">
                  {/* File type summary */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {Object.entries(typeCounts).map(([type, count]) => (
                      <Badge 
                        key={type} 
                        variant="secondary" 
                        className="text-xs capitalize"
                      >
                        {type}: {count}
                      </Badge>
                    ))}
                    <Badge variant="outline" className="text-xs">
                      Total: {zipEntries.length} files
                    </Badge>
                  </div>

                  {/* File list */}
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-1">
                      {zipEntries.map((entry, idx) => (
                        <div 
                          key={idx}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-md text-sm",
                            "hover:bg-secondary/50 transition-colors"
                          )}
                        >
                          {getFileIcon(entry.name)}
                          <span className="truncate flex-1 font-mono text-xs">
                            {entry.path}
                          </span>
                          {entry.size > 0 && (
                            <span className="text-xs text-muted-foreground shrink-0">
                              {formatSize(entry.size)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Image Preview */}
              {isImage && imagePreview && (
                <div className="p-3">
                  <div className="relative rounded-md overflow-hidden bg-secondary/30 flex items-center justify-center">
                    <img 
                      src={imagePreview} 
                      alt={file.name}
                      className="max-h-[200px] max-w-full object-contain"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Click to expand • Image may contain hidden data (steganography)
                  </p>
                </div>
              )}

              {/* Non-special file */}
              {!isZip && !isImage && (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  <div className="flex items-center justify-center gap-2">
                    {getFileIcon(file.name)}
                    <span>File ready for analysis</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
