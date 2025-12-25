import { useState, useEffect, useRef } from 'react';
import { 
  History, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Pause,
  Brain,
  ChevronDown,
  ChevronRight,
  Flag,
  Terminal,
  Lightbulb,
  TrendingUp,
  Award,
  Copy,
  ExternalLink,
  Upload,
  Download,
  Share2,
  Sparkles,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import { 
  mockAnalysisSessions, 
  mockSimilarSolves, 
  mockToolRecommendations,
  mockSessionDetails 
} from '@/lib/mock-data';

interface AnalysisHistoryProps {
  jobId: string;
  onSelectSession?: (sessionId: string) => void;
  onApplyStrategy?: (tools: string[]) => void;
}

export function AnalysisHistory({ 
  jobId, 
  onSelectSession,
  onApplyStrategy 
}: AnalysisHistoryProps) {
  const [sessions, setSessions] = useState<api.AnalysisSessionSummary[]>([]);
  const [selectedSession, setSelectedSession] = useState<api.SessionDetail | null>(null);
  const [similarSolves, setSimilarSolves] = useState<api.SimilarSolve[]>([]);
  const [recommendations, setRecommendations] = useState<api.ToolRecommendation[]>([]);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('history');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSessions();
  }, [jobId]);

  // Export strategy as JSON
  const exportStrategy = (session: api.SessionDetail) => {
    const strategy = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      name: session.session.name,
      category: session.session.detected_category,
      strategy: session.session.strategy,
      tools: [...new Set(session.effective_tools.map(t => t.tool))],
      toolSequence: session.commands.map(c => ({
        tool: c.tool,
        args: c.arguments,
      })),
      aiInsights: session.ai_insights,
      summary: session.session.summary,
      stats: {
        totalCommands: session.session.total_commands,
        successfulCommands: session.session.successful_commands,
        flagsFound: session.session.flags_found_count,
      }
    };

    const blob = new Blob([JSON.stringify(strategy, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ctf-strategy-${session.session.detected_category || 'unknown'}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Strategy exported successfully');
  };

  // Import strategy from JSON
  const importStrategy = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const strategy = JSON.parse(e.target?.result as string);
        
        if (!strategy.version || !strategy.tools) {
          throw new Error('Invalid strategy file format');
        }

        toast.success(`Imported strategy: ${strategy.name || 'Unnamed'}`);
        
        // Apply the imported strategy
        if (onApplyStrategy && strategy.tools.length > 0) {
          onApplyStrategy(strategy.tools);
        }
      } catch (err) {
        toast.error('Failed to import strategy: Invalid file format');
        console.error('Import error:', err);
      }
    };
    reader.readAsText(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Copy strategy to clipboard for sharing
  const shareStrategy = (session: api.SessionDetail) => {
    const strategy = {
      version: "1.0",
      name: session.session.name,
      category: session.session.detected_category,
      tools: [...new Set(session.effective_tools.map(t => t.tool))],
      summary: session.session.summary,
    };

    navigator.clipboard.writeText(JSON.stringify(strategy, null, 2));
    toast.success('Strategy copied to clipboard');
  };

  const loadSessions = async () => {
    setIsLoading(true);
    try {
      const response = await api.getJobSessions(jobId);
      setSessions(response.sessions);
    } catch (err) {
      console.error('Failed to load sessions from API, using mock data:', err);
      // Use mock data as fallback
      const jobSessions = mockAnalysisSessions.filter(s => s.job_id === jobId);
      setSessions(jobSessions as unknown as api.AnalysisSessionSummary[]);
      // Also load mock similar solves and recommendations
      setSimilarSolves(mockSimilarSolves as unknown as api.SimilarSolve[]);
      setRecommendations(mockToolRecommendations as unknown as api.ToolRecommendation[]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSessionDetails = async (sessionId: string) => {
    try {
      const details = await api.getSessionDetails(jobId, sessionId);
      setSelectedSession(details);
      onSelectSession?.(sessionId);
    } catch (err) {
      console.error('Failed to load session details from API, using mock data:', err);
      // Use mock data as fallback
      const mockDetails = mockSessionDetails[sessionId];
      if (mockDetails) {
        setSelectedSession(mockDetails as unknown as api.SessionDetail);
        onSelectSession?.(sessionId);
      }
    }
  };

  const loadSimilarSolves = async (category: string, fileTypes: string[]) => {
    try {
      const [solves, recs] = await Promise.all([
        api.getSimilarSolves(category, fileTypes),
        api.getToolRecommendations(category, fileTypes),
      ]);
      setSimilarSolves(solves);
      setRecommendations(recs);
    } catch (err) {
      console.error('Failed to load similar solves from API, using mock data:', err);
      // Use mock data as fallback
      setSimilarSolves(mockSimilarSolves as unknown as api.SimilarSolve[]);
      setRecommendations(mockToolRecommendations as unknown as api.ToolRecommendation[]);
    }
  };

  const toggleSession = (sessionId: string) => {
    setExpandedSessions(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
        loadSessionDetails(sessionId);
      }
      return next;
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'stopped':
        return <Pause className="h-4 w-4 text-warning" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground animate-pulse" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-success/10 text-success border-success/30';
      case 'failed':
        return 'bg-destructive/10 text-destructive border-destructive/30';
      case 'stopped':
        return 'bg-warning/10 text-warning border-warning/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const formatDuration = (startedAt: string, endedAt: string | null) => {
    if (!endedAt) return 'In progress';
    const start = new Date(startedAt).getTime();
    const end = new Date(endedAt).getTime();
    const seconds = Math.round((end - start) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Session History
          </TabsTrigger>
          <TabsTrigger value="similar" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Similar Solves
          </TabsTrigger>
          <TabsTrigger value="recommendations" className="flex items-center gap-2">
            <Award className="h-4 w-4" />
            AI Recommendations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Analysis Sessions ({sessions.length})
                </CardTitle>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={importStrategy}
                    accept=".json"
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-1"
                  >
                    <Upload className="h-3 w-3" />
                    Import
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3 py-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg border animate-pulse">
                      <Skeleton className="h-4 w-4 rounded" />
                      <Skeleton className="h-4 w-4 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                      <Skeleton className="h-8 w-16" />
                    </div>
                  ))}
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground animate-fade-in">
                  <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No analysis sessions yet</p>
                  <p className="text-sm">Start an AI analysis to create history</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2 pr-4">
                    {sessions.map((session) => (
                      <Collapsible
                        key={session.id}
                        open={expandedSessions.has(session.id)}
                        onOpenChange={() => toggleSession(session.id)}
                      >
                        <CollapsibleTrigger className="w-full">
                          <div className={cn(
                            "flex items-center gap-3 p-3 rounded-lg transition-colors text-left",
                            "hover:bg-muted/50 cursor-pointer border",
                            expandedSessions.has(session.id) ? "bg-muted/50 border-border" : "border-transparent"
                          )}>
                            {expandedSessions.has(session.id) ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                            
                            {getStatusIcon(session.status)}
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">{session.name}</span>
                                {session.detected_category && (
                                  <Badge variant="outline" className="text-xs capitalize">
                                    {session.detected_category}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(session.started_at), { addSuffix: true })}
                                {' • '}
                                {formatDuration(session.started_at, session.ended_at)}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right">
                                <div className="text-sm font-medium">{session.total_commands}</div>
                                <div className="text-xs text-muted-foreground">commands</div>
                              </div>
                              
                              {session.flags_found_count > 0 && (
                                <Badge className="bg-success">
                                  <Flag className="h-3 w-3 mr-1" />
                                  {session.flags_found_count}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        
                        <CollapsibleContent>
                          {selectedSession?.session.id === session.id && (
                            <div className="ml-8 mr-2 mb-3 mt-2 space-y-3">
                              {/* Summary */}
                              {selectedSession.session.summary && (
                                <div className="p-3 rounded-lg bg-muted/30 text-sm">
                                  {selectedSession.session.summary}
                                </div>
                              )}
                              
                              {/* Stats */}
                              <div className="grid grid-cols-4 gap-2">
                                <div className="p-2 rounded bg-muted/30 text-center">
                                  <div className="text-lg font-semibold">{selectedSession.commands.length}</div>
                                  <div className="text-xs text-muted-foreground">Commands</div>
                                </div>
                                <div className="p-2 rounded bg-muted/30 text-center">
                                  <div className="text-lg font-semibold">{session.successful_commands}</div>
                                  <div className="text-xs text-muted-foreground">Successful</div>
                                </div>
                                <div className="p-2 rounded bg-muted/30 text-center">
                                  <div className="text-lg font-semibold">{session.ai_suggestions_used}</div>
                                  <div className="text-xs text-muted-foreground">AI Hints</div>
                                </div>
                                <div className="p-2 rounded bg-success/10 text-center">
                                  <div className="text-lg font-semibold text-success">{selectedSession.flags.length}</div>
                                  <div className="text-xs text-muted-foreground">Flags</div>
                                </div>
                              </div>
                              
                              {/* Flags found */}
                              {selectedSession.flags.length > 0 && (
                                <div className="space-y-1">
                                  <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                    <Flag className="h-3 w-3" /> Flags Found
                                  </div>
                                  {selectedSession.flags.map((flag) => (
                                    <div key={flag.id} className="flex items-center gap-2 p-2 rounded bg-success/10">
                                      <code className="font-mono text-sm flex-1">{flag.value}</code>
                                      <Badge variant="outline" className="text-xs">
                                        {Math.round(flag.confidence * 100)}%
                                      </Badge>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6"
                                        onClick={() => navigator.clipboard.writeText(flag.value)}
                                      >
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {/* AI Insights */}
                              {selectedSession.ai_insights.length > 0 && (
                                <div className="space-y-1">
                                  <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                    <Brain className="h-3 w-3" /> AI Insights ({selectedSession.ai_insights.length})
                                  </div>
                                  <ScrollArea className="h-32">
                                    <div className="space-y-2 pr-2">
                                      {selectedSession.ai_insights.slice(0, 5).map((insight, i) => (
                                        <div key={i} className="p-2 rounded bg-muted/30 text-xs">
                                          <div className="flex items-center gap-2 mb-1">
                                            <Badge variant="outline" className="capitalize">{insight.category}</Badge>
                                            <span className="text-muted-foreground">
                                              {Math.round(insight.confidence * 100)}% confident
                                            </span>
                                          </div>
                                          <p className="text-muted-foreground">{insight.analysis}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </ScrollArea>
                                </div>
                              )}
                              
                              {/* Effective Tools */}
                              {selectedSession.effective_tools.length > 0 && (
                                <div className="space-y-1">
                                  <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                    <Lightbulb className="h-3 w-3" /> Effective Tools
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {[...new Set(selectedSession.effective_tools.map(t => t.tool))].map((tool) => (
                                      <Badge key={tool} variant="secondary" className="text-xs">
                                        {tool}
                                      </Badge>
                                    ))}
                                  </div>
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {onApplyStrategy && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => onApplyStrategy(
                                          [...new Set(selectedSession.effective_tools.map(t => t.tool))]
                                        )}
                                      >
                                        <ExternalLink className="h-3 w-3 mr-1" />
                                        Apply
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => exportStrategy(selectedSession)}
                                    >
                                      <Download className="h-3 w-3 mr-1" />
                                      Export
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => shareStrategy(selectedSession)}
                                    >
                                      <Share2 className="h-3 w-3 mr-1" />
                                      Share
                                    </Button>
                                  </div>
                                </div>
                              )}
                              
                              {/* Commands preview */}
                              {selectedSession.commands.length > 0 && (
                                <div className="space-y-1">
                                  <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                    <Terminal className="h-3 w-3" /> Commands ({selectedSession.commands.length})
                                  </div>
                                  <ScrollArea className="h-24">
                                    <div className="space-y-1 pr-2">
                                      {selectedSession.commands.slice(0, 10).map((cmd) => (
                                        <div 
                                          key={cmd.id} 
                                          className={cn(
                                            "flex items-center gap-2 p-1.5 rounded text-xs font-mono",
                                            cmd.exit_code === 0 ? "bg-muted/30" : "bg-destructive/10"
                                          )}
                                        >
                                          <span className="text-muted-foreground w-8">{cmd.duration_ms}ms</span>
                                          <span className="truncate">{cmd.tool} {cmd.arguments.join(' ')}</span>
                                        </div>
                                      ))}
                                      {selectedSession.commands.length > 10 && (
                                        <div className="text-xs text-muted-foreground text-center py-1">
                                          +{selectedSession.commands.length - 10} more commands
                                        </div>
                                      )}
                                    </div>
                                  </ScrollArea>
                                </div>
                              )}
                            </div>
                          )}
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="similar" className="animate-fade-in">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-transparent">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Similar Past Solves
                {similarSolves.length > 0 && (
                  <Badge variant="secondary" className="ml-auto">{similarSolves.length} found</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {similarSolves.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground animate-fade-in">
                  <div className="relative mx-auto w-16 h-16 mb-4">
                    <TrendingUp className="h-12 w-12 mx-auto opacity-30 absolute inset-0 m-auto" />
                    <Sparkles className="h-5 w-5 text-primary/50 absolute -top-1 -right-1 animate-pulse" />
                  </div>
                  <p className="font-medium">No similar solves found</p>
                  <p className="text-sm">Complete more challenges to build AI knowledge base</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {similarSolves.map((solve, index) => (
                    <div 
                      key={solve.id} 
                      className={cn(
                        "p-4 rounded-lg border bg-card transition-all duration-200 hover:shadow-md hover:border-primary/30",
                        "animate-fade-in"
                      )}
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant="outline" className="capitalize bg-primary/5">{solve.category}</Badge>
                        {solve.time_to_solve_seconds && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {Math.round(solve.time_to_solve_seconds / 60)}m
                          </div>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {solve.total_commands} commands
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
                        <span className="font-medium">Files:</span> {solve.file_types.join(', ')}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {solve.successful_tools.map((tool) => (
                          <Badge 
                            key={tool} 
                            variant="secondary" 
                            className="text-xs bg-success/10 text-success border-success/20"
                          >
                            ✓ {tool}
                          </Badge>
                        ))}
                      </div>
                      {onApplyStrategy && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full gap-2 hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-colors"
                          onClick={() => onApplyStrategy(solve.tool_sequence)}
                        >
                          <ExternalLink className="h-3 w-3" />
                          Use This Approach
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="animate-fade-in">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3 bg-gradient-to-r from-warning/5 to-transparent">
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="h-4 w-4 text-warning" />
                AI Tool Recommendations
                {recommendations.length > 0 && (
                  <Badge variant="secondary" className="ml-auto">{recommendations.length} tools</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recommendations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground animate-fade-in">
                  <div className="relative mx-auto w-16 h-16 mb-4">
                    <Award className="h-12 w-12 mx-auto opacity-30 absolute inset-0 m-auto" />
                    <Brain className="h-5 w-5 text-warning/50 absolute -top-1 -right-1 animate-pulse" />
                  </div>
                  <p className="font-medium">No recommendations yet</p>
                  <p className="text-sm">Run analysis to get AI-powered tool suggestions</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recommendations.map((rec, i) => (
                    <div 
                      key={rec.tool} 
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 hover:shadow-md animate-fade-in",
                        i === 0 ? "bg-gradient-to-r from-warning/10 to-transparent border-warning/30" : "hover:border-primary/30"
                      )}
                      style={{ animationDelay: `${i * 80}ms` }}
                    >
                      <div className={cn(
                        "flex items-center justify-center h-8 w-8 rounded-full font-bold text-sm",
                        i === 0 ? "bg-warning/20 text-warning" : "bg-primary/10 text-primary"
                      )}>
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-mono font-medium">{rec.tool}</div>
                        <div className="text-xs text-muted-foreground">{rec.reason}</div>
                      </div>
                      <Badge variant={i === 0 ? "default" : "secondary"} className={i === 0 ? "bg-warning text-warning-foreground" : ""}>
                        {rec.score} pts
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
