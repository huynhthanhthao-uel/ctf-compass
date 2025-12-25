import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CategoryScore {
  category: string;
  score: number;
  keywords: string[];
}

interface DetectCategoryResponse {
  category: string;
  confidence: number;
  detected_keywords: string[];
  all_scores: CategoryScore[];
}

// Comprehensive keyword patterns for each category
const CATEGORY_PATTERNS: Record<string, { keywords: string[]; extensions: string[]; weight: number }> = {
  crypto: {
    keywords: [
      'rsa', 'aes', 'des', 'cipher', 'encrypt', 'decrypt', 'key', 'modulus', 'exponent',
      'prime', 'factor', 'xor', 'base64', 'base32', 'hex', 'hash', 'md5', 'sha', 'hmac',
      'caesar', 'vigenere', 'substitution', 'transposition', 'diffie', 'hellman', 'ecc',
      'elliptic', 'curve', 'public', 'private', 'signature', 'verify', 'padding', 'pkcs',
      'openssl', 'pem', 'der', 'asn1', 'iv', 'nonce', 'salt', 'pbkdf', 'scrypt', 'bcrypt',
      'rot13', 'rot47', 'atbash', 'affine', 'railfence', 'playfair', 'one-time-pad', 'otp',
      'lcg', 'prng', 'random', 'seed', 'coppersmith', 'wiener', 'hastad', 'bleichenbacher'
    ],
    extensions: ['.pem', '.key', '.crt', '.pub', '.enc', '.asc'],
    weight: 1.5
  },
  pwn: {
    keywords: [
      'buffer', 'overflow', 'stack', 'heap', 'rop', 'ret2', 'gadget', 'shellcode',
      'exploit', 'payload', 'canary', 'aslr', 'pie', 'nx', 'dep', 'relro', 'got',
      'plt', 'libc', 'system', 'execve', 'mprotect', 'mmap', 'format', 'string',
      'printf', 'scanf', 'gets', 'strcpy', 'sprintf', 'fsb', 'fmtstr', 'pwntools',
      'gdb', 'peda', 'gef', 'pwndbg', 'checksec', 'one_gadget', 'rop_chain',
      'sigreturn', 'srop', 'bof', 'use-after-free', 'uaf', 'double-free', 'tcache',
      'fastbin', 'unsorted', 'largebin', 'smallbin', 'house_of', 'malloc', 'free',
      'hook', '__malloc_hook', '__free_hook', 'environ', 'race', 'condition'
    ],
    extensions: ['.elf', '.so', '.out'],
    weight: 1.4
  },
  rev: {
    keywords: [
      'reverse', 'binary', 'disassemble', 'decompile', 'assembly', 'asm', 'x86', 'x64',
      'arm', 'mips', 'ida', 'ghidra', 'radare', 'r2', 'objdump', 'strings', 'ltrace',
      'strace', 'gdb', 'breakpoint', 'register', 'instruction', 'opcode', 'function',
      'anti-debug', 'obfuscate', 'pack', 'unpack', 'upx', 'vmprotect', 'themida',
      'license', 'keygen', 'serial', 'crackme', 'patch', 'nop', 'jmp', 'call', 'ret',
      'mov', 'push', 'pop', 'xor', 'and', 'or', 'shl', 'shr', 'cmp', 'test', 'jz', 'jnz',
      'pe', 'elf', 'mach-o', 'section', 'segment', 'import', 'export', 'symbol', 'reloc',
      'angr', 'z3', 'symbolic', 'execution', 'constraint', 'solver', 'smt'
    ],
    extensions: ['.exe', '.dll', '.sys', '.bin', '.elf', '.so', '.dylib'],
    weight: 1.3
  },
  forensics: {
    keywords: [
      'forensic', 'memory', 'dump', 'image', 'disk', 'partition', 'file', 'system',
      'ntfs', 'fat', 'ext4', 'mft', 'registry', 'prefetch', 'event', 'log', 'timeline',
      'volatility', 'autopsy', 'sleuth', 'foremost', 'scalpel', 'binwalk', 'carve',
      'recover', 'deleted', 'hidden', 'slack', 'unallocated', 'artifact', 'evidence',
      'pcap', 'packet', 'network', 'wireshark', 'tshark', 'tcpdump', 'flow', 'stream',
      'exif', 'metadata', 'steganography', 'stego', 'lsb', 'dct', 'embed', 'extract',
      'zsteg', 'steghide', 'stegsolve', 'outguess', 'openstego', 'invisible',
      'png', 'jpg', 'jpeg', 'gif', 'bmp', 'wav', 'mp3', 'pdf', 'doc', 'zip', 'rar',
      'browser', 'history', 'cookie', 'cache', 'sqlite', 'chrome', 'firefox', 'edge'
    ],
    extensions: ['.pcap', '.pcapng', '.raw', '.mem', '.dmp', '.img', '.dd', '.E01', '.vmem'],
    weight: 1.2
  },
  web: {
    keywords: [
      'http', 'https', 'url', 'request', 'response', 'header', 'cookie', 'session',
      'xss', 'csrf', 'sqli', 'sql', 'injection', 'lfi', 'rfi', 'ssrf', 'xxe', 'ssti',
      'template', 'deserialization', 'pickle', 'yaml', 'json', 'xml', 'xpath',
      'jwt', 'token', 'oauth', 'saml', 'idor', 'authentication', 'authorization',
      'bypass', 'privilege', 'escalation', 'upload', 'download', 'traversal', 'path',
      'php', 'asp', 'jsp', 'cgi', 'perl', 'python', 'node', 'express', 'flask', 'django',
      'wordpress', 'joomla', 'drupal', 'nginx', 'apache', 'tomcat', 'iis',
      'burp', 'proxy', 'intercept', 'modify', 'replay', 'fuzz', 'scan', 'crawl',
      'robots', 'sitemap', 'git', 'svn', 'backup', 'config', 'env', 'secret', 'api'
    ],
    extensions: ['.html', '.php', '.asp', '.aspx', '.jsp', '.js', '.css'],
    weight: 1.1
  },
  misc: {
    keywords: [
      'osint', 'recon', 'search', 'google', 'dork', 'social', 'engineering',
      'encoding', 'decode', 'convert', 'esoteric', 'brainfuck', 'whitespace', 'malbolge',
      'qr', 'barcode', 'morse', 'braille', 'semaphore', 'flag', 'puzzle', 'riddle',
      'game', 'trivia', 'quiz', 'programming', 'algorithm', 'scripting', 'automation',
      'ppc', 'jail', 'escape', 'sandbox', 'restricted', 'shell', 'command', 'bash',
      'python', 'eval', 'exec', 'import', 'module', 'builtins', 'globals', 'locals'
    ],
    extensions: ['.txt', '.md', '.py', '.js', '.sh'],
    weight: 0.8
  }
};

function analyzeContent(text: string, fileNames: string[]): DetectCategoryResponse {
  const lowerText = text.toLowerCase();
  const scores: CategoryScore[] = [];
  
  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    let score = 0;
    const foundKeywords: string[] = [];
    
    // Check keywords
    for (const keyword of patterns.keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = lowerText.match(regex);
      if (matches) {
        score += matches.length * patterns.weight;
        if (!foundKeywords.includes(keyword)) {
          foundKeywords.push(keyword);
        }
      }
    }
    
    // Check file extensions
    for (const fileName of fileNames) {
      const lowerFileName = fileName.toLowerCase();
      for (const ext of patterns.extensions) {
        if (lowerFileName.endsWith(ext)) {
          score += 5 * patterns.weight;
          foundKeywords.push(`file:${ext}`);
        }
      }
    }
    
    // Bonus for multiple distinct keyword matches
    if (foundKeywords.length >= 3) {
      score *= 1.2;
    }
    if (foundKeywords.length >= 5) {
      score *= 1.3;
    }
    
    scores.push({
      category,
      score,
      keywords: foundKeywords.slice(0, 10)
    });
  }
  
  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);
  
  const topScore = scores[0];
  const secondScore = scores[1]?.score || 0;
  
  // Calculate confidence based on score difference
  let confidence = 0.5;
  if (topScore.score > 0) {
    const scoreDiff = topScore.score - secondScore;
    const relativeGap = scoreDiff / topScore.score;
    confidence = Math.min(0.95, 0.5 + relativeGap * 0.5 + Math.min(topScore.score / 50, 0.3));
  }
  
  return {
    category: topScore.score > 0 ? topScore.category : 'misc',
    confidence: Math.round(confidence * 100) / 100,
    detected_keywords: topScore.keywords,
    all_scores: scores.map(s => ({
      ...s,
      score: Math.round(s.score * 100) / 100
    }))
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const files: string[] = body?.files || [];
    const description: string = body?.description || '';
    const fileOutputs: Record<string, string> = body?.file_outputs || {};
    const stringsOutputs: Record<string, string> = body?.strings_outputs || {};

    // Combine all text content for analysis
    const combinedText = [
      description,
      files.join(' '),
      ...Object.values(fileOutputs),
      ...Object.values(stringsOutputs),
    ].join('\n');

    const result = analyzeContent(combinedText, files);

    console.log(`[detect-category] Detected: ${result.category} (${result.confidence}) - Keywords: ${result.detected_keywords.slice(0, 5).join(', ')}`);

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
