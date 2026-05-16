import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.setGlobalPrefix('api');
  const port = Number(process.env.PORT || 3001);
  await app.listen(port, '127.0.0.1');
  console.log(`Backend running on http://127.0.0.1:${port}`);
}

bootstrap();
