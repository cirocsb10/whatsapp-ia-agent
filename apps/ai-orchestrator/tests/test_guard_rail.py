import pytest
from src.services.guard_rail import GuardRailService, GuardRailResult


@pytest.mark.asyncio
async def test_text_block_rule_triggers():
    rules = [{
        "type": "TEXT_BLOCK",
        "action": "block",
        "config": {"patterns": ["concorrente X", "outra empresa"]},
        "priority": 1,
        "fallback_message": "Posso ajudar com nossos produtos.",
    }]
    guard = GuardRailService(rules)
    result = await guard.validate("Você pode comprar na concorrente X com desconto.", {})
    assert result.triggered is True
    assert result.action == "block"
    assert result.fallback_message == "Posso ajudar com nossos produtos."


@pytest.mark.asyncio
async def test_no_rule_triggered_for_clean_response():
    rules = [{
        "type": "TEXT_BLOCK",
        "action": "block",
        "config": {"patterns": ["concorrente X"]},
        "priority": 1,
        "fallback_message": None,
    }]
    guard = GuardRailService(rules)
    result = await guard.validate("Temos ótimos produtos! Posso ajudar com o catálogo.", {})
    assert result.triggered is False


@pytest.mark.asyncio
async def test_numeric_cap_blocks_high_discount():
    rules = [{
        "type": "NUMERIC_CAP",
        "action": "rewrite",
        "config": {"field": "discount_percent", "max": 10},
        "priority": 1,
        "fallback_message": "Posso oferecer até 10% de desconto.",
    }]
    guard = GuardRailService(rules)
    result = await guard.validate("Vou dar 50% de desconto para você!", {})
    assert result.triggered is True
    assert result.action == "rewrite"


@pytest.mark.asyncio
async def test_rules_sorted_by_priority():
    rules = [
        {"type": "TEXT_BLOCK", "action": "log_only", "config": {"patterns": ["test"]}, "priority": 10, "fallback_message": None},
        {"type": "TEXT_BLOCK", "action": "block", "config": {"patterns": ["test"]}, "priority": 1, "fallback_message": "blocked"},
    ]
    guard = GuardRailService(rules)
    result = await guard.validate("test message", {})
    assert result.action == "block"  # Priority 1 fires first
