from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    jwt_secret: str = "csNEylPU1gLCGs6AAvU0CRk4F6FOQ8KS3cxP-tn1sjc"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:3001", "http://localhost:8000"]

    # Redis (for wallet auth nonces, token blacklist, event listener state)
    redis_url: str = "redis://localhost:6379"

    # Blockchain / Escrow
    rpc_url: str = "http://127.0.0.1:8545"
    contract_address: str = ""
    platform_fee_bps: int = 250
    client_private_key: str = ""
    freelancer_private_key: str = ""

    blockchain_timeout: int = 30
    blockchain_tx_timeout: int = 120
    event_listener_heartbeat_timeout: int = 30
    event_listener_stale_timeout: int = 90

    # IPFS
    ipfs_api_url: str = "http://127.0.0.1:5001"
    repin_interval_seconds: int = 21600
    ipfs_monitor_interval: int = 30
    ipfs_degraded_threshold: int = 2
    ipfs_down_threshold: int = 4

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
