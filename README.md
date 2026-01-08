# Carelum - Frontend

A cross-platform mobile application for connecting parents with verified babysitters, built with Expo React Native and Supabase.

## 🚀 Quick Start

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Python 3.8+ (for backend API)
- Supabase project (for backend services)

### Setup

1. **Install frontend dependencies**

   ```bash
   npm install
   ```

2. **Install backend dependencies**

   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Configure environment variables**

   **Frontend** - Create a `.env` file in the project root or update `app.config.js`:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   EXPO_PUBLIC_API_URL=http://localhost:8000
   ```

   **Backend** - Create a `.env` file in the `backend/` directory:
   ```env
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

   > ⚠️ **Important**: Never commit your `.env` files to version control!

4. **Set up Supabase database**

   - Run the SQL schema in `scripts/create-supabase-schema.sql` in your Supabase SQL Editor
   - See `README_SUPABASE.md` for detailed setup instructions

5. **Start the backend API server**

   ```bash
   cd backend
   ./start.sh
   # OR
   source venv/bin/activate
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

   The API will be available at:
   - API: http://localhost:8000
   - Swagger UI: http://localhost:8000/docs
   - ReDoc: http://localhost:8000/redoc

6. **Start the frontend development server**

   ```bash
   npm start
   ```

## 📚 Documentation

### Essential Documentation

- **[APP_FEATURES_STATUS.md](./APP_FEATURES_STATUS.md)** - Complete app features, UI screens, and implementation status
- **[ADMIN_GUIDE.md](./ADMIN_GUIDE.md)** - Complete guide for creating and managing admin users
- **[ADMIN.md](./ADMIN.md)** - Admin system documentation (features and usage)
- **[README_SUPABASE.md](./README_SUPABASE.md)** - Complete Supabase setup and configuration guide
- **[DATABASE_ARCHITECTURE.md](./DATABASE_ARCHITECTURE.md)** - Complete database architecture and schema documentation
- **[SECURITY.md](./SECURITY.md)** - Security best practices and guidelines
- **[API_IMPLEMENTATION.md](./API_IMPLEMENTATION.md)** - REST API implementation guide and architecture
- **[backend/API_GUIDE.md](./backend/API_GUIDE.md)** - Complete REST API documentation with setup, testing, and usage
- **[backend/README_SETUP.md](./backend/README_SETUP.md)** - Backend setup and quick start guide

## 🏗️ Architecture

### Tech Stack

- **Frontend**: React Native (Expo)
- **Backend**: 
  - **Supabase** (PostgreSQL, Auth, Storage, Realtime) - Primary database and auth
  - **FastAPI** (Python) - REST API for user management and AI services
- **State Management**: React Hooks + AsyncStorage
- **Navigation**: Expo Router
- **Styling**: React Native StyleSheet with theme support

### Data Flow

1. **AsyncStorage (Primary)**: Instant local storage for responsive UI
2. **REST API (FastAPI)**: User/profile operations and admin management
3. **Supabase (Secondary)**: Background sync, real-time updates, persistent storage
4. **Real-time Sync**: Supabase Realtime subscriptions keep AsyncStorage updated

### Key Features

- ✅ Instant UI updates (AsyncStorage-first approach)
- ✅ Offline support
- ✅ Real-time synchronization
- ✅ Role-based access (Parent, Sitter, Admin)
- ✅ Profile management
- ✅ Child management
- ✅ Session management
- ✅ Verification system
- ✅ Chat and messaging
- ✅ GPS tracking
- ✅ Audio monitoring and cry detection

## 📱 User Roles

### Parent
- Create and manage child profiles
- Search and book sitters
- Manage sessions
- Receive alerts and notifications
- Chat with sitters

### Sitter
- Complete profile setup
- Submit verification documents
- Accept/reject session requests
- Manage active sessions
- Chat with parents

### Admin
- User management
- Verification queue
- Statistics and analytics
- System settings
- Security management

## 🔧 Development

### Project Structure

```
frontend/
├── app/                    # Expo Router screens
│   ├── (admin)/            # Admin screens
│   ├── (auth)/             # Authentication screens
│   ├── (parent)/           # Parent screens
│   └── (sitter)/           # Sitter screens
├── src/
│   ├── components/          # Reusable components
│   ├── config/             # Configuration files
│   ├── hooks/               # Custom React hooks
│   ├── services/            # API and service layer
│   ├── types/               # TypeScript types
│   └── utils/               # Utility functions
├── scripts/                 # Database scripts and utilities
└── assets/                  # Images, fonts, locales
```

### Key Services

**Frontend Services:**
- `auth.service.ts` - Authentication and user management (Supabase)
- `user-api.service.ts` - User/profile operations via REST API
- `admin-api.service.ts` - Admin operations via REST API
- `child.service.ts` - Child profile management
- `session.service.ts` - Session management
- `verification.service.ts` - Sitter verification
- `admin.service.ts` - Admin operations (Supabase direct)
- `storage.service.ts` - File uploads (Supabase Storage)
- `local-storage.service.ts` - AsyncStorage management

**Backend API (FastAPI):**
- User/Profile endpoints (`/api/users/me`)
- Admin endpoints (`/api/admin/*`)
- AI endpoints (`/predict`, `/bot/*`)
- See `backend/API_GUIDE.md` for complete API documentation

### Scripts

- `scripts/create-supabase-schema.sql` - Main database schema
- `scripts/createAdmin.ts` - Admin user creation script
- `scripts/FIX_RLS_*.sql` - Row Level Security fixes

## 🚀 Deployment

### Building for Production

```bash
# iOS
npx expo build:ios

# Android
npx expo build:android

# Web
npx expo build:web
```

### Environment Setup

Make sure to set production environment variables:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## 🔐 Security

- Row Level Security (RLS) enabled on all Supabase tables
- Secure authentication via Supabase Auth with JWT tokens
- REST API endpoints protected with JWT authentication middleware
- Role-based access control (RBAC) for admin endpoints
- Environment variables for sensitive data
- See `SECURITY.md` for detailed security guidelines

## 🌐 REST API

The project includes a FastAPI backend that provides REST endpoints for user management and admin operations.

### API Features

- **User/Profile Management**: Get and update user profiles via `/api/users/me`
- **Admin Operations**: User management, statistics, and CRUD operations via `/api/admin/*`
- **AI Services**: Cry detection and chatbot endpoints (`/predict`, `/bot/*`)
- **Authentication**: JWT token validation using Supabase
- **Session Management**: Proper session handling with token-based auth

### Quick API Reference

**User Endpoints:**
- `GET /api/users/me` - Get current user profile
- `PUT /api/users/me` - Update current user profile

**Admin Endpoints:**
- `GET /api/admin/users` - Get all users (with filtering)
- `GET /api/admin/users/{id}` - Get user by ID
- `PUT /api/admin/users/{id}` - Update user
- `DELETE /api/admin/users/{id}` - Delete user
- `GET /api/admin/stats` - Get admin statistics

**AI Endpoints:**
- `POST /predict` - Cry detection prediction
- `POST /bot/update` - Update child care instructions
- `POST /bot/ask` - Ask chatbot a question

### API Documentation

- **Complete Guide**: See `backend/API_GUIDE.md` for full API documentation
- **Interactive Docs**: Visit http://localhost:8000/docs (Swagger UI) when server is running
- **Implementation Guide**: See `API_IMPLEMENTATION.md` for architecture and usage examples

### Using the API from Frontend

The frontend includes service layers that handle API communication:

```typescript
// Get user profile
import { getCurrentUserProfileFromAPI } from '@/src/services/user-api.service';
const result = await getCurrentUserProfileFromAPI();

// Admin operations
import { getAllUsersFromAPI } from '@/src/services/admin-api.service';
const users = await getAllUsersFromAPI('parent', 100);
```

See `src/services/user-api.service.ts` and `src/services/admin-api.service.ts` for all available methods.

## 📝 License

[Your License Here]

## 🤝 Contributing

[Your Contributing Guidelines Here]

## 📞 Support

[Your Support Information Here]
