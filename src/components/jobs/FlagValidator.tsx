import { useState, useMemo } from 'react';
import { Flag, CheckCircle, XCircle, AlertTriangle, Sparkles, Copy, Check, Shield, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface FlagCandidate {
  id: string;
  value: string;
  confidence: number;
  source: string;
  commandId?: string;
  context?: string;
  validated?: boolean;
  validationResult?: {
    isValid: boolean;
    matchedFormat?: string;
    warnings: string[];
  };
}

interface FlagValidatorProps {
  candidates: FlagCandidate[];
  expectedFormat?: string;
}

// Common CTF flag formats from various competitions
const KNOWN_FLAG_FORMATS = [
  { name: 'CTF{...}', pattern: /^CTF\{[^}]+\}$/i, example: 'CTF{example_flag}' },
  { name: 'FLAG{...}', pattern: /^FLAG\{[^}]+\}$/i, example: 'FLAG{example_flag}' },
  { name: 'flag{...}', pattern: /^flag\{[^}]+\}$/i, example: 'flag{example_flag}' },
  { name: 'HTB{...}', pattern: /^HTB\{[^}]+\}$/i, example: 'HTB{hack_the_box}' },
  { name: 'THM{...}', pattern: /^THM\{[^}]+\}$/i, example: 'THM{try_hack_me}' },
  { name: 'picoCTF{...}', pattern: /^picoCTF\{[^}]+\}$/i, example: 'picoCTF{example}' },
  { name: 'DUCTF{...}', pattern: /^DUCTF\{[^}]+\}$/i, example: 'DUCTF{down_under}' },
  { name: 'CSCG{...}', pattern: /^CSCG\{[^}]+\}$/i, example: 'CSCG{cyber_security}' },
  { name: 'FCSC{...}', pattern: /^FCSC\{[^}]+\}$/i, example: 'FCSC{french_ctf}' },
  { name: 'SECCON{...}', pattern: /^SECCON\{[^}]+\}$/i, example: 'SECCON{japanese_ctf}' },
  { name: 'DEFCON{...}', pattern: /^DEFCON\{[^}]+\}$/i, example: 'DEFCON{las_vegas}' },
  { name: 'rwctf{...}', pattern: /^rwctf\{[^}]+\}$/i, example: 'rwctf{real_world}' },
  { name: 'INCTF{...}', pattern: /^INCTF\{[^}]+\}$/i, example: 'INCTF{india_ctf}' },
  { name: 'ASIS{...}', pattern: /^ASIS\{[^}]+\}$/i, example: 'ASIS{iranian_ctf}' },
  { name: 'google{...}', pattern: /^google\{[^}]+\}$/i, example: 'google{google_ctf}' },
  { name: 'p4{...}', pattern: /^p4\{[^}]+\}$/i, example: 'p4{p4_team}' },
];

// Validation warnings
function getValidationWarnings(flag: string): string[] {
  const warnings: string[] = [];
  
  // Check for suspicious patterns
  if (/^[A-Z]+\{test|example|flag|sample\}$/i.test(flag)) {
    warnings.push('Looks like a placeholder/test flag');
  }
  
  // Check for base64 encoded content inside
  const inner = flag.match(/\{([^}]+)\}/)?.[1];
  if (inner) {
    if (/^[A-Za-z0-9+/]+=*$/.test(inner) && inner.length > 10) {
      warnings.push('Inner content appears to be base64 encoded');
    }
    
    // Check for hex
    if (/^[0-9a-fA-F]+$/.test(inner) && inner.length > 10 && inner.length % 2 === 0) {
      warnings.push('Inner content appears to be hex encoded');
    }
    
    // Very short inner content
    if (inner.length < 3) {
      warnings.push('Flag content is very short');
    }
    
    // Very long inner content
    if (inner.length > 100) {
      warnings.push('Flag content is unusually long');
    }
    
    // Check for common words
    if (/password|secret|admin|root|key/i.test(inner)) {
      warnings.push('Contains common keyword - might not be the actual flag');
    }
  }
  
  // Check for special characters that might indicate corruption
  if (/[\x00-\x1f]/.test(flag)) {
    warnings.push('Contains non-printable characters');
  }
  
  return warnings;
}

// Validate a flag against known formats
function validateFlag(flag: string, customFormat?: string): FlagCandidate['validationResult'] {
  const warnings = getValidationWarnings(flag);
  
  // Check custom format first
  if (customFormat) {
    try {
      const customRegex = new RegExp(customFormat);
      if (customRegex.test(flag)) {
        return { isValid: true, matchedFormat: 'Custom format', warnings };
      }
    } catch {
      // Invalid regex, ignore
    }
  }
  
  // Check known formats
  for (const format of KNOWN_FLAG_FORMATS) {
    if (format.pattern.test(flag)) {
      return { isValid: true, matchedFormat: format.name, warnings };
    }
  }
  
  // Check generic format PREFIX{content}
  if (/^[A-Za-z0-9_]+\{[^}]+\}$/.test(flag)) {
    return { isValid: true, matchedFormat: 'Generic PREFIX{...}', warnings };
  }
  
  return { isValid: false, warnings: [...warnings, 'Does not match any known flag format'] };
}

export function FlagValidator({ candidates, expectedFormat }: FlagValidatorProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyValid, setShowOnlyValid] = useState(false);

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Validate all candidates
  const validatedCandidates = useMemo(() => {
    return candidates.map(candidate => ({
      ...candidate,
      validationResult: validateFlag(candidate.value, expectedFormat),
    }));
  }, [candidates, expectedFormat]);

  // Filter and sort
  const filteredCandidates = useMemo(() => {
    let filtered = validatedCandidates;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        c.value.toLowerCase().includes(query) ||
        c.source.toLowerCase().includes(query)
      );
    }
    
    if (showOnlyValid) {
      filtered = filtered.filter(c => c.validationResult?.isValid);
    }
    
    // Sort: valid + high confidence first
    return filtered.sort((a, b) => {
      const aValid = a.validationResult?.isValid ? 1 : 0;
      const bValid = b.validationResult?.isValid ? 1 : 0;
      if (aValid !== bValid) return bValid - aValid;
      return b.confidence - a.confidence;
    });
  }, [validatedCandidates, searchQuery, showOnlyValid]);

  const validCount = validatedCandidates.filter(c => c.validationResult?.isValid).length;

  if (candidates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Flag className="h-12 w-12 mb-4 opacity-50" />
        <p>No flag candidates found</p>
        <p className="text-sm">Run the analysis to extract potential flags</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-success" />
            <span className="text-sm">
              <span className="font-medium">{validCount}</span> valid
            </span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              <span className="font-medium">{candidates.length - validCount}</span> unverified
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search flags..."
              className="pl-8 h-8 w-48"
            />
          </div>
          <Button
            variant={showOnlyValid ? "default" : "outline"}
            size="sm"
            onClick={() => setShowOnlyValid(!showOnlyValid)}
          >
            <Shield className="h-3 w-3 mr-1" />
            Valid only
          </Button>
        </div>
      </div>

      {/* Expected format info */}
      {expectedFormat && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
          <Flag className="h-4 w-4" />
          <span>Expected format:</span>
          <code className="font-mono bg-muted px-1 rounded">{expectedFormat}</code>
        </div>
      )}

      {/* Candidates list */}
      <ScrollArea className="h-[500px]">
        <div className="space-y-3 p-1">
          {filteredCandidates.map((candidate) => {
            const isValid = candidate.validationResult?.isValid;
            const hasWarnings = (candidate.validationResult?.warnings.length || 0) > 0;
            
            return (
              <div
                key={candidate.id}
                className={cn(
                  "p-4 rounded-lg border transition-all",
                  isValid && !hasWarnings
                    ? "border-success/50 bg-success/5"
                    : isValid && hasWarnings
                    ? "border-warning/50 bg-warning/5"
                    : "border-border bg-card"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-3">
                    {/* Flag value */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {isValid ? (
                        hasWarnings ? (
                          <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                        ) : (
                          <CheckCircle className="h-4 w-4 text-success shrink-0" />
                        )
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      
                      {candidate.confidence >= 0.9 && isValid && (
                        <Sparkles className="h-4 w-4 text-success shrink-0" />
                      )}
                      
                      <code className="px-2 py-1 rounded bg-muted font-mono text-sm break-all">
                        {candidate.value}
                      </code>
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => copyToClipboard(candidate.value, candidate.id)}
                      >
                        {copiedId === candidate.id ? (
                          <Check className="h-3 w-3 text-success" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center gap-4 text-sm flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Confidence:</span>
                        <Progress 
                          value={candidate.confidence * 100} 
                          className="w-20 h-2"
                        />
                        <span className="font-medium">
                          {Math.round(candidate.confidence * 100)}%
                        </span>
                      </div>
                      
                      <Badge variant="outline" className="text-xs">
                        {candidate.source}
                      </Badge>

                      {candidate.validationResult?.matchedFormat && (
                        <Badge variant="secondary" className="text-xs">
                          {candidate.validationResult.matchedFormat}
                        </Badge>
                      )}
                    </div>

                    {/* Warnings */}
                    {hasWarnings && (
                      <div className="space-y-1">
                        {candidate.validationResult?.warnings.map((warning, i) => (
                          <div 
                            key={i}
                            className="flex items-center gap-2 text-xs text-warning"
                          >
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            {warning}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Context */}
                    {candidate.context && (
                      <div className="rounded bg-terminal-bg p-2">
                        <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap overflow-x-auto">
                          {candidate.context}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          
          {filteredCandidates.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No flags match your filters
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
