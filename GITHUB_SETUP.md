# GitHub Setup Guide

## ✅ Pre-Push Checklist

Before pushing to GitHub, ensure you've completed these steps:

### 1. Environment Variables Setup ✓

- [x] Created `.env.example` with placeholder values
- [x] Updated `.gitignore` to exclude `.env` files
- [x] Removed hardcoded API keys from `firebase.ts`
- [x] Created `app.config.js` to load environment variables
- [x] Updated Firebase config to use environment variables

### 2. Create Your Local `.env` File

**IMPORTANT**: Create a `.env` file locally (this will NOT be committed):

```bash
cp .env.example .env
```

Then edit `.env` with your actual Firebase credentials:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyBYw_Qv0Lh-_RKv6YbpDuHh2Fbh0YkQ38U
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=carelum-mobile-app.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=carelum-mobile-app
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=carelum-mobile-app.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=450058872130
EXPO_PUBLIC_FIREBASE_APP_ID=1:450058872130:web:5a5e11b6bf32053e1714db
```

### 3. Verify `.env` is Ignored

Run this command to verify `.env` is in `.gitignore`:

```bash
git check-ignore .env
```

If it returns `.env`, you're good! ✅

### 4. Remove Hardcoded Keys from Git History (If Already Committed)

If you've already committed API keys, you need to remove them from Git history:

```bash
# Remove the file from Git history (but keep it locally)
git rm --cached src/config/firebase.ts

# Commit the removal
git commit -m "Remove hardcoded API keys"

# If already pushed, you may need to force push (be careful!)
# git push --force
```

**Note**: If keys were already pushed to a public repo, consider rotating them in Firebase Console.

### 5. Ready to Push!

Now you can safely push to GitHub:

```bash
git add .
git commit -m "Setup environment variables for secure API key management"
git push origin main
```

## 📋 What Changed

1. **`.env.example`** - Template file with placeholder values (safe to commit)
2. **`.gitignore`** - Updated to exclude all `.env` files
3. **`app.config.js`** - New file to load environment variables
4. **`src/config/firebase.ts`** - Updated to read from environment variables
5. **`SECURITY.md`** - Security documentation
6. **`README.md`** - Updated with setup instructions

## 🔒 Security Best Practices

- ✅ Never commit `.env` files
- ✅ Use `.env.example` as a template
- ✅ Rotate keys if accidentally exposed
- ✅ Use different keys for development/production
- ✅ Keep `.env` in `.gitignore`

## 🚨 If You Accidentally Committed Secrets

1. **Immediately rotate the keys** in Firebase Console
2. Remove from Git history (see step 4 above)
3. Update your local `.env` with new keys
4. Force push (if necessary, coordinate with team)

## 📝 For Team Members

When cloning the repository:

1. Clone the repo
2. Copy `.env.example` to `.env`
3. Fill in your Firebase credentials
4. Run `npm install`
5. Start development with `npm start`
