import type { INestApplication } from "@nestjs/common";

const LOCAL_ADMIN_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

export function configureApiApp(app: INestApplication): void {
  app.enableCors({
    origin: LOCAL_ADMIN_ORIGINS,
    methods: ["GET", "POST", "PUT", "OPTIONS"],
    allowedHeaders: ["content-type", "x-admin-key"]
  });
}
