import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-backend-url',
};

// Backend API URL - can be overridden by x-backend-url header
const ENV_BACKEND_URL = Deno.env.get('CTF_BACKEND_URL') || '';

// Get backend URL from header or fallback to env
function getBackendUrl(req: Request): string {
  const headerUrl = req.headers.get('x-backend-url');
  return headerUrl || ENV_BACKEND_URL;
}

// Allowed tools for security (whitelist)
const ALLOWED_TOOLS = [
  // File analysis
  'file', 'strings', 'cat', 'head', 'tail', 'xxd', 'hexdump', 'readelf', 'objdump', 'nm',
  // Binary analysis
  'checksec', 'binwalk', 'foremost',
  // Crypto
  'base64', 'base32', 'openssl',
  // Stego
  'exiftool', 'zsteg', 'steghide', 'pngcheck',
  // Network
  'tshark', 'tcpdump',
  // Text processing
  'grep', 'awk', 'sed', 'sort', 'uniq', 'wc', 'tr',
  // Python
  'python3', 'python',
  // General
  'ls', 'pwd', 'echo', 'find',
];

// Validate tool is allowed
function isToolAllowed(tool: string): boolean {
  return ALLOWED_TOOLS.includes(tool.toLowerCase());
}

// Call real Docker backend API
async function executeOnBackend(
  backendUrl: string,
  jobId: string,
  tool: string,
  args: string[]
): Promise<{ stdout: string; stderr: string; exit_code: number; error?: string }> {
  const url = `${backendUrl}/api/jobs/${jobId}/terminal`;
  
  console.log(`[sandbox-terminal] Calling backend: ${url}`);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tool,
      arguments: args,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[sandbox-terminal] Backend error: ${response.status} - ${errorText}`);
    throw new Error(`Backend returned ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  console.log(`[sandbox-terminal] Backend result: exit_code=${result.exit_code}`);
  
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exit_code: result.exit_code ?? 0,
    error: result.error,
  };
}

// Execute Python script on backend
async function executePythonOnBackend(
  backendUrl: string,
  jobId: string,
  script: string,
  fileName?: string
): Promise<{ stdout: string; stderr: string; exit_code: number; error?: string }> {
  const url = `${backendUrl}/api/jobs/${jobId}/script`;
  
  console.log(`[sandbox-terminal] Executing Python script on backend: ${url}`);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      script,
      language: 'python',
      file_name: fileName,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[sandbox-terminal] Script execution error: ${response.status} - ${errorText}`);
    throw new Error(`Script execution failed: ${errorText}`);
  }

  const result = await response.json();
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exit_code: result.exit_code ?? 0,
    error: result.error,
  };
}

// Upload file to backend
async function uploadFileToBackend(
  backendUrl: string,
  jobId: string,
  fileName: string,
  content: string
): Promise<{ success: boolean; error?: string }> {
  const url = `${backendUrl}/api/jobs/${jobId}/files`;
  
  console.log(`[sandbox-terminal] Uploading file to backend: ${fileName}`);
  
  // Convert base64 content to blob
  const binaryContent = Uint8Array.from(atob(content), c => c.charCodeAt(0));
  const blob = new Blob([binaryContent]);
  
  const formData = new FormData();
  formData.append('file', blob, fileName);
  
  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[sandbox-terminal] File upload error: ${response.status} - ${errorText}`);
    return { success: false, error: errorText };
  }

  return { success: true };
}

// List files on backend
async function listFilesOnBackend(backendUrl: string, jobId: string): Promise<string[]> {
  const url = `${backendUrl}/api/jobs/${jobId}/files`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to list files: ${response.status}`);
  }

  const result = await response.json();
  return result.files || [];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      job_id: jobId,
      tool,
      args = [],
      script,
      action,
      file_name: fileName,
      file_content: fileContent,
    } = body;

    console.log(`[sandbox-terminal] Request: {
  job_id: "${jobId}",
  tool: "${tool}",
  args: ${JSON.stringify(args)},
  has_script: ${!!script},
  action: ${action},
  file_name: ${fileName}
}`);

    // Validate job_id
    if (!jobId || typeof jobId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'job_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get backend URL from header or env
    const backendUrl = getBackendUrl(req);
    
    // Check if backend is configured
    if (!backendUrl) {
      console.error('[sandbox-terminal] Backend URL not configured');
      return new Response(
        JSON.stringify({
          error: 'Backend not configured. Set backend URL in Configuration page or CTF_BACKEND_URL secret.',
          hint: 'Go to Settings → Docker Backend URL and enter your backend address',
          stdout: '',
          stderr: 'Backend API URL not configured',
          exit_code: 1,
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`[sandbox-terminal] Using backend URL: ${backendUrl}`);

    // Handle file upload action
    if (action === 'upload' && fileName && fileContent) {
      const result = await uploadFileToBackend(backendUrl, jobId, fileName, fileContent);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle list files action
    if (action === 'list_files') {
      const files = await listFilesOnBackend(backendUrl, jobId);
      return new Response(
        JSON.stringify({ files }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle Python script execution
    if (script) {
      const result = await executePythonOnBackend(backendUrl, jobId, script, fileName);
      console.log(`[sandbox-terminal] Script result: {
  stdout_length: ${result.stdout.length},
  stderr_length: ${result.stderr.length},
  exit_code: ${result.exit_code}
}`);
      
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate tool
    if (!tool || typeof tool !== 'string') {
      return new Response(
        JSON.stringify({ error: 'tool is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check tool is allowed
    if (!isToolAllowed(tool)) {
      return new Response(
        JSON.stringify({
          stdout: '',
          stderr: `Tool '${tool}' is not allowed in sandbox`,
          exit_code: 126,
          error: `Tool not allowed: ${tool}`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Execute command on real backend
    const result = await executeOnBackend(backendUrl, jobId, tool, args);

    console.log(`[sandbox-terminal] Result: {
  job_id: "${jobId}",
  tool: "${tool}",
  stdout_length: ${result.stdout.length},
  exit_code: ${result.exit_code}
}`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[sandbox-terminal] Error: ${errorMessage}`);
    
    // Check if it's a connection error to backend
    if (errorMessage.includes('fetch failed') || errorMessage.includes('connection refused')) {
      return new Response(
        JSON.stringify({
          error: 'Cannot connect to Docker backend. Ensure the backend is running.',
          hint: 'Run: cd ctf-autopilot/infra && docker compose up -d',
          stdout: '',
          stderr: 'Backend connection failed',
          exit_code: 1,
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({
        error: errorMessage,
        stdout: '',
        stderr: errorMessage,
        exit_code: 1,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
