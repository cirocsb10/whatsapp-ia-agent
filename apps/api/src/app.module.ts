import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { PrismaModule } from "./common/prisma/prisma.module";
import { RedisModule } from "./common/redis/redis.module";
import { ProductsModule } from "./modules/products/products.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { GatewaysModule } from "./gateways/gateways.module";
import { BillingModule } from "./modules/billing/billing.module";
import { SuperAdminModule } from "./modules/super-admin/super-admin.module";
import { AuthModule } from "./modules/auth/auth.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { ConversationsModule } from "./modules/conversations/conversations.module";
import { AgentModule } from "./modules/agent/agent.module";
import { CrmModule } from "./modules/crm/crm.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { InboxEventsConsumer } from "./queue/inbox-events.consumer";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env.local", "../../.env", ".env"],
      validate: (env) => {
        if (!env.MERCADOPAGO_WEBHOOK_SECRET) {
          throw new Error("MERCADOPAGO_WEBHOOK_SECRET env var is required");
        }
        if (!env.FRONTEND_URL) {
          throw new Error("FRONTEND_URL env var is required");
        }
        return env;
      },
    }),
    ThrottlerModule.forRoot([
      { name: "global", ttl: 60_000, limit: 120 },
    ]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.get<string>("REDIS_URL") ?? "" },
      }),
    }),
    PrismaModule, RedisModule, ProductsModule, OrdersModule, PaymentsModule,
    AnalyticsModule, GatewaysModule, BillingModule, SuperAdminModule,
    AuthModule, SettingsModule, ConversationsModule, AgentModule,
    CrmModule, CategoriesModule,
  ],
  providers: [
    InboxEventsConsumer,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
