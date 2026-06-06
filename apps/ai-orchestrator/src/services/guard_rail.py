import re
import threading
from dataclasses import dataclass
from typing import Optional
import structlog

log = structlog.get_logger(__name__)

_REGEX_TIMEOUT_SECONDS = 0.5


def _safe_regex_search(pattern: str, text: str) -> bool:
    """Run re.search with a hard timeout to prevent ReDoS from malicious patterns."""
    result: list[bool] = [False]

    def _run() -> None:
        try:
            result[0] = bool(re.search(pattern, text, re.IGNORECASE))
        except re.error:
            pass

    t = threading.Thread(target=_run, daemon=True)
    t.start()
    t.join(_REGEX_TIMEOUT_SECONDS)
    if t.is_alive():
        log.warning("guard_rule regex timed out", pattern=pattern[:100])
    return result[0]


@dataclass
class GuardRailResult:
    triggered: bool
    action: Optional[str] = None  # "block" | "rewrite" | "handoff" | "log_only"
    reason: Optional[str] = None
    fallback_message: Optional[str] = None


class GuardRailService:
    def __init__(self, rules: list[dict]):
        self.rules = sorted(rules, key=lambda r: r.get("priority", 100))

    async def validate(self, response_text: str, state: dict) -> GuardRailResult:
        for rule in self.rules:
            result = await self._check_rule(rule, response_text, state)
            if result.triggered:
                log.info("guard_rule triggered", rule_type=rule["type"], action=rule["action"])
                return result
        return GuardRailResult(triggered=False)

    async def _check_rule(self, rule: dict, text: str, state: dict) -> GuardRailResult:
        rule_type = rule.get("type", "")
        action = rule.get("action", "block").lower()
        fallback = rule.get("fallback_message")
        config = rule.get("config", {})

        triggered = False
        reason = None

        if rule_type == "TEXT_BLOCK":
            patterns = config.get("patterns", [])
            for pattern in patterns:
                if pattern.lower() in text.lower():
                    triggered = True
                    reason = f"Texto proibido encontrado: '{pattern}'"
                    break

        elif rule_type == "REGEX_MATCH":
            pattern = config.get("pattern", "")
            if pattern and _safe_regex_search(pattern, text):
                triggered = True
                reason = f"Padrão regex disparado: {pattern}"

        elif rule_type == "NUMERIC_CAP":
            field = config.get("field", "")
            max_value = config.get("max", 0)
            if field == "discount_percent":
                discounts = re.findall(r"(\d+)\s*%\s*(?:de\s+)?desconto", text, re.IGNORECASE)
                for d in discounts:
                    if int(d) > max_value:
                        triggered = True
                        reason = f"Desconto de {d}% excede limite de {max_value}%"
                        break

        elif rule_type == "HANDOFF_TRIGGER":
            keywords = config.get("keywords", [])
            for kw in keywords:
                if kw.lower() in text.lower():
                    triggered = True
                    reason = f"Palavra-chave de handoff: '{kw}'"
                    break

        elif rule_type == "SEMANTIC_BLOCK":
            patterns = config.get("patterns", [])
            for pattern in patterns:
                if pattern.lower() in text.lower():
                    triggered = True
                    reason = f"Conteúdo semanticamente bloqueado: '{pattern}'"
                    break

        if triggered:
            return GuardRailResult(
                triggered=True,
                action=action,
                reason=reason,
                fallback_message=fallback,
            )
        return GuardRailResult(triggered=False)
