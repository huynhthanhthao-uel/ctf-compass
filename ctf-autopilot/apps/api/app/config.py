from pydantic_settings import BaseSettings
from pydantic import Field
from typing import List, Optional
import secrets
import os


class Settings(BaseSettings):
    # Core
    environment: str = "production"
    debug: bool = False
    secret_key: str = Field(default_factory=lambda: secrets.token_urlsafe(32))
    
    # Database - defaults allow container to start for health checks
    postgres_host: str = "postgres"
    postgres_port: int = 5432
    postgres_user: str = "ctfautopilot"
    postgres_password: str = "ctfautopilot"  # Default for dev, override in production
    postgres_db: str = "ctfautopilot"
    
    @property
    def database_url(self) -> str:
        return f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
    
    # Redis
    redis_host: str = "redis"
    redis_port: int = 6379
    redis_password: str = ""
    
    @property
    def redis_url(self) -> str:
        auth = f":{self.redis_password}@" if self.redis_password else ""
        return f"redis://{auth}{self.redis_host}:{self.redis_port}/0"
    
    # Auth - default for dev, MUST override in production
    admin_password: str = "changeme"
    session_timeout_seconds: int = 3600
    
    # MegaLLM - optional, features disabled if not set
    megallm_api_key: Optional[str] = None
    megallm_api_url: str = "https://ai.megallm.io/v1/chat/completions"
    megallm_model: str = "llama3.3-70b-instruct"
    
    @property
    def llm_enabled(self) -> bool:
        return bool(self.megallm_api_key)
    
    # Upload
    max_upload_size_mb: int = 200
    allowed_extensions: str = ".txt,.py,.c,.cpp,.h,.java,.js,.json,.xml,.html,.css,.md,.pdf,.png,.jpg,.jpeg,.gif,.zip,.tar,.gz,.pcap,.pcapng,.elf,.exe,.dll,.so,.bin"
    
    @property
    def allowed_extensions_list(self) -> List[str]:
        return [ext.strip() for ext in self.allowed_extensions.split(",")]
    
    @property
    def max_upload_size_bytes(self) -> int:
        return self.max_upload_size_mb * 1024 * 1024
    
    # Sandbox
    sandbox_timeout_seconds: int = 60
    sandbox_memory_limit: str = "512m"
    sandbox_cpu_limit: float = 1.0
    sandbox_image: str = "ctf-autopilot-sandbox:latest"
    
    # Rate limiting
    rate_limit_uploads: int = 10
    rate_limit_api: int = 100
    
    # Data paths
    data_dir: str = "/data"
    
    @property
    def runs_dir(self) -> str:
        return f"{self.data_dir}/runs"
    
    # CORS - allow all origins by default for development
    cors_origins: List[str] = ["*"]
    
    # TLS
    enable_tls: bool = False
    
    class Config:
        # Load from OS env by default; optionally load .env if readable (e.g. local dev).
        # This prevents container crashes when a host-mounted .env has restrictive permissions.
        env_file = None
        case_sensitive = False
        extra = "ignore"  # Ignore extra env vars to prevent startup failures


def _select_env_file() -> Optional[str]:
    path = ".env"
    try:
        if os.path.isfile(path) and os.access(path, os.R_OK):
            return path
    except Exception:
        pass
    return None


settings = Settings(_env_file=_select_env_file())
