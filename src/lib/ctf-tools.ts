// CTF Tool suggestions and file type mappings

export interface ToolSuggestion {
  tool: string;
  args: string[];
  description: string;
  priority: number; // Higher = more relevant
}

// File extension to category mapping
const FILE_CATEGORIES: Record<string, string[]> = {
  binary: ['.elf', '.exe', '.bin', '.so', '.dll', '.out', '.o'],
  image: ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.webp'],
  audio: ['.wav', '.mp3', '.flac', '.ogg', '.m4a'],
  video: ['.mp4', '.avi', '.mkv', '.mov'],
  archive: ['.zip', '.tar', '.gz', '.7z', '.rar', '.bz2', '.xz'],
  network: ['.pcap', '.pcapng', '.cap'],
  document: ['.pdf', '.doc', '.docx', '.txt', '.md'],
  code: ['.py', '.c', '.cpp', '.java', '.js', '.php', '.rb', '.go'],
  crypto: ['.pem', '.key', '.crt', '.enc', '.aes', '.rsa'],
  memory: ['.mem', '.vmem', '.raw', '.img', '.dd'],
};

// Tool suggestions by file category
const CATEGORY_TOOLS: Record<string, ToolSuggestion[]> = {
  binary: [
    { tool: 'file', args: ['{file}'], description: 'Identify file type', priority: 100 },
    { tool: 'checksec', args: ['--file', '{file}'], description: 'Check security protections (ASLR, NX, PIE, Canary)', priority: 95 },
    { tool: 'strings', args: ['-n', '8', '{file}'], description: 'Extract printable strings', priority: 90 },
    { tool: 'readelf', args: ['-h', '{file}'], description: 'ELF header info', priority: 85 },
    { tool: 'readelf', args: ['-S', '{file}'], description: 'ELF sections', priority: 80 },
    { tool: 'readelf', args: ['-s', '{file}'], description: 'ELF symbols', priority: 75 },
    { tool: 'nm', args: ['-C', '{file}'], description: 'List symbols (demangled)', priority: 70 },
    { tool: 'objdump', args: ['-d', '-M', 'intel', '{file}'], description: 'Disassemble (Intel syntax)', priority: 65 },
    { tool: 'r2', args: ['-q', '-c', 'aaa;afl;pdf@main', '{file}'], description: 'Radare2 analysis + main function', priority: 60 },
    { tool: 'rabin2', args: ['-z', '{file}'], description: 'Extract strings with radare2', priority: 55 },
    { tool: 'ropper', args: ['--file', '{file}', '--search', 'pop rdi'], description: 'Find ROP gadgets', priority: 50 },
    { tool: 'retdec-decompiler', args: ['{file}'], description: 'Decompile to C code', priority: 45 },
    { tool: 'ltrace', args: ['{file}'], description: 'Trace library calls', priority: 40 },
    { tool: 'strace', args: ['{file}'], description: 'Trace system calls', priority: 35 },
  ],
  image: [
    { tool: 'file', args: ['{file}'], description: 'Identify image format', priority: 100 },
    { tool: 'exiftool', args: ['-a', '-u', '{file}'], description: 'Extract all metadata', priority: 95 },
    { tool: 'zsteg', args: ['-a', '{file}'], description: 'Check for LSB steganography (PNG/BMP)', priority: 90 },
    { tool: 'steghide', args: ['info', '{file}'], description: 'Check steghide data', priority: 85 },
    { tool: 'steghide', args: ['extract', '-sf', '{file}', '-p', ''], description: 'Extract with empty password', priority: 80 },
    { tool: 'stegseek', args: ['{file}'], description: 'Brute-force steghide password', priority: 75 },
    { tool: 'binwalk', args: ['-e', '{file}'], description: 'Extract embedded files', priority: 70 },
    { tool: 'strings', args: ['-n', '8', '{file}'], description: 'Find hidden strings', priority: 65 },
    { tool: 'pngcheck', args: ['-v', '{file}'], description: 'Validate PNG structure', priority: 60 },
    { tool: 'identify', args: ['-verbose', '{file}'], description: 'ImageMagick analysis', priority: 55 },
    { tool: 'xxd', args: ['-l', '100', '{file}'], description: 'Check file header', priority: 50 },
  ],
  audio: [
    { tool: 'file', args: ['{file}'], description: 'Identify audio format', priority: 100 },
    { tool: 'exiftool', args: ['{file}'], description: 'Extract metadata', priority: 95 },
    { tool: 'sox', args: ['{file}', '-n', 'spectrogram', '-o', 'spec.png'], description: 'Generate spectrogram', priority: 90 },
    { tool: 'ffprobe', args: ['-v', 'quiet', '-print_format', 'json', '-show_streams', '{file}'], description: 'Audio stream info', priority: 85 },
    { tool: 'strings', args: ['-n', '8', '{file}'], description: 'Find hidden strings', priority: 80 },
    { tool: 'xxd', args: ['{file}'], description: 'Hex dump for analysis', priority: 75 },
  ],
  archive: [
    { tool: 'file', args: ['{file}'], description: 'Identify archive type', priority: 100 },
    { tool: 'unzip', args: ['-l', '{file}'], description: 'List ZIP contents', priority: 95 },
    { tool: 'zipinfo', args: ['{file}'], description: 'Detailed ZIP info', priority: 90 },
    { tool: '7z', args: ['l', '{file}'], description: 'List 7z/RAR contents', priority: 85 },
    { tool: 'binwalk', args: ['-e', '{file}'], description: 'Extract all embedded files', priority: 80 },
    { tool: 'fcrackzip', args: ['-v', '-u', '-D', '-p', 'rockyou.txt', '{file}'], description: 'Crack ZIP password', priority: 75 },
    { tool: 'strings', args: ['{file}'], description: 'Find strings in archive', priority: 70 },
  ],
  network: [
    { tool: 'file', args: ['{file}'], description: 'Identify capture format', priority: 100 },
    { tool: 'tshark', args: ['-r', '{file}', '-q', '-z', 'io,stat,0'], description: 'Traffic statistics', priority: 95 },
    { tool: 'tshark', args: ['-r', '{file}', '-q', '-z', 'conv,tcp'], description: 'TCP conversations', priority: 90 },
    { tool: 'tshark', args: ['-r', '{file}', '-Y', 'http'], description: 'Filter HTTP traffic', priority: 85 },
    { tool: 'tshark', args: ['-r', '{file}', '-Y', 'dns'], description: 'Filter DNS queries', priority: 80 },
    { tool: 'tshark', args: ['-r', '{file}', '-Y', 'ftp'], description: 'Filter FTP traffic', priority: 75 },
    { tool: 'tshark', args: ['-r', '{file}', '--export-objects', 'http,http_out/'], description: 'Export HTTP objects', priority: 70 },
    { tool: 'tshark', args: ['-r', '{file}', '-q', '-z', 'follow,tcp,ascii,0'], description: 'Follow first TCP stream', priority: 65 },
    { tool: 'strings', args: ['-n', '10', '{file}'], description: 'Extract strings from capture', priority: 60 },
  ],
  document: [
    { tool: 'file', args: ['{file}'], description: 'Identify document type', priority: 100 },
    { tool: 'pdfinfo', args: ['{file}'], description: 'PDF metadata', priority: 95 },
    { tool: 'pdftotext', args: ['{file}', '-'], description: 'Extract PDF text', priority: 90 },
    { tool: 'pdfimages', args: ['-all', '{file}', 'img_'], description: 'Extract PDF images', priority: 85 },
    { tool: 'exiftool', args: ['-a', '-u', '{file}'], description: 'All metadata', priority: 80 },
    { tool: 'strings', args: ['{file}'], description: 'Hidden strings', priority: 75 },
    { tool: 'binwalk', args: ['-e', '{file}'], description: 'Extract embedded files', priority: 70 },
    { tool: 'grep', args: ['-a', 'flag', '{file}'], description: 'Search for flag keyword', priority: 65 },
  ],
  crypto: [
    { tool: 'file', args: ['{file}'], description: 'Identify file type', priority: 100 },
    { tool: 'xxd', args: ['{file}'], description: 'Hex dump', priority: 95 },
    { tool: 'base64', args: ['-d', '{file}'], description: 'Base64 decode', priority: 90 },
    { tool: 'openssl', args: ['asn1parse', '-in', '{file}'], description: 'Parse ASN.1 structure', priority: 85 },
    { tool: 'openssl', args: ['rsa', '-in', '{file}', '-text', '-noout'], description: 'RSA key info', priority: 80 },
    { tool: 'name-that-hash', args: ['-f', '{file}'], description: 'Identify hash type', priority: 75 },
    { tool: 'john', args: ['{file}'], description: 'Crack with John', priority: 70 },
    { tool: 'strings', args: ['{file}'], description: 'Find readable content', priority: 65 },
  ],
  memory: [
    { tool: 'file', args: ['{file}'], description: 'Identify memory dump', priority: 100 },
    { tool: 'volatility', args: ['-f', '{file}', 'imageinfo'], description: 'Identify OS profile', priority: 95 },
    { tool: 'volatility', args: ['-f', '{file}', 'pslist'], description: 'List processes', priority: 90 },
    { tool: 'volatility', args: ['-f', '{file}', 'cmdline'], description: 'Process command lines', priority: 85 },
    { tool: 'volatility', args: ['-f', '{file}', 'filescan'], description: 'Scan for files', priority: 80 },
    { tool: 'volatility', args: ['-f', '{file}', 'netscan'], description: 'Network connections', priority: 75 },
    { tool: 'volatility', args: ['-f', '{file}', 'hashdump'], description: 'Dump password hashes', priority: 70 },
    { tool: 'strings', args: ['-n', '10', '{file}'], description: 'Extract strings', priority: 65 },
  ],
  code: [
    { tool: 'file', args: ['{file}'], description: 'Identify file type', priority: 100 },
    { tool: 'cat', args: ['{file}'], description: 'View source code', priority: 95 },
    { tool: 'grep', args: ['-i', 'flag', '{file}'], description: 'Search for flag', priority: 90 },
    { tool: 'grep', args: ['-i', 'password', '{file}'], description: 'Search for passwords', priority: 85 },
    { tool: 'grep', args: ['-oE', '[A-Za-z0-9+/]{20,}={0,2}', '{file}'], description: 'Find base64 strings', priority: 80 },
    { tool: 'grep', args: ['-E', '(eval|exec|system)', '{file}'], description: 'Find dangerous functions', priority: 75 },
  ],
  unknown: [
    { tool: 'file', args: ['{file}'], description: 'Identify file type', priority: 100 },
    { tool: 'xxd', args: ['-l', '256', '{file}'], description: 'Hex dump header', priority: 95 },
    { tool: 'strings', args: ['-n', '8', '{file}'], description: 'Extract strings', priority: 90 },
    { tool: 'binwalk', args: ['{file}'], description: 'Scan for embedded files', priority: 85 },
    { tool: 'exiftool', args: ['{file}'], description: 'Check metadata', priority: 80 },
    { tool: 'sha256sum', args: ['{file}'], description: 'File hash', priority: 75 },
  ],
};

// Get file category from extension
export function getFileCategory(filename: string): string {
  const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0] || '';
  
  for (const [category, extensions] of Object.entries(FILE_CATEGORIES)) {
    if (extensions.includes(ext)) {
      return category;
    }
  }
  
  return 'unknown';
}

// Get tool suggestions for a file
export function getToolSuggestions(filename: string): ToolSuggestion[] {
  const category = getFileCategory(filename);
  const tools = CATEGORY_TOOLS[category] || CATEGORY_TOOLS.unknown;
  
  return tools.map(t => ({
    ...t,
    args: t.args.map(arg => arg === '{file}' ? filename : arg),
  }));
}

// Get suggestions for multiple files
export function getMultiFileSuggestions(files: string[]): ToolSuggestion[] {
  if (files.length === 0) return CATEGORY_TOOLS.unknown;
  
  // Get category counts
  const categoryCounts: Record<string, number> = {};
  files.forEach(f => {
    const cat = getFileCategory(f);
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });
  
  // Get dominant category
  const dominantCategory = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])[0][0];
  
  // Get tools for dominant category
  const tools = CATEGORY_TOOLS[dominantCategory] || CATEGORY_TOOLS.unknown;
  
  // Replace {file} with first file of that category
  const categoryFiles = files.filter(f => getFileCategory(f) === dominantCategory);
  const targetFile = categoryFiles[0] || files[0];
  
  return tools.map(t => ({
    ...t,
    args: t.args.map(arg => arg === '{file}' ? targetFile : arg),
  }));
}

// Build autocomplete command from partial input
export function getAutocomplete(
  input: string,
  files: string[],
  history: string[]
): string[] {
  const suggestions: string[] = [];
  const inputLower = input.toLowerCase();
  
  // If empty, suggest from file-based tools
  if (!input.trim()) {
    const fileSuggestions = getMultiFileSuggestions(files);
    return fileSuggestions.slice(0, 5).map(s => `${s.tool} ${s.args.join(' ')}`);
  }
  
  // Check history first
  const historyMatches = history.filter(h => 
    h.toLowerCase().startsWith(inputLower) && h !== input
  );
  suggestions.push(...historyMatches.slice(0, 3));
  
  // Check tools
  const allTools = Object.values(CATEGORY_TOOLS).flat();
  const uniqueTools = [...new Set(allTools.map(t => t.tool))];
  
  const toolMatches = uniqueTools.filter(t => 
    t.toLowerCase().startsWith(inputLower)
  );
  
  // If tool matches, suggest with file
  if (toolMatches.length > 0 && files.length > 0) {
    toolMatches.forEach(tool => {
      const toolSuggestion = allTools.find(t => t.tool === tool);
      if (toolSuggestion) {
        const cmd = `${tool} ${toolSuggestion.args.map(a => 
          a === '{file}' ? files[0] : a
        ).join(' ')}`;
        if (!suggestions.includes(cmd)) {
          suggestions.push(cmd);
        }
      }
    });
  }
  
  return suggestions.slice(0, 8);
}

// Common flag patterns for detection
export const FLAG_PATTERNS = [
  /CTF\{[^}]+\}/gi,
  /FLAG\{[^}]+\}/gi,
  /flag\{[^}]+\}/gi,
  /HTB\{[^}]+\}/gi,
  /THM\{[^}]+\}/gi,
  /picoCTF\{[^}]+\}/gi,
  /DUCTF\{[^}]+\}/gi,
  /[A-Z]{2,10}\{[a-zA-Z0-9_-]+\}/g,
];

// Check if output contains potential flags
export function detectFlags(output: string): string[] {
  const flags: Set<string> = new Set();
  
  for (const pattern of FLAG_PATTERNS) {
    const matches = output.match(pattern);
    if (matches) {
      matches.forEach(m => flags.add(m));
    }
  }
  
  return Array.from(flags);
}
