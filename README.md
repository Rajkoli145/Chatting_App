# Multilingual Chat Web App - Frontend

A complete React frontend for real-time multilingual chat with automatic translation. Ready to connect to your NestJS backend.

## ✅ What's Built (Frontend Complete)

- **Authentication**: Mobile login/register with OTP (mock: 123456)
- **Real-time Chat**: Socket.io integration, typing indicators, read receipts
- **Translation UI**: Language selection, original/translated toggle, 10+ languages
- **User Management**: Search users, create conversations, profile management
- **Responsive Design**: Beautiful purple gradient theme, mobile-first

## 🔧 Backend Required (NestJS + PostgreSQL)

Update API URLs in `src/services/api.ts` and `src/services/socket.ts` to point to your NestJS backend.

### Required Endpoints:
```
POST /auth/register, /auth/verify-otp
GET /users/me, /users/search  
GET/POST /conversations
GET /conversations/:id/messages
```

### Required Socket Events:
```
message:send → message:new
typing:start/stop → typing:update
message:mark-read → message:read
```

## Quick Start

```bash
npm install
npm run dev
```

Then build your NestJS backend with PostgreSQL, Socket.io, and Google Translate API integration.

The frontend is production-ready and will seamlessly connect to your backend once deployed!