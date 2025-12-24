/**
 * API client for CTF Autopilot backend
 */

const API_BASE = '/api';

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
  const url = `${API_BASE}${endpoint}`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  // Add CSRF token for mutating requests
  if (['POST', 'PATCH', 'DELETE'].includes(options.method || '')) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      (headers as Record<string, string>)['X-CSRF-Token'] = csrfToken;
    }
  }
  
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });
  
  // Handle response text first to check for HTML
  const text = await response.text();
  
  // Check if we got HTML instead of JSON (backend not running)
  if (isHtmlResponse(text)) {
    throw new Error('Backend API not available. Please deploy the backend first.');
  }
  
  if (!response.ok) {
    const error = text ? JSON.parse(text) : { detail: 'Unknown error' };
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  
  // Handle empty responses
  if (!text) return {} as T;
  
  return JSON.parse(text);
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
  files: File[]
): Promise<Job> {
  const formData = new FormData();
  formData.append('title', title);
  formData.append('description', description);
  formData.append('flag_format', flagFormat);
  files.forEach((file) => formData.append('files', file));
  
  const csrfToken = getCsrfToken();
  const headers: HeadersInit = {};
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }
  
  const response = await fetch(`${API_BASE}/jobs`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  
  return response.json();
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
  changelog?: string;
}

export async function checkForUpdates(): Promise<UpdateCheckResponse> {
  return apiFetch('/system/check-update');
}

export async function performUpdate(): Promise<Response> {
  const csrfToken = getCsrfToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }
  
  return fetch(`${API_BASE}/system/update`, {
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
