import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AnalyticsModule } from "./analytics/analytics.module";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { configs, validateEnv } from "./config";
import { HealthController } from "./health.controller";
import { CustomersModule } from "./customers/customers.module";
import { DocumentsModule } from "./documents/documents.module";
import { LeadsModule } from "./leads/leads.module";
import { OrdersModule } from "./orders/orders.module";
import { PaymentsModule } from "./payments/payments.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ProductsModule } from "./products/products.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { RbacModule } from "./rbac/rbac.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { SettingsModule } from "./settings/settings.module";
import { TasksModule } from "./tasks/tasks.module";
import { UsersModule } from "./users/users.module";
import { WarehouseModule } from "./warehouse/warehouse.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: configs,
      validate: validateEnv
    }),
    PrismaModule,
    AnalyticsModule,
    AuthModule,
    AuditModule,
    CustomersModule,
    DocumentsModule,
    LeadsModule,
    NotificationsModule,
    OrdersModule,
    PaymentsModule,
    RbacModule,
    RealtimeModule,
    ProductsModule,
    SettingsModule,
    TasksModule,
    UsersModule,
    WarehouseModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
