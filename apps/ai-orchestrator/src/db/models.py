from sqlalchemy import Column, String, Integer, Boolean, Text, DateTime, ForeignKey, JSON, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from src.db.postgres import Base
import uuid


class AgentConfig(Base):
    __tablename__ = "agent_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, unique=True)
    agent_name = Column(String(100), nullable=False, default="Assistente")
    tone = Column(String(20), nullable=False, default="FRIENDLY")
    greeting_message = Column(Text)
    business_hours = Column(JSON)
    llm_model = Column(String(100), default="gpt-4o-mini")
    llm_temperature = Column(Float, default=0.3)
    handoff_message = Column(Text)
    handoff_order_value_brl = Column(Float)
    auto_handoff_threshold = Column(Integer, default=3)
    system_prompt_base = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class GuardRule(Base):
    __tablename__ = "guard_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    type = Column(String(50), nullable=False)
    action = Column(String(20), nullable=False, default="block")
    config = Column(JSON, nullable=False, default=dict)
    priority = Column(Integer, default=100)
    fallback_message = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class KnowledgeBase(Base):
    __tablename__ = "knowledge_bases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    name = Column(String(200), nullable=False)
    type = Column(String(20), nullable=False)  # "faq" | "text" | "url"
    content = Column(Text)
    is_indexed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
