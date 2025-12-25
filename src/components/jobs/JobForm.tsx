import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, AlertCircle, FolderOpen, Link, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { FilePreview } from './FilePreview';
import { useCategoryDetector } from '@/hooks/use-category-detector';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const CHALLENGE_CATEGORIES = [
  { value: 'crypto', label: 'Crypto' },
  { value: 'pwn', label: 'Pwn' },
  { value: 'web', label: 'Web' },
  { value: 'rev', label: 'Reverse Engineering' },
  { value: 'forensics', label: 'Forensics' },
  { value: 'misc', label: 'Misc' },
] as const;

interface JobFormProps {
  onSubmit: (title: string, description: string, flagFormat: string, files: File[], category?: string, challengeUrl?: string) => Promise<void>;
  isLoading?: boolean;
}

export function JobForm({ onSubmit, isLoading }: JobFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [flagFormat, setFlagFormat] = useState('CTF{[a-zA-Z0-9_]+}');
  const [category, setCategory] = useState<string>('');
  const [challengeUrl, setChallengeUrl] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [autoDetected, setAutoDetected] = useState(false);

  const { detectFromFiles, isDetecting, result: detectionResult } = useCategoryDetector();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prev => [...prev, ...acceptedFiles]);
    setError(null);
  }, []);

  // Auto-detect category when files change
  useEffect(() => {
    if (files.length > 0 && !category) {
      detectFromFiles(files, description).then(result => {
        if (result && result.confidence > 0.5) {
          setCategory(result.category);
          setAutoDetected(true);
          toast.success(`Auto-detected category: ${result.category}`, {
            description: `Confidence: ${Math.round(result.confidence * 100)}% • Keywords: ${result.detectedKeywords.slice(0, 3).join(', ')}`
          });
        }
      });
    }
  }, [files, detectFromFiles, description, category]);

  // Reset auto-detected flag when category changes manually
  const handleCategoryChange = (value: string) => {
    setCategory(value);
    setAutoDetected(false);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 200 * 1024 * 1024,
  });

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    if (files.length === 1) {
      setAutoDetected(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Challenge title is required');
      return;
    }

    // Validate URL if provided
    if (challengeUrl.trim()) {
      try {
        new URL(challengeUrl);
      } catch {
        setError('Invalid challenge URL format');
        return;
      }
    }

    try {
      new RegExp(flagFormat);
    } catch {
      setError('Invalid flag format regex');
      return;
    }

    await onSubmit(title, description, flagFormat, files, category || undefined, challengeUrl.trim() || undefined);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Challenge Information</CardTitle>
          <CardDescription>Enter the details of the CTF challenge</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Challenge Title *</Label>
              <Input
                id="title"
                placeholder="e.g., RSA Basics"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="category">Category</Label>
                {isDetecting && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Detecting...
                  </span>
                )}
                {autoDetected && detectionResult && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Sparkles className="h-3 w-3" />
                    Auto-detected ({Math.round(detectionResult.confidence * 100)}%)
                  </Badge>
                )}
              </div>
              <Select value={category} onValueChange={handleCategoryChange} disabled={isLoading}>
                <SelectTrigger id="category" className="bg-background">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {CHALLENGE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {autoDetected && detectionResult && detectionResult.detectedKeywords.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {detectionResult.detectedKeywords.slice(0, 5).map((keyword, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs font-mono">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="flagFormat">Flag Format (Regex)</Label>
              <Input
                id="flagFormat"
                placeholder="CTF{[a-zA-Z0-9_]+}"
                value={flagFormat}
                onChange={(e) => setFlagFormat(e.target.value)}
                className="font-mono text-sm"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="challengeUrl">Challenge URL</Label>
              <div className="relative">
                <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="challengeUrl"
                  placeholder="https://ctf.example.com/challenge"
                  value={challengeUrl}
                  onChange={(e) => setChallengeUrl(e.target.value)}
                  className="pl-9"
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe the challenge, any hints, or notes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={isLoading}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Challenge Files (Optional)</CardTitle>
          <CardDescription>Upload challenge files if available</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all",
              isDragActive 
                ? "border-primary bg-primary/5" 
                : "border-border hover:border-primary/50 hover:bg-secondary/30",
              isLoading && "opacity-50 cursor-not-allowed"
            )}
          >
            <input {...getInputProps()} disabled={isLoading} />
            <div className="flex flex-col items-center">
              <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center mb-3">
                <Upload className="h-6 w-6 text-muted-foreground" />
              </div>
              {isDragActive ? (
                <p className="text-primary font-medium">Drop files here...</p>
              ) : (
                <>
                  <p className="text-foreground font-medium">
                    Drag & drop files here
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Supports ZIP archives and individual files (max 200MB)
                  </p>
                </>
              )}
            </div>
          </div>

          {files.length > 0 && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                {files.length} file{files.length > 1 ? 's' : ''} selected
              </div>
              <div className="space-y-2">
                {files.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="relative">
                    <FilePreview file={file} />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7 z-10"
                      onClick={() => removeFile(index)}
                      disabled={isLoading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Button type="submit" className="w-full h-11" disabled={isLoading}>
        {isLoading ? (
          <>
            <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
            Creating Analysis...
          </>
        ) : (
          <>
            <Upload className="h-4 w-4 mr-2" />
            Create Analysis
          </>
        )}
      </Button>
    </form>
  );
}
