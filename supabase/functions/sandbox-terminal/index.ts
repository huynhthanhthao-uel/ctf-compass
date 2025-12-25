import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Job file storage simulation (in production, use Supabase Storage)
const jobFiles: Record<string, Map<string, { content: string; type: string }>> = {};

// Track command history per job for progressive analysis
const jobState: Record<string, {
  commandsRun: string[];
  discoveredInfo: string[];
  flagFound: boolean;
  detectedCategory: string;
  uploadedFiles: string[];
}> = {};

// Initialize or get job state
function getJobState(jobId: string) {
  if (!jobState[jobId]) {
    jobState[jobId] = {
      commandsRun: [],
      discoveredInfo: [],
      flagFound: false,
      detectedCategory: 'unknown',
      uploadedFiles: [],
    };
  }
  return jobState[jobId];
}

// Store file content for a job
function storeJobFile(jobId: string, fileName: string, content: string, type: string) {
  if (!jobFiles[jobId]) {
    jobFiles[jobId] = new Map();
  }
  jobFiles[jobId].set(fileName, { content, type });
  
  const state = getJobState(jobId);
  if (!state.uploadedFiles.includes(fileName)) {
    state.uploadedFiles.push(fileName);
  }
}

// Get stored files for a job
function getJobFiles(jobId: string): Map<string, { content: string; type: string }> {
  return jobFiles[jobId] || new Map();
}

// Analyze file content to determine type and extract data
function analyzeFileContent(content: string, fileName: string): {
  type: string;
  category: string;
  findings: string[];
  flags: string[];
} {
  const findings: string[] = [];
  const flags: string[] = [];
  let type = 'unknown';
  let category = 'misc';

  const lowerContent = content.toLowerCase();
  const lowerName = fileName.toLowerCase();

  // Detect file type
  if (lowerName.endsWith('.py') || content.includes('#!/usr/bin/env python') || content.includes('def ') || content.includes('import ')) {
    type = 'Python script';
    category = 'crypto';
    if (content.includes('RSA') || content.includes('rsa')) {
      findings.push('RSA cryptography detected');
      category = 'crypto';
    }
    if (content.includes('AES') || content.includes('Cipher')) {
      findings.push('Symmetric encryption detected');
    }
  } else if (lowerName.endsWith('.png') || content.startsWith('\x89PNG')) {
    type = 'PNG image';
    category = 'forensics';
    findings.push('PNG image - check for steganography');
  } else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
    type = 'JPEG image';
    category = 'forensics';
    findings.push('JPEG image - check EXIF data');
  } else if (lowerName.endsWith('.zip') || content.startsWith('PK')) {
    type = 'ZIP archive';
    category = 'forensics';
    findings.push('ZIP archive - needs extraction');
  } else if (lowerName.endsWith('.txt') || lowerName.endsWith('.enc')) {
    type = 'Text file';
    // Check for encoding patterns
    if (/^[A-Za-z0-9+/=]+$/.test(content.trim())) {
      findings.push('Possible Base64 encoding detected');
      category = 'crypto';
    }
    if (/^[0-9a-fA-F]+$/.test(content.trim())) {
      findings.push('Possible hex encoding detected');
      category = 'crypto';
    }
  } else if (content.includes('ELF') || lowerName === 'challenge' || !lowerName.includes('.')) {
    type = 'ELF executable';
    category = 'rev';
    if (content.includes('gets') || content.includes('strcpy')) {
      findings.push('Potentially vulnerable function detected');
      category = 'pwn';
    }
  }

  // Extract flag candidates
  const flagPatterns = [
    /CTF\{[^}]+\}/gi,
    /FLAG\{[^}]+\}/gi,
    /flag\{[^}]+\}/gi,
    /picoCTF\{[^}]+\}/gi,
    /HTB\{[^}]+\}/gi,
  ];

  for (const pattern of flagPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      flags.push(...matches);
    }
  }

  return { type, category, findings, flags };
}

// Dynamic output generator based on actual file analysis
function getSmartOutput(
  jobId: string,
  tool: string,
  args: string[],
  files: Map<string, { content: string; type: string }>
): { stdout: string; stderr: string; exit_code: number } {
  const state = getJobState(jobId);
  const argsStr = args.join(' ');
  state.commandsRun.push(`${tool} ${argsStr}`);

  // List files
  if (tool === 'ls') {
    const fileList = Array.from(files.keys());
    if (fileList.length > 0) {
      return { stdout: fileList.join('\n'), stderr: '', exit_code: 0 };
    }
    // Check for hardcoded demo files if no uploaded files
    return getHardcodedOutput(jobId, tool, args);
  }

  // File command
  if (tool === 'file') {
    const targetFile = args[0];
    const fileData = files.get(targetFile);
    if (fileData) {
      const analysis = analyzeFileContent(fileData.content, targetFile);
      state.detectedCategory = analysis.category;
      return { stdout: `${targetFile}: ${analysis.type}`, stderr: '', exit_code: 0 };
    }
    return getHardcodedOutput(jobId, tool, args);
  }

  // Cat command - read file content
  if (tool === 'cat') {
    const targetFile = args[0];
    const fileData = files.get(targetFile);
    if (fileData) {
      const analysis = analyzeFileContent(fileData.content, targetFile);
      state.discoveredInfo.push(...analysis.findings);
      if (analysis.flags.length > 0) {
        state.flagFound = true;
      }
      // Return truncated content for display
      const displayContent = fileData.content.length > 2000 
        ? fileData.content.slice(0, 2000) + '\n... (truncated)'
        : fileData.content;
      return { stdout: displayContent, stderr: '', exit_code: 0 };
    }
    return getHardcodedOutput(jobId, tool, args);
  }

  // Strings command
  if (tool === 'strings') {
    const targetFile = args.find(a => !a.startsWith('-')) || args[0];
    const fileData = files.get(targetFile);
    if (fileData) {
      // Extract printable strings
      const extractedStrings: string[] = fileData.content.match(/[\x20-\x7E]{4,}/g) || [];
      const analysis = analyzeFileContent(fileData.content, targetFile);
      if (analysis.flags.length > 0) {
        state.flagFound = true;
        analysis.flags.forEach(f => {
          if (!extractedStrings.includes(f)) extractedStrings.push(f);
        });
      }
      return { stdout: extractedStrings.slice(0, 50).join('\n'), stderr: '', exit_code: 0 };
    }
    return getHardcodedOutput(jobId, tool, args);
  }

  // Base64 decode
  if (tool === 'base64') {
    const targetFile = args.find(a => !a.startsWith('-'));
    const fileData = targetFile ? files.get(targetFile) : null;
    if (fileData || args.includes('-d')) {
      try {
        const content = fileData?.content || args[args.length - 1];
        const decoded = atob(content.trim());
        // Check for flag in decoded content
        const flagMatch = decoded.match(/CTF\{[^}]+\}|FLAG\{[^}]+\}|flag\{[^}]+\}/i);
        if (flagMatch) {
          state.flagFound = true;
          return { stdout: decoded, stderr: '', exit_code: 0 };
        }
        return { stdout: decoded, stderr: '', exit_code: 0 };
      } catch {
        return { stdout: '', stderr: 'base64: invalid input', exit_code: 1 };
      }
    }
    return getHardcodedOutput(jobId, tool, args);
  }

  // Xxd - hex dump
  if (tool === 'xxd') {
    const targetFile = args.find(a => !a.startsWith('-'));
    const fileData = targetFile ? files.get(targetFile) : null;
    if (fileData) {
      const bytes = new TextEncoder().encode(fileData.content.slice(0, 256));
      const lines: string[] = [];
      for (let i = 0; i < bytes.length; i += 16) {
        const hex = Array.from(bytes.slice(i, i + 16))
          .map(b => b.toString(16).padStart(2, '0'))
          .join(' ');
        const ascii = Array.from(bytes.slice(i, i + 16))
          .map(b => b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.')
          .join('');
        lines.push(`${i.toString(16).padStart(8, '0')}: ${hex.padEnd(47)}  ${ascii}`);
      }
      return { stdout: lines.join('\n'), stderr: '', exit_code: 0 };
    }
    return getHardcodedOutput(jobId, tool, args);
  }

  // Python execution
  if (tool === 'python3' || tool === 'python') {
    // Check if we have enough info to solve
    const allFlags: string[] = [];
    for (const [, fileData] of files) {
      const analysis = analyzeFileContent(fileData.content, '');
      allFlags.push(...analysis.flags);
    }
    if (allFlags.length > 0) {
      state.flagFound = true;
      return {
        stdout: `[*] Analysis complete\n[*] Flags found:\n${allFlags.map(f => `FLAG: ${f}`).join('\n')}`,
        stderr: '',
        exit_code: 0,
      };
    }
    return getHardcodedOutput(jobId, tool, args);
  }

  // Grep - search for patterns
  if (tool === 'grep') {
    const pattern = args.find(a => !a.startsWith('-') && !files.has(a));
    const targetFile = args.find(a => files.has(a));
    if (pattern && targetFile) {
      const fileData = files.get(targetFile);
      if (fileData) {
        const regex = new RegExp(pattern, 'gi');
        const matches = fileData.content.match(regex);
        if (matches) {
          return { stdout: matches.join('\n'), stderr: '', exit_code: 0 };
        }
        return { stdout: '', stderr: '', exit_code: 1 };
      }
    }
    // Special grep for flags
    if (pattern?.includes('CTF') || pattern?.includes('FLAG')) {
      for (const [, fileData] of files) {
        const analysis = analyzeFileContent(fileData.content, '');
        if (analysis.flags.length > 0) {
          state.flagFound = true;
          return { stdout: analysis.flags.join('\n'), stderr: '', exit_code: 0 };
        }
      }
    }
    return getHardcodedOutput(jobId, tool, args);
  }

  // Fall back to hardcoded for demo jobs
  return getHardcodedOutput(jobId, tool, args);
}

// Hardcoded outputs for demo job IDs (keeping backward compatibility)
function getHardcodedOutput(
  jobId: string,
  tool: string,
  args: string[]
): { stdout: string; stderr: string; exit_code: number } {
  const state = getJobState(jobId);
  const argsStr = args.join(' ');

  // === JOB-001: Crypto RSA ===
  if (jobId === 'job-001') {
    if (tool === 'ls') {
      return { stdout: 'challenge.py\noutput.txt\nREADME.txt', stderr: '', exit_code: 0 };
    }
    if (tool === 'file') {
      return { 
        stdout: 'challenge.py: Python script, ASCII text executable\noutput.txt: ASCII text', 
        stderr: '', exit_code: 0 
      };
    }
    if (tool === 'cat' && argsStr.includes('challenge.py')) {
      state.discoveredInfo.push('RSA with small n');
      return {
        stdout: `from Crypto.Util.number import bytes_to_long, long_to_bytes
import math

n = 323  # Very small modulus!
e = 5
c = 245

# Flag encrypted with weak RSA
# Your task: factor n and decrypt c

print("Encrypted message:", c)
print("Public key: (n={}, e={})".format(n, e))`,
        stderr: '', exit_code: 0
      };
    }
    if (tool === 'strings') {
      state.flagFound = true;
      return {
        stdout: `n = 323\ne = 5\nc = 245\n# Hint: 323 = 17 * 19`,
        stderr: '', exit_code: 0
      };
    }
    if (tool === 'python3' || tool === 'python') {
      state.flagFound = true;
      return {
        stdout: `[*] RSA Decryption\n[*] n = 323, e = 5, c = 245\n[*] Factoring n = 323...\n[*] Found: p = 17, q = 19\n[*] Computing d = inverse(5, 288) = 173\n[*] Decrypting...\nFLAG: CTF{sm4ll_pr1m3s_br34k_rs4}`,
        stderr: '', exit_code: 0
      };
    }
  }

  // === JOB-002: Forensics ===
  if (jobId === 'job-002') {
    if (tool === 'ls') {
      return { stdout: 'secret.png\nREADME.txt', stderr: '', exit_code: 0 };
    }
    if (tool === 'file') {
      return { stdout: 'secret.png: PNG image data, 1024 x 768, 8-bit/color RGBA', stderr: '', exit_code: 0 };
    }
    if (tool === 'exiftool') {
      state.flagFound = true;
      return {
        stdout: `File Name: secret.png\nFile Size: 245 kB\nImage Width: 1024\nImage Height: 768\nComment: FLAG{h1dd3n_1n_pl41n_s1ght}`,
        stderr: '', exit_code: 0
      };
    }
    if (tool === 'strings') {
      return { stdout: `IHDR\nsRGB\nSteghide password: "hidden"`, stderr: '', exit_code: 0 };
    }
    if (tool === 'zsteg') {
      state.flagFound = true;
      return { stdout: `b1,r,lsb,xy: FLAG{h1dd3n_1n_pl41n_s1ght}`, stderr: '', exit_code: 0 };
    }
  }

  // === JOB-003: Reverse Engineering ===
  if (jobId === 'job-003') {
    if (tool === 'ls') {
      return { stdout: 'challenge\nREADME.txt', stderr: '', exit_code: 0 };
    }
    if (tool === 'file') {
      return { stdout: 'challenge: ELF 64-bit LSB executable, x86-64, dynamically linked, stripped', stderr: '', exit_code: 0 };
    }
    if (tool === 'strings') {
      state.flagFound = true;
      return {
        stdout: `/lib64/ld-linux-x86-64.so.2\nputs\nmain\nEnter password:\nWrong password!\nCTF{str1ngs_r3v34l_s3cr3ts}`,
        stderr: '', exit_code: 0
      };
    }
    if (tool === 'ltrace') {
      return { stdout: `strcmp("test", "s3cr3t_p4ss") = -1\nputs("Wrong password!")`, stderr: '', exit_code: 0 };
    }
  }

  // === JOB-004: Web SQLi ===
  if (jobId === 'job-004') {
    if (tool === 'ls') {
      return { stdout: 'app.py\nrequirements.txt\ndatabase.db', stderr: '', exit_code: 0 };
    }
    if (tool === 'cat' && argsStr.includes('app.py')) {
      state.flagFound = true;
      return {
        stdout: `from flask import Flask, request
import sqlite3

@app.route('/login', methods=['POST'])
def login():
    username = request.form['username']
    password = request.form['password']
    # VULNERABLE: SQL injection!
    query = f"SELECT * FROM users WHERE username='{username}' AND password='{password}'"
    if result:
        return {"flag": "CTF{sql1_1nj3ct10n_w1ns}"}`,
        stderr: '', exit_code: 0
      };
    }
    if (tool === 'grep') {
      state.flagFound = true;
      return { stdout: 'CTF{sql1_1nj3ct10n_w1ns}', stderr: '', exit_code: 0 };
    }
  }

  // === JOB-005: PWN ===
  if (jobId === 'job-005') {
    if (tool === 'ls') {
      return { stdout: 'vuln\nREADME.txt', stderr: '', exit_code: 0 };
    }
    if (tool === 'checksec') {
      return { stdout: 'RELRO: No RELRO\nStack Canary: No canary\nNX: Disabled\nPIE: No PIE', stderr: '', exit_code: 0 };
    }
    if (tool === 'strings') {
      state.flagFound = true;
      return { stdout: `/bin/sh\ngets\nwin_function\nCTF{buff3r_0v3rfl0w_m4st3r}`, stderr: '', exit_code: 0 };
    }
    if (tool === 'objdump') {
      return {
        stdout: `0x401156 <win_function>:\n  lea 0xe50(%rip),%rdi  # "CTF{buff3r_0v3rfl0w_m4st3r}"\n  call puts@plt\n\n0x401168 <vulnerable_function>:\n  sub $0x40,%rsp  # 64 byte buffer\n  call gets@plt   # VULNERABLE!`,
        stderr: '', exit_code: 0
      };
    }
  }

  // === JOB-006: Misc Base64 ===
  if (jobId === 'job-006') {
    if (tool === 'ls') {
      return { stdout: 'encoded.txt\nREADME.txt', stderr: '', exit_code: 0 };
    }
    if (tool === 'cat' && argsStr.includes('encoded')) {
      return { stdout: 'Q1RGe20xeHQzdXJfM25jMGQxbmdfbTRzdDNyfQ==', stderr: '', exit_code: 0 };
    }
    if (tool === 'base64') {
      state.flagFound = true;
      return { stdout: 'CTF{m1xt3ur_3nc0d1ng_m4st3r}', stderr: '', exit_code: 0 };
    }
    if (tool === 'strings') {
      return { stdout: 'Q1RGe20xeHQzdXJfM25jMGQxbmdfbTRzdDNyfQ==\n# Base64 encoded', stderr: '', exit_code: 0 };
    }
  }

  // Generic forensics demo (for new jobs with image files)
  if (tool === 'exiftool') {
    return {
      stdout: `File Name: ${args[0] || 'image.png'}\nFile Size: 128 kB\nMIME Type: image/png\nImage Width: 800\nImage Height: 600\nComment: Check LSB steganography`,
      stderr: '', exit_code: 0
    };
  }

  if (tool === 'binwalk') {
    return {
      stdout: `DECIMAL       HEXADECIMAL     DESCRIPTION\n0             0x0             PNG image, 800 x 600\n65536         0x10000         Zip archive data`,
      stderr: '', exit_code: 0
    };
  }

  if (tool === 'checksec') {
    return {
      stdout: `RELRO: Partial RELRO\nStack Canary: No canary found\nNX: NX enabled\nPIE: No PIE`,
      stderr: '', exit_code: 0
    };
  }

  // Health check
  if (tool === 'echo' && args.includes('ok')) {
    return { stdout: 'ok', stderr: '', exit_code: 0 };
  }

  // Default fallback
  return {
    stdout: `[${tool}] Command executed for ${jobId}`,
    stderr: '',
    exit_code: 0
  };
}

// Execute Python script with smarter output
function executePythonScript(jobId: string, script: string): { stdout: string; stderr: string; exit_code: number } {
  console.log(`[sandbox-terminal] Executing Python script for ${jobId}`);
  
  const state = getJobState(jobId);
  const lowerScript = script.toLowerCase();
  const files = getJobFiles(jobId);
  
  // Check if script analyzes uploaded files and finds flags
  const allFlags: string[] = [];
  for (const [fileName, fileData] of files) {
    const analysis = analyzeFileContent(fileData.content, fileName);
    allFlags.push(...analysis.flags);
  }
  
  if (allFlags.length > 0) {
    state.flagFound = true;
    return {
      stdout: `[*] Python Script Execution\n[*] Analyzing challenge files...\n[*] Processing complete!\n${allFlags.map(f => `FLAG: ${f}`).join('\n')}`,
      stderr: '',
      exit_code: 0,
    };
  }

  // Job-specific script outputs (backward compatibility)
  if (jobId === 'job-001' || (lowerScript.includes('pow(') && lowerScript.includes('inverse'))) {
    state.flagFound = true;
    return {
      stdout: `[*] RSA Solver Script\n[*] n = 323, e = 5, c = 245\n[*] Factoring n...\n[*] Found: p = 17, q = 19\n[*] d = inverse(5, 288) = 173\n[*] Decrypting...\nFLAG: CTF{sm4ll_pr1m3s_br34k_rs4}`,
      stderr: '',
      exit_code: 0
    };
  }
  
  if (jobId === 'job-002' || lowerScript.includes('exif') || lowerScript.includes('steg')) {
    state.flagFound = true;
    return {
      stdout: `[*] Forensics Analysis\n[*] Checking EXIF metadata...\n[*] Found hidden Comment field\nFLAG: FLAG{h1dd3n_1n_pl41n_s1ght}`,
      stderr: '',
      exit_code: 0
    };
  }
  
  if (jobId === 'job-003' || lowerScript.includes('xor') || lowerScript.includes('binary')) {
    state.flagFound = true;
    return {
      stdout: `[*] Binary Analysis\n[*] Extracting strings...\n[*] Found hardcoded flag\nFLAG: CTF{str1ngs_r3v34l_s3cr3ts}`,
      stderr: '',
      exit_code: 0
    };
  }
  
  if (jobId === 'job-004' || lowerScript.includes('sql') || lowerScript.includes('request')) {
    state.flagFound = true;
    return {
      stdout: `[*] SQL Injection Solver\n[*] Payload: ' OR '1'='1' --\n[*] Bypass successful!\nFLAG: CTF{sql1_1nj3ct10n_w1ns}`,
      stderr: '',
      exit_code: 0
    };
  }
  
  if (jobId === 'job-005' || lowerScript.includes('pwn') || lowerScript.includes('overflow')) {
    state.flagFound = true;
    return {
      stdout: `[*] PWN Exploit\n[*] win_function: 0x401156\n[*] Offset: 72 bytes\n[*] Sending payload...\nFLAG: CTF{buff3r_0v3rfl0w_m4st3r}`,
      stderr: '',
      exit_code: 0
    };
  }
  
  if (jobId === 'job-006' || lowerScript.includes('base64') || lowerScript.includes('decode')) {
    state.flagFound = true;
    return {
      stdout: `[*] Encoding Solver\n[*] Input: Q1RGe20xeHQzdXJfM25jMGQxbmdfbTRzdDNyfQ==\n[*] Decoding Base64...\nFLAG: CTF{m1xt3ur_3nc0d1ng_m4st3r}`,
      stderr: '',
      exit_code: 0
    };
  }
  
  // Generic script execution with analysis
  return {
    stdout: `[*] Script executed successfully\n[*] No flag found in output\n[*] Try running more specific analysis tools`,
    stderr: '',
    exit_code: 0
  };
}

// Simulate netcat connection to remote server
function executeNetcatCommand(
  jobId: string,
  host: string,
  port: string,
  payload?: string,
  interactionScript?: string[],
  _timeout?: number
): { stdout: string; stderr: string; exit_code: number; connected: boolean; interaction_log?: string[] } {
  console.log(`[sandbox-terminal] Netcat connection: ${host}:${port}`);
  
  const state = getJobState(jobId);
  
  // Demo netcat responses for common CTF scenarios
  const interactionLog: string[] = [];
  
  // PWN challenge simulation
  if (host.includes('pwn') || port === '9001' || port === '1337') {
    interactionLog.push(`$ nc ${host} ${port}`);
    interactionLog.push(`[*] Connected to ${host}:${port}`);
    interactionLog.push(`Welcome to the PWN challenge!`);
    interactionLog.push(`Enter your name: `);
    
    if (payload) {
      interactionLog.push(`You entered: ${payload.slice(0, 20)}...`);
      // Check if payload looks like exploit (long string or contains ROP gadgets)
      if (payload.length > 64 || payload.includes('\\x')) {
        state.flagFound = true;
        interactionLog.push(`[*] Buffer overflow detected!`);
        interactionLog.push(`[*] Executing win_function...`);
        interactionLog.push(`FLAG: CTF{r3m0t3_pwn_m4st3r}`);
        return {
          stdout: interactionLog.join('\n'),
          stderr: '',
          exit_code: 0,
          connected: true,
          interaction_log: interactionLog,
        };
      }
    }
    
    if (interactionScript && interactionScript.length > 0) {
      for (const cmd of interactionScript) {
        interactionLog.push(`> ${cmd}`);
        if (cmd.length > 64) {
          state.flagFound = true;
          interactionLog.push(`[*] Overflow triggered!`);
          interactionLog.push(`FLAG: CTF{r3m0t3_pwn_m4st3r}`);
          break;
        }
      }
    }
    
    return {
      stdout: interactionLog.join('\n'),
      stderr: '',
      exit_code: 0,
      connected: true,
      interaction_log: interactionLog,
    };
  }
  
  // Crypto challenge simulation
  if (host.includes('crypto') || port === '9002') {
    interactionLog.push(`$ nc ${host} ${port}`);
    interactionLog.push(`[*] Connected to ${host}:${port}`);
    interactionLog.push(`=== Crypto Challenge Server ===`);
    interactionLog.push(`Encrypted message: 245`);
    interactionLog.push(`Public key: n=323, e=5`);
    interactionLog.push(`Enter decrypted message: `);
    
    if (payload === 'HI' || payload?.includes('CTF{')) {
      state.flagFound = true;
      interactionLog.push(`Correct! Here's your flag:`);
      interactionLog.push(`FLAG: CTF{n3tw0rk_crypt0_m4st3r}`);
    }
    
    return {
      stdout: interactionLog.join('\n'),
      stderr: '',
      exit_code: 0,
      connected: true,
      interaction_log: interactionLog,
    };
  }
  
  // Misc/quiz challenge simulation
  if (host.includes('misc') || host.includes('quiz') || port === '9003') {
    interactionLog.push(`$ nc ${host} ${port}`);
    interactionLog.push(`[*] Connected to ${host}:${port}`);
    interactionLog.push(`=== CTF Quiz ===`);
    interactionLog.push(`Question 1: What is 2+2?`);
    
    if (interactionScript) {
      let correct = 0;
      const answers = ['4', 'python', 'yes'];
      for (let i = 0; i < interactionScript.length && i < answers.length; i++) {
        interactionLog.push(`> ${interactionScript[i]}`);
        if (interactionScript[i].toLowerCase().includes(answers[i])) {
          interactionLog.push(`Correct!`);
          correct++;
        } else {
          interactionLog.push(`Wrong!`);
        }
      }
      if (correct >= 2) {
        state.flagFound = true;
        interactionLog.push(`Congratulations!`);
        interactionLog.push(`FLAG: CTF{qu1z_m4st3r_2024}`);
      }
    }
    
    return {
      stdout: interactionLog.join('\n'),
      stderr: '',
      exit_code: 0,
      connected: true,
      interaction_log: interactionLog,
    };
  }
  
  // Generic connection simulation
  interactionLog.push(`$ nc ${host} ${port}`);
  interactionLog.push(`[*] Attempting connection to ${host}:${port}...`);
  interactionLog.push(`[*] Connected successfully`);
  interactionLog.push(`Welcome to the challenge server!`);
  
  if (payload) {
    interactionLog.push(`Received: ${payload}`);
    // Check for flag patterns in response
    if (payload.includes("' OR") || payload.includes('admin')) {
      state.flagFound = true;
      interactionLog.push(`FLAG: CTF{n3tc4t_ch4ll3ng3_s0lv3d}`);
    }
  }
  
  return {
    stdout: interactionLog.join('\n'),
    stderr: '',
    exit_code: 0,
    connected: true,
    interaction_log: interactionLog,
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { 
      job_id, 
      tool, 
      args = [], 
      script, 
      script_type,
      // File upload support
      file_name,
      file_content,
      file_type,
      action,
      // Netcat support
      payload,
      timeout,
      interaction_script 
    } = body;

    console.log('[sandbox-terminal] Request:', { 
      job_id, 
      tool, 
      args: args?.slice?.(0, 2), 
      has_script: !!script,
      action,
      file_name 
    });

    // Handle file upload action
    if (action === 'upload' && file_name && file_content) {
      storeJobFile(job_id, file_name, file_content, file_type || 'unknown');
      console.log(`[sandbox-terminal] Stored file ${file_name} for job ${job_id}`);
      
      // Analyze the file immediately
      const analysis = analyzeFileContent(file_content, file_name);
      
      return new Response(JSON.stringify({
        success: true,
        message: `File ${file_name} uploaded`,
        analysis: {
          type: analysis.type,
          category: analysis.category,
          findings: analysis.findings,
          flags_found: analysis.flags.length,
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle Python script execution
    if (script && (script_type === 'python' || tool === 'python3')) {
      console.log('[sandbox-terminal] Executing Python script for job:', job_id);
      
      const result = executePythonScript(job_id, script);
      
      return new Response(JSON.stringify({
        stdout: result.stdout,
        stderr: result.stderr,
        exit_code: result.exit_code,
        command_id: `script-${Date.now()}`,
        executed_at: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle netcat commands
    if (tool === 'nc' || tool === 'nc_interact') {
      console.log('[sandbox-terminal] Netcat command for job:', job_id, 'host:', args[0], 'port:', args[1]);
      
      const host = args[0] || 'localhost';
      const port = args[1] || '9999';
      const result = executeNetcatCommand(job_id, host, port, payload, interaction_script, timeout || 10);
      
      return new Response(JSON.stringify({
        ...result,
        command_id: `nc-${Date.now()}`,
        executed_at: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!tool) {
      return new Response(JSON.stringify({ error: 'Missing tool parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get uploaded files for this job
    const files = getJobFiles(job_id);
    
    // Get smart output based on actual files or fallback to hardcoded
    const result = getSmartOutput(job_id, tool, args || [], files);

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

    console.log('[sandbox-terminal] Result:', { 
      job_id,
      tool, 
      stdout_length: result.stdout.length,
      exit_code: result.exit_code 
    });

    return new Response(JSON.stringify({
      stdout: result.stdout,
      stderr: result.stderr,
      exit_code: result.exit_code,
      command_id: `cmd-${Date.now()}`,
      executed_at: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[sandbox-terminal] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal error',
      stdout: '',
      stderr: error instanceof Error ? error.message : 'Internal error',
      exit_code: 1
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
