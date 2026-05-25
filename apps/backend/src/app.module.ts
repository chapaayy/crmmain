import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AnalyticsModule } from "./analytics/analytics.module";
import { AuditModule } from "./audit/audit.module";
import { AttendanceModule } from "./attendance/attendance.module";
import { AuthModule } from "./auth/auth.module";
import { CommissionRulesModule } from "./commission-rules/commission-rules.module";
import { configs, validateEnv } from "./config";
import { HealthController } from "./health.controller";
import { CustomersModule } from "./customers/customers.module";
import { DocumentsModule } from "./documents/documents.module";
import { EmployeeTasksModule } from "./employee-tasks/employee-tasks.module";
import { EmployeesModule } from "./employees/employees.module";
import { LeadsModule } from "./leads/leads.module";
import { MeModule } from "./me/me.module";
import { OrdersModule } from "./orders/orders.module";
import { PaymentsModule } from "./payments/payments.module";
import { PayrollModule } from "./payroll/payroll.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ProductsModule } from "./products/products.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { RbacModule } from "./rbac/rbac.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { ResponsibilitiesModule } from "./responsibilities/responsibilities.module";
import { SecretsModule } from "./secrets/secrets.module";
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
    AttendanceModule,
    AuthModule,
    AuditModule,
    CommissionRulesModule,
    CustomersModule,
    DocumentsModule,
    EmployeeTasksModule,
    EmployeesModule,
    LeadsModule,
    MeModule,
    NotificationsModule,
    OrdersModule,
    PaymentsModule,
    PayrollModule,
    RbacModule,
    RealtimeModule,
    ResponsibilitiesModule,
    SecretsModule,
    ProductsModule,
    SettingsModule,
    TasksModule,
    UsersModule,
    WarehouseModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
