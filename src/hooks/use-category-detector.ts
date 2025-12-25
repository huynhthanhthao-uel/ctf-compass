import { useState, useCallback } from 'react';
import JSZip from 'jszip';

interface CategoryScore {
  category: string;
  score: number;
  keywords: string[];
}

interface DetectionResult {
  category: string;
  confidence: number;
  detectedKeywords: string[];
  allScores: CategoryScore[];
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
      'lcg', 'prng', 'random', 'seed', 'coppersmith', 'wiener', 'hastad', 'bleichenbacher',
      'n =', 'e =', 'c =', 'p =', 'q =', 'd =', 'phi'
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
      'hook', '__malloc_hook', '__free_hook', 'environ', 'race', 'condition',
      'nc ', 'netcat', 'connect', 'socket'
    ],
    extensions: ['.elf', '.so', '.out', '.bin'],
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
    extensions: ['.exe', '.dll', '.sys', '.elf', '.so', '.dylib', '.apk', '.dex'],
    weight: 1.3
  },
  forensics: {
    keywords: [
      'forensic', 'memory', 'dump', 'disk', 'partition', 'file', 'system',
      'ntfs', 'fat', 'ext4', 'mft', 'registry', 'prefetch', 'event', 'log', 'timeline',
      'volatility', 'autopsy', 'sleuth', 'foremost', 'scalpel', 'binwalk', 'carve',
      'recover', 'deleted', 'hidden', 'slack', 'unallocated', 'artifact', 'evidence',
      'pcap', 'packet', 'network', 'wireshark', 'tshark', 'tcpdump', 'flow', 'stream',
      'exif', 'metadata', 'steganography', 'stego', 'lsb', 'dct', 'embed', 'extract',
      'zsteg', 'steghide', 'stegsolve', 'outguess', 'openstego', 'invisible',
      'browser', 'history', 'cookie', 'cache', 'sqlite', 'chrome', 'firefox', 'edge',
      'comment', 'hidden in', 'plain sight'
    ],
    extensions: ['.pcap', '.pcapng', '.raw', '.mem', '.dmp', '.img', '.dd', '.vmem', 
                 '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.wav', '.mp3', '.pdf'],
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
      'eval', 'exec', 'import', 'module', 'builtins', 'globals', 'locals'
    ],
    extensions: ['.txt', '.md', '.py', '.js', '.sh'],
    weight: 0.8
  }
};

function analyzeContent(text: string, fileNames: string[]): DetectionResult {
  const lowerText = text.toLowerCase();
  const scores: CategoryScore[] = [];
  
  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    let score = 0;
    const foundKeywords: string[] = [];
    
    // Check keywords
    for (const keyword of patterns.keywords) {
      try {
        const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'gi');
        const matches = lowerText.match(regex);
        if (matches) {
          score += matches.length * patterns.weight;
          if (!foundKeywords.includes(keyword)) {
            foundKeywords.push(keyword);
          }
        }
      } catch {
        // Skip invalid regex
      }
    }
    
    // Check file extensions
    for (const fileName of fileNames) {
      const lowerFileName = fileName.toLowerCase();
      for (const ext of patterns.extensions) {
        if (lowerFileName.endsWith(ext)) {
          score += 5 * patterns.weight;
          if (!foundKeywords.includes(`file:${ext}`)) {
            foundKeywords.push(`file:${ext}`);
          }
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
      score: Math.round(score * 100) / 100,
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
    detectedKeywords: topScore.keywords,
    allScores: scores
  };
}

export function useCategoryDetector() {
  const [isDetecting, setIsDetecting] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);

  const detectFromFiles = useCallback(async (files: File[], description?: string): Promise<DetectionResult | null> => {
    if (files.length === 0) return null;
    
    setIsDetecting(true);
    
    try {
      const fileNames: string[] = [];
      let textContent = description || '';
      
      for (const file of files) {
        fileNames.push(file.name);
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        
        // Extract content from ZIP files
        if (ext === 'zip') {
          try {
            const zip = new JSZip();
            const contents = await zip.loadAsync(file);
            
            for (const [path, zipEntry] of Object.entries(contents.files)) {
              if (!zipEntry.dir) {
                fileNames.push(path);
                
                // Read text content from text files inside ZIP
                const fileExt = path.split('.').pop()?.toLowerCase() || '';
                const textExtensions = ['txt', 'py', 'js', 'c', 'cpp', 'h', 'java', 'md', 'json', 'xml', 'html', 'php', 'sh', 'pem', 'key'];
                
                if (textExtensions.includes(fileExt)) {
                  try {
                    const content = await zipEntry.async('string');
                    // Limit content size to prevent memory issues
                    textContent += '\n' + content.slice(0, 10000);
                  } catch {
                    // Binary file, skip content reading
                  }
                }
              }
            }
          } catch (err) {
            console.error('Error reading ZIP:', err);
          }
        }
        
        // Read text files directly
        const textExtensions = ['txt', 'py', 'js', 'c', 'cpp', 'h', 'java', 'md', 'json', 'xml', 'html', 'php', 'sh', 'pem', 'key'];
        if (textExtensions.includes(ext)) {
          try {
            const content = await file.text();
            textContent += '\n' + content.slice(0, 10000);
          } catch {
            // Skip if can't read
          }
        }
      }
      
      const detectionResult = analyzeContent(textContent, fileNames);
      setResult(detectionResult);
      return detectionResult;
    } catch (err) {
      console.error('Error detecting category:', err);
      return null;
    } finally {
      setIsDetecting(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
  }, []);

  return {
    detectFromFiles,
    isDetecting,
    result,
    reset
  };
}
