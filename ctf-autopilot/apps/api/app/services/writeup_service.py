from pathlib import Path
from typing import Dict, List
from uuid import UUID
import httpx
import json
import re

from app.config import settings


class WriteupService:
    """Service for generating writeups using MegaLLM API."""
    
    SYSTEM_PROMPT = """You are a professional CTF writeup generator. You create clear, technical writeups based ONLY on the provided evidence.

CRITICAL RULES:
1. You MUST only reference commands and outputs from the evidence pack provided
2. You MUST NOT invent or assume any commands, tools, or outputs not in the evidence
3. Every claim MUST cite the specific command_id from the evidence
4. If the flag is not definitively found, say so clearly
5. Use markdown formatting for readability

Your writeup should follow this structure:
- **Overview**: Brief challenge description
- **Reconnaissance**: Initial analysis steps taken (cite command_ids)
- **Analysis Steps**: Detailed walkthrough with evidence
- **Findings**: Key discoveries with citations
- **Flag Candidates**: List candidates with confidence and evidence
- **Reproduction Steps**: How to reproduce the analysis"""

    USER_PROMPT_TEMPLATE = """Generate a professional CTF writeup based on the following evidence pack.

## Challenge Information
Title: {title}
Description:
{description}

## Evidence Pack
The following commands were executed and their outputs recorded:

{commands_section}

## Flag Candidates Found
{candidates_section}

## Instructions
1. Write a clear, professional writeup
2. Cite specific command_ids for every claim (e.g., "Evidence: cmd_001")
3. Do NOT mention any commands or tools not listed above
4. If candidates look valid, explain why based on the evidence
5. If no clear flag was found, explain what was discovered

Generate the writeup now:"""

    async def generate_writeup(
        self,
        job_id: UUID,
        title: str,
        description: str,
        evidence_pack: Dict,
    ) -> str:
        """Generate writeup using MegaLLM API."""
        # Format commands section
        commands_section = self._format_commands(evidence_pack.get("commands", []))
        
        # Format candidates section
        candidates_section = self._format_candidates(evidence_pack.get("candidates", []))
        
        # Build user prompt
        user_prompt = self.USER_PROMPT_TEMPLATE.format(
            title=title,
            description=description,
            commands_section=commands_section,
            candidates_section=candidates_section,
        )
        
        # Call MegaLLM API
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                settings.megallm_api_url,
                headers={
                    "Authorization": f"Bearer {settings.megallm_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "megallm-pro",
                    "messages": [
                        {"role": "system", "content": self.SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.3,
                    "max_tokens": 4000,
                },
            )
            
            response.raise_for_status()
            result = response.json()
        
        writeup = result["choices"][0]["message"]["content"]
        
        # Validate writeup doesn't reference unknown commands
        writeup = self._validate_writeup(writeup, evidence_pack)
        
        # Save writeup
        self._save_writeup(job_id, writeup)
        
        return writeup
    
    def _format_commands(self, commands: List[Dict]) -> str:
        """Format commands for the prompt."""
        sections = []
        
        for cmd in commands:
            section = f"""### Command: {cmd.get('command_id')}
Tool: {cmd.get('tool')}
Arguments: {' '.join(cmd.get('arguments', []))}
Exit Code: {cmd.get('exit_code')}

Output (truncated):
```
{cmd.get('stdout_preview', 'No output')}
```
"""
            if cmd.get('stderr_preview'):
                section += f"""
Stderr:
```
{cmd.get('stderr_preview')}
```
"""
            sections.append(section)
        
        return '\n'.join(sections)
    
    def _format_candidates(self, candidates: List[Dict]) -> str:
        """Format flag candidates for the prompt."""
        if not candidates:
            return "No flag candidates found."
        
        sections = []
        for i, candidate in enumerate(candidates, 1):
            section = f"""{i}. **{candidate.get('value')}**
   - Confidence: {candidate.get('confidence', 0):.2f}
   - Source: {candidate.get('source')}
   - Evidence: {candidate.get('evidence_id')}
   - Context: {candidate.get('context', 'N/A')[:200]}
"""
            sections.append(section)
        
        return '\n'.join(sections)
    
    def _validate_writeup(self, writeup: str, evidence_pack: Dict) -> str:
        """Validate that writeup only references known commands."""
        known_ids = set(evidence_pack.get("command_ids", []))
        
        # Find all command_id references in writeup
        referenced_ids = set(re.findall(r'cmd_\d+', writeup))
        
        # Check for unknown references
        unknown_ids = referenced_ids - known_ids
        
        if unknown_ids:
            warning = f"\n\n---\n**Warning**: This writeup may contain hallucinated command references: {unknown_ids}\n"
            writeup = writeup + warning
        
        return writeup
    
    def _save_writeup(self, job_id: UUID, writeup: str) -> None:
        """Save writeup to file."""
        job_dir = Path(settings.runs_dir) / str(job_id)
        job_dir.mkdir(parents=True, exist_ok=True)
        
        report_path = job_dir / "report.md"
        with open(report_path, 'w') as f:
            f.write(writeup)
