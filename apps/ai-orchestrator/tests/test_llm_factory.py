import pytest
from unittest.mock import patch, MagicMock


def test_factory_returns_openai_for_gpt_models():
    from src.services.llm import get_llm
    with patch("src.services.llm.ChatOpenAI") as Mock:
        Mock.return_value = MagicMock()
        llm = get_llm("gpt-4o-mini")
        Mock.assert_called_once()
        assert "gpt-4o-mini" in str(Mock.call_args)


def test_factory_returns_anthropic_for_claude_models():
    from src.services.llm import get_llm
    with patch("src.services.llm.ChatAnthropic") as Mock:
        Mock.return_value = MagicMock()
        llm = get_llm("claude-haiku-4-5-20251001")
        Mock.assert_called_once()


def test_factory_raises_for_unknown_model():
    from src.services.llm import get_llm
    with pytest.raises(ValueError, match="Unsupported model"):
        get_llm("modelo-inexistente-xyz")


def test_factory_returns_ollama_for_llama():
    from src.services.llm import get_llm
    with patch("src.services.llm.ChatOllama") as Mock:
        Mock.return_value = MagicMock()
        llm = get_llm("llama3.3")
        Mock.assert_called_once()
