import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./common/prisma/prisma.module";
import { ProductsModule } from "./modules/products/products.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { GatewaysModule } from "./gateways/gateways.module";
import { BillingModule } from "./modules/billing/billing.module";
import { SuperAdminModule } from "./modules/super-admin/super-admin.module";
import { ClerkWebhookModule } from "./modules/clerk/clerk-webhook.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule, ProductsModule, OrdersModule, PaymentsModule,
    AnalyticsModule, GatewaysModule, BillingModule, SuperAdminModule,
    ClerkWebhookModule,
  ],
})
export class AppModule {}
