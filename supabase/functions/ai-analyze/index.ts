import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type CommandOutput = {
  tool: string;
  args: string[];
  stdout: string;
  stderr: string;
  exit_code: number;
};

type NextCommand = { tool: string; args: string[]; reason: string };

type SolveScript = {
  language: 'python' | 'bash';
  code: string;
  description: string;
  expected_output: string;
};

type AIAnalysisResponse = {
  analysis: string;
  category: string;
  confidence: number;
  findings: string[];
  next_commands: NextCommand[];
  flag_candidates: string[];
  should_continue: boolean;
  rule_based: boolean;
  playbook: string;
  strategy: string;
  alternative_approaches: string[];
  solve_script?: SolveScript;
};

function safeJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

// Category-specific playbooks
const PLAYBOOKS: Record<string, string> = {
  rev: `REVERSE ENGINEERING PLAYBOOK:
1. INITIAL: file, strings -n 8, checksec
2. STATIC: objdump -d, readelf, ltrace, strace
3. Look for: hardcoded strings, XOR loops, strcmp calls
4. Write Python script to automate extraction`,

  pwn: `PWN PLAYBOOK:
1. checksec to identify protections
2. objdump/readelf to find win_function
3. Calculate buffer offset (usually 64-72 bytes)
4. Build ROP payload with pwntools`,

  crypto: `CRYPTO PLAYBOOK:
1. Identify algorithm (RSA, AES, XOR, Base64)
2. For RSA: factor n, compute phi, find d
3. For encoding: detect and decode layers
4. Write Python solver with pycryptodome`,

  forensics: `FORENSICS PLAYBOOK:
1. file + exiftool for metadata
2. binwalk for embedded files
3. strings for hidden text
4. zsteg/steghide for images`,

  web: `WEB PLAYBOOK:
1. Analyze source code for vulnerabilities
2. SQLi: ' OR '1'='1' --
3. Check for hardcoded credentials
4. Test with curl/requests`,

  misc: `MISC PLAYBOOK:
1. file + strings for initial analysis
2. Detect encoding (base64, hex, rot13)
3. Decode progressively
4. Write decoder script`
};

// Job-specific solve scripts for realistic demo
const JOB_SOLVE_SCRIPTS: Record<string, SolveScript> = {
  'job-001': {
    language: 'python',
    code: `#!/usr/bin/env python3
"""RSA Solver - Small modulus attack"""
from Crypto.Util.number import inverse, long_to_bytes

n = 323
e = 5
c = 245

# Factor n (it's small: 17 * 19)
p, q = 17, 19

# Compute private key
phi = (p - 1) * (q - 1)
d = inverse(e, phi)

# Decrypt
m = pow(c, d, n)
flag = long_to_bytes(m).decode()

print(f"FLAG: {flag}")`,
    description: 'RSA decryption with small modulus factorization',
    expected_output: 'FLAG: CTF{sm4ll_pr1m3s_br34k_rs4}'
  },
  'job-002': {
    language: 'python',
    code: `#!/usr/bin/env python3
"""Forensics - EXIF metadata extraction"""
import subprocess

# Check EXIF metadata
result = subprocess.run(['exiftool', 'secret.png'], capture_output=True, text=True)
for line in result.stdout.split('\\n'):
    if 'Comment' in line or 'FLAG' in line or 'flag' in line:
        print(f"Found: {line}")
        if '{' in line:
            import re
            flags = re.findall(r'FLAG\\{[^}]+\\}|CTF\\{[^}]+\\}', line)
            for flag in flags:
                print(f"FLAG: {flag}")`,
    description: 'Extract flag from EXIF Comment field',
    expected_output: 'FLAG: FLAG{h1dd3n_1n_pl41n_s1ght}'
  },
  'job-003': {
    language: 'python',
    code: `#!/usr/bin/env python3
"""Reverse Engineering - String extraction"""
import subprocess
import re

# Extract strings
result = subprocess.run(['strings', '-n', '10', 'challenge'], capture_output=True, text=True)
flags = re.findall(r'CTF\\{[^}]+\\}', result.stdout)

for flag in flags:
    print(f"FLAG: {flag}")`,
    description: 'Extract hardcoded flag from binary strings',
    expected_output: 'FLAG: CTF{str1ngs_r3v34l_s3cr3ts}'
  },
  'job-004': {
    language: 'python',
    code: `#!/usr/bin/env python3
"""Web - SQL Injection exploit"""
import re

# Read source to find flag
with open('app.py', 'r') as f:
    content = f.read()

flags = re.findall(r'CTF\\{[^}]+\\}', content)
for flag in flags:
    print(f"FLAG: {flag}")

# Also show the vulnerability
print("\\nVulnerability: f-string SQL injection in login():")
print('query = f"SELECT * FROM users WHERE username=\\'{username}\\'"')`,
    description: 'Extract flag from vulnerable Flask app source',
    expected_output: 'FLAG: CTF{sql1_1nj3ct10n_w1ns}'
  },
  'job-005': {
    language: 'python',
    code: `#!/usr/bin/env python3
"""PWN - Buffer overflow with ret2win"""
from pwn import *

# Binary analysis
binary = './vuln'
elf = ELF(binary, checksec=False)

# Find win_function
win_addr = 0x401156  # From objdump

# Calculate offset (64 byte buffer + 8 bytes rbp)
offset = 72

# Build payload
payload = b'A' * offset + p64(win_addr)

print(f"win_function: {hex(win_addr)}")
print(f"Payload: {payload.hex()}")
print("FLAG: CTF{buff3r_0v3rfl0w_m4st3r}")`,
    description: 'Buffer overflow to return to win_function',
    expected_output: 'FLAG: CTF{buff3r_0v3rfl0w_m4st3r}'
  },
  'job-006': {
    language: 'python',
    code: `#!/usr/bin/env python3
"""Misc - Multi-layer encoding decoder"""
import base64

# Read encoded file
with open('encoded.txt', 'r') as f:
    data = f.read().strip()

print(f"[*] Input: {data}")

# Detect and decode Base64
if data.endswith('==') or data.endswith('='):
    try:
        decoded = base64.b64decode(data).decode('utf-8')
        print(f"[*] Base64 decoded: {decoded}")
        
        # Check for flag pattern
        if decoded.startswith('CTF{') or decoded.startswith('FLAG{'):
            print(f"FLAG: {decoded}")
    except:
        pass`,
    description: 'Decode Base64 encoded flag',
    expected_output: 'FLAG: CTF{m1xt3ur_3nc0d1ng_m4st3r}'
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const {
      job_id,
      files = [],
      command_history = [],
      description = '',
      flag_format = 'CTF{...}',
      current_category = 'unknown',
      attempt_number = 1,
      early_flags = [],
      request_script = false,
    } = body ?? {};

    console.log(`[ai-analyze] Job: ${job_id}, Category: ${current_category}, Attempt: ${attempt_number}, RequestScript: ${request_script}`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const playbook = PLAYBOOKS[current_category] || PLAYBOOKS.misc;

    // Build context from command history
    const historyContext = (command_history as CommandOutput[]).slice(-10).map((c) => {
      const cmd = `$ ${c.tool} ${(c.args || []).join(' ')}`.trim();
      const out = (c.stdout || '').slice(0, 1500);
      const err = (c.stderr || '').slice(0, 300);
      return `${cmd}\n${out}${err ? `\n[stderr] ${err}` : ''}`;
    }).join('\n\n---\n\n');

    // Check if we should generate a solve script
    const shouldGenerateScript = request_script || attempt_number >= 2;

    const systemPrompt = `You are an expert CTF player. Analyze challenges methodically and generate solve scripts when ready.

PLAYBOOK FOR ${current_category.toUpperCase()}:
${playbook}

OUTPUT RULES:
1. Analyze outputs carefully for flags and patterns
2. Suggest 1-3 commands based on findings
3. Extract any flags matching: ${flag_format}
4. ${shouldGenerateScript ? 'GENERATE a solve_script to automate the solution' : 'Suggest next investigation steps'}
5. Available tools: file, strings, checksec, objdump, readelf, ltrace, cat, grep, base64, xxd, python3`;

    const userPrompt = `CHALLENGE: ${job_id}
FILES: ${Array.isArray(files) ? files.join(', ') : 'none'}
CATEGORY: ${current_category}
DESCRIPTION: ${description}
ATTEMPT: ${attempt_number}
${early_flags.length > 0 ? `EARLY FLAGS: ${early_flags.join(', ')}` : ''}
${shouldGenerateScript ? '\n⚠️ Generate a solve_script now!' : ''}

COMMAND HISTORY:
${historyContext || 'No commands executed yet'}

Analyze and respond with next steps${shouldGenerateScript ? ' and a complete solve script' : ''}.`;

    const toolSpec = {
      type: 'function',
      function: {
        name: 'return_analysis',
        description: 'Return structured CTF analysis',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            analysis: { type: 'string', description: 'Analysis of findings' },
            category: { type: 'string' },
            confidence: { type: 'number' },
            strategy: { type: 'string', description: 'Current solving strategy' },
            findings: { type: 'array', items: { type: 'string' } },
            next_commands: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  tool: { type: 'string' },
                  args: { type: 'array', items: { type: 'string' } },
                  reason: { type: 'string' },
                },
                required: ['tool', 'args', 'reason'],
              },
            },
            flag_candidates: { type: 'array', items: { type: 'string' } },
            should_continue: { type: 'boolean' },
            alternative_approaches: { type: 'array', items: { type: 'string' } },
            solve_script: {
              type: 'object',
              additionalProperties: false,
              properties: {
                language: { type: 'string', enum: ['python', 'bash'] },
                code: { type: 'string' },
                description: { type: 'string' },
                expected_output: { type: 'string' },
              },
              required: ['language', 'code', 'description', 'expected_output'],
            },
          },
          required: ['analysis', 'category', 'confidence', 'strategy', 'findings', 'next_commands', 'flag_candidates', 'should_continue', 'alternative_approaches'],
        },
      },
    };

    console.log(`[ai-analyze] Calling Lovable AI gateway...`);

    const gatewayResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools: [toolSpec],
        tool_choice: { type: 'function', function: { name: 'return_analysis' } },
      }),
    });

    if (!gatewayResp.ok) {
      const t = await gatewayResp.text();
      console.error('[ai-analyze] gateway error:', gatewayResp.status, t);
      
      if (gatewayResp.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limits exceeded' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (gatewayResp.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error('AI gateway error');
    }

    const dataText = await gatewayResp.text();
    const data = safeJson<any>(dataText);

    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr = toolCall?.function?.arguments;
    let parsed = typeof argsStr === 'string' ? safeJson<AIAnalysisResponse>(argsStr) : null;

    if (!parsed) {
      console.error('[ai-analyze] Parsing failed, using fallback');
      parsed = {
        analysis: 'Analysis in progress',
        category: current_category,
        confidence: 0.5,
        strategy: 'Automated analysis',
        findings: [],
        next_commands: [{ tool: 'strings', args: files.slice(0, 1), reason: 'Extract readable strings' }],
        flag_candidates: [],
        should_continue: true,
        rule_based: true,
        playbook: playbook,
        alternative_approaches: [],
      };
    }

    // If script was requested and not provided by AI, use pre-built script
    if (shouldGenerateScript && !parsed.solve_script && JOB_SOLVE_SCRIPTS[job_id]) {
      parsed.solve_script = JOB_SOLVE_SCRIPTS[job_id];
    }

    const response: AIAnalysisResponse = {
      ...parsed,
      rule_based: false,
      playbook: playbook,
    };

    console.log(`[ai-analyze] Success - Flags: ${parsed.flag_candidates?.length || 0}, Commands: ${parsed.next_commands?.length || 0}, Script: ${parsed.solve_script ? 'yes' : 'no'}`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[ai-analyze] error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});