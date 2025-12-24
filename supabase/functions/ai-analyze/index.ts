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

// Category-specific playbooks like a real CTF player
const PLAYBOOKS: Record<string, string> = {
  rev: `REVERSE ENGINEERING PLAYBOOK:
1. INITIAL RECON: file, strings -n 8, checksec
2. STATIC ANALYSIS: objdump -d, readelf -a, nm -a
3. DYNAMIC ANALYSIS: ltrace, strace, gdb
4. COMMON PATTERNS:
   - XOR encryption: look for loops with XOR operations
   - Hardcoded passwords: search strings for comparison logic
   - Anti-debug: check for ptrace calls
   - Obfuscation: look for decryption routines
5. DECOMPILATION: Use Ghidra/IDA patterns in analysis
6. WRITE SOLVE SCRIPT: Create Python script to automate extraction`,

  pwn: `BINARY EXPLOITATION PLAYBOOK:
1. SECURITY CHECK: checksec (NX, PIE, RELRO, Canary, ASLR)
2. VULNERABILITY SCAN:
   - Buffer overflow: look for gets(), strcpy(), scanf without bounds
   - Format string: printf(user_input)
   - Use-after-free: malloc/free patterns
3. FIND OFFSET: pattern create/search or cyclic
4. EXPLOIT TECHNIQUES:
   - ret2win: find win() or flag() function
   - ret2libc: leak libc, find system/bin/sh
   - ROP: build chain with gadgets
   - Format string: write-what-where
5. WRITE EXPLOIT: Create pwntools script`,

  crypto: `CRYPTOGRAPHY PLAYBOOK:
1. IDENTIFY CIPHER: Look for patterns, key sizes, IV usage
2. COMMON ATTACKS:
   - XOR: frequency analysis, known plaintext
   - RSA: small e, common modulus, Wiener's attack, factorize n
   - AES: ECB mode patterns, padding oracle
   - Base64/Hex: decode and analyze
3. MATHEMATICAL ANALYSIS: factorization, discrete log
4. IMPLEMENTATION FLAWS: weak RNG, reused nonces
5. WRITE SOLVER: Create Python script with pycryptodome`,

  forensics: `FORENSICS PLAYBOOK:
1. FILE ANALYSIS: file, exiftool, binwalk
2. STEGANOGRAPHY:
   - Images: steghide, zsteg, stegsolve, exiftool
   - Audio: spectogram analysis
   - LSB extraction
3. MEMORY/DISK: volatility, foremost, strings
4. NETWORK: wireshark filters, protocol analysis
5. HIDDEN DATA: alternate data streams, file carving
6. WRITE EXTRACTOR: Python script for data extraction`,

  web: `WEB EXPLOITATION PLAYBOOK:
1. RECONNAISSANCE: dirb, nikto, robots.txt, .git
2. INJECTION:
   - SQLi: ' OR 1=1--, UNION SELECT
   - XSS: <script>alert(1)</script>
   - SSTI: {{7*7}}, \${7*7}
   - Command injection: ; ls, | cat /etc/passwd
3. AUTH BYPASS: JWT manipulation, session fixation
4. LFI/RFI: ../../etc/passwd, php://filter
5. WRITE EXPLOIT: Python requests script`,

  misc: `MISCELLANEOUS PLAYBOOK:
1. FILE ANALYSIS: file, xxd, hexdump
2. ENCODING: base64, hex, rot13, morse
3. PATTERNS: regex for flags, hidden data
4. PROGRAMMING: solve puzzles, automation
5. OSINT: metadata, hidden clues
6. WRITE SOLVER: Python script for decoding`
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

    // Enhanced system prompt to generate solve scripts
    const systemPrompt = `You are an expert CTF (Capture The Flag) player with years of experience. You solve challenges like a human expert would - methodically, intelligently, and creatively.

YOUR ROLE:
- Analyze the challenge and command outputs
- Identify the challenge category and vulnerability/technique needed
- Propose the next logical steps following proven CTF methodology
- Extract any flags found in the output
- When you have enough information, WRITE A SOLVE SCRIPT that will extract the flag

CURRENT PLAYBOOK FOR ${current_category.toUpperCase()}:
${playbook}

SCRIPT GENERATION:
When you have gathered enough information to solve the challenge:
1. Write a complete Python script that solves the challenge
2. The script should:
   - Read the challenge files if needed
   - Implement the solution logic (decryption, decoding, exploitation)
   - Print the flag in the format: print(f"FLAG: {flag}")
3. Use only standard library + common CTF libs: pycryptodome, pwn, requests
4. Make the script self-contained and executable

RULES:
1. Think step-by-step like a real CTF player
2. Suggest 1-5 commands based on what's most promising
3. Available tools: file, strings, checksec, objdump, readelf, ltrace, strace, grep, binwalk, xxd, hexdump, base64, python3, r2, cat
4. If you see a flag matching the format, include it in flag_candidates
5. Provide multiple alternative approaches when stuck
6. Keep analysis concise but insightful
7. IMPORTANT: After 2-3 analysis attempts, you SHOULD write a solve_script
8. If early flags were found, analyze HOW they were found and validate them`;

    const userPrompt = `CHALLENGE: ${job_id}
FILES: ${Array.isArray(files) ? files.join(', ') : 'none'}
CATEGORY: ${current_category}
ATTEMPT: ${attempt_number}
FLAG FORMAT: ${flag_format}
DESCRIPTION: ${description}
${early_flags.length > 0 ? `\nEARLY FLAGS FOUND: ${early_flags.join(', ')}` : ''}
${request_script ? '\n⚠️ IMPORTANT: We need a solve script now! Write a complete Python script to solve this challenge.' : ''}

COMMAND HISTORY (${Array.isArray(command_history) ? command_history.length : 0} commands):
${(command_history as CommandOutput[]).slice(-15).map((c) => {
  const head = `$ ${c.tool} ${(c.args || []).join(' ')}`.trim();
  const out = (c.stdout || '').slice(0, 2000);
  const err = (c.stderr || '').slice(0, 500);
  return `${head}\n[stdout]\n${out}${out.length >= 2000 ? '\n...truncated...' : ''}${err ? `\n[stderr]\n${err}` : ''}`;
}).join('\n\n---\n\n')}

${attempt_number >= 3 || request_script ? `
Based on the analysis so far, write a Python solve script that will:
1. Read and process the challenge files
2. Apply the appropriate technique (decryption, decoding, etc.)
3. Extract and print the flag
` : 'Analyze this CTF challenge. What\'s the most likely solution path? What commands should we run next?'}`;

    const toolSpec = {
      type: 'function',
      function: {
        name: 'return_analysis',
        description: 'Return structured CTF analysis with next commands, strategy, and optionally a solve script',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            analysis: { 
              type: 'string',
              description: 'Detailed analysis of the challenge and current progress'
            },
            category: { 
              type: 'string',
              description: 'Detected category: rev, pwn, crypto, forensics, web, misc'
            },
            confidence: { 
              type: 'number',
              description: 'Confidence in the analysis (0-1)'
            },
            strategy: {
              type: 'string',
              description: 'Current solving strategy being used'
            },
            findings: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Key findings from the analysis'
            },
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
              description: 'Next commands to execute'
            },
            flag_candidates: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Any flags found matching the expected format'
            },
            should_continue: { 
              type: 'boolean',
              description: 'Whether to continue analysis or stop'
            },
            alternative_approaches: {
              type: 'array',
              items: { type: 'string' },
              description: 'Alternative solving approaches if current one fails'
            },
            solve_script: {
              type: 'object',
              additionalProperties: false,
              properties: {
                language: { type: 'string', enum: ['python', 'bash'] },
                code: { type: 'string', description: 'Complete executable script code' },
                description: { type: 'string', description: 'What the script does' },
                expected_output: { type: 'string', description: 'Expected output format' },
              },
              required: ['language', 'code', 'description', 'expected_output'],
              description: 'A solve script to run in sandbox (provide when you have enough info to solve)'
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
        return new Response(JSON.stringify({ error: 'Rate limits exceeded, please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (gatewayResp.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required, please add funds to your Lovable AI workspace.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'AI gateway error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const dataText = await gatewayResp.text();
    const data = safeJson<any>(dataText);

    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr = toolCall?.function?.arguments;
    const parsed = typeof argsStr === 'string' ? safeJson<AIAnalysisResponse>(argsStr) : null;

    if (!parsed) {
      console.error('[ai-analyze] Missing/invalid tool output:', dataText.slice(0, 800));
      return new Response(JSON.stringify({ error: 'AI output parsing failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const response: AIAnalysisResponse = {
      ...parsed,
      rule_based: false,
      playbook: playbook,
    };

    console.log(`[ai-analyze] Success - Found ${parsed.flag_candidates?.length || 0} flags, ${parsed.next_commands?.length || 0} commands, Script: ${parsed.solve_script ? 'yes' : 'no'}`);

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
