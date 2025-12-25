import { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, AlertCircle, FolderOpen, Link, Sparkles, Loader2, BarChart3 } from 'lucide-react';
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
import { CategoryConfidenceChart } from './CategoryConfidenceChart';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TemplateSelector } from './TemplateSelector';
import { ChallengeTemplate } from '@/hooks/use-challenge-templates';

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
  const [lastDetectedFiles, setLastDetectedFiles] = useState<string>('');
  const [lastDetectedDesc, setLastDetectedDesc] = useState<string>('');
  const [showChart, setShowChart] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const { detectFromFiles, isDetecting, result: detectionResult } = useCategoryDetector();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prev => [...prev, ...acceptedFiles]);
    setError(null);
  }, []);

  // Create a signature for current files
  const filesSignature = files.map(f => `${f.name}:${f.size}`).join('|');

  // Manual re-detect function
  const handleRedetect = useCallback(async () => {
    if (files.length === 0 && !description.trim()) {
      toast.error('Add files or description to detect category');
      return;
    }

    const result = await detectFromFiles(files, description);
    if (result) {
      setCategory(result.category);
      setAutoDetected(true);
      setLastDetectedFiles(filesSignature);
      setLastDetectedDesc(description);
      toast.success(`Detected category: ${result.category}`, {
        description: `Confidence: ${Math.round(result.confidence * 100)}% • Keywords: ${result.detectedKeywords.slice(0, 3).join(', ')}`
      });
    }
  }, [files, description, detectFromFiles, filesSignature]);

  // Auto-detect when files are added (first time only, or when re-detect is needed)
  useEffect(() => {
    const shouldAutoDetect = files.length > 0 && 
      !category && 
      filesSignature !== lastDetectedFiles;

    if (shouldAutoDetect) {
      detectFromFiles(files, description).then(result => {
        if (result && result.confidence > 0.5) {
          setCategory(result.category);
          setAutoDetected(true);
          setLastDetectedFiles(filesSignature);
          setLastDetectedDesc(description);
          toast.success(`Auto-detected category: ${result.category}`, {
            description: `Confidence: ${Math.round(result.confidence * 100)}% • Keywords: ${result.detectedKeywords.slice(0, 3).join(', ')}`
          });
        }
      });
    }
  }, [filesSignature, files, detectFromFiles, description, category, lastDetectedFiles]);

  // Debounced detection when description changes
  useEffect(() => {
    if (description.trim().length > 20 && files.length > 0 && !isDetecting) {
      // Clear previous timer
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Set new debounced detection
      debounceRef.current = setTimeout(() => {
        if (description !== lastDetectedDesc) {
          detectFromFiles(files, description).then(result => {
            if (result) {
              // Only update if result differs and confidence is good
              if (result.category !== category && result.confidence > 0.6) {
                setShowChart(true);
                // Don't auto-change category, just show the chart
              }
            }
          });
        }
      }, 800);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [description, files, detectFromFiles, lastDetectedDesc, category, isDetecting]);

  // Check if re-detection might give different results
  const canRedetect = files.length > 0 || description.trim().length > 10;
  const hasChangedSinceLastDetect = filesSignature !== lastDetectedFiles || description !== lastDetectedDesc;

  // Reset auto-detected flag when category changes manually
  const handleCategoryChange = (value: string) => {
    setCategory(value);
    setAutoDetected(false);
  };

  // Handle category selection from chart
  const handleChartCategorySelect = (cat: string) => {
    setCategory(cat);
    setAutoDetected(false);
    toast.success(`Selected category: ${cat}`);
  };

  // Handle template selection
  const handleSelectTemplate = useCallback((template: ChallengeTemplate) => {
    setTitle(template.titlePattern);
    setDescription(template.description);
    setFlagFormat(template.flagFormat);
    setCategory(template.category);
    setAutoDetected(false);
    toast.success(`Template "${template.name}" applied!`, {
      description: `Category: ${template.category} • Flag format loaded`
    });
  }, []);

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
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base">Challenge Information</CardTitle>
              <CardDescription>Enter the details of the CTF challenge</CardDescription>
            </div>
            <TemplateSelector
              onSelectTemplate={handleSelectTemplate}
              currentData={{
                category,
                title,
                description,
                flagFormat
              }}
              disabled={isLoading}
            />
          </div>
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
              <div className="flex items-center gap-2 flex-wrap">
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
                    Auto ({Math.round(detectionResult.confidence * 100)}%)
                  </Badge>
                )}
                {canRedetect && hasChangedSinceLastDetect && !isDetecting && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2 text-primary hover:text-primary"
                    onClick={handleRedetect}
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    {category ? 'Re-detect' : 'Detect'}
                  </Button>
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
              {detectionResult && detectionResult.detectedKeywords.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {detectionResult.detectedKeywords.slice(0, 5).map((keyword, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs font-mono">
                      {keyword}
                    </Badge>
                  ))}
                  {hasChangedSinceLastDetect && (
                    <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/50">
                      Changed
                    </Badge>
                  )}
                  {detectionResult.allScores.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-5 text-[10px] px-1.5 ml-auto"
                      onClick={() => setShowChart(!showChart)}
                    >
                      <BarChart3 className="h-3 w-3 mr-1" />
                      {showChart ? 'Hide' : 'Compare'}
                    </Button>
                  )}
                </div>
              )}

              {/* Category Confidence Chart */}
              <Collapsible open={showChart} onOpenChange={setShowChart}>
                <CollapsibleContent className="mt-2">
                  {detectionResult && (
                    <CategoryConfidenceChart
                      scores={detectionResult.allScores}
                      selectedCategory={category}
                      onSelectCategory={handleChartCategorySelect}
                    />
                  )}
                </CollapsibleContent>
              </Collapsible>
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
