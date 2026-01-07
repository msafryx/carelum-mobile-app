# Carelum - Frontend

A cross-platform mobile application for connecting parents with verified babysitters, built with Expo React Native.

## 🚀 Quick Start

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Firebase project (for backend services)

### Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables**

   Create a `.env` file in the project root:

   ```env
   EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

   > ⚠️ **Important**: Never commit your `.env` file to version control!

3. **Start the development server**

   ```bash
   npm start
   ```

## 📚 Documentation

### Essential Documentation

- **[APP_FEATURES_STATUS.md](./APP_FEATURES_STATUS.md)** - Complete app features, UI screens, and implementation status
- **[DATABASE_SETUP_COMPLETE.md](./DATABASE_SETUP_COMPLETE.md)** - Complete MySQL database setup guide (includes sync instructions)
- **[LOCAL_DATABASE_GUIDE.md](./LOCAL_DATABASE_GUIDE.md)** - How to check and inspect AsyncStorage (local storage)
- **[ADMIN.md](./ADMIN.md)** - Admin system guide (account creation, features, usage)
- **[SECURITY.md](./SECURITY.md)** - Security guidelines and best practices
- **[LOCAL_DB_SOLUTIONS.md](./LOCAL_DB_SOLUTIONS.md)** - Alternative database inspection solutions

## 🗄️ Database System

The app uses a **hybrid database architecture**:

- **Local Storage (AsyncStorage)**: All data stored locally for offline support
- **Firebase**: Real-time features (active sessions, GPS, chat, alerts)
- **Auto-Sync**: Automatic synchronization between local and Firebase

**Collections are created automatically** - no manual setup needed!

See [DATABASE_SETUP_COMPLETE.md](./DATABASE_SETUP_COMPLETE.md) for complete setup instructions.

## 📁 Project Structure

```
frontend/
├── app/                    # Expo Router screens
│   ├── (auth)/            # Authentication screens
│   ├── (parent)/          # Parent user screens
│   ├── (sitter)/          # Babysitter screens
│   └── (admin)/           # Admin screens
├── src/
│   ├── components/        # Reusable UI components
│   ├── config/           # Configuration files
│   ├── hooks/            # Custom React hooks
│   ├── services/         # API and service layers
│   │   ├── local-storage.service.ts    # Local storage operations
│   │   ├── firebase-collections.service.ts  # Firebase collections
│   │   └── storage-sync.service.ts    # Sync service
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Utility functions
│       └── checkLocalStorage.ts  # Local DB inspection utilities
└── assets/                # Images, fonts, etc.
```

## 🛠️ Development

### Available Scripts

- `npm start` - Start Expo development server
- `npm run android` - Run on Android emulator/device
- `npm run ios` - Run on iOS simulator/device
- `npm run web` - Run in web browser
- `npm run lint` - Run ESLint
- `npm run create-admin` - Create admin account

### Checking Local Database

To inspect local storage data:

```typescript
import { printStorageStats, getStorageStats, inspectLocalStorage } from '@/src/utils/checkLocalStorage';

// Print statistics to console
await printStorageStats();

// Get statistics object
const stats = await getStorageStats();
console.log(stats);

// Get all data
const allData = await inspectLocalStorage();
console.log(allData);
```

See [LOCAL_DATABASE_GUIDE.md](./LOCAL_DATABASE_GUIDE.md) for complete guide.

## 🔐 Security

See [SECURITY.md](./SECURITY.md) for detailed information about:
- Environment variable setup
- API key management
- Best practices for handling secrets

## 📚 Learn More

- [Expo documentation](https://docs.expo.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [React Native](https://reactnative.dev/)
- [Firebase](https://firebase.google.com/docs)

## 🆘 Troubleshooting

### Database Issues

- **Local storage not working**: Check [LOCAL_DATABASE_GUIDE.md](./LOCAL_DATABASE_GUIDE.md)
- **Firebase not connecting**: Check [DATABASE_SETUP_COMPLETE.md](./DATABASE_SETUP_COMPLETE.md)

### Common Issues

1. **"Firebase not configured"** → Check `.env` file exists with correct credentials
2. **"Cannot find native module"** → See [EXPO_GO_LIMITATIONS.md](./EXPO_GO_LIMITATIONS.md)
3. **Collections not created** → They're created automatically on first use

## 📝 License

[Add your license here]

## 👥 Contributors

[Add contributors here]
