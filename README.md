# Carelum - Frontend

A cross-platform mobile application for connecting parents with verified babysitters, built with Expo React Native and Supabase.

## 🚀 Quick Start

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Supabase project (for backend services)

### Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables**

   Create a `.env` file in the project root or update `app.config.js`:

   ```env
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

   > ⚠️ **Important**: Never commit your `.env` file to version control!

3. **Set up Supabase database**

   - Run the SQL schema in `scripts/create-supabase-schema.sql` in your Supabase SQL Editor
   - See `README_SUPABASE.md` for detailed setup instructions

4. **Start the development server**

   ```bash
   npm start
   ```

## 📚 Documentation

### Essential Documentation

- **[APP_FEATURES_STATUS.md](./APP_FEATURES_STATUS.md)** - Complete app features, UI screens, and implementation status
- **[ADMIN_GUIDE.md](./ADMIN_GUIDE.md)** - Complete guide for creating and managing admin users
- **[ADMIN.md](./ADMIN.md)** - Admin system documentation (features and usage)
- **[README_SUPABASE.md](./README_SUPABASE.md)** - Complete Supabase setup and configuration guide
- **[DISABLE_EMAIL_CONFIRMATION.md](./DISABLE_EMAIL_CONFIRMATION.md)** - How to disable email confirmation in Supabase
- **[SECURITY.md](./SECURITY.md)** - Security best practices and guidelines

## 🏗️ Architecture

### Tech Stack

- **Frontend**: React Native (Expo)
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **State Management**: React Hooks + AsyncStorage
- **Navigation**: Expo Router
- **Styling**: React Native StyleSheet with theme support

### Data Flow

1. **AsyncStorage (Primary)**: Instant local storage for responsive UI
2. **Supabase (Secondary)**: Background sync, real-time updates, persistent storage
3. **Real-time Sync**: Supabase Realtime subscriptions keep AsyncStorage updated

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

- `auth.service.ts` - Authentication and user management
- `child.service.ts` - Child profile management
- `session.service.ts` - Session management
- `verification.service.ts` - Sitter verification
- `admin.service.ts` - Admin operations
- `storage.service.ts` - File uploads (Supabase Storage)
- `local-storage.service.ts` - AsyncStorage management

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
- Secure authentication via Supabase Auth
- Environment variables for sensitive data
- See `SECURITY.md` for detailed security guidelines

## 📝 License

[Your License Here]

## 🤝 Contributing

[Your Contributing Guidelines Here]

## 📞 Support

[Your Support Information Here]
