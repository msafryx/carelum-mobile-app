# Security & Environment Variables

## 🔐 API Keys and Secrets Management

This project uses environment variables to securely manage API keys and sensitive configuration. **Never commit actual API keys to version control.**

## Setup Instructions

### 1. Create Environment File

Copy the example environment file:

```bash
cp .env.example .env
```

### 2. Fill in Your Credentials

Edit the `.env` file with your actual Firebase credentials:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your_actual_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 3. Verify .gitignore

Ensure your `.env` file is in `.gitignore` (it should be by default). Check with:

```bash
git check-ignore .env
```

If it returns `.env`, you're good! If not, add it to `.gitignore`.

## How It Works

1. **Environment Variables**: All sensitive data is stored in `.env` file
2. **Expo Public Variables**: Variables prefixed with `EXPO_PUBLIC_` are embedded at build time
3. **App Config**: `app.config.js` loads the `.env` file and makes values available via `Constants.expoConfig.extra`
4. **Firebase Config**: `src/config/firebase.ts` reads from environment variables

## Important Notes

⚠️ **NEVER:**
- Commit `.env` file to Git
- Share API keys in screenshots or documentation
- Hardcode credentials in source files
- Push secrets to public repositories

✅ **ALWAYS:**
- Use `.env.example` as a template (without real values)
- Keep `.env` in `.gitignore`
- Use environment variables for all sensitive data
- Rotate keys if accidentally exposed

## Getting Firebase Credentials

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to Project Settings (gear icon)
4. Scroll to "Your apps" section
5. Copy the configuration values

## For Production

For production builds, use:
- GitHub Secrets (for CI/CD)
- Expo Secrets (for EAS Build)
- Environment-specific `.env` files (`.env.production`)

## Troubleshooting

If Firebase isn't initializing:
1. Check that `.env` file exists and has correct values
2. Verify all `EXPO_PUBLIC_*` variables are set
3. Restart Expo development server after changing `.env`
4. Check console for configuration warnings
