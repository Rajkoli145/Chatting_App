# Cross-Lingo Talk - Multilingual Chat Application

A complete full-stack multilingual chat application with real-time translation, built with React (Frontend) and NestJS (Backend).

## 🌟 Features

### 🔐 Authentication
- Mobile-based registration and login
- OTP verification system
- JWT token authentication
- Secure user sessions

### 💬 Real-time Chat
- Socket.io powered real-time messaging
- Typing indicators and online status
- Message delivery and read receipts
- User presence tracking

### 🌍 Personalized Translation System
- **Automatic Translation**: Messages are automatically translated to each user's preferred language
- **Individual Language Preferences**: Each user can set their preferred language
- **Smart Translation Logic**: 
  - User A (Hindi preference) sends "Hello" → User A sees "नमस्ते"
  - User B (Spanish preference) receives same message as "Hola"
  - User C (French preference) would see "Bonjour"
- **Toggle Feature**: Switch between original and translated text
- **15+ Supported Languages**: English, Hindi, Spanish, French, German, Chinese, Japanese, and more

### 👥 User Management
- Search users by name or mobile number
- Create new conversations
- Profile management with language preferences
- Real-time online/offline status

### 🎨 Modern UI/UX
- Beautiful purple gradient theme
- Responsive design (mobile-first)
- Clean and intuitive interface
- Real-time status indicators

## 🏗️ Architecture

### Frontend (React + TypeScript)
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with custom components
- **State Management**: React Context API
- **Real-time**: Socket.io Client
- **UI Components**: Custom component library

### Backend (NestJS + TypeScript)
- **Framework**: NestJS with TypeScript
- **Database**: MongoDB with Mongoose
- **Real-time**: Socket.io Gateway
- **Translation**: Google Translate API
- **Authentication**: JWT with Passport

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB database
- Google Translate API key

### Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Configure your environment variables
npm run start:dev
```

### Frontend Setup
```bash
npm install
npm run dev
```

### Environment Variables

#### Backend (.env)
```env
MONGODB_URI=mongodb://localhost:27017/cross-lingo-chat
JWT_SECRET=your-jwt-secret
GOOGLE_TRANSLATE_API_KEY=your-google-translate-api-key
PORT=5001
```

#### Frontend
Update API URLs in `src/services/api.ts` and `src/services/socket.ts` if needed.

## 📡 API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - User login
- `POST /auth/verify-otp` - Verify OTP

### Users
- `GET /users/me` - Get current user
- `PATCH /users/me` - Update user profile
- `GET /users/search` - Search users

### Conversations
- `GET /conversations` - Get user conversations
- `POST /conversations` - Create new conversation
- `GET /conversations/:id/messages` - Get conversation messages
- `POST /conversations/:id/messages` - Send message

## 🔌 Socket Events

### Connection
- `connection` - User connects
- `disconnect` - User disconnects
- `joinConversation` - Join conversation room
- `leaveConversation` - Leave conversation room

### Messaging
- `sendMessage` - Send new message
- `newMessage` - Receive new message (personalized translation)
- `typing` - Typing indicator
- `userTyping` - Typing status update

### Presence
- `getUserStatus` - Check user online status
- `getOnlineUsers` - Get all online users
- `userStatusChanged` - User online/offline status change

## 🌐 Translation System

The application features a sophisticated personalized translation system:

1. **User Language Preferences**: Each user sets their preferred language in settings
2. **Automatic Translation**: When a message is sent, it's translated to each recipient's language
3. **Individual Delivery**: Each user receives the message in their own language
4. **Real-time Processing**: Translation happens instantly using Google Translate API
5. **Fallback Handling**: Graceful handling when translation fails

### Example Flow:
```
User A (Hindi) sends: "How are you?"
↓
Backend translates for each recipient:
├── User A sees: "आप कैसे हैं?" (Hindi)
├── User B sees: "¿Cómo estás?" (Spanish) 
└── User C sees: "Comment allez-vous?" (French)
```

## 🛠️ Development

### Project Structure
```
├── backend/                 # NestJS backend
│   ├── src/
│   │   ├── auth/           # Authentication module
│   │   ├── chat/           # Chat gateway (Socket.io)
│   │   ├── conversations/  # Conversation management
│   │   ├── messages/       # Message handling
│   │   ├── translation/    # Translation service
│   │   ├── users/          # User management
│   │   └── schemas/        # MongoDB schemas
│   └── package.json
├── src/                    # React frontend
│   ├── components/         # React components
│   ├── contexts/          # React contexts
│   ├── services/          # API and Socket services
│   └── hooks/             # Custom hooks
└── package.json
```

### Key Technologies
- **Frontend**: React, TypeScript, Tailwind CSS, Socket.io Client
- **Backend**: NestJS, TypeScript, MongoDB, Socket.io, Google Translate API
- **Authentication**: JWT, Passport
- **Real-time**: Socket.io
- **Translation**: Google Translate API

## 🔧 Recent Updates

### v2.0.0 - Personalized Translation System
- ✅ Individual user language preferences
- ✅ Automatic message translation per recipient
- ✅ Real-time translation with Google Translate API
- ✅ Translation toggle functionality
- ✅ Fixed authorization issues
- ✅ Real-time online status tracking

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🚀 Deployment

The application is ready for deployment on platforms like:
- **Frontend**: Netlify, Vercel, GitHub Pages
- **Backend**: Heroku, Railway, DigitalOcean
- **Database**: MongoDB Atlas

---

**Built with ❤️ by Raj Koli**