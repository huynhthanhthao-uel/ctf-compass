// Mock data for development/demo purposes
import { Job, JobDetail, Command, Artifact, FlagCandidate, Config } from './types';

export const mockJobs: Job[] = [
  {
    id: 'job-001',
    title: 'Crypto Challenge - RSA Basics',
    description: 'A basic RSA encryption challenge with weak parameters. The modulus n can be factored easily.',
    flagFormat: 'CTF{[a-zA-Z0-9_]+}',
    category: 'crypto',
    status: 'done',
    createdAt: '2024-01-15T10:30:00Z',
    progress: 100,
  },
  {
    id: 'job-002',
    title: 'Forensics - Hidden in Image',
    description: 'Extract hidden data from a PNG image using steganography analysis. Check LSB, metadata, and embedded files.',
    flagFormat: 'FLAG{[a-zA-Z0-9]+}',
    category: 'forensics',
    status: 'done',
    createdAt: '2024-01-15T11:00:00Z',
    progress: 100,
  },
  {
    id: 'job-003',
    title: 'Reverse Engineering - Binary Analysis',
    description: 'Analyze a stripped ELF binary to find the flag. Check for hardcoded strings and password comparison.',
    flagFormat: 'CTF{.*}',
    category: 'rev',
    status: 'done',
    createdAt: '2024-01-15T11:15:00Z',
    progress: 100,
  },
  {
    id: 'job-004',
    title: 'Web - SQL Injection',
    description: 'Exploit a SQL injection vulnerability in a login form to extract the admin password and flag.',
    flagFormat: 'CTF{[a-zA-Z0-9_]+}',
    category: 'web',
    status: 'queued',
    createdAt: '2024-01-15T11:30:00Z',
    progress: 0,
  },
  {
    id: 'job-005',
    title: 'PWN - Buffer Overflow',
    description: 'Exploit a buffer overflow vulnerability in a 64-bit binary. Find the offset and craft a ROP chain.',
    flagFormat: 'CTF{[a-zA-Z0-9_]+}',
    category: 'pwn',
    status: 'queued',
    createdAt: '2024-01-15T12:00:00Z',
    progress: 0,
  },
  {
    id: 'job-006',
    title: 'Misc - Base64 Nested Encoding',
    description: 'Decode multiple layers of encoding (base64, hex, rot13) to reveal the flag.',
    flagFormat: 'CTF{[a-zA-Z0-9_]+}',
    category: 'misc',
    status: 'done',
    createdAt: '2024-01-15T12:30:00Z',
    completedAt: '2024-01-15T12:35:00Z',
    progress: 100,
  },
];

// Mock data for job-006 (Misc - Base64 Nested Encoding)
export const mockJob006Commands: Command[] = [
  {
    id: 'cmd-006-001',
    jobId: 'job-006',
    tool: 'file',
    args: ['encoded.txt'],
    exitCode: 0,
    stdout: 'encoded.txt: ASCII text',
    stderr: '',
    executedAt: new Date().toISOString(),
    duration: 0.05,
  },
  {
    id: 'cmd-006-002',
    jobId: 'job-006',
    tool: 'cat',
    args: ['encoded.txt'],
    exitCode: 0,
    stdout: 'VlRSQ1IxcFlWbXhqTTFKMlkwWkpNRnBYTlhkTlJGWnpXa2RHTUZsVE1ERT0=',
    stderr: '',
    executedAt: new Date().toISOString(),
    duration: 0.02,
  },
  {
    id: 'cmd-006-003',
    jobId: 'job-006',
    tool: 'base64',
    args: ['-d', 'encoded.txt'],
    exitCode: 0,
    stdout: 'VTRCRGtZVmxjM1J2YzZJMFpXNXdXa2RGbWtTMDE=',
    stderr: '',
    executedAt: new Date().toISOString(),
    duration: 0.03,
  },
  {
    id: 'cmd-006-004',
    jobId: 'job-006',
    tool: 'bash',
    args: ['-c', 'base64 -d encoded.txt | base64 -d'],
    exitCode: 0,
    stdout: 'U4BDkYVlc3RvcI0ZW5wWkdFmkS01',
    stderr: '',
    executedAt: new Date().toISOString(),
    duration: 0.04,
  },
  {
    id: 'cmd-006-005',
    jobId: 'job-006',
    tool: 'bash',
    args: ['-c', 'base64 -d encoded.txt | base64 -d | base64 -d'],
    exitCode: 0,
    stdout: 'CTF{n3st3d_3nc0d1ng_m4st3r}',
    stderr: '',
    executedAt: new Date().toISOString(),
    duration: 0.05,
  },
];

export const mockJob006Artifacts: Artifact[] = [
  {
    name: 'encoded.txt',
    path: '/data/runs/job-006/input/encoded.txt',
    size: 64,
    type: 'text/plain',
    createdAt: new Date().toISOString(),
  },
  {
    name: 'decoded_layer1.txt',
    path: '/data/runs/job-006/output/decoded_layer1.txt',
    size: 48,
    type: 'text/plain',
    createdAt: new Date().toISOString(),
  },
  {
    name: 'decoded_final.txt',
    path: '/data/runs/job-006/output/decoded_final.txt',
    size: 28,
    type: 'text/plain',
    createdAt: new Date().toISOString(),
  },
];

export const mockJob006Flags: FlagCandidate[] = [
  {
    id: 'flag-006-001',
    value: 'CTF{n3st3d_3nc0d1ng_m4st3r}',
    confidence: 0.99,
    source: 'base64 decode chain',
    commandId: 'cmd-006-005',
    context: '>>> CTF{n3st3d_3nc0d1ng_m4st3r} <<<',
  },
];

export const mockJob006Writeup = `# Misc - Base64 Nested Encoding Writeup

## Overview
This challenge involves decoding multiple layers of base64 encoding to reveal the hidden flag.

## Analysis Steps

### Step 1: Initial File Analysis
\`\`\`bash
$ file encoded.txt
encoded.txt: ASCII text

$ cat encoded.txt
VlRSQ1IxcFlWbXhqTTFKMlkwWkpNRnBYTlhkTlJGWnpXa2RHTUZsVE1ERT0=
\`\`\`

The file contains what appears to be base64-encoded data.

### Step 2: First Layer Decode
\`\`\`bash
$ base64 -d encoded.txt
VTRCRGtZVmxjM1J2YzZJMFpXNXdXa2RGbWtTMDE=
\`\`\`

Still base64 encoded - let's continue decoding.

### Step 3: Second Layer Decode
\`\`\`bash
$ base64 -d encoded.txt | base64 -d
U4BDkYVlc3RvcI0ZW5wWkdFmkS01
\`\`\`

### Step 4: Final Decode
\`\`\`bash
$ base64 -d encoded.txt | base64 -d | base64 -d
CTF{n3st3d_3nc0d1ng_m4st3r}
\`\`\`

**Evidence ID:** cmd-006-005

## Flag Candidates

| Candidate | Confidence | Source |
|-----------|------------|--------|
| \`CTF{n3st3d_3nc0d1ng_m4st3r}\` | 99% | base64 decode chain |

## Conclusion

The flag was hidden behind 3 layers of base64 encoding. Iterative decoding revealed the final flag.

**Flag:** \`CTF{n3st3d_3nc0d1ng_m4st3r}\`

---
*Generated by CTF Autopilot Analyzer*
`;

// Function to update job status globally
export function updateMockJobStatus(jobId: string, status: 'queued' | 'running' | 'done' | 'failed', progress?: number) {
  const idx = mockJobs.findIndex(j => j.id === jobId);
  if (idx !== -1) {
    mockJobs[idx] = { 
      ...mockJobs[idx], 
      status, 
      progress: progress ?? (status === 'done' ? 100 : mockJobs[idx].progress),
      completedAt: status === 'done' ? new Date().toISOString() : mockJobs[idx].completedAt
    };
  }
}

// Mock data for job-003 after analysis completes
export const mockJob003Commands: Command[] = [
  {
    id: 'cmd-003-001',
    jobId: 'job-003',
    tool: 'file',
    args: ['challenge'],
    exitCode: 0,
    stdout: 'challenge: ELF 64-bit LSB pie executable, x86-64, version 1 (SYSV), dynamically linked, interpreter /lib64/ld-linux-x86-64.so.2, stripped',
    stderr: '',
    executedAt: new Date().toISOString(),
    duration: 0.05,
  },
  {
    id: 'cmd-003-002',
    jobId: 'job-003',
    tool: 'checksec',
    args: ['--file=challenge'],
    exitCode: 0,
    stdout: `RELRO           STACK CANARY      NX            PIE             RPATH      RUNPATH
Full RELRO      Canary found      NX enabled    PIE enabled     No RPATH   No RUNPATH`,
    stderr: '',
    executedAt: new Date().toISOString(),
    duration: 0.12,
  },
  {
    id: 'cmd-003-003',
    jobId: 'job-003',
    tool: 'strings',
    args: ['-n', '10', 'challenge'],
    exitCode: 0,
    stdout: `/lib64/ld-linux-x86-64.so.2
libc.so.6
puts
printf
strcmp
Enter the password:
Checking password...
CTF{r3v3rs3_3ng1n33r1ng_b4s1cs}
Correct! Here's your flag
Wrong password, try again`,
    stderr: '',
    executedAt: new Date().toISOString(),
    duration: 0.08,
  },
  {
    id: 'cmd-003-004',
    jobId: 'job-003',
    tool: 'objdump',
    args: ['-d', '-M', 'intel', 'challenge'],
    exitCode: 0,
    stdout: `0000000000001169 <main>:
    1169: push   rbp
    116a: mov    rbp,rsp
    116d: sub    rsp,0x50
    1171: lea    rdi,[rip+0xe90]  # "Enter the password:"
    1178: call   1050 <puts@plt>
    ...
    11b5: lea    rsi,[rip+0xe64]  # "CTF{r3v3rs3_3ng1n33r1ng_b4s1cs}"
    11bc: call   1060 <strcmp@plt>`,
    stderr: '',
    executedAt: new Date().toISOString(),
    duration: 0.25,
  },
];

export const mockJob003Artifacts: Artifact[] = [
  {
    name: 'challenge',
    path: '/data/runs/job-003/input/challenge',
    size: 16384,
    type: 'application/x-executable',
    createdAt: new Date().toISOString(),
  },
  {
    name: 'disassembly.txt',
    path: '/data/runs/job-003/output/disassembly.txt',
    size: 45678,
    type: 'text/plain',
    createdAt: new Date().toISOString(),
  },
  {
    name: 'strings_output.txt',
    path: '/data/runs/job-003/output/strings_output.txt',
    size: 2048,
    type: 'text/plain',
    createdAt: new Date().toISOString(),
  },
];

export const mockJob003Flags: FlagCandidate[] = [
  {
    id: 'flag-003-001',
    value: 'CTF{r3v3rs3_3ng1n33r1ng_b4s1cs}',
    confidence: 0.98,
    source: 'strings output',
    commandId: 'cmd-003-003',
    context: '...Checking password...\n>>> CTF{r3v3rs3_3ng1n33r1ng_b4s1cs} <<<\nCorrect! Here\'s your flag...',
  },
  {
    id: 'flag-003-002',
    value: 'CTF{r3v3rs3_3ng1n33r1ng_b4s1cs}',
    confidence: 0.95,
    source: 'objdump disassembly',
    commandId: 'cmd-003-004',
    context: 'lea rsi,[rip+0xe64] # >>> CTF{r3v3rs3_3ng1n33r1ng_b4s1cs} <<<',
  },
];

export const mockJob003Writeup = `# Reverse Engineering - Binary Analysis Writeup

## Overview
This challenge provides a stripped ELF binary that requires password verification to reveal the flag.

## Reconnaissance

### File Analysis
\`\`\`bash
$ file challenge
challenge: ELF 64-bit LSB pie executable, x86-64, version 1 (SYSV), dynamically linked, stripped
\`\`\`

The binary is a 64-bit stripped ELF executable with PIE enabled.

### Security Analysis
\`\`\`bash
$ checksec --file=challenge
RELRO           STACK CANARY      NX            PIE
Full RELRO      Canary found      NX enabled    PIE enabled
\`\`\`

All protections are enabled, but for this challenge, we don't need exploitation.

## Analysis Steps

### Step 1: String Extraction
Using \`strings\` to find readable strings:

\`\`\`bash
$ strings -n 10 challenge
Enter the password:
Checking password...
CTF{r3v3rs3_3ng1n33r1ng_b4s1cs}
Correct! Here's your flag
\`\`\`

**Evidence ID:** cmd-003-003

The flag is directly visible in the binary strings!

### Step 2: Disassembly Confirmation
Confirmed with objdump that the flag is compared using strcmp:

\`\`\`asm
11b5: lea    rsi,[rip+0xe64]  # "CTF{r3v3rs3_3ng1n33r1ng_b4s1cs}"
11bc: call   1060 <strcmp@plt>
\`\`\`

**Evidence ID:** cmd-003-004

## Flag Candidates

| Candidate | Confidence | Source |
|-----------|------------|--------|
| \`CTF{r3v3rs3_3ng1n33r1ng_b4s1cs}\` | 98% | strings output |
| \`CTF{r3v3rs3_3ng1n33r1ng_b4s1cs}\` | 95% | objdump disassembly |

## Conclusion

The flag was embedded directly in the binary without any obfuscation. A simple strings analysis was sufficient to extract it.

**Flag:** \`CTF{r3v3rs3_3ng1n33r1ng_b4s1cs}\`

---
*Generated by CTF Autopilot Analyzer*
`;

export const mockCommands: Command[] = [
  {
    id: 'cmd-001',
    jobId: 'job-001',
    tool: 'file',
    args: ['challenge.py'],
    exitCode: 0,
    stdout: 'challenge.py: Python script, ASCII text executable',
    stderr: '',
    executedAt: '2024-01-15T10:30:10Z',
    duration: 0.05,
  },
  {
    id: 'cmd-002',
    jobId: 'job-001',
    tool: 'strings',
    args: ['-n', '8', 'output.bin'],
    exitCode: 0,
    stdout: 'BEGIN RSA PRIVATE KEY\nn = 0x...\ne = 65537\nCTF{w34k_pr1m3s_4r3_b4d}\nEND RSA PRIVATE KEY',
    stderr: '',
    executedAt: '2024-01-15T10:30:15Z',
    duration: 0.12,
  },
  {
    id: 'cmd-003',
    jobId: 'job-001',
    tool: 'xxd',
    args: ['-l', '64', 'output.bin'],
    exitCode: 0,
    stdout: '00000000: 4354 467b 7733 346b 5f70 7231 6d33 735f  CTF{w34k_pr1m3s_\n00000010: 3472 335f 6234 647d 0a00 0000 0000 0000  4r3_b4d}........',
    stderr: '',
    executedAt: '2024-01-15T10:30:20Z',
    duration: 0.08,
  },
];

export const mockArtifacts: Artifact[] = [
  {
    name: 'challenge.py',
    path: '/data/runs/job-001/input/challenge.py',
    size: 2048,
    type: 'text/x-python',
    createdAt: '2024-01-15T10:30:00Z',
  },
  {
    name: 'output.bin',
    path: '/data/runs/job-001/input/output.bin',
    size: 1024,
    type: 'application/octet-stream',
    createdAt: '2024-01-15T10:30:00Z',
  },
  {
    name: 'commands.log',
    path: '/data/runs/job-001/logs/commands.log',
    size: 4096,
    type: 'text/plain',
    createdAt: '2024-01-15T10:32:15Z',
  },
];

export const mockFlagCandidates: FlagCandidate[] = [
  {
    id: 'flag-001',
    value: 'CTF{w34k_pr1m3s_4r3_b4d}',
    confidence: 0.95,
    source: 'strings output',
    commandId: 'cmd-002',
    context: '...BEGIN RSA PRIVATE KEY\nn = 0x...\ne = 65537\n>>> CTF{w34k_pr1m3s_4r3_b4d} <<<\nEND RSA PRIVATE KEY...',
  },
  {
    id: 'flag-002',
    value: 'CTF{w34k_pr1m3s_4r3_b4d}',
    confidence: 0.92,
    source: 'xxd hex dump',
    commandId: 'cmd-003',
    context: '00000000: 4354 467b 7733 346b 5f70 7231 6d33 735f  >>> CTF{w34k_pr1m3s_ <<<',
  },
];

export const mockWriteup = `# RSA Basics - Challenge Writeup

## Overview
This challenge presents a basic RSA encryption scenario with intentionally weak parameters, making it vulnerable to factorization attacks.

## Reconnaissance

### File Analysis
\`\`\`bash
$ file challenge.py
challenge.py: Python script, ASCII text executable

$ file output.bin
output.bin: data
\`\`\`

The challenge provides a Python script and an encrypted binary output file.

## Analysis Steps

### Step 1: Extract Strings
Using the \`strings\` command on the binary output revealed readable content:

\`\`\`bash
$ strings -n 8 output.bin
BEGIN RSA PRIVATE KEY
n = 0x...
e = 65537
CTF{w34k_pr1m3s_4r3_b4d}
END RSA PRIVATE KEY
\`\`\`

**Evidence ID:** cmd-002

### Step 2: Hex Dump Verification
Confirmed the flag presence using xxd:

\`\`\`bash
$ xxd -l 64 output.bin
00000000: 4354 467b 7733 346b 5f70 7231 6d33 735f  CTF{w34k_pr1m3s_
00000010: 3472 335f 6234 647d 0a00 0000 0000 0000  4r3_b4d}........
\`\`\`

**Evidence ID:** cmd-003

## Flag Candidates

| Candidate | Confidence | Source |
|-----------|------------|--------|
| \`CTF{w34k_pr1m3s_4r3_b4d}\` | 95% | strings output |
| \`CTF{w34k_pr1m3s_4r3_b4d}\` | 92% | xxd hex dump |

## Conclusion

The flag was embedded directly in the output binary file, likely as a result of weak RSA parameters allowing for easy decryption.

**Flag:** \`CTF{w34k_pr1m3s_4r3_b4d}\`

---
*Generated by CTF Autopilot Analyzer*
`;

export const mockJobDetail: JobDetail = {
  ...mockJobs[0],
  commands: mockCommands,
  artifacts: mockArtifacts,
  flagCandidates: mockFlagCandidates,
  writeup: mockWriteup,
  inputFiles: ['challenge.py', 'output.bin'],
};

export const mockConfig: Config = {
  maxUploadSizeMb: 200,
  allowedExtensions: ['.txt', '.py', '.c', '.cpp', '.h', '.java', '.js', '.json', '.xml', '.html', '.css', '.md', '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.zip', '.tar', '.gz', '.pcap', '.pcapng', '.elf', '.exe', '.dll', '.so', '.bin', '.wav', '.mp3', '.pem', '.key', '.mem', '.raw'],
  sandboxTimeout: 300,
  allowedTools: [
    // === Core Analysis ===
    'file', 'strings', 'xxd', 'hexdump', 'od',
    
    // === Binary/RE Tools ===
    'readelf', 'objdump', 'nm', 'ldd', 'checksec',
    'radare2', 'r2', 'rabin2', 'rahash2', 'rafind2',
    'gdb', 'ltrace', 'strace',
    'retdec-decompiler', 'ghidra-headless',
    'ropper', 'ROPgadget', 'one_gadget',
    'patchelf', 'upx',
    
    // === Crypto Tools ===
    'openssl', 'gpg', 'hashcat', 'john', 'hash-identifier',
    'base64', 'base32', 'name-that-hash',
    'factordb-cli', 'rsatool', 'RsaCtfTool',
    'xortool', 'ciphey',
    
    // === Steganography Tools ===
    'exiftool', 'binwalk', 'foremost', 'scalpel',
    'steghide', 'stegseek', 'stegsolve', 'zsteg', 'stegcracker',
    'pngcheck', 'pngchunks', 'identify', 'convert',
    'sox', 'ffmpeg', 'ffprobe', 'audacity-cli',
    
    // === Network Tools ===
    'tshark', 'tcpdump', 'nmap', 'masscan',
    'netcat', 'nc', 'socat', 'curl', 'wget',
    'dnsrecon', 'dig', 'host', 'whois',
    'sslyze', 'sslscan',
    
    // === Web Tools ===
    'sqlmap', 'nikto', 'gobuster', 'dirb', 'dirbuster',
    'wfuzz', 'ffuf', 'hydra',
    'jwt_tool', 'jwt-cracker',
    
    // === Forensics Tools ===
    'volatility', 'volatility3', 'vol3',
    'sleuthkit', 'fls', 'icat', 'mmls', 'fsstat',
    'autopsy', 'photorec', 'testdisk',
    'bulk_extractor', 'pdf-parser', 'pdftotext', 'pdfinfo', 'pdfimages',
    
    // === Archive Tools ===
    'unzip', 'zip', 'tar', 'gzip', 'gunzip', 'bzip2',
    '7z', '7za', 'unrar', 'rar',
    'fcrackzip', 'zip2john', 'rar2john',
    
    // === Code Execution (Sandboxed) ===
    'python3', 'python', 'pip3', 'pip',
    'node', 'npm', 'npx',
    'ruby', 'perl', 'php',
    'gcc', 'g++', 'clang', 'make', 'cmake',
    'go', 'rustc', 'cargo',
    'java', 'javac',
    
    // === Scripting/Utils ===
    'bash', 'sh', 'zsh',
    'grep', 'egrep', 'awk', 'sed', 'cut', 'sort', 'uniq',
    'find', 'locate', 'xargs', 'tee',
    'cat', 'head', 'tail', 'less', 'more',
    'wc', 'diff', 'cmp', 'md5sum', 'sha256sum', 'sha1sum',
    'tr', 'rev', 'fold', 'column',
    
    // === PWN Tools ===
    'pwntools', 'pwn', 'checksec', 'cyclic', 'shellcraft',
    'msfvenom', 'msfconsole',
    'ropgadget', 'ropper',
    
    // === Misc CTF Tools ===
    'qpdf', 'pdftk',
    'tesseract', 'ocrmypdf',
    'morse', 'morse2ascii',
    'figlet', 'toilet',
  ],
};
