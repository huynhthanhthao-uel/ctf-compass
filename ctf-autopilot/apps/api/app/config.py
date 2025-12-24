from pydantic_settings import BaseSettings
from typing import List
import secrets


class Settings(BaseSettings):
    # Core
    environment: str = "production"
    debug: bool = False
    secret_key: str = secrets.token_urlsafe(32)
    
    # Database
    postgres_host: str = "postgres"
    postgres_port: int = 5432
    postgres_user: str = "ctfautopilot"
    postgres_password: str
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
    
    # Auth
    admin_password: str
    session_timeout_seconds: int = 3600
    
    # MegaLLM
    megallm_api_key: str
    megallm_api_url: str = "https://api.megallm.example.com/v1/chat/completions"
    
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
    
    # CORS
    cors_origins: List[str] = ["http://localhost:3000"]
    
    # TLS
    enable_tls: bool = False
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
