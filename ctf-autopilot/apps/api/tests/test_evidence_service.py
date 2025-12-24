import pytest
import re

from app.services.evidence_service import EvidenceService


class TestEvidenceService:
    """Tests for flag extraction."""
    
    def setup_method(self):
        self.service = EvidenceService()
    
    def test_extract_standard_flag(self):
        """Standard CTF{} format should be extracted."""
        command_results = [{
            "command_id": "cmd_001",
            "tool": "strings",
            "stdout": "Some text\nCTF{this_is_a_flag}\nMore text",
        }]
        
        candidates = self.service.extract_flags(
            job_id="test",
            command_results=command_results,
        )
        
        assert len(candidates) == 1
        assert candidates[0]["value"] == "CTF{this_is_a_flag}"
    
    def test_extract_custom_flag_format(self):
        """Custom flag format should be extracted."""
        command_results = [{
            "command_id": "cmd_001",
            "tool": "strings",
            "stdout": "CUSTOM{my_custom_flag}",
        }]
        
        candidates = self.service.extract_flags(
            job_id="test",
            command_results=command_results,
            custom_pattern=r"CUSTOM\{[^}]+\}",
        )
        
        assert len(candidates) >= 1
        assert any(c["value"] == "CUSTOM{my_custom_flag}" for c in candidates)
    
    def test_no_duplicates(self):
        """Same flag should not be extracted multiple times."""
        command_results = [
            {
                "command_id": "cmd_001",
                "tool": "strings",
                "stdout": "CTF{same_flag}\nCTF{same_flag}",
            },
            {
                "command_id": "cmd_002",
                "tool": "cat",
                "stdout": "CTF{same_flag}",
            },
        ]
        
        candidates = self.service.extract_flags(
            job_id="test",
            command_results=command_results,
        )
        
        values = [c["value"] for c in candidates]
        assert values.count("CTF{same_flag}") == 1
    
    def test_confidence_scoring(self):
        """Confidence should vary based on context."""
        # Flag in clean text should have higher confidence
        clean_result = [{
            "command_id": "cmd_001",
            "tool": "strings",
            "stdout": "The flag is CTF{clean_flag} here",
        }]
        
        # Flag in binary garbage should have lower confidence
        noisy_result = [{
            "command_id": "cmd_001",
            "tool": "xxd",
            "stdout": "00000000: 89504e47 CTF{noisy_flag} 0a1a0a00",
        }]
        
        clean_candidates = self.service.extract_flags("test", clean_result)
        noisy_candidates = self.service.extract_flags("test", noisy_result)
        
        if clean_candidates and noisy_candidates:
            assert clean_candidates[0]["confidence"] >= noisy_candidates[0]["confidence"]
    
    def test_invalid_regex_handling(self):
        """Invalid regex patterns should be handled gracefully."""
        command_results = [{
            "command_id": "cmd_001",
            "tool": "strings",
            "stdout": "CTF{normal_flag}",
        }]
        
        # Invalid regex should not crash, just be ignored
        candidates = self.service.extract_flags(
            job_id="test",
            command_results=command_results,
            custom_pattern="[invalid(regex",  # Unbalanced brackets
        )
        
        # Should still extract default patterns
        assert len(candidates) >= 1


class TestRegexPatterns:
    """Test regex pattern compilation."""
    
    def test_default_patterns_valid(self):
        """All default patterns should compile."""
        service = EvidenceService()
        
        for pattern_str in service.default_flag_patterns:
            try:
                re.compile(pattern_str)
            except re.error:
                pytest.fail(f"Invalid pattern: {pattern_str}")
    
    def test_custom_pattern_validation(self):
        """Custom patterns should be validated."""
        from pydantic import ValidationError
        from app.schemas import JobCreate
        
        # Valid pattern
        job = JobCreate(
            title="Test",
            description="Test description",
            flag_format=r"CUSTOM\{[a-z]+\}",
        )
        assert job.flag_format == r"CUSTOM\{[a-z]+\}"
        
        # Invalid pattern
        with pytest.raises(ValidationError):
            JobCreate(
                title="Test",
                description="Test description",
                flag_format="[invalid(pattern",
            )
