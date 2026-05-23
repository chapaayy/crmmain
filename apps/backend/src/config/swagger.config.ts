import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export function setupSwagger(app: INestApplication, config: ConfigService) {
  const apiPublicUrl = config.get<string>("app.apiPublicUrl");
  const swaggerConfig = new DocumentBuilder()
    .setTitle("Polybags CRM API")
    .setDescription("Backend API for polypropylene bag CRM/ERP")
    .setVersion("0.1.0")
    .addBearerAuth()
    .addServer(apiPublicUrl ?? "/")
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup("docs", app, document, {
    swaggerOptions: {
      persistAuthorization: true
    }
  });
}
