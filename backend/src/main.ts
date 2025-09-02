import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.simple.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for frontend
  app.enableCors({
    origin: ['http://localhost:8080', 'http://localhost:8081', process.env.FRONTEND_URL || 'http://localhost:8081'],
    credentials: true,
  });

  // Enable validation pipes
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  const port = process.env.PORT || 5002;
  
  try {
    await app.listen(port);
    console.log(`🚀 Backend server running on http://localhost:${port}`);
  } catch (error) {
    console.error(`❌ Failed to start server on port ${port}:`, error.message);
    process.exit(1);
  }
}

bootstrap();
