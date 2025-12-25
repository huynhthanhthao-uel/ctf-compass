import { getBackendUrlFromStorage } from "@/lib/backend-url";

// Custom error classes for specific handling
export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class PaymentRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentRequiredError';
  }
}

/**
 * API client for CTF Autopilot Docker backend
 * All operations require a configured Docker backend URL
 */

function getApiBase(): string {
  const backendUrl = getBackendUrlFromStorage();
  if (!backendUrl) {
    throw new Error('Backend URL not configured. Go to Settings → Docker Backend URL to configure.');
  }
  return `${backendUrl}/api`;
}

// Get CSRF token from cookie
function getCsrfToken(): string | null {
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : null;
}

// Check if response is HTML (backend not available, Vite serving index.html)
function isHtmlResponse(text: string): boolean {
  return text.trimStart().startsWith('<!') || text.trimStart().startsWith('<html');
}

// Generic fetch wrapper with error handling
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${getApiBase()}${endpoint}`;

  const method = (options.method || 'GET').toUpperCase();

  const headers: HeadersInit = {
    'Accept': 'application/json',
    ...options.headers,
  };

  // Only send JSON content-type when we actually have a JSON body.
  // Avoiding Content-Type on GET prevents unnecessary CORS preflights.
  const hasBody = options.body !== undefined && options.body !== null;
  if (hasBody && typeof options.body === 'string') {
    const h = headers as Record<string, string>;
    if (!h['Content-Type']) h['Content-Type'] = 'application/json';
  }

  // Add CSRF token for mutating requests
  if (['POST', 'PATCH', 'DELETE'].includes(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      (headers as Record<string, string>)['X-CSRF-Token'] = csrfToken;
    }
  }

  // Log request for diagnostics
  const startTime = performance.now();
  let response: Response;
  
  try {
    response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch (error) {
    // Log network error for diagnostics
    const errorMessage = error instanceof Error ? error.message : 'Network error';
    const isCors = errorMessage.includes('Failed to fetch') || errorMessage.includes('CORS');
    
    // Dynamic import to avoid circular dependency
    import('@/components/NetworkDiagnostics').then(({ addDiagnosticLog }) => {
      addDiagnosticLog({
        type: 'error',
        method,
        url,
        error: errorMessage,
        corsError: isCors,
      });
    }).catch(() => {});
    
    throw error;
  }

  const duration = Math.round(performance.now() - startTime);

  // Log response for diagnostics
  import('@/components/NetworkDiagnostics').then(({ addDiagnosticLog }) => {
    addDiagnosticLog({
      type: 'response',
      method,
      url,
      status: response.status,
      statusText: response.statusText,
      duration,
    });
  }).catch(() => {});

  // Handle response text first to check for HTML
  const text = await response.text();

  // Check if we got HTML instead of JSON (backend not running)
  if (isHtmlResponse(text)) {
    throw new Error('Backend not reachable. Check your Docker Backend URL in Settings.');
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    if (text) {
      try {
        const parsed = JSON.parse(text);
        detail = parsed?.detail || parsed?.error || parsed?.message || detail;
      } catch {
        detail = text.substring(0, 200);
      }
    }
    throw new Error(detail);
  }

  // Handle empty responses
  if (!text) return {} as T;

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON response from backend');
  }
}


// ============ Auth API ============

export interface LoginResponse {
  message: string;
  expires_at: string;
}

export async function login(password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export async function logout(): Promise<void> {
  await apiFetch('/auth/logout', { method: 'POST' });
}

export async function checkSession(): Promise<{ authenticated: boolean }> {
  try {
    return await apiFetch('/auth/session');
  } catch {
    return { authenticated: false };
  }
}

// ============ Jobs API ============

export interface Job {
  id: string;
  title: string;
  status: 'pending' | 'queued' | 'running' | 'completed' | 'failed';
  created_at: string;
  completed_at?: string;
}

export interface JobDetail extends Job {
  description: string;
  flag_format: string;
  started_at?: string;
  input_files: string[];
  commands_executed: number;
  error_message?: string;
  timeline: Array<{ timestamp: string; event: string }>;
  flag_candidates: Array<{
    value: string;
    confidence: number;
    source: string;
  }>;
}

export interface JobListResponse {
  jobs: Job[];
  total: number;
  limit: number;
  offset: number;
}

export async function listJobs(
  limit = 20,
  offset = 0,
  status?: string
): Promise<JobListResponse> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (status) params.set('status', status);
  
  return apiFetch(`/jobs?${params}`);
}

export async function getJob(jobId: string): Promise<JobDetail> {
  return apiFetch(`/jobs/${jobId}`);
}

export async function createJob(
  title: string,
  description: string,
  flagFormat: string,
  files: File[],
  category?: string,
  challengeUrl?: string
): Promise<Job> {
  const backendUrl = getBackendUrlFromStorage();
  if (!backendUrl) {
    throw new Error('Backend URL not configured. Go to Settings to configure.');
  }

  const formData = new FormData();
  formData.append('title', title);
  formData.append('description', description);
  formData.append('flag_format', flagFormat);
  if (category) formData.append('category', category);
  if (challengeUrl) formData.append('challenge_url', challengeUrl);
  files.forEach((file) => formData.append('files', file));
  
  const csrfToken = getCsrfToken();
  const headers: HeadersInit = {
    'Accept': 'application/json',
  };
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }
  
  const response = await fetch(`${backendUrl}/api/jobs`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
    headers,
  });
  
  const text = await response.text();
  
  if (isHtmlResponse(text)) {
    throw new Error('Backend not reachable. Check your Docker Backend URL in Settings.');
  }
  
  if (!response.ok) {
    let error = { detail: `HTTP ${response.status}` };
    try {
      error = JSON.parse(text);
    } catch {
      error.detail = text.substring(0, 200) || error.detail;
    }
    throw new Error(error.detail || error.toString());
  }
  
  return JSON.parse(text);
}

export async function runJob(jobId: string): Promise<void> {
  await apiFetch(`/jobs/${jobId}/run`, { method: 'POST' });
}

export async function getJobCommands(jobId: string): Promise<{
  commands: Array<{
    id: string;
    tool: string;
    arguments: string[];
    started_at: string;
    completed_at?: string;
    exit_code?: number;
    stdout: string;
    stderr: string;
  }>;
}> {
  return apiFetch(`/jobs/${jobId}/commands`);
}

export async function getJobArtifacts(jobId: string): Promise<{
  artifacts: Array<{
    path: string;
    size: number;
    type: string;
    hash?: string;
  }>;
}> {
  return apiFetch(`/jobs/${jobId}/artifacts`);
}

// ============ System API ============

export interface UpdateCheckResponse {
  updates_available: boolean;
  current_version: string;
  latest_version: string;
  commits_behind?: number;
  changelog?: string;
  error?: string;
}

export async function checkForUpdates(): Promise<UpdateCheckResponse> {
  return apiFetch('/system/check-update');
}

export async function performUpdate(): Promise<Response> {
  const backendUrl = getBackendUrlFromStorage();
  if (!backendUrl) {
    throw new Error('Backend URL not configured');
  }

  const csrfToken = getCsrfToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }
  
  return fetch(`${backendUrl}/api/system/update`, {
    method: 'POST',
    headers,
    credentials: 'include',
  });
}

export interface ApiKeyResponse {
  is_configured: boolean;
  key_prefix?: string;
}

export async function getApiKeyStatus(): Promise<ApiKeyResponse> {
  return apiFetch('/system/api-key');
}

export async function setApiKey(apiKey: string): Promise<ApiKeyResponse> {
  return apiFetch('/system/api-key', {
    method: 'POST',
    body: JSON.stringify({ api_key: apiKey }),
  });
}

export interface ModelConfigResponse {
  analysis_model: string;
  writeup_model: string;
  extraction_model: string;
}

export async function getModelConfig(): Promise<ModelConfigResponse> {
  return apiFetch('/system/models');
}

export async function setModelConfig(config: {
  analysis_model?: string;
  writeup_model?: string;
  extraction_model?: string;
}): Promise<ModelConfigResponse> {
  return apiFetch('/system/models', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

// ============ Config API ============

export interface ConfigResponse {
  max_upload_size_mb: number;
  sandbox_timeout_seconds: number;
  allowed_extensions: string[];
  allowed_tools: string[];
}

export async function getConfig(): Promise<ConfigResponse> {
  return apiFetch('/config');
}

// ============ Terminal API ============

export interface TerminalCommandResult {
  exit_code: number;
  stdout: string;
  stderr: string;
  error?: string;
  duration_ms?: number;
}

export async function executeTerminalCommand(
  jobId: string,
  tool: string,
  args: string[]
): Promise<TerminalCommandResult> {
  return apiFetch(`/jobs/${jobId}/terminal`, {
    method: 'POST',
    body: JSON.stringify({ tool, arguments: args }),
  });
}

export async function getJobFiles(jobId: string): Promise<{ files: string[] }> {
  return apiFetch(`/jobs/${jobId}/files`);
}

// ============ AI Analysis API ============

export interface CommandOutput {
  tool: string;
  args: string[];
  stdout: string;
  stderr: string;
  exit_code: number;
}

export interface NextCommand {
  tool: string;
  args: string[];
  reason: string;
}

export interface SolveScript {
  language: 'python' | 'bash';
  code: string;
  description: string;
  expected_output: string;
}

export interface AIAnalysisResponse {
  analysis: string;
  category: string;
  confidence: number;
  findings: string[];
  next_commands: NextCommand[];
  flag_candidates: string[];
  should_continue: boolean;
  rule_based: boolean;
  strategy?: string;
  alternative_approaches?: string[];
  playbook?: string;
  solve_script?: SolveScript;
}

export async function analyzeWithAI(
  jobId: string,
  files: string[],
  commandHistory: CommandOutput[],
  description: string = "",
  flagFormat: string = "CTF{...}",
  currentCategory: string = "unknown",
  attemptNumber: number = 1,
  requestScript: boolean = false,
  earlyFlags: string[] = []
): Promise<AIAnalysisResponse> {
  return apiFetch('/ai/analyze', {
    method: 'POST',
    body: JSON.stringify({
      job_id: jobId,
      files,
      command_history: commandHistory,
      description,
      flag_format: flagFormat,
      current_category: currentCategory,
      attempt_number: attemptNumber,
      request_script: requestScript,
      early_flags: earlyFlags,
    }),
  });
}

// Execute Python script in sandbox
export async function executePythonInSandbox(
  jobId: string,
  script: string
): Promise<TerminalCommandResult> {
  return apiFetch(`/jobs/${jobId}/terminal`, {
    method: 'POST',
    body: JSON.stringify({ 
      tool: 'python3', 
      arguments: ['-c', script],
      script,
      script_type: 'python'
    }),
  });
}

export interface DetectCategoryResponse {
  category: string;
  confidence: number;
}

export async function detectCategory(
  files: string[],
  fileOutputs: Record<string, string> = {},
  stringsOutputs: Record<string, string> = {}
): Promise<DetectCategoryResponse> {
  return apiFetch('/ai/detect-category', {
    method: 'POST',
    body: JSON.stringify({
      files,
      file_outputs: fileOutputs,
      strings_outputs: stringsOutputs,
    }),
  });
}


// ============ History API ============

export interface AnalysisSessionSummary {
  id: string;
  job_id: string;
  name: string;
  strategy: string | null;
  detected_category: string | null;
  status: string;
  started_at: string;
  ended_at: string | null;
  total_commands: number;
  successful_commands: number;
  flags_found_count: number;
  ai_suggestions_used: number;
  notes: string | null;
  summary: string | null;
}

export interface CommandSummary {
  id: string;
  tool: string;
  arguments: string[];
  exit_code: number | null;
  stdout_preview: string;
  executed_at: string;
  duration_ms: number;
}

export interface FlagSummary {
  id: string;
  value: string;
  confidence: number;
  source: string | null;
}

export interface SessionDetail {
  session: AnalysisSessionSummary;
  commands: CommandSummary[];
  flags: FlagSummary[];
  ai_insights: Array<{
    analysis: string;
    category: string;
    confidence: number;
    findings: string[];
    timestamp: string;
  }>;
  effective_tools: Array<{
    tool: string;
    context: string | null;
    timestamp: string;
  }>;
}

export interface ToolRecommendation {
  tool: string;
  score: number;
  reason: string;
}

export interface SimilarSolve {
  id: string;
  category: string;
  file_types: string[];
  successful_tools: string[];
  tool_sequence: string[];
  time_to_solve_seconds: number | null;
  total_commands: number;
}

export async function createAnalysisSession(
  jobId: string,
  name: string = "Analysis Session",
  strategy: string = "auto"
): Promise<AnalysisSessionSummary> {
  return apiFetch('/history/sessions', {
    method: 'POST',
    body: JSON.stringify({ job_id: jobId, name, strategy }),
  });
}

export async function getJobSessions(
  jobId: string,
  limit: number = 20
): Promise<{ sessions: AnalysisSessionSummary[]; total: number }> {
  return apiFetch(`/history/sessions/${jobId}?limit=${limit}`);
}

export async function getSessionDetails(
  jobId: string,
  sessionId: string
): Promise<SessionDetail> {
  return apiFetch(`/history/sessions/${jobId}/${sessionId}`);
}

export async function endAnalysisSession(
  sessionId: string,
  status: string = "completed",
  summary?: string
): Promise<void> {
  await apiFetch(`/history/sessions/${sessionId}/end`, {
    method: 'POST',
    body: JSON.stringify({ status, summary }),
  });
}

export async function addSessionInsight(
  sessionId: string,
  insight: {
    analysis: string;
    category: string;
    confidence: number;
    findings: string[];
    next_commands: Array<{ tool: string; args: string[]; reason: string }>;
  }
): Promise<void> {
  await apiFetch(`/history/sessions/${sessionId}/insight`, {
    method: 'POST',
    body: JSON.stringify(insight),
  });
}

export async function recordEffectiveTool(
  sessionId: string,
  tool: string,
  context?: string
): Promise<void> {
  await apiFetch(`/history/sessions/${sessionId}/effective-tool`, {
    method: 'POST',
    body: JSON.stringify({ tool, context }),
  });
}

export async function saveToGlobalHistory(
  sessionId: string,
  fileTypes: string[],
  successfulTools: string[],
  toolSequence: string[],
  keywords: string[] = []
): Promise<void> {
  await apiFetch(`/history/sessions/${sessionId}/save-global`, {
    method: 'POST',
    body: JSON.stringify({
      file_types: fileTypes,
      successful_tools: successfulTools,
      tool_sequence: toolSequence,
      keywords,
    }),
  });
}

export async function getToolRecommendations(
  category: string,
  fileTypes: string[]
): Promise<ToolRecommendation[]> {
  return apiFetch('/history/recommend-tools', {
    method: 'POST',
    body: JSON.stringify({ category, file_types: fileTypes }),
  });
}

export async function getSimilarSolves(
  category: string,
  fileTypes: string[],
  limit: number = 5
): Promise<SimilarSolve[]> {
  return apiFetch(`/history/similar-solves?limit=${limit}`, {
    method: 'POST',
    body: JSON.stringify({ category, file_types: fileTypes }),
  });
}

// ============ Sandbox Tools API ============

export interface ToolStatus {
  available: boolean;
  path?: string;
  error?: string;
  assumed?: boolean;
}

export interface ToolAvailabilityResponse {
  tools: Record<string, ToolStatus>;
  cached: boolean;
  checked_at: string;
  summary?: {
    available: number;
    total: number;
    percentage: number;
  };
}

export interface PythonPackagesResponse {
  packages: string[];
  can_install_more: boolean;
  venv_supported: boolean;
}

export interface RunScriptRequest {
  script: string;
  pip_packages?: string[];
  timeout?: number;
}

export interface RunScriptResponse {
  exit_code: number;
  stdout: string;
  stderr: string;
  script: string;
  packages: string[];
}

export async function checkToolAvailability(refresh: boolean = false): Promise<ToolAvailabilityResponse> {
  return apiFetch(`/system/sandbox/tools?refresh=${refresh}`);
}

export async function getPythonPackages(): Promise<PythonPackagesResponse> {
  return apiFetch('/system/sandbox/python-packages');
}

export async function runPythonScript(request: RunScriptRequest): Promise<RunScriptResponse> {
  return apiFetch('/system/sandbox/run-script', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

// ============ Netcat Challenge Support ============

export interface NetcatConnectionResult {
  stdout: string;
  stderr: string;
  exit_code: number;
  connected: boolean;
  interaction_log?: string[];
}

export async function executeNetcatCommand(
  jobId: string,
  host: string,
  port: number,
  payload?: string,
  timeout: number = 10
): Promise<NetcatConnectionResult> {
  return apiFetch(`/jobs/${jobId}/terminal`, {
    method: 'POST',
    body: JSON.stringify({
      tool: 'nc',
      arguments: [host, String(port)],
      payload,
      timeout,
    }),
  });
}

export async function executeNetcatInteraction(
  jobId: string,
  host: string,
  port: number,
  script: string[],
  timeout: number = 30
): Promise<NetcatConnectionResult> {
  return apiFetch(`/jobs/${jobId}/terminal`, {
    method: 'POST',
    body: JSON.stringify({
      tool: 'nc_interact',
      arguments: [host, String(port)],
      interaction_script: script,
      timeout,
    }),
  });
}
