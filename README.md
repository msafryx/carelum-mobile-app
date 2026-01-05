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

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your Firebase credentials:
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
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

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
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Utility functions
└── assets/                # Images, fonts, etc.
```

## 📚 Documentation

- [SECURITY.md](./SECURITY.md) - Security guidelines and best practices
- [ADMIN.md](./ADMIN.md) - Admin system guide (account creation, features, usage)
- [DATABASE_GUIDE.md](./DATABASE_GUIDE.md) - Database architecture and usage
- [HYBRID_ARCHITECTURE.md](./HYBRID_ARCHITECTURE.md) - Hybrid database architecture details

## 🔐 Security

See [SECURITY.md](./SECURITY.md) for detailed information about:
- Environment variable setup
- API key management
- Best practices for handling secrets

## 🛠️ Development

### Available Scripts

- `npm start` - Start Expo development server
- `npm run android` - Run on Android emulator/device
- `npm run ios` - Run on iOS simulator/device
- `npm run web` - Run in web browser
- `npm run lint` - Run ESLint

### Environment Variables

All sensitive configuration is managed through environment variables. See `.env.example` for required variables.

## 📚 Learn more

- [Expo documentation](https://docs.expo.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [React Native](https://reactnative.dev/)
- [Firebase](https://firebase.google.com/docs)
