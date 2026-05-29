import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import structlog

from src.config import settings
from src.services.session import SessionService
from src.publishers.rabbitmq import RabbitMQPublisher
from src.consumers.rabbitmq import start_consumer
from src.db.postgres import create_db_engine

log = structlog.get_logger(__name__)

session_service: SessionService | None = None
publisher: RabbitMQPublisher | None = None
consumer_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global session_service, publisher, consumer_task

    log.info("Starting AI Orchestrator...", debug=settings.debug)

    await create_db_engine()

    session_service = SessionService(settings.redis_url)
    await session_service.connect()

    publisher = RabbitMQPublisher(settings.rabbitmq_url)
    await publisher.connect()

    consumer_task = asyncio.create_task(
        start_consumer(session_service, publisher)
    )

    log.info("AI Orchestrator started successfully!")

    yield

    log.info("Shutting down AI Orchestrator...")
    if consumer_task:
        consumer_task.cancel()
    if publisher:
        await publisher.close()
    if session_service:
        await session_service.close()


app = FastAPI(
    title="WhatsAgent AI Orchestrator",
    description="LangGraph-based conversational AI engine",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3002"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai-orchestrator"}


@app.get("/graph/info")
async def graph_info():
    from src.graph.agent import get_agent_graph
    graph = get_agent_graph()
    return {"nodes": list(graph.nodes.keys()), "status": "compiled"}
