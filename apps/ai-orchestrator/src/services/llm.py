from langchain_core.language_models import BaseChatModel
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_ollama import ChatOllama
from src.config import settings
import structlog

log = structlog.get_logger(__name__)

OPENAI_MODELS = {
    "gpt-4o", "gpt-4o-mini",
    "gpt-4-turbo", "gpt-3.5-turbo",
}

ANTHROPIC_MODELS = {
    "claude-opus-4-8", "claude-sonnet-4-6",
    "claude-haiku-4-5-20251001",
    "claude-opus", "claude-sonnet", "claude-haiku",
}

GOOGLE_MODELS = {
    "gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash",
}

OLLAMA_MODELS = {
    "llama3.3", "llama3.1", "mistral", "mixtral",
    "qwen2.5", "phi3", "deepseek-r1",
}


def get_llm(
    model: str,
    temperature: float = 0.3,
    max_tokens: int = 1000,
) -> BaseChatModel:
    model_lower = model.lower()

    if model_lower in OPENAI_MODELS or model_lower.startswith("gpt-"):
        log.debug("llm_factory", provider="openai", model=model)
        return ChatOpenAI(
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            api_key=settings.openai_api_key,
        )

    if model_lower in ANTHROPIC_MODELS or model_lower.startswith("claude-"):
        aliases = {
            "claude-opus":   "claude-opus-4-8",
            "claude-sonnet": "claude-sonnet-4-6",
            "claude-haiku":  "claude-haiku-4-5-20251001",
        }
        resolved = aliases.get(model_lower, model)
        log.debug("llm_factory", provider="anthropic", model=resolved)
        return ChatAnthropic(
            model=resolved,
            temperature=temperature,
            max_tokens=max_tokens,
            api_key=settings.anthropic_api_key,
        )

    if model_lower in GOOGLE_MODELS or model_lower.startswith("gemini-"):
        log.debug("llm_factory", provider="google", model=model)
        return ChatGoogleGenerativeAI(
            model=model,
            temperature=temperature,
            max_output_tokens=max_tokens,
            google_api_key=settings.google_api_key,
        )

    if model_lower in OLLAMA_MODELS or model_lower.startswith("ollama:"):
        clean_model = model_lower.replace("ollama:", "")
        log.debug("llm_factory", provider="ollama", model=clean_model)
        return ChatOllama(
            model=clean_model,
            temperature=temperature,
            num_predict=max_tokens,
            base_url=settings.ollama_url,
        )

    raise ValueError(
        f"Unsupported model: '{model}'. "
        f"Supported: OpenAI {OPENAI_MODELS}, "
        f"Anthropic {ANTHROPIC_MODELS}, "
        f"Google {GOOGLE_MODELS}, "
        f"Ollama {OLLAMA_MODELS}"
    )


def get_llm_with_tools(model: str, tools: list, **kwargs) -> BaseChatModel:
    llm = get_llm(model, **kwargs)
    return llm.bind_tools(tools)
