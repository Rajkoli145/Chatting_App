# Cross Lingo Talk - Backend

NestJS backend for the multilingual chat application with real-time messaging, authentication, and translation features.

## Features

- **Authentication**: Mobile-based OTP authentication with JWT tokens
- **Real-time Chat**: Socket.io integration for instant messaging
- **Translation**: Mock translation service (Google Translate API ready)
- **User Management**: User search, profile management
- **Database**: PostgreSQL with TypeORM

## Quick Start

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Start the server
npm run start:dev
```

### Database Setup

1. Create a PostgreSQL database named `cross_lingo_talk`
2. Update database credentials in `.env`
3. The application will auto-create tables on first run (development mode)

### Environment Variables

```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=password
DATABASE_NAME=cross_lingo_talk

JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:8081

# Optional: Google Translate API
GOOGLE_TRANSLATE_API_KEY=your-api-key
```

## API Endpoints

### Authentication
- `POST /auth/register` - Register with mobile number
- `POST /auth/verify-otp` - Verify OTP and get JWT token

### Users
- `GET /users/me` - Get current user profile
- `PATCH /users/me` - Update user profile
- `GET /users/search?q=query` - Search users

### Conversations
- `GET /conversations` - Get user's conversations
- `POST /conversations` - Create new conversation
- `GET /conversations/:id` - Get conversation details

### Messages
- `GET /conversations/:id/messages` - Get conversation messages

## Socket.io Events

### Client → Server
- `message:send` - Send a new message
- `typing:start` - Start typing indicator
- `typing:stop` - Stop typing indicator
- `message:mark-read` - Mark message as read

### Server → Client
- `message:new` - New message received
- `message:delivered` - Message delivered
- `message:read` - Message read
- `typing:update` - Typing status update
- `presence:update` - User online/offline status

## Development

```bash
# Development mode with hot reload
npm run start:dev

# Build for production
npm run build

# Start production server
npm run start:prod

# Run tests
npm run test
```

## Production Notes

1. **Database**: Set up proper PostgreSQL instance
2. **JWT Secret**: Use a strong, random JWT secret
3. **Translation**: Add Google Translate API key for real translations
4. **CORS**: Update FRONTEND_URL for your domain
5. **Environment**: Set NODE_ENV=production
