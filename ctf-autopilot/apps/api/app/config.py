from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from typing import List, Optional
import secrets
import os
import json


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
    
    # Auth - simple default for local deployment
    admin_password: str = "admin"
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
    
    # CORS - stored as string to avoid pydantic-settings JSON parsing issues
    # Supports: "*", "http://a,http://b", or '["http://a","http://b"]'
    cors_origins_raw: str = Field(default="*", validation_alias="CORS_ORIGINS")

    @property
    def cors_origins(self) -> List[str]:
        """Parse CORS origins from raw string."""
        v = self.cors_origins_raw.strip() if self.cors_origins_raw else ""
        if not v or v == "*":
            return ["*"]
        # Try JSON array first
        if v.startswith("["):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return [str(x).strip() for x in parsed if x]
            except Exception:
                pass
        # Fall back to comma-separated
        return [x.strip() for x in v.split(",") if x.strip()]

    # TLS
    enable_tls: bool = False

    # Pydantic v2 settings config
    model_config = SettingsConfigDict(
        env_file=None,
        case_sensitive=False,
        extra="ignore",
        validate_default=True,
    )


def _select_env_file() -> Optional[str]:
    path = ".env"
    try:
        if os.path.isfile(path) and os.access(path, os.R_OK):
            return path
    except Exception:
        pass
    return None


settings = Settings(_env_file=_select_env_file())
