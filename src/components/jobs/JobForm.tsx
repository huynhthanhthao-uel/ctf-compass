import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileText, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface JobFormProps {
  onSubmit: (title: string, description: string, flagFormat: string, files: File[]) => Promise<void>;
  isLoading?: boolean;
}

export function JobForm({ onSubmit, isLoading }: JobFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [flagFormat, setFlagFormat] = useState('CTF{[a-zA-Z0-9_]+}');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prev => [...prev, ...acceptedFiles]);
    setError(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 200 * 1024 * 1024, // 200MB
  });

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Challenge title is required');
      return;
    }

    if (files.length === 0) {
      setError('At least one file is required');
      return;
    }

    try {
      // Validate regex
      new RegExp(flagFormat);
    } catch {
      setError('Invalid flag format regex');
      return;
    }

    await onSubmit(title, description, flagFormat, files);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="title">Challenge Title *</Label>
          <Input
            id="title"
            placeholder="e.g., Crypto - RSA Basics"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isLoading}
          />
        </div>

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
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (Markdown)</Label>
        <Textarea
          id="description"
          placeholder="Describe the challenge, any hints, or notes..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          disabled={isLoading}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Challenge Files *</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
              isDragActive 
                ? "border-primary bg-primary/5" 
                : "border-border hover:border-primary/50",
              isLoading && "opacity-50 cursor-not-allowed"
            )}
          >
            <input {...getInputProps()} disabled={isLoading} />
            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            {isDragActive ? (
              <p className="text-primary">Drop files here...</p>
            ) : (
              <>
                <p className="text-muted-foreground">
                  Drag & drop files here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports ZIP archives and individual files (max 200MB total)
                </p>
              </>
            )}
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">{file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({formatFileSize(file.size)})
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeFile(index)}
                    disabled={isLoading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Upload className="h-4 w-4 mr-2 animate-spin" />
            Creating Job...
          </>
        ) : (
          <>
            <Upload className="h-4 w-4 mr-2" />
            Create Analysis Job
          </>
        )}
      </Button>
    </form>
  );
}
