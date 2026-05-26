import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export function setupSwagger(app: INestApplication) {
  const swaggerConfig = new DocumentBuilder()
    .setTitle("Polybags CRM API")
    .setDescription("Backend API for polypropylene bag CRM/ERP")
    .setVersion("0.1.0")
    .addBearerAuth()
    .addServer("/api")
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup("docs", app, document, {
    swaggerOptions: {
      persistAuthorization: true
    }
  });
}
