import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3003);
  const corsOrigin = configService.get<string>('CORS_ORIGIN', 'http://localhost:3000');

  // Validation pipe
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // CORS - Allow frontend and WebSocket connections
  app.enableCors({
    origin: [corsOrigin, 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
    credentials: true,
  });

  // API prefix
  app.setGlobalPrefix('api/v1');

  await app.listen(port);
  console.log(`🚀 MS-Status running on port ${port}`);
  console.log(`📡 WebSocket ready at ws://localhost:${port}`);
}

bootstrap();
