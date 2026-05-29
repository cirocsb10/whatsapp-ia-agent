export default () => ({
  port: parseInt(process.env.PORT ?? "3001", 10),
  nodeEnv: process.env.NODE_ENV ?? "development",
  meta: {
    appId: process.env.META_APP_ID ?? "",
    appSecret: process.env.META_APP_SECRET ?? "",
    verifyToken: process.env.META_VERIFY_TOKEN ?? "",
    webhookSecret: process.env.META_WEBHOOK_SECRET ?? "",
    graphApiVersion: "v21.0",
    graphApiBaseUrl: "https://graph.facebook.com",
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? "",
    whisperModel: process.env.OPENAI_WHISPER_MODEL ?? "whisper-1",
  },
  redis: {
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
    sessionTtlSeconds: 86400,
    deduplicationTtlSeconds: 60,
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL ?? "amqp://localhost:5672",
  },
  storage: {
    endpoint: process.env.MINIO_ENDPOINT ?? "localhost",
    port: parseInt(process.env.MINIO_PORT ?? "9000", 10),
    accessKey: process.env.MINIO_ACCESS_KEY ?? "",
    secretKey: process.env.MINIO_SECRET_KEY ?? "",
    bucket: process.env.MINIO_BUCKET ?? "whatsagent-media",
    useSSL: process.env.NODE_ENV === "production",
  },
});
