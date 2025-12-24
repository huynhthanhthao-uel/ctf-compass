import pytest
from pathlib import Path
import tempfile
import zipfile
import os

from app.services.file_service import FileService


class TestFileService:
    """Tests for file upload security."""
    
    def setup_method(self):
        self.service = FileService()
    
    def test_sanitize_filename_normal(self):
        """Normal filenames should pass through."""
        assert self.service.sanitize_filename("test.txt") == "test.txt"
        assert self.service.sanitize_filename("my-file_123.py") == "my-file_123.py"
    
    def test_sanitize_filename_path_traversal(self):
        """Path traversal attempts should be rejected."""
        with pytest.raises(ValueError):
            self.service.sanitize_filename("../../../etc/passwd")
        
        with pytest.raises(ValueError):
            self.service.sanitize_filename("..\\..\\windows\\system32")
        
        with pytest.raises(ValueError):
            self.service.sanitize_filename("/etc/passwd")
    
    def test_sanitize_filename_special_chars(self):
        """Special characters should be replaced."""
        result = self.service.sanitize_filename("test<>file.txt")
        assert "<" not in result
        assert ">" not in result
    
    def test_sanitize_filename_hidden_files(self):
        """Hidden files (starting with .) should have dot removed."""
        result = self.service.sanitize_filename(".hidden")
        assert not result.startswith(".")
    
    def test_zip_slip_prevention(self):
        """Zip slip attacks should be prevented."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create malicious zip
            zip_path = Path(tmpdir) / "malicious.zip"
            dest_path = Path(tmpdir) / "extracted"
            dest_path.mkdir()
            
            with zipfile.ZipFile(zip_path, 'w') as zf:
                # Try to write outside extraction directory
                zf.writestr("../../../etc/malicious", "evil content")
            
            # Extraction should handle this safely
            import asyncio
            
            with pytest.raises(ValueError, match="Path traversal"):
                asyncio.run(self.service._safe_extract_zip(zip_path, dest_path))
    
    def test_allowed_extensions(self):
        """Only allowed extensions should pass validation."""
        from app.config import settings
        
        # These should be in the allowed list
        assert ".txt" in settings.allowed_extensions_list
        assert ".py" in settings.allowed_extensions_list
        assert ".zip" in settings.allowed_extensions_list


class TestPathSanitization:
    """Additional path sanitization tests."""
    
    def setup_method(self):
        self.service = FileService()
    
    def test_null_byte_injection(self):
        """Null bytes should be rejected."""
        with pytest.raises(ValueError):
            self.service.sanitize_filename("file.txt\x00.exe")
    
    def test_unicode_normalization(self):
        """Unicode tricks should be handled."""
        # Some unicode chars can be confused with path separators
        result = self.service.sanitize_filename("test\u2215file.txt")  # Division slash
        assert "/" not in result
        assert "\\" not in result
    
    def test_very_long_filename(self):
        """Very long filenames should be truncated."""
        long_name = "a" * 500 + ".txt"
        result = self.service.sanitize_filename(long_name)
        assert len(result) <= 200
