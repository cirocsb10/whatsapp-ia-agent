import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { PrismaModule } from "./common/prisma/prisma.module";
import { ProductsModule } from "./modules/products/products.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { GatewaysModule } from "./gateways/gateways.module";
import { BillingModule } from "./modules/billing/billing.module";
import { SuperAdminModule } from "./modules/super-admin/super-admin.module";
import { ClerkWebhookModule } from "./modules/clerk/clerk-webhook.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { ConversationsModule } from "./modules/conversations/conversations.module";
import { AgentModule } from "./modules/agent/agent.module";

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
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.get<string>("REDIS_URL") ?? "" },
      }),
    }),
    PrismaModule, ProductsModule, OrdersModule, PaymentsModule,
    AnalyticsModule, GatewaysModule, BillingModule, SuperAdminModule,
    ClerkWebhookModule, SettingsModule, ConversationsModule, AgentModule,
  ],
})
export class AppModule {}
