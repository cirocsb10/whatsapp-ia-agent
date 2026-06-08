import json
import uuid
from dataclasses import dataclass, field
from typing import Any
import redis.asyncio as aioredis
from src.config import settings
import structlog

log = structlog.get_logger(__name__)


@dataclass
class Session:
    tenant_id: str
    contact_phone: str
    conversation_id: str
    current_stage: str = "greeting"
    messages: list[dict] = field(default_factory=list)
    cart: list[dict] = field(default_factory=list)
    order_id: str | None = None


class SessionService:
    def __init__(self, redis_url: str):
        self.redis_url = redis_url
        self._client: aioredis.Redis | None = None

    async def connect(self):
        self._client = await aioredis.from_url(
            self.redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
        log.info("Redis session service connected")

    async def close(self):
        if self._client:
            await self._client.aclose()

    def _key(self, tenant_id: str, contact_phone: str) -> str:
        return f"session:{tenant_id}:{contact_phone}"

    async def get_or_create(
        self,
        tenant_id: str,
        contact_phone: str,
        conversation_id: str | None = None,
    ) -> Session:
        key = self._key(tenant_id, contact_phone)
        data = await self._client.get(key)

        if data:
            parsed = json.loads(data)
            session = Session(**parsed)
            # Sync conversation_id with DB whenever it changes (new conversation)
            if conversation_id and session.conversation_id != conversation_id:
                session.conversation_id = conversation_id
                await self._save(session)
            return session

        session = Session(
            tenant_id=tenant_id,
            contact_phone=contact_phone,
            conversation_id=conversation_id or str(uuid.uuid4()),
        )
        await self._save(session)
        return session

    async def update(self, tenant_id: str, contact_phone: str, updates: dict[str, Any], ttl_seconds: int | None = None) -> None:
        key = self._key(tenant_id, contact_phone)
        data = await self._client.get(key)
        if not data:
            return

        parsed = json.loads(data)
        parsed.update(updates)

        # Keep message history bounded
        if "messages" in parsed and len(parsed["messages"]) > settings.session_max_messages:
            parsed["messages"] = parsed["messages"][-settings.session_max_messages:]

        await self._client.setex(
            key,
            ttl_seconds or settings.session_ttl_seconds,
            json.dumps(parsed),
        )

    async def _save(self, session: Session) -> None:
        key = self._key(session.tenant_id, session.contact_phone)
        data = {
            "tenant_id": session.tenant_id,
            "contact_phone": session.contact_phone,
            "conversation_id": session.conversation_id,
            "current_stage": session.current_stage,
            "messages": session.messages,
            "cart": session.cart,
            "order_id": session.order_id,
        }
        await self._client.setex(
            key,
            settings.session_ttl_seconds,
            json.dumps(data),
        )

    async def delete(self, tenant_id: str, contact_phone: str) -> None:
        key = self._key(tenant_id, contact_phone)
        await self._client.delete(key)
