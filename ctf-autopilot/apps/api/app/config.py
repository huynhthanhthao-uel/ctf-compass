from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator
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
    
    # CORS - Allow all origins by default for easier deployment
    # For production, set CORS_ORIGINS env var to specific origins
    # Example: CORS_ORIGINS='http://192.168.168.24:3000,http://localhost:3000'
    # NOTE: Explicitly alias to CORS_ORIGINS to ensure it is picked up in all pydantic-settings versions.
    cors_origins: List[str] = Field(default_factory=lambda: ["*"], validation_alias="CORS_ORIGINS")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_cors_origins(cls, v):
        # Support env as:
        # - JSON list: ["http://a","http://b"]
        # - CSV: http://a,http://b
        # - Single value: * or http://example.com
        if v is None:
            return ["*"]
        if isinstance(v, str):
            s = v.strip()
            if not s:
                return ["*"]
            if s.startswith("["):
                try:
                    parsed = json.loads(s)
                    if isinstance(parsed, list):
                        return parsed
                except Exception:
                    pass
            return [item.strip() for item in s.split(",") if item.strip()]
        return v

    # TLS
    enable_tls: bool = False

    # Pydantic v2 settings config (env still comes from OS env; env_file is injected via _env_file below)
    model_config = SettingsConfigDict(
        env_file=None,
        case_sensitive=False,
        extra="ignore",
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
