from fastapi import UploadFile
from pathlib import Path
from typing import List
from uuid import UUID
import mimetypes
import hashlib
import zipfile
import os
import re

from app.config import settings
from app.schemas import ArtifactInfo


class FileService:
    """Service for handling file uploads and storage."""
    
    DANGEROUS_PATTERNS = [
        r'\.\./',          # Path traversal
        r'\.\.\\',         # Windows path traversal
        r'^/',             # Absolute paths
        r'^[A-Za-z]:',     # Windows absolute paths
        r'[\x00-\x1f]',    # Control characters
    ]
    
    async def validate_file(self, file: UploadFile) -> None:
        """Validate uploaded file."""
        if not file.filename:
            raise ValueError("Filename is required")
        
        # Sanitize filename
        safe_name = self.sanitize_filename(file.filename)
        if not safe_name:
            raise ValueError("Invalid filename")
        
        # Check extension
        ext = Path(safe_name).suffix.lower()
        if ext not in settings.allowed_extensions_list:
            raise ValueError(f"File type not allowed: {ext}")
        
        # Check size
        content = await file.read()
        await file.seek(0)  # Reset for later reading
        
        if len(content) > settings.max_upload_size_bytes:
            raise ValueError(
                f"File too large. Maximum size: {settings.max_upload_size_mb}MB"
            )
        
        # Verify MIME type matches extension (basic check)
        mime_type, _ = mimetypes.guess_type(safe_name)
        file_mime = file.content_type
        
        # Allow some flexibility for archives
        if ext in ['.zip', '.tar', '.gz'] and file_mime:
            if 'application' not in file_mime and 'octet-stream' not in file_mime:
                raise ValueError("MIME type mismatch for archive")
    
    def sanitize_filename(self, filename: str) -> str:
        """Sanitize filename to prevent path traversal."""
        # Check for dangerous patterns
        for pattern in self.DANGEROUS_PATTERNS:
            if re.search(pattern, filename):
                raise ValueError(f"Dangerous pattern in filename: {filename}")
        
        # Get just the filename, no path
        name = Path(filename).name
        
        # Remove or replace problematic characters
        safe_name = re.sub(r'[^\w\-_\.]', '_', name)
        
        # Prevent hidden files
        safe_name = safe_name.lstrip('.')
        
        # Limit length
        if len(safe_name) > 200:
            base = Path(safe_name).stem[:190]
            ext = Path(safe_name).suffix
            safe_name = base + ext
        
        return safe_name
    
    async def save_files(self, job_id: UUID, files: List[UploadFile]) -> List[str]:
        """Save uploaded files to job directory."""
        job_dir = self.get_job_dir(job_id)
        input_dir = job_dir / "input"
        input_dir.mkdir(parents=True, exist_ok=True)
        
        # Set restrictive permissions
        os.chmod(input_dir, 0o700)
        
        saved_files = []
        
        for file in files:
            safe_name = self.sanitize_filename(file.filename)
            file_path = input_dir / safe_name
            
            content = await file.read()
            file_path.write_bytes(content)
            
            # Restrictive file permissions
            os.chmod(file_path, 0o600)
            
            saved_files.append(safe_name)
            
            # Extract zip files
            if safe_name.endswith('.zip'):
                await self._safe_extract_zip(file_path, job_dir / "extracted")
        
        return saved_files
    
    async def _safe_extract_zip(self, zip_path: Path, dest: Path) -> None:
        """Safely extract zip file, preventing zip-slip attacks."""
        dest.mkdir(parents=True, exist_ok=True)
        dest_resolved = dest.resolve()
        
        with zipfile.ZipFile(zip_path) as zf:
            for member in zf.namelist():
                # Sanitize the member path
                safe_member = self.sanitize_filename(Path(member).name)
                if not safe_member:
                    continue
                
                # Build target path and verify it's within destination
                target_path = (dest / safe_member).resolve()
                
                if not str(target_path).startswith(str(dest_resolved)):
                    raise ValueError(f"Path traversal detected in zip: {member}")
                
                # Check if it's a directory
                if member.endswith('/'):
                    target_path.mkdir(parents=True, exist_ok=True)
                else:
                    # Extract file content
                    target_path.parent.mkdir(parents=True, exist_ok=True)
                    content = zf.read(member)
                    
                    # Size check for individual files
                    if len(content) > settings.max_upload_size_bytes:
                        raise ValueError(f"Extracted file too large: {member}")
                    
                    target_path.write_bytes(content)
                    os.chmod(target_path, 0o600)
    
    def get_job_dir(self, job_id: UUID) -> Path:
        """Get job directory path."""
        return Path(settings.runs_dir) / str(job_id)
    
    def get_report_path(self, job_id: UUID) -> Path:
        """Get report file path."""
        return self.get_job_dir(job_id) / "report.md"
    
    async def list_artifacts(self, job_id: UUID) -> List[ArtifactInfo]:
        """List all artifacts for a job."""
        job_dir = self.get_job_dir(job_id)
        artifacts = []
        
        if not job_dir.exists():
            return artifacts
        
        for file_path in job_dir.rglob("*"):
            if file_path.is_file():
                rel_path = file_path.relative_to(job_dir)
                mime_type, _ = mimetypes.guess_type(str(file_path))
                
                # Calculate hash for non-large files
                file_hash = None
                if file_path.stat().st_size < 10 * 1024 * 1024:  # < 10MB
                    content = file_path.read_bytes()
                    file_hash = f"sha256:{hashlib.sha256(content).hexdigest()}"
                
                artifacts.append(ArtifactInfo(
                    path=str(rel_path),
                    size=file_path.stat().st_size,
                    type=mime_type or "application/octet-stream",
                    hash=file_hash,
                ))
        
        return artifacts
