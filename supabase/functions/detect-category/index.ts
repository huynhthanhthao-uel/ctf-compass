import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type DetectCategoryResponse = { category: string; confidence: number };

function detectFromText(t: string): DetectCategoryResponse {
  const text = (t || '').toLowerCase();
  const has = (s: string) => text.includes(s);

  if (has('pcap') || has('wireshark') || has('forensic') || has('stego') || has('exif') || has('jpeg') || has('png') || has('zip')) {
    return { category: 'forensics', confidence: 0.7 };
  }
  if (has('rsa') || has('aes') || has('cipher') || has('crypt') || has('base64') || has('hex')) {
    return { category: 'crypto', confidence: 0.7 };
  }
  if (has('buffer') || has('overflow') || has('rop') || has('canary') || has('pwntools') || has('format string')) {
    return { category: 'pwn', confidence: 0.7 };
  }
  if (has('http') || has('xss') || has('sqli') || has('sql') || has('csrf') || has('cookie') || has('jwt')) {
    return { category: 'web', confidence: 0.7 };
  }
  if (has('elf') || has('disasm') || has('objdump') || has('ghidra') || has('ida') || has('reverse') || has('binary')) {
    return { category: 'rev', confidence: 0.65 };
  }
  return { category: 'misc', confidence: 0.4 };
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
    const files: string[] = body?.files || [];
    const fileOutputs: Record<string, string> = body?.file_outputs || {};
    const stringsOutputs: Record<string, string> = body?.strings_outputs || {};

    const combined = [
      files.join(' '),
      ...Object.values(fileOutputs),
      ...Object.values(stringsOutputs),
    ].join('\n');

    const result = detectFromText(combined);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[detect-category] error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
