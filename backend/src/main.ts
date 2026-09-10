import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Serve static frontend assets
  const frontendPaths = [
    path.join(__dirname, '..', '..', 'frontend'),
    path.join(process.cwd(), 'frontend'),
    path.join(process.cwd(), '../frontend'),
  ];
  for (const fp of frontendPaths) {
    if (fs.existsSync(fp)) {
      app.useStaticAssets(fp);
      logger.log(`Serving static frontend assets from: ${fp}`);
      break;
    }
  }

  // Serve local uploads if present
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (fs.existsSync(uploadsDir)) {
    app.useStaticAssets(uploadsDir, { prefix: '/uploads' });
  }

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || process.env.PORT || 8080;

  await app.listen(port, '0.0.0.0');
  logger.log(`CivicLens Backend API is running on http://0.0.0.0:${port}`);
}

bootstrap();
