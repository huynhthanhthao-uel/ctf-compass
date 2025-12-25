import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * WebSocket Edge Function for Real-time Job Progress
 * 
 * Handles bidirectional communication for:
 * - Broadcasting analysis progress to connected clients
 * - Receiving progress updates from analysis workers
 */

// Store active WebSocket connections per job
const jobConnections: Map<string, Set<WebSocket>> = new Map();

// Store job progress state
const jobProgress: Map<string, JobProgressState> = new Map();

interface JobProgressState {
  jobId: string;
  status: 'pending' | 'running' | 'analyzing' | 'completed' | 'failed';
  progress: number; // 0-100
  currentStep: string;
  steps: ProgressStep[];
  logs: string[];
  startedAt: string;
  updatedAt: string;
  error?: string;
}

interface ProgressStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  output?: string;
}

// Initialize default progress state for a job
function initJobProgress(jobId: string): JobProgressState {
  return {
    jobId,
    status: 'pending',
    progress: 0,
    currentStep: 'Initializing',
    steps: [
      { id: 'upload', name: 'Upload Files', status: 'pending' },
      { id: 'detect', name: 'Detect Category', status: 'pending' },
      { id: 'analyze', name: 'AI Analysis', status: 'pending' },
      { id: 'commands', name: 'Execute Commands', status: 'pending' },
      { id: 'extract', name: 'Extract Flags', status: 'pending' },
      { id: 'complete', name: 'Generate Report', status: 'pending' },
    ],
    logs: [],
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Broadcast progress to all connected clients for a job
function broadcastProgress(jobId: string, progress: JobProgressState) {
  const connections = jobConnections.get(jobId);
  if (!connections) return;

  const message = JSON.stringify({
    type: 'progress',
    data: progress,
  });

  connections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });

  console.log(`[job-progress] Broadcast to ${connections.size} clients for job ${jobId}`);
}

// Handle incoming messages
function handleMessage(ws: WebSocket, jobId: string, message: string) {
  try {
    const data = JSON.parse(message);
    console.log(`[job-progress] Received message for job ${jobId}:`, data.type);

    switch (data.type) {
      case 'subscribe':
        // Client wants to receive updates
        let connections = jobConnections.get(jobId);
        if (!connections) {
          connections = new Set();
          jobConnections.set(jobId, connections);
        }
        connections.add(ws);
        
        // Send current state
        const currentProgress = jobProgress.get(jobId) || initJobProgress(jobId);
        jobProgress.set(jobId, currentProgress);
        ws.send(JSON.stringify({ type: 'progress', data: currentProgress }));
        break;

      case 'update_progress':
        // Worker updating progress
        updateProgress(jobId, data.payload);
        break;

      case 'update_step':
        // Update specific step
        updateStep(jobId, data.stepId, data.status, data.output);
        break;

      case 'add_log':
        // Add log entry
        addLog(jobId, data.message);
        break;

      case 'set_status':
        // Set overall job status
        setStatus(jobId, data.status, data.error);
        break;

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;

      default:
        console.log(`[job-progress] Unknown message type: ${data.type}`);
    }
  } catch (e) {
    console.error('[job-progress] Error handling message:', e);
  }
}

// Update progress state
function updateProgress(jobId: string, payload: Partial<JobProgressState>) {
  const progress = jobProgress.get(jobId) || initJobProgress(jobId);
  
  Object.assign(progress, payload, {
    updatedAt: new Date().toISOString(),
  });
  
  jobProgress.set(jobId, progress);
  broadcastProgress(jobId, progress);
}

// Update a specific step
function updateStep(jobId: string, stepId: string, status: ProgressStep['status'], output?: string) {
  const progress = jobProgress.get(jobId) || initJobProgress(jobId);
  
  const step = progress.steps.find(s => s.id === stepId);
  if (step) {
    step.status = status;
    if (status === 'running') {
      step.startedAt = new Date().toISOString();
      progress.currentStep = step.name;
    } else if (status === 'completed' || status === 'failed') {
      step.completedAt = new Date().toISOString();
    }
    if (output) {
      step.output = output;
    }
  }

  // Calculate overall progress
  const completedSteps = progress.steps.filter(s => s.status === 'completed').length;
  progress.progress = Math.round((completedSteps / progress.steps.length) * 100);
  progress.updatedAt = new Date().toISOString();

  jobProgress.set(jobId, progress);
  broadcastProgress(jobId, progress);
}

// Add log entry
function addLog(jobId: string, message: string) {
  const progress = jobProgress.get(jobId) || initJobProgress(jobId);
  
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  progress.logs.push(`[${timestamp}] ${message}`);
  progress.updatedAt = new Date().toISOString();

  // Keep only last 100 logs
  if (progress.logs.length > 100) {
    progress.logs = progress.logs.slice(-100);
  }

  jobProgress.set(jobId, progress);
  broadcastProgress(jobId, progress);
}

// Set overall status
function setStatus(jobId: string, status: JobProgressState['status'], error?: string) {
  const progress = jobProgress.get(jobId) || initJobProgress(jobId);
  
  progress.status = status;
  progress.updatedAt = new Date().toISOString();
  
  if (error) {
    progress.error = error;
  }
  
  if (status === 'completed') {
    progress.progress = 100;
  }

  jobProgress.set(jobId, progress);
  broadcastProgress(jobId, progress);
}

// Clean up connection
function cleanupConnection(ws: WebSocket, jobId: string) {
  const connections = jobConnections.get(jobId);
  if (connections) {
    connections.delete(ws);
    if (connections.size === 0) {
      jobConnections.delete(jobId);
    }
  }
  console.log(`[job-progress] Connection closed for job ${jobId}`);
}

serve(async (req) => {
  const url = new URL(req.url);
  const jobId = url.searchParams.get('job_id');

  // Handle HTTP requests for getting current state
  if (req.method === 'GET' && !req.headers.get('upgrade')) {
    if (!jobId) {
      return new Response(JSON.stringify({ error: 'job_id required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const progress = jobProgress.get(jobId) || initJobProgress(jobId);
    return new Response(JSON.stringify(progress), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // Handle POST requests for updating progress (from workers)
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const { job_id, type, ...payload } = body;

      if (!job_id) {
        return new Response(JSON.stringify({ error: 'job_id required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      switch (type) {
        case 'update_progress':
          updateProgress(job_id, payload);
          break;
        case 'update_step':
          updateStep(job_id, payload.step_id, payload.status, payload.output);
          break;
        case 'add_log':
          addLog(job_id, payload.message);
          break;
        case 'set_status':
          setStatus(job_id, payload.status, payload.error);
          break;
        default:
          return new Response(JSON.stringify({ error: 'Unknown type' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  // Handle WebSocket upgrade
  const upgradeHeader = req.headers.get('upgrade') || '';
  if (upgradeHeader.toLowerCase() !== 'websocket') {
    return new Response('Expected WebSocket connection', { status: 400 });
  }

  if (!jobId) {
    return new Response('job_id query parameter required', { status: 400 });
  }

  console.log(`[job-progress] WebSocket connection for job ${jobId}`);

  const { socket, response } = Deno.upgradeWebSocket(req);

  socket.onopen = () => {
    console.log(`[job-progress] WebSocket opened for job ${jobId}`);
    
    // Auto-subscribe on connect
    let connections = jobConnections.get(jobId);
    if (!connections) {
      connections = new Set();
      jobConnections.set(jobId, connections);
    }
    connections.add(socket);

    // Send current state
    const currentProgress = jobProgress.get(jobId) || initJobProgress(jobId);
    jobProgress.set(jobId, currentProgress);
    socket.send(JSON.stringify({ type: 'connected', data: currentProgress }));
  };

  socket.onmessage = (event) => {
    handleMessage(socket, jobId, event.data);
  };

  socket.onclose = () => {
    cleanupConnection(socket, jobId);
  };

  socket.onerror = (error) => {
    console.error(`[job-progress] WebSocket error for job ${jobId}:`, error);
    cleanupConnection(socket, jobId);
  };

  return response;
});
