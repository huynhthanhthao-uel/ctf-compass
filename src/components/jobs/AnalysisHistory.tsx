import { useState, useEffect } from 'react';
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
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import * as api from '@/lib/api';

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

  useEffect(() => {
    loadSessions();
  }, [jobId]);

  const loadSessions = async () => {
    setIsLoading(true);
    try {
      const response = await api.getJobSessions(jobId);
      setSessions(response.sessions);
    } catch (err) {
      console.error('Failed to load sessions:', err);
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
      console.error('Failed to load session details:', err);
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
      console.error('Failed to load similar solves:', err);
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
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4" />
                Analysis Sessions ({sessions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Clock className="h-5 w-5 animate-spin mr-2" />
                  Loading history...
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
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
                                  {onApplyStrategy && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="mt-2"
                                      onClick={() => onApplyStrategy(
                                        [...new Set(selectedSession.effective_tools.map(t => t.tool))]
                                      )}
                                    >
                                      <ExternalLink className="h-3 w-3 mr-1" />
                                      Apply This Strategy
                                    </Button>
                                  )}
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

        <TabsContent value="similar">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Similar Past Solves
              </CardTitle>
            </CardHeader>
            <CardContent>
              {similarSolves.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No similar solves found</p>
                  <p className="text-sm">Complete more challenges to build knowledge</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {similarSolves.map((solve) => (
                    <div key={solve.id} className="p-3 rounded-lg border bg-card">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="capitalize">{solve.category}</Badge>
                        {solve.time_to_solve_seconds && (
                          <span className="text-xs text-muted-foreground">
                            Solved in {Math.round(solve.time_to_solve_seconds / 60)}m
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mb-2">
                        File types: {solve.file_types.join(', ')}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {solve.successful_tools.map((tool) => (
                          <Badge key={tool} variant="secondary" className="text-xs">
                            {tool}
                          </Badge>
                        ))}
                      </div>
                      {onApplyStrategy && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2"
                          onClick={() => onApplyStrategy(solve.tool_sequence)}
                        >
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

        <TabsContent value="recommendations">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="h-4 w-4" />
                AI Tool Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recommendations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Award className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No recommendations available</p>
                  <p className="text-sm">Run analysis to get AI recommendations</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recommendations.map((rec, i) => (
                    <div 
                      key={rec.tool} 
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border",
                        i === 0 && "bg-primary/5 border-primary/20"
                      )}
                    >
                      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-bold">
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-mono font-medium">{rec.tool}</div>
                        <div className="text-xs text-muted-foreground">{rec.reason}</div>
                      </div>
                      <Badge variant="secondary">{rec.score} pts</Badge>
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
