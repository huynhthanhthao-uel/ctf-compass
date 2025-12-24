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

type AIAnalysisResponse = {
  analysis: string;
  category: string;
  confidence: number;
  findings: string[];
  next_commands: NextCommand[];
  flag_candidates: string[];
  should_continue: boolean;
  rule_based: boolean;
};

function safeJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

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
    } = body ?? {};

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const systemPrompt = `You are a CTF solving assistant. Your job is to propose the next terminal commands to run.

Rules:
- Prefer safe, non-destructive commands.
- Suggest at most 3 commands.
- Commands must be from typical CTF CLI tools (file, strings, checksec, objdump, readelf, ltrace, strace, grep, binwalk, r2, python3).
- If you see a flag candidate matching the provided format, include it.
- If the current info is insufficient, propose reconnaissance commands first.
- Keep reasoning short.`;

    const userPrompt = `JOB: ${job_id}
FILES: ${Array.isArray(files) ? files.join(', ') : ''}
CATEGORY: ${current_category}
ATTEMPT: ${attempt_number}
EXPECTED FLAG FORMAT (regex-ish): ${flag_format}
DESCRIPTION: ${description}

RECENT COMMAND HISTORY (last ${Array.isArray(command_history) ? command_history.length : 0}):
${(command_history as CommandOutput[]).slice(-10).map((c) => {
  const head = `$ ${c.tool} ${(c.args || []).join(' ')}`.trim();
  const out = (c.stdout || '').slice(0, 1200);
  const err = (c.stderr || '').slice(0, 400);
  return `${head}\n[stdout]\n${out}${out.length >= 1200 ? '\n...truncated...' : ''}\n[stderr]\n${err}${err.length >= 400 ? '\n...truncated...' : ''}`;
}).join('\n\n---\n\n')}`;

    const toolSpec = {
      type: 'function',
      function: {
        name: 'return_analysis',
        description: 'Return structured analysis and next commands for a CTF job.',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            analysis: { type: 'string' },
            category: { type: 'string' },
            confidence: { type: 'number' },
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
          },
          required: ['analysis', 'category', 'confidence', 'findings', 'next_commands', 'flag_candidates', 'should_continue'],
        },
      },
    };

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
    };

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
