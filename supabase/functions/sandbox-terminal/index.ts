import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Track command history per job to simulate progressive analysis
const jobState: Record<string, {
  commandsRun: string[];
  discoveredInfo: string[];
  flagFound: boolean;
}> = {};

// Initialize or get job state
function getJobState(jobId: string) {
  if (!jobState[jobId]) {
    jobState[jobId] = {
      commandsRun: [],
      discoveredInfo: [],
      flagFound: false
    };
  }
  return jobState[jobId];
}

// Job-specific realistic outputs that progress based on previous commands
const getJobOutput = (
  jobId: string, 
  tool: string, 
  args: string[]
): { stdout: string; stderr: string; exit_code: number } => {
  const state = getJobState(jobId);
  const argsStr = args.join(' ');
  const commandKey = `${tool} ${argsStr}`.trim();
  
  // Track this command
  state.commandsRun.push(commandKey);

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
    if (tool === 'cat' && argsStr.includes('output.txt')) {
      return { stdout: 'Encrypted: 245\nn=323, e=5', stderr: '', exit_code: 0 };
    }
    if (tool === 'strings') {
      const hasContext = state.discoveredInfo.includes('RSA with small n');
      return {
        stdout: hasContext 
          ? `n = 323\ne = 5\nc = 245\n# Hint: 323 = 17 * 19\n# phi = (17-1)*(19-1) = 288\n# d = inverse(5, 288) = 173`
          : 'n = 323\ne = 5\nc = 245\nEncrypted message',
        stderr: '', exit_code: 0
      };
    }
    if (tool === 'python3' || tool === 'python') {
      state.flagFound = true;
      return {
        stdout: `[*] RSA Decryption
[*] n = 323, e = 5, c = 245
[*] Factoring n = 323...
[*] Found: p = 17, q = 19
[*] phi(n) = (p-1)*(q-1) = 288
[*] d = modular_inverse(5, 288) = 173
[*] m = pow(245, 173, 323) = 67, 84, 70...
[*] Decoding bytes...
FLAG: CTF{sm4ll_pr1m3s_br34k_rs4}`,
        stderr: '', exit_code: 0
      };
    }
  }

  // === JOB-002: Forensics Steganography ===
  if (jobId === 'job-002') {
    if (tool === 'ls') {
      return { stdout: 'secret.png\nREADME.txt', stderr: '', exit_code: 0 };
    }
    if (tool === 'file') {
      return { 
        stdout: 'secret.png: PNG image data, 1024 x 768, 8-bit/color RGBA, non-interlaced', 
        stderr: '', exit_code: 0 
      };
    }
    if (tool === 'exiftool') {
      state.discoveredInfo.push('EXIF metadata');
      return {
        stdout: `ExifTool Version Number         : 12.40
File Name                       : secret.png
File Size                       : 245 kB
File Type                       : PNG
MIME Type                       : image/png
Image Width                     : 1024
Image Height                    : 768
Comment                         : FLAG{h1dd3n_1n_pl41n_s1ght}
Author                          : CTF Challenge`,
        stderr: '', exit_code: 0
      };
    }
    if (tool === 'strings') {
      return {
        stdout: `IHDR\nsRGB\ngAMA\npHYs\nSteghide password: "hidden"\nIDAT\nIEND`,
        stderr: '', exit_code: 0
      };
    }
    if (tool === 'binwalk') {
      state.discoveredInfo.push('embedded zip');
      return {
        stdout: `DECIMAL       HEXADECIMAL     DESCRIPTION
--------------------------------------------------------------------------------
0             0x0             PNG image, 1024 x 768, 8-bit/color RGBA
41            0x29            Zlib compressed data
245760        0x3C000         Zip archive data, name: hidden.txt
245800        0x3C028         End of Zip archive`,
        stderr: '', exit_code: 0
      };
    }
    if (tool === 'zsteg') {
      state.flagFound = true;
      return {
        stdout: `b1,r,lsb,xy         .. text: "FLAG{h1dd3n_1n_pl41n_s1ght}"
b1,rgb,lsb,xy       .. file: data
b2,r,lsb,xy         .. text: "random noise"`,
        stderr: '', exit_code: 0
      };
    }
    if (tool === 'python3' || tool === 'python') {
      state.flagFound = true;
      return {
        stdout: `[*] PNG Forensics Analysis
[*] Checking EXIF metadata...
[*] Found Comment field with suspicious content
[*] Checking LSB steganography...
FLAG: FLAG{h1dd3n_1n_pl41n_s1ght}`,
        stderr: '', exit_code: 0
      };
    }
  }

  // === JOB-003: Reverse Engineering ===
  if (jobId === 'job-003') {
    if (tool === 'ls') {
      return { stdout: 'challenge\nREADME.txt', stderr: '', exit_code: 0 };
    }
    if (tool === 'file') {
      return { 
        stdout: 'challenge: ELF 64-bit LSB executable, x86-64, version 1 (SYSV), dynamically linked, stripped', 
        stderr: '', exit_code: 0 
      };
    }
    if (tool === 'checksec') {
      return {
        stdout: `RELRO           STACK CANARY      NX            PIE             RPATH      RUNPATH
Partial RELRO   No canary found   NX enabled    No PIE          No RPATH   No RUNPATH`,
        stderr: '', exit_code: 0
      };
    }
    if (tool === 'strings') {
      state.discoveredInfo.push('hardcoded strings');
      state.flagFound = true;
      return {
        stdout: `/lib64/ld-linux-x86-64.so.2
libc.so.6
puts
__libc_start_main
Enter password: 
Wrong password!
Access granted!
CTF{str1ngs_r3v34l_s3cr3ts}
secret_function
check_password
main`,
        stderr: '', exit_code: 0
      };
    }
    if (tool === 'ltrace') {
      return {
        stdout: `puts("Enter password: ") = 17
gets(0x7ffd12345678, 0, 0, 0) = 0x7ffd12345678
strcmp("test", "s3cr3t_p4ss") = -1
puts("Wrong password!") = 16`,
        stderr: '', exit_code: 0
      };
    }
    if (tool === 'objdump') {
      return {
        stdout: `0000000000401000 <main>:
  401000:       push   %rbp
  401001:       mov    %rsp,%rbp
  401008:       lea    0xff9(%rip),%rdi        # "Enter password:"
  40100f:       call   401030 <puts@plt>
  401021:       call   401060 <check_password>
  401026:       cmp    $0x1,%eax
  401029:       je     401040 <print_flag>

0000000000401050 <print_flag>:
  401050:       lea    0xe50(%rip),%rdi        # "CTF{str1ngs_r3v34l_s3cr3ts}"
  401057:       call   401030 <puts@plt>`,
        stderr: '', exit_code: 0
      };
    }
  }

  // === JOB-004: Web SQL Injection ===
  if (jobId === 'job-004') {
    if (tool === 'ls') {
      return { stdout: 'app.py\nrequirements.txt\ndatabase.db\nREADME.txt', stderr: '', exit_code: 0 };
    }
    if (tool === 'file') {
      return { 
        stdout: 'app.py: Python script, ASCII text executable\ndatabase.db: SQLite 3.x database', 
        stderr: '', exit_code: 0 
      };
    }
    if (tool === 'cat') {
      if (argsStr.includes('app.py')) {
        state.discoveredInfo.push('SQL injection vulnerability');
        return {
          stdout: `from flask import Flask, request
import sqlite3

app = Flask(__name__)

@app.route('/login', methods=['POST'])
def login():
    username = request.form['username']
    password = request.form['password']
    # VULNERABLE: String formatting in SQL query
    query = f"SELECT * FROM users WHERE username='{username}' AND password='{password}'"
    conn = sqlite3.connect('database.db')
    result = conn.execute(query).fetchone()
    if result:
        return {"message": "Login successful!", "flag": "CTF{sql1_1nj3ct10n_w1ns}"}
    return {"error": "Invalid credentials"}, 401`,
          stderr: '', exit_code: 0
        };
      }
    }
    if (tool === 'strings') {
      return {
        stdout: `SELECT * FROM users
admin
password
CTF{sql1_1nj3ct10n_w1ns}
flask
sqlite3`,
        stderr: '', exit_code: 0
      };
    }
    if (tool === 'grep') {
      state.flagFound = true;
      return { stdout: 'CTF{sql1_1nj3ct10n_w1ns}', stderr: '', exit_code: 0 };
    }
    if (tool === 'python3' || tool === 'python') {
      state.flagFound = true;
      return {
        stdout: `[*] SQL Injection Exploit
[*] Target: http://localhost:5000/login
[*] Payload: ' OR '1'='1' --
[*] Sending request...
[*] Response: {"message": "Login successful!", "flag": "CTF{sql1_1nj3ct10n_w1ns}"}
FLAG: CTF{sql1_1nj3ct10n_w1ns}`,
        stderr: '', exit_code: 0
      };
    }
  }

  // === JOB-005: PWN Buffer Overflow ===
  if (jobId === 'job-005') {
    if (tool === 'ls') {
      return { stdout: 'vuln\nREADME.txt', stderr: '', exit_code: 0 };
    }
    if (tool === 'file') {
      return { 
        stdout: 'vuln: ELF 64-bit LSB executable, x86-64, version 1 (SYSV), dynamically linked, not stripped', 
        stderr: '', exit_code: 0 
      };
    }
    if (tool === 'checksec') {
      state.discoveredInfo.push('weak protections');
      return {
        stdout: `RELRO           STACK CANARY      NX            PIE             RPATH      RUNPATH
No RELRO        No canary found   NX disabled   No PIE          No RPATH   No RUNPATH`,
        stderr: '', exit_code: 0
      };
    }
    if (tool === 'strings') {
      return {
        stdout: `/lib64/ld-linux-x86-64.so.2
gets
puts
system
/bin/sh
CTF{buff3r_0v3rfl0w_m4st3r}
win_function
main
vulnerable_function`,
        stderr: '', exit_code: 0
      };
    }
    if (tool === 'objdump' || tool === 'readelf') {
      state.discoveredInfo.push('win_function at 0x401156');
      return {
        stdout: `0000000000401156 <win_function>:
  401156:       push   %rbp
  401157:       mov    %rsp,%rbp
  40115a:       lea    0xe9f(%rip),%rdi        # "CTF{buff3r_0v3rfl0w_m4st3r}"
  401161:       call   401030 <puts@plt>

0000000000401168 <vulnerable_function>:
  401168:       sub    $0x40,%rsp              # 64 byte buffer
  401177:       call   401040 <gets@plt>       # VULNERABLE: no bounds check`,
        stderr: '', exit_code: 0
      };
    }
    if (tool === 'python3' || tool === 'python') {
      state.flagFound = true;
      return {
        stdout: `[*] PWN Exploit - Buffer Overflow
[*] Binary: vuln
[*] win_function at: 0x401156
[*] Buffer size: 64 bytes (0x40)
[*] Offset to return address: 72 bytes
[*] Building payload: b'A' * 72 + p64(0x401156)
[*] Sending payload...
[*] Got shell!
FLAG: CTF{buff3r_0v3rfl0w_m4st3r}`,
        stderr: '', exit_code: 0
      };
    }
  }

  // === JOB-006: Misc Base64 Encoding === (More realistic progressive flow)
  if (jobId === 'job-006') {
    if (tool === 'ls') {
      return { stdout: 'encoded.txt\nREADME.txt', stderr: '', exit_code: 0 };
    }
    if (tool === 'file') {
      return { stdout: 'encoded.txt: ASCII text\nREADME.txt: ASCII text', stderr: '', exit_code: 0 };
    }
    if (tool === 'cat') {
      if (argsStr.includes('README')) {
        return {
          stdout: `# Misc Challenge - Nested Encoding

The flag is hidden in encoded.txt
It has been encoded multiple times using different methods.
Can you decode it?

Flag format: CTF{...}`,
          stderr: '', exit_code: 0
        };
      }
      if (argsStr.includes('encoded')) {
        state.discoveredInfo.push('base64 encoded data');
        return { 
          stdout: 'Q1RGe20xeHQzdXJfM25jMGQxbmdfbTRzdDNyfQ==', 
          stderr: '', exit_code: 0 
        };
      }
    }
    if (tool === 'strings') {
      const output = state.discoveredInfo.includes('base64 encoded data')
        ? `Q1RGe20xeHQzdXJfM25jMGQxbmdfbTRzdDNyfQ==
# This looks like base64 encoding
# Try: base64 -d encoded.txt`
        : `Q1RGe20xeHQzdXJfM25jMGQxbmdfbTRzdDNyfQ==`;
      return { stdout: output, stderr: '', exit_code: 0 };
    }
    if (tool === 'xxd') {
      return {
        stdout: `00000000: 5131 5247 6532 3078 6548 5130 6458 5666  Q1RGe20xeHQzdXJf
00000010: 4d32 356a 4d47 5178 626d 6466 6254 5274  M25jMGQxbmdfbTRt
00000020: 4d33 4a39 0a                             M3J9.`,
        stderr: '', exit_code: 0
      };
    }
    if (tool === 'base64') {
      state.flagFound = true;
      return { stdout: 'CTF{m1xt3ur_3nc0d1ng_m4st3r}', stderr: '', exit_code: 0 };
    }
    if (tool === 'python3' || tool === 'python') {
      state.flagFound = true;
      return {
        stdout: `[*] Encoding Analysis Script
[*] Reading file: encoded.txt
[*] Content: Q1RGe20xeHQzdXJfM25jMGQxbmdfbTRzdDNyfQ==
[*] Detected encoding: Base64 (ends with ==)
[*] Decoding Base64...
[*] Decoded: CTF{m1xt3ur_3nc0d1ng_m4st3r}
[*] Checking for additional layers...
[*] No more encoding detected
FLAG: CTF{m1xt3ur_3nc0d1ng_m4st3r}`,
        stderr: '', exit_code: 0
      };
    }
  }

  // Default fallback
  return {
    stdout: `[${tool}] Command executed for ${jobId}`,
    stderr: '',
    exit_code: 0
  };
};

// Execute Python script
const executePythonScript = (jobId: string, script: string): { stdout: string; stderr: string; exit_code: number } => {
  console.log(`[sandbox-terminal] Executing Python script for ${jobId}`);
  
  const lowerScript = script.toLowerCase();
  const state = getJobState(jobId);
  
  // Return job-specific script output
  if (jobId === 'job-001' || (lowerScript.includes('pow(') && lowerScript.includes('inverse'))) {
    state.flagFound = true;
    return {
      stdout: `[*] RSA Solver Script
[*] n = 323, e = 5, c = 245
[*] Factoring n = 323...
[*] Found factors: p = 17, q = 19
[*] Computing phi = (p-1)*(q-1) = 288
[*] Computing d = inverse(e, phi) = 173
[*] Decrypting: m = pow(c, d, n)
[*] Result: CTF{sm4ll_pr1m3s_br34k_rs4}
FLAG: CTF{sm4ll_pr1m3s_br34k_rs4}`,
      stderr: '',
      exit_code: 0
    };
  }
  
  if (jobId === 'job-002' || lowerScript.includes('exif') || lowerScript.includes('steg') || lowerScript.includes('png')) {
    state.flagFound = true;
    return {
      stdout: `[*] Forensics Analysis Script
[*] Analyzing secret.png...
[*] Checking EXIF metadata...
[*] Found hidden Comment field
[*] Content: FLAG{h1dd3n_1n_pl41n_s1ght}
FLAG: FLAG{h1dd3n_1n_pl41n_s1ght}`,
      stderr: '',
      exit_code: 0
    };
  }
  
  if (jobId === 'job-003' || (lowerScript.includes('xor') || lowerScript.includes('binary'))) {
    state.flagFound = true;
    return {
      stdout: `[*] Binary Analysis Script
[*] Reading binary: challenge
[*] Extracting strings...
[*] Found password comparison: "s3cr3t_p4ss"
[*] Found flag string in binary
FLAG: CTF{str1ngs_r3v34l_s3cr3ts}`,
      stderr: '',
      exit_code: 0
    };
  }
  
  if (jobId === 'job-004' || lowerScript.includes('sql') || lowerScript.includes('request')) {
    state.flagFound = true;
    return {
      stdout: `[*] SQL Injection Solver
[*] Target: login endpoint
[*] Testing payload: ' OR '1'='1' --
[*] Bypass successful!
[*] Response: Login successful
FLAG: CTF{sql1_1nj3ct10n_w1ns}`,
      stderr: '',
      exit_code: 0
    };
  }
  
  if (jobId === 'job-005' || lowerScript.includes('pwn') || lowerScript.includes('overflow') || lowerScript.includes('payload')) {
    state.flagFound = true;
    return {
      stdout: `[*] PWN Exploit Script
[*] Binary: vuln
[*] win_function at: 0x401156
[*] Buffer size: 64 bytes
[*] Offset: 72 bytes to return address
[*] Payload: b'A' * 72 + p64(0x401156)
[*] Sending exploit...
FLAG: CTF{buff3r_0v3rfl0w_m4st3r}`,
      stderr: '',
      exit_code: 0
    };
  }
  
  if (jobId === 'job-006' || lowerScript.includes('base64') || lowerScript.includes('decode')) {
    state.flagFound = true;
    return {
      stdout: `[*] Encoding Solver Script
[*] Reading: encoded.txt
[*] Content: Q1RGe20xeHQzdXJfM25jMGQxbmdfbTRzdDNyfQ==
[*] Detected: Base64 encoding
[*] Decoding...
[*] Result: CTF{m1xt3ur_3nc0d1ng_m4st3r}
FLAG: CTF{m1xt3ur_3nc0d1ng_m4st3r}`,
      stderr: '',
      exit_code: 0
    };
  }
  
  // Generic fallback
  return {
    stdout: `[*] Script executed successfully
[*] No flag found in output`,
    stderr: '',
    exit_code: 0
  };
};

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
    const { job_id, tool, args = [], script, script_type } = body;

    console.log('[sandbox-terminal] Request:', { job_id, tool, args: args?.slice?.(0, 2), has_script: !!script });

    // Handle Python script execution
    if (script && (script_type === 'python' || tool === 'python3')) {
      console.log('[sandbox-terminal] Executing Python script for job:', job_id);
      
      const result = executePythonScript(job_id, script);
      
      console.log('[sandbox-terminal] Script result:', {
        job_id,
        stdout_length: result.stdout.length,
        exit_code: result.exit_code
      });

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

    if (!tool) {
      return new Response(JSON.stringify({ error: 'Missing tool parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[sandbox-terminal] Executing:', { job_id, tool, args });

    // Get realistic progressive output
    const result = getJobOutput(job_id, tool, args || []);

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 250));

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
