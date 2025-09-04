import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.simple.module';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';

class SocketIOAdapter extends IoAdapter {
  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: [
          'http://localhost:8080',
          'http://localhost:8081', 
          'http://localhost:8082',
          'http://192.168.0.102:8080',
          process.env.FRONTEND_URL || 'http://localhost:8081'
        ],
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });
    return server;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Use custom Socket.IO adapter with CORS
  app.useWebSocketAdapter(new SocketIOAdapter(app));
  
  // Enable CORS for frontend
  app.enableCors({
    origin: [
      'http://localhost:8080',
      'http://localhost:8081', 
      'http://localhost:8082',
      'http://192.168.0.102:8080',
      'http://127.0.0.1:8080',
      process.env.FRONTEND_URL || 'http://localhost:8081'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['Access-Control-Allow-Origin'],
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
