"""AI-powered analysis service for CTF challenge solving."""

from pathlib import Path
from typing import Dict, List, Optional, Tuple
from uuid import UUID
import httpx
import json
import re

from app.config import settings


class AIAnalysisService:
    """Service for AI-powered CTF analysis using MegaLLM API."""
    
    # Category detection patterns
    CATEGORY_PATTERNS = {
        'binary': {
            'file_signatures': ['ELF', 'PE32', 'Mach-O', 'executable'],
            'extensions': ['.elf', '.exe', '.out', '.bin', '.dll', '.so'],
            'strings_hints': ['GLIBC', 'libc', 'main', 'printf', 'scanf', 'gets', 'strcpy'],
        },
        'crypto': {
            'file_signatures': ['PGP', 'GPG', 'encrypted'],
            'extensions': ['.enc', '.gpg', '.aes', '.rsa', '.pem', '.key'],
            'strings_hints': ['BEGIN RSA', 'BEGIN PGP', 'AES', 'RSA', 'cipher', 'hash'],
        },
        'forensics': {
            'file_signatures': ['data', 'archive', 'filesystem'],
            'extensions': ['.dd', '.img', '.raw', '.dump', '.mem', '.vmem'],
            'strings_hints': ['MFT', 'NTFS', 'FAT32', 'ext4', 'inode'],
        },
        'network': {
            'file_signatures': ['pcap', 'tcpdump', 'Wireshark'],
            'extensions': ['.pcap', '.pcapng', '.cap'],
            'strings_hints': ['HTTP', 'TCP', 'UDP', 'GET', 'POST', 'User-Agent'],
        },
        'stego': {
            'file_signatures': ['image', 'PNG', 'JPEG', 'GIF', 'BMP', 'audio', 'WAVE'],
            'extensions': ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.wav', '.mp3'],
            'strings_hints': ['IHDR', 'IDAT', 'IEND', 'JFIF', 'Exif'],
        },
        'web': {
            'file_signatures': ['HTML', 'text'],
            'extensions': ['.html', '.php', '.js', '.css', '.sql'],
            'strings_hints': ['DOCTYPE', 'script', 'SELECT', 'INSERT', 'WHERE'],
        },
        'misc': {
            'file_signatures': [],
            'extensions': ['.txt', '.py', '.java', '.c', '.cpp'],
            'strings_hints': [],
        },
    }
    
    ANALYST_SYSTEM_PROMPT = """You are an expert CTF (Capture The Flag) analyst. Your job is to analyze command outputs and determine the best next steps to find the flag.

CRITICAL RULES:
1. Always suggest concrete, executable commands with exact arguments
2. Base suggestions on actual output patterns you observe
3. Focus on finding the flag - look for patterns like CTF{}, FLAG{}, flag{}, etc.
4. If you see encoded data, suggest decoding steps
5. If you see files within files, suggest extraction
6. Be persistent - errors just mean try another approach
7. Consider what category the challenge is (crypto, forensics, pwn, web, stego, reversing)

Your response MUST be valid JSON with this exact structure:
{
  "analysis": "Brief analysis of what you see in the outputs",
  "category": "detected challenge category (binary|crypto|forensics|network|stego|web|misc)",
  "confidence": 0.0-1.0,
  "findings": ["list of interesting findings"],
  "next_commands": [
    {"tool": "command_name", "args": ["arg1", "arg2"], "reason": "why this command helps"}
  ],
  "flag_candidates": ["any potential flags found"],
  "should_continue": true/false
}"""

    ANALYST_USER_TEMPLATE = """Analyze these CTF challenge outputs and suggest next steps.

## Files in workspace:
{file_list}

## Previous command outputs (most recent first):
{command_history}

## What we know so far:
- Challenge description: {description}
- Expected flag format: {flag_format}
- Current detected category: {current_category}
- Attempt number: {attempt_number}

Analyze the outputs and suggest 1-3 specific commands to try next. Focus on finding the flag."""

    async def analyze_and_suggest(
        self,
        files: List[str],
        command_history: List[Dict],
        description: str = "",
        flag_format: str = "CTF{...}",
        current_category: str = "unknown",
        attempt_number: int = 1,
    ) -> Dict:
        """Analyze outputs and suggest next commands using AI."""
        
        # Format command history
        history_text = self._format_command_history(command_history)
        
        # Build user prompt
        user_prompt = self.ANALYST_USER_TEMPLATE.format(
            file_list="\n".join(f"- {f}" for f in files),
            command_history=history_text,
            description=description or "No description provided",
            flag_format=flag_format,
            current_category=current_category,
            attempt_number=attempt_number,
        )
        
        # If LLM not enabled, use rule-based fallback
        if not settings.llm_enabled:
            return self._rule_based_analysis(
                files, command_history, current_category, attempt_number
            )
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    settings.megallm_api_url,
                    headers={
                        "Authorization": f"Bearer {settings.megallm_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": settings.megallm_model,
                        "messages": [
                            {"role": "system", "content": self.ANALYST_SYSTEM_PROMPT},
                            {"role": "user", "content": user_prompt},
                        ],
                        "temperature": 0.2,
                        "max_tokens": 1500,
                    },
                )
                
                response.raise_for_status()
                result = response.json()
            
            content = result["choices"][0]["message"]["content"]
            
            # Parse JSON response
            analysis = self._parse_ai_response(content)
            return analysis
            
        except Exception as e:
            # Fallback to rule-based
            return self._rule_based_analysis(
                files, command_history, current_category, attempt_number,
                error=str(e)
            )
    
    def detect_category(
        self,
        files: List[str],
        file_outputs: Dict[str, str],
        strings_outputs: Dict[str, str],
    ) -> Tuple[str, float]:
        """Detect challenge category from file analysis outputs."""
        
        scores = {cat: 0.0 for cat in self.CATEGORY_PATTERNS}
        
        for filename in files:
            ext = Path(filename).suffix.lower()
            file_output = file_outputs.get(filename, "")
            strings_output = strings_outputs.get(filename, "")
            
            for category, patterns in self.CATEGORY_PATTERNS.items():
                # Check extension
                if ext in patterns['extensions']:
                    scores[category] += 2.0
                
                # Check file signature
                for sig in patterns['file_signatures']:
                    if sig.lower() in file_output.lower():
                        scores[category] += 1.5
                
                # Check strings hints
                for hint in patterns['strings_hints']:
                    if hint in strings_output:
                        scores[category] += 0.5
        
        # Get best category
        if not any(scores.values()):
            return 'misc', 0.3
        
        best_category = max(scores, key=scores.get)
        max_score = scores[best_category]
        
        # Normalize confidence
        confidence = min(max_score / 10.0, 1.0)
        
        return best_category, confidence
    
    def _format_command_history(self, command_history: List[Dict]) -> str:
        """Format command history for prompt."""
        if not command_history:
            return "No commands executed yet."
        
        sections = []
        for cmd in command_history[-10:]:  # Last 10 commands
            output = cmd.get('stdout', '')[:1500]  # Truncate
            error = cmd.get('stderr', '')[:500]
            
            section = f"""### Command: {cmd.get('tool', 'unknown')} {' '.join(cmd.get('args', []))}
Exit code: {cmd.get('exit_code', 'unknown')}

Output:
```
{output if output else '(no output)'}
```"""
            if error:
                section += f"""
Stderr:
```
{error}
```"""
            sections.append(section)
        
        return "\n\n".join(sections)
    
    def _parse_ai_response(self, content: str) -> Dict:
        """Parse AI response JSON."""
        try:
            # Try to find JSON in response
            json_match = re.search(r'\{[\s\S]*\}', content)
            if json_match:
                return json.loads(json_match.group())
        except json.JSONDecodeError:
            pass
        
        # Fallback response
        return {
            "analysis": content[:500],
            "category": "unknown",
            "confidence": 0.3,
            "findings": [],
            "next_commands": [],
            "flag_candidates": [],
            "should_continue": True,
            "parse_error": True,
        }
    
    def _rule_based_analysis(
        self,
        files: List[str],
        command_history: List[Dict],
        current_category: str,
        attempt_number: int,
        error: str = None,
    ) -> Dict:
        """Rule-based fallback when LLM is not available."""
        
        # Analyze outputs for patterns
        findings = []
        flag_candidates = []
        next_commands = []
        
        for cmd in command_history:
            output = cmd.get('stdout', '')
            
            # Look for flags
            flag_patterns = [
                r'[A-Z]{2,10}\{[^}]{1,100}\}',
                r'flag\{[^}]+\}',
                r'CTF\{[^}]+\}',
            ]
            for pattern in flag_patterns:
                matches = re.findall(pattern, output, re.IGNORECASE)
                flag_candidates.extend(matches)
            
            # Look for interesting patterns
            if 'base64' in output.lower() or re.search(r'^[A-Za-z0-9+/]{20,}={0,2}$', output, re.MULTILINE):
                findings.append("Detected base64 encoded data")
            if 'password' in output.lower():
                findings.append("Found password reference")
            if 'hidden' in output.lower():
                findings.append("Found 'hidden' keyword")
        
        # Generate next commands based on category and attempt
        if current_category == 'stego' or any(f.endswith(('.png', '.jpg', '.jpeg')) for f in files):
            next_commands = [
                {"tool": "zsteg", "args": ["-a", files[0]], "reason": "Check LSB steganography"},
                {"tool": "steghide", "args": ["extract", "-sf", files[0], "-p", ""], "reason": "Try empty password"},
                {"tool": "exiftool", "args": ["-a", "-u", files[0]], "reason": "Check all metadata"},
            ]
        elif current_category == 'binary':
            next_commands = [
                {"tool": "checksec", "args": ["--file=" + files[0]], "reason": "Check binary protections"},
                {"tool": "radare2", "args": ["-qc", "aaa;afl", files[0]], "reason": "Analyze functions"},
                {"tool": "strings", "args": ["-n", "10", files[0]], "reason": "Extract longer strings"},
            ]
        elif current_category == 'crypto':
            next_commands = [
                {"tool": "base64", "args": ["-d", files[0]], "reason": "Try base64 decode"},
                {"tool": "xxd", "args": [files[0]], "reason": "View hex dump"},
                {"tool": "openssl", "args": ["enc", "-d", "-aes-256-cbc", "-in", files[0]], "reason": "Try common decryption"},
            ]
        else:
            # Default analysis
            next_commands = [
                {"tool": "strings", "args": ["-n", "8", files[0]], "reason": "Extract strings"},
                {"tool": "binwalk", "args": ["-e", files[0]], "reason": "Extract embedded files"},
                {"tool": "grep", "args": ["-aoE", "[A-Z]{2,10}\\{[^}]+\\}", files[0]], "reason": "Search for flag pattern"},
            ]
        
        return {
            "analysis": f"Rule-based analysis (LLM unavailable: {error or 'not configured'})",
            "category": current_category,
            "confidence": 0.5,
            "findings": findings,
            "next_commands": next_commands[:3],  # Limit to 3 commands
            "flag_candidates": list(set(flag_candidates)),
            "should_continue": attempt_number < 50 and not flag_candidates,
            "rule_based": True,
        }


ai_analysis_service = AIAnalysisService()
