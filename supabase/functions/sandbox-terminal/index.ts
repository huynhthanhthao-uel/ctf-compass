import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Job-specific mock outputs for different challenge types
const jobMockOutputs: Record<string, Record<string, { stdout: string; stderr: string; exit_code: number }>> = {
  // Job 001 - Crypto RSA
  'job-001': {
    file: {
      stdout: "challenge.py: Python script, ASCII text executable\noutput.txt: ASCII text",
      stderr: "",
      exit_code: 0
    },
    strings: {
      stdout: `n = 323
e = 5
c = 245
p = 17
q = 19
# n = p * q = 323
# phi = (p-1)*(q-1) = 288
# d = inverse(e, phi) = 173
# m = pow(c, d, n)
# Decrypted: CTF{sm4ll_pr1m3s_br34k_rs4}`,
      stderr: "",
      exit_code: 0
    },
    cat: {
      stdout: `from Crypto.Util.number import bytes_to_long, long_to_bytes
import math

n = 323  # Very small, easily factored!
e = 5
c = 245

# TODO: Factor n and decrypt
# Hint: n = 17 * 19`,
      stderr: "",
      exit_code: 0
    },
    ls: {
      stdout: `challenge.py\noutput.txt\nREADME.txt`,
      stderr: "",
      exit_code: 0
    }
  },
  // Job 002 - Forensics Steganography
  'job-002': {
    file: {
      stdout: "secret.png: PNG image data, 1024 x 768, 8-bit/color RGBA, non-interlaced",
      stderr: "",
      exit_code: 0
    },
    strings: {
      stdout: `IHDR
sRGB
gAMA
pHYs
IDAT
IEND
Steghide password: "hidden"`,
      stderr: "",
      exit_code: 0
    },
    exiftool: {
      stdout: `ExifTool Version Number         : 12.40
File Name                       : secret.png
File Size                       : 245 kB
File Type                       : PNG
MIME Type                       : image/png
Image Width                     : 1024
Image Height                    : 768
Comment                         : FLAG{h1dd3n_1n_pl41n_s1ght}
Author                          : CTF Challenge`,
      stderr: "",
      exit_code: 0
    },
    binwalk: {
      stdout: `DECIMAL       HEXADECIMAL     DESCRIPTION
--------------------------------------------------------------------------------
0             0x0             PNG image, 1024 x 768, 8-bit/color RGBA
41            0x29            Zlib compressed data
245760        0x3C000         Zip archive data, name: hidden.txt
245800        0x3C028         End of Zip archive`,
      stderr: "",
      exit_code: 0
    },
    steghide: {
      stdout: `wrote extracted data to "hidden.txt".
Content: FLAG{h1dd3n_1n_pl41n_s1ght}`,
      stderr: "",
      exit_code: 0
    },
    zsteg: {
      stdout: `b1,r,lsb,xy         .. text: "FLAG{h1dd3n_1n_pl41n_s1ght}"
b1,rgb,lsb,xy       .. file: data`,
      stderr: "",
      exit_code: 0
    },
    ls: {
      stdout: `secret.png\nREADME.txt`,
      stderr: "",
      exit_code: 0
    }
  },
  // Job 003 - Reverse Engineering (existing)
  'job-003': {
    file: {
      stdout: "challenge: ELF 64-bit LSB executable, x86-64, version 1 (SYSV), dynamically linked, stripped",
      stderr: "",
      exit_code: 0
    },
    strings: {
      stdout: `/lib64/ld-linux-x86-64.so.2
libc.so.6
puts
__libc_start_main
GLIBC_2.2.5
Enter password: 
Wrong password!
Access granted!
CTF{str1ngs_r3v34l_s3cr3ts}
secret_function
check_password
main`,
      stderr: "",
      exit_code: 0
    },
    checksec: {
      stdout: `RELRO           STACK CANARY      NX            PIE             RPATH      RUNPATH
Partial RELRO   No canary found   NX enabled    No PIE          No RPATH   No RUNPATH`,
      stderr: "",
      exit_code: 0
    },
    objdump: {
      stdout: `challenge:     file format elf64-x86-64

0000000000401000 <main>:
  401000:       push   %rbp
  401001:       mov    %rsp,%rbp
  401008:       lea    0xff9(%rip),%rdi        # "Enter password:"
  40100f:       call   401030 <puts@plt>
  401014:       lea    -0x10(%rbp),%rdi
  401018:       call   401040 <gets@plt>        ; VULN: buffer overflow
  40101d:       lea    -0x10(%rbp),%rdi
  401021:       call   401060 <check_password>
  401026:       cmp    $0x1,%eax
  401029:       je     401040 <print_flag>`,
      stderr: "",
      exit_code: 0
    },
    ltrace: {
      stdout: `puts("Enter password: ") = 17
gets(0x7ffd12345678, 0, 0, 0) = 0x7ffd12345678
strcmp("test", "s3cr3t_p4ss") = -1
puts("Wrong password!") = 16`,
      stderr: "",
      exit_code: 0
    },
    ls: {
      stdout: `challenge\nREADME.txt`,
      stderr: "",
      exit_code: 0
    }
  },
  // Job 004 - Web SQL Injection
  'job-004': {
    file: {
      stdout: "app.py: Python script, ASCII text executable\nrequirements.txt: ASCII text",
      stderr: "",
      exit_code: 0
    },
    strings: {
      stdout: `from flask import Flask, request
import sqlite3

@app.route('/login', methods=['POST'])
def login():
    username = request.form['username']
    password = request.form['password']
    query = f"SELECT * FROM users WHERE username='{username}' AND password='{password}'"
    # SQL Injection vulnerable!
    
# Admin credentials in database
# username: admin, password: CTF{sql1_1nj3ct10n_w1ns}`,
      stderr: "",
      exit_code: 0
    },
    cat: {
      stdout: `# SQL Injection Challenge
# Target: http://localhost:5000/login
# Hint: The login form is vulnerable to SQL injection
# Payload: ' OR '1'='1' --

# Expected flag format: CTF{...}`,
      stderr: "",
      exit_code: 0
    },
    curl: {
      stdout: `{"message": "Login successful!", "flag": "CTF{sql1_1nj3ct10n_w1ns}"}`,
      stderr: "",
      exit_code: 0
    },
    grep: {
      stdout: `CTF{sql1_1nj3ct10n_w1ns}`,
      stderr: "",
      exit_code: 0
    },
    ls: {
      stdout: `app.py\nrequirements.txt\ndatabase.db\nREADME.txt`,
      stderr: "",
      exit_code: 0
    }
  },
  // Job 005 - PWN Buffer Overflow
  'job-005': {
    file: {
      stdout: "vuln: ELF 64-bit LSB executable, x86-64, version 1 (SYSV), dynamically linked, not stripped",
      stderr: "",
      exit_code: 0
    },
    checksec: {
      stdout: `RELRO           STACK CANARY      NX            PIE             RPATH      RUNPATH
No RELRO        No canary found   NX disabled   No PIE          No RPATH   No RUNPATH`,
      stderr: "",
      exit_code: 0
    },
    strings: {
      stdout: `/lib64/ld-linux-x86-64.so.2
gets
puts
system
/bin/sh
CTF{buff3r_0v3rfl0w_m4st3r}
win_function
main
vulnerable_function`,
      stderr: "",
      exit_code: 0
    },
    objdump: {
      stdout: `vuln:     file format elf64-x86-64

0000000000401156 <win_function>:
  401156:       push   %rbp
  401157:       mov    %rsp,%rbp
  40115a:       lea    0xe9f(%rip),%rdi        # "CTF{buff3r_0v3rfl0w_m4st3r}"
  401161:       call   401030 <puts@plt>
  401166:       leave
  401167:       ret

0000000000401168 <vulnerable_function>:
  401168:       push   %rbp
  401169:       mov    %rsp,%rbp
  40116c:       sub    $0x40,%rsp              # 64 byte buffer
  401170:       lea    -0x40(%rbp),%rax
  401174:       mov    %rax,%rdi
  401177:       call   401040 <gets@plt>       # VULN: no bounds check
  40117c:       leave
  40117d:       ret`,
      stderr: "",
      exit_code: 0
    },
    readelf: {
      stdout: `Symbol table '.symtab' contains 15 entries:
   Num:    Value          Size Type    Bind   Vis      Ndx Name
    10: 0000000000401156    18 FUNC    GLOBAL DEFAULT   14 win_function
    11: 0000000000401168    22 FUNC    GLOBAL DEFAULT   14 vulnerable_function
    12: 0000000000401180    35 FUNC    GLOBAL DEFAULT   14 main`,
      stderr: "",
      exit_code: 0
    },
    ls: {
      stdout: `vuln\nREADME.txt`,
      stderr: "",
      exit_code: 0
    }
  },
  // Job 006 - Misc Encoding
  'job-006': {
    file: {
      stdout: "encoded.txt: ASCII text",
      stderr: "",
      exit_code: 0
    },
    cat: {
      stdout: `Q1RGe20xeHQzdXJfM25jMGQxbmdfbTRzdDNyfQ==`,
      stderr: "",
      exit_code: 0
    },
    strings: {
      stdout: `Q1RGe20xeHQzdXJfM25jMGQxbmdfbTRzdDNyfQ==
# Hint: base64 -> flag`,
      stderr: "",
      exit_code: 0
    },
    base64: {
      stdout: `CTF{m1xt3ur_3nc0d1ng_m4st3r}`,
      stderr: "",
      exit_code: 0
    },
    xxd: {
      stdout: `00000000: 5131 5247 6532 3031 6548 5130 6458 5666  Q1RGe20xeHQzdXJf
00000010: 4d32 356a 4d47 5178 626d 6466 6254 5274  M25jMGQxbmdfbTRt
00000020: 4d33 4a39                                M3J9`,
      stderr: "",
      exit_code: 0
    },
    ls: {
      stdout: `encoded.txt\nREADME.txt`,
      stderr: "",
      exit_code: 0
    }
  }
};

// Default mock outputs when job not found
const defaultMockOutputs: Record<string, { stdout: string; stderr: string; exit_code: number }> = {
  file: {
    stdout: "ELF 64-bit LSB executable, x86-64, version 1 (SYSV), dynamically linked, stripped",
    stderr: "",
    exit_code: 0
  },
  strings: {
    stdout: `[Mock strings output]
CTF{m0ck_fl4g_h3r3}`,
    stderr: "",
    exit_code: 0
  },
  ls: {
    stdout: `challenge\nREADME.txt`,
    stderr: "",
    exit_code: 0
  },
  checksec: {
    stdout: `RELRO           STACK CANARY      NX            PIE
Partial RELRO   No canary found   NX enabled    No PIE`,
    stderr: "",
    exit_code: 0
  }
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
    const { job_id, tool, args } = body;

    console.log('[sandbox-terminal] Executing:', { job_id, tool, args });

    if (!tool) {
      return new Response(JSON.stringify({ error: 'Missing tool parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get job-specific mock output first, then fallback to default
    const jobOutputs = jobMockOutputs[job_id] || {};
    let result = jobOutputs[tool] || defaultMockOutputs[tool] || {
      stdout: `[Mock] ${tool} ${(args || []).join(' ')}`,
      stderr: "",
      exit_code: 0
    };

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
