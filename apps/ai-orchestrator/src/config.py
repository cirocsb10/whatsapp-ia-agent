from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    app_name: str = "WhatsAgent AI Orchestrator"
    debug: bool = False
    log_level: str = "INFO"

    # Database
    database_url: str = Field(
        default="postgresql+asyncpg://whatsagent:whatsagent_secret@localhost:5432/whatsagent"
    )

    # Redis
    redis_url: str = Field(default="redis://:redis_secret@localhost:6379")
    session_ttl_seconds: int = 86400
    session_max_messages: int = 50

    # RabbitMQ
    rabbitmq_url: str = Field(default="amqp://whatsagent:rabbitmq_secret@localhost:5672")
    rabbitmq_inbound_queue: str = "ai.process"
    rabbitmq_inbound_exchange: str = "messages"
    rabbitmq_inbound_routing_key: str = "msg.inbound"
    rabbitmq_outbound_exchange: str = "ai"
    rabbitmq_outbound_routing_key: str = "ai.response"

    # OpenAI
    openai_api_key: str = Field(default="")
    openai_model_complex: str = "gpt-4o"
    openai_model_simple: str = "gpt-4o-mini"
    openai_embedding_model: str = "text-embedding-3-small"
    openai_max_tokens: int = 1000
    openai_temperature: float = 0.3

    # Anthropic
    anthropic_api_key: str = Field(default="")

    # Google
    google_api_key: str = Field(default="")

    # Ollama
    ollama_url: str = Field(default="http://localhost:11434")
    ollama_enabled: bool = Field(default=False)

    # LangGraph
    langgraph_recursion_limit: int = 10

    # Internal
    backoffice_api_url: str = Field(default="http://api:3002")
    internal_api_token: str = Field(default="")


settings = Settings()
