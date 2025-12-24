import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mock command outputs for demo purposes when Docker backend is not available
const mockOutputs: Record<string, Record<string, { stdout: string; stderr: string; exit_code: number }>> = {
  file: {
    default: {
      stdout: "ELF 64-bit LSB executable, x86-64, version 1 (SYSV), dynamically linked, stripped",
      stderr: "",
      exit_code: 0
    }
  },
  strings: {
    default: {
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
    }
  },
  objdump: {
    default: {
      stdout: `challenge:     file format elf64-x86-64

Disassembly of section .text:

0000000000401000 <main>:
  401000:       55                      push   %rbp
  401001:       48 89 e5                mov    %rsp,%rbp
  401004:       48 83 ec 10             sub    $0x10,%rsp
  401008:       48 8d 3d f9 0f 00 00    lea    0xff9(%rip),%rdi
  40100f:       e8 1c 00 00 00          callq  401030 <puts@plt>
  401014:       48 8d 7d f0             lea    -0x10(%rbp),%rdi
  401018:       e8 23 00 00 00          callq  401040 <gets@plt>
  40101d:       48 8d 7d f0             lea    -0x10(%rbp),%rdi
  401021:       e8 0a 00 00 00          callq  401030 <check_password>`,
      stderr: "",
      exit_code: 0
    }
  },
  checksec: {
    default: {
      stdout: `RELRO           STACK CANARY      NX            PIE             RPATH      RUNPATH      Symbols         FORTIFY
Partial RELRO   No canary found   NX enabled    No PIE          No RPATH   No RUNPATH   No Symbols      No`,
      stderr: "",
      exit_code: 0
    }
  },
  readelf: {
    default: {
      stdout: `ELF Header:
  Magic:   7f 45 4c 46 02 01 01 00 00 00 00 00 00 00 00 00 
  Class:                             ELF64
  Data:                              2's complement, little endian
  Version:                           1 (current)
  OS/ABI:                            UNIX - System V
  Type:                              EXEC (Executable file)
  Machine:                           Advanced Micro Devices X86-64
  Entry point address:               0x401000`,
      stderr: "",
      exit_code: 0
    }
  },
  hexdump: {
    default: {
      stdout: `00000000  7f 45 4c 46 02 01 01 00  00 00 00 00 00 00 00 00  |.ELF............|
00000010  02 00 3e 00 01 00 00 00  00 10 40 00 00 00 00 00  |..>.......@.....|
00000020  40 00 00 00 00 00 00 00  00 00 00 00 00 00 00 00  |@...............|`,
      stderr: "",
      exit_code: 0
    }
  },
  xxd: {
    default: {
      stdout: `00000000: 7f45 4c46 0201 0100 0000 0000 0000 0000  .ELF............
00000010: 0200 3e00 0100 0000 0010 4000 0000 0000  ..>.......@.....
00000020: 4000 0000 0000 0000 0000 0000 0000 0000  @...............`,
      stderr: "",
      exit_code: 0
    }
  },
  nm: {
    default: {
      stdout: `nm: challenge: no symbols`,
      stderr: "",
      exit_code: 1
    }
  },
  ltrace: {
    default: {
      stdout: `puts("Enter password: ") = 17
gets(0x7ffd12345678, 0, 0, 0) = 0x7ffd12345678
strcmp("test", "s3cr3t_p4ss") = -1
puts("Wrong password!") = 16`,
      stderr: "",
      exit_code: 0
    }
  },
  strace: {
    default: {
      stdout: `execve("./challenge", ["./challenge"], 0x7ffd...) = 0
brk(NULL) = 0x5555557f3000
write(1, "Enter password: ", 16) = 16
read(0, "test\\n", 1024) = 5
write(1, "Wrong password!\\n", 16) = 16
exit_group(1) = ?`,
      stderr: "",
      exit_code: 0
    }
  },
  grep: {
    default: {
      stdout: `Binary file challenge matches`,
      stderr: "",
      exit_code: 0
    }
  },
  cat: {
    default: {
      stdout: `# Challenge Binary
This is a reverse engineering challenge.
Find the hidden flag inside the binary.`,
      stderr: "",
      exit_code: 0
    }
  },
  ls: {
    default: {
      stdout: `challenge
README.txt`,
      stderr: "",
      exit_code: 0
    }
  },
  binwalk: {
    default: {
      stdout: `DECIMAL       HEXADECIMAL     DESCRIPTION
--------------------------------------------------------------------------------
0             0x0             ELF, 64-bit LSB executable, AMD x86-64, version 1 (SYSV)`,
      stderr: "",
      exit_code: 0
    }
  },
  r2: {
    default: {
      stdout: `[0x00401000]> aaa
[x] Analyze all flags starting with sym. and entry0
[0x00401000]> afl
0x00401000    1 87           main
0x00401060    1 42           check_password
0x00401090    1 6            entry0
[0x00401000]> pdf @ main
            ; DATA XREF from entry0
            ;-- main:
            0x00401000      push rbp
            0x00401001      mov rbp, rsp
            0x00401004      sub rsp, 0x10
            0x00401008      lea rdi, str.Enter_password:
            0x0040100f      call sym.imp.puts
            0x00401014      lea rdi, [rbp - 0x10]
            0x00401018      call sym.imp.gets          ; dangerous!
            0x0040101d      lea rdi, [rbp - 0x10]
            0x00401021      call check_password`,
      stderr: "",
      exit_code: 0
    }
  }
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // Expected path: /sandbox-terminal or with job_id in body
    console.log('[sandbox-terminal] Request path:', url.pathname);
    console.log('[sandbox-terminal] Method:', req.method);

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

    // Get mock output for the tool
    const toolOutputs = mockOutputs[tool];
    let result = toolOutputs?.default || {
      stdout: `[Mock] ${tool} ${(args || []).join(' ')}`,
      stderr: "",
      exit_code: 0
    };

    // Special handling for certain tools with specific args
    if (tool === 'grep' && args?.some((a: string) => a.includes('CTF{'))) {
      result = {
        stdout: "CTF{str1ngs_r3v34l_s3cr3ts}",
        stderr: "",
        exit_code: 0
      };
    }

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

    console.log('[sandbox-terminal] Result:', { 
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
