from pathlib import Path
from typing import List, Dict
from uuid import UUID
import re
import json

from app.config import settings


class EvidenceService:
    """Service for extracting evidence and flag candidates."""
    
    def __init__(self):
        self.default_flag_patterns = [
            r"CTF\{[^}]+\}",
            r"FLAG\{[^}]+\}",
            r"flag\{[^}]+\}",
            r"ctf\{[^}]+\}",
        ]
    
    def extract_flags(
        self,
        job_id: UUID,
        command_results: List[Dict],
        custom_pattern: str = None,
    ) -> List[Dict]:
        """Extract flag candidates from command outputs."""
        candidates = []
        seen_values = set()
        
        # Compile patterns
        patterns = []
        if custom_pattern:
            try:
                patterns.append(re.compile(custom_pattern, re.IGNORECASE))
            except re.error:
                pass
        
        for pattern_str in self.default_flag_patterns:
            patterns.append(re.compile(pattern_str))
        
        for result in command_results:
            stdout = result.get("stdout", "")
            command_id = result.get("command_id", "")
            tool = result.get("tool", "")
            
            for pattern in patterns:
                matches = pattern.findall(stdout)
                
                for match in matches:
                    if match in seen_values:
                        continue
                    
                    seen_values.add(match)
                    
                    # Calculate confidence based on source
                    confidence = self._calculate_confidence(match, tool, stdout)
                    
                    # Get context around the match
                    context = self._extract_context(stdout, match)
                    
                    candidates.append({
                        "value": match,
                        "confidence": confidence,
                        "source": f"{tool} output",
                        "evidence_id": command_id,
                        "context": context,
                    })
        
        # Sort by confidence
        candidates.sort(key=lambda x: x["confidence"], reverse=True)
        
        return candidates
    
    def _calculate_confidence(
        self,
        match: str,
        tool: str,
        output: str,
    ) -> float:
        """Calculate confidence score for a flag candidate."""
        confidence = 0.5  # Base confidence
        
        # Higher confidence for decoded/text outputs
        if tool in ["strings", "base64", "pdftotext"]:
            confidence += 0.2
        
        # Higher confidence if flag-like structure
        if re.match(r'^[A-Z]+\{[a-zA-Z0-9_-]+\}$', match):
            confidence += 0.2
        
        # Lower confidence for very short or very long flags
        inner = re.search(r'\{([^}]+)\}', match)
        if inner:
            inner_len = len(inner.group(1))
            if inner_len < 5:
                confidence -= 0.2
            elif inner_len > 100:
                confidence -= 0.3
        
        # Lower confidence if surrounded by random-looking data
        lines = output.split('\n')
        for line in lines:
            if match in line:
                # Check if line looks like readable text
                readable_ratio = sum(1 for c in line if c.isalnum() or c.isspace()) / max(len(line), 1)
                if readable_ratio < 0.5:
                    confidence -= 0.2
                break
        
        return max(0.1, min(1.0, confidence))
    
    def _extract_context(self, output: str, match: str, context_lines: int = 2) -> str:
        """Extract context around a match."""
        lines = output.split('\n')
        
        for i, line in enumerate(lines):
            if match in line:
                start = max(0, i - context_lines)
                end = min(len(lines), i + context_lines + 1)
                context = '\n'.join(lines[start:end])
                
                # Truncate if too long
                if len(context) > 500:
                    context = context[:500] + "..."
                
                return context
        
        return ""
    
    def save_evidence(
        self,
        job_id: UUID,
        command_results: List[Dict],
        candidates: List[Dict],
    ) -> None:
        """Save evidence and candidates to files."""
        job_dir = Path(settings.runs_dir) / str(job_id)
        output_dir = job_dir / "output"
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Save command results
        evidence_path = job_dir / "evidence.json"
        with open(evidence_path, 'w') as f:
            json.dump({
                "commands": command_results,
                "total_commands": len(command_results),
            }, f, indent=2, default=str)
        
        # Save flag candidates
        flags_path = job_dir / "flags.json"
        with open(flags_path, 'w') as f:
            json.dump({
                "candidates": candidates,
                "total_candidates": len(candidates),
            }, f, indent=2)
    
    def build_evidence_pack(
        self,
        job_id: UUID,
        command_results: List[Dict],
        candidates: List[Dict],
    ) -> Dict:
        """Build evidence pack for writeup generation."""
        # Truncate outputs to avoid overwhelming the LLM
        truncated_commands = []
        
        for cmd in command_results:
            truncated = {
                "command_id": cmd.get("command_id"),
                "tool": cmd.get("tool"),
                "arguments": cmd.get("arguments"),
                "exit_code": cmd.get("exit_code"),
                "stdout_preview": cmd.get("stdout", "")[:2000],
                "stderr_preview": cmd.get("stderr", "")[:500] if cmd.get("stderr") else "",
            }
            truncated_commands.append(truncated)
        
        return {
            "commands": truncated_commands,
            "candidates": candidates,
            "command_ids": [c.get("command_id") for c in command_results],
        }
