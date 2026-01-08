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

Edit the `.env` file with your actual Supabase credentials:

**Frontend (.env in project root):**
```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_API_URL=http://localhost:8000
```

**Backend (.env in backend/ directory):**
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_JWT_SECRET=your_jwt_secret  # Optional
```

### 3. Verify .gitignore

Ensure your `.env` file is in `.gitignore` (it should be by default). Check with:

```bash
git check-ignore .env
```

If it returns `.env`, you're good! If not, add it to `.gitignore`.

## How It Works

1. **Environment Variables**: All sensitive data is stored in `.env` files
2. **Expo Public Variables**: Variables prefixed with `EXPO_PUBLIC_` are embedded at build time
3. **App Config**: `app.config.js` loads the `.env` file and makes values available via `Constants.expoConfig.extra`
4. **Supabase Config**: `src/config/supabase.ts` reads from environment variables
5. **Backend Config**: Backend loads `.env` file using `python-dotenv`

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

## Getting Supabase Credentials

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Go to Settings → API
4. Copy the following:
   - **Project URL** → `EXPO_PUBLIC_SUPABASE_URL`
   - **anon public** key → `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - **JWT Secret** (optional) → `SUPABASE_JWT_SECRET`

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
