# Admin User Guide

Complete guide for creating and managing admin users in Carelum.

---

## 🔐 Admin Account Creation

### Method 1: Using Script (Recommended)

1. **Update credentials in script:**
   - Open `scripts/createAdmin.ts`
   - Update `ADMIN_EMAIL` and `ADMIN_PASSWORD` (lines 30-31)
   - Make sure Supabase credentials are in `.env` or `app.config.js`

2. **Run the script:**
   ```bash
   npx ts-node scripts/createAdmin.ts
   ```

3. **Save the credentials:**
   - The script will output the admin email and password
   - Save these securely!

### Method 2: Using Supabase Dashboard

1. **Register a user via the app:**
   - Use the normal sign-up flow
   - Choose any role (parent or sitter)
   - Complete registration

2. **Change role to admin:**
   - Go to [Supabase Dashboard](https://supabase.com/dashboard)
   - Select your project
   - Go to **Table Editor** → `users` table
   - Find the user by email
   - Click **Edit** (pencil icon)
   - Change `role` from `'parent'` or `'sitter'` to `'admin'`
   - Click **Save**

3. **Done!** The user can now log in as admin.

---

## 🔑 Admin Login

Admin users login **exactly the same way** as regular users:

1. Open the app
2. Go to **Login** screen
3. Enter admin email and password
4. Click **Log In**

The app will automatically:
- Authenticate the user
- Load the profile from AsyncStorage/Supabase
- Detect the `role: 'admin'`
- Route to `/(admin)/home` (Admin Dashboard)

**No special login flow needed!** The role-based routing handles everything.

---

## 📱 Admin Features

### 1. Admin Dashboard (`/(admin)/home`)
- Quick stats (Total Users, Pending Verifications, Active Sessions)
- User breakdown by role
- Quick action buttons
- Real-time statistics

### 2. User Management (`/(admin)/users`)
- View all users (parents, sitters, admins)
- Search and filter
- Edit user information
- Change user roles
- Activate/Deactivate users

### 3. Verification Queue (`/(admin)/verifications`)
- View pending verification requests
- Review submitted documents
- Approve/Reject requests
- View verification history

### 4. Statistics (`/(admin)/statistics`)
- Real-time statistics dashboard
- User statistics
- System status
- Export reports

### 5. Admin Settings (`/(admin)/settings`)
- Security settings
- System settings
- Data management
- Maintenance mode

### 6. Admin Profile (`/(admin)/profile`)
- Edit profile
- Admin badge display
- Notification preferences
- Security settings

---

## 🔧 How It Works

### Role-Based Routing

The app uses role-based routing in `app/landing.tsx`:

```typescript
if (user && userProfile) {
  const route = 
    userProfile.role === USER_ROLES.PARENT ? '/(parent)/home' :
    userProfile.role === USER_ROLES.BABYSITTER ? '/(sitter)/home' :
    userProfile.role === USER_ROLES.ADMIN ? '/(admin)/home' :
    '/(auth)/login';
  return <Redirect href={route as any} />;
}
```

### Admin Role Detection

- Admin users have `role: 'admin'` in the `users` table
- The role is loaded from AsyncStorage (instant) or Supabase (background sync)
- Routing happens automatically based on role

### Access Control

- Only users with `role: 'admin'` can access admin screens
- Supabase Row Level Security (RLS) policies enforce this
- Admin screens check for admin role before rendering

---

## ⚠️ Important Notes

1. **Email Confirmation:**
   - If email confirmation is enabled in Supabase, admin must confirm email before first login
   - To disable: Supabase Dashboard → Authentication → Settings → Disable "Enable email confirmations"

2. **User Numbers:**
   - Admin users get numbers like `a1`, `a2`, `a3`, etc.
   - Generated automatically by the script

3. **Security:**
   - Admin accounts have full access to the system
   - Keep admin credentials secure
   - Use strong passwords
   - Consider 2FA for production

4. **Multiple Admins:**
   - You can create multiple admin accounts
   - Each gets a unique user number (`a1`, `a2`, etc.)

---

## 🐛 Troubleshooting

### Admin can't log in

1. **Check email confirmation:**
   - If email confirmation is enabled, check email inbox
   - Or disable email confirmation in Supabase Dashboard

2. **Check role in database:**
   - Go to Supabase Dashboard → Table Editor → `users`
   - Verify `role` is set to `'admin'` (not `'Admin'` or `'ADMIN'`)

3. **Check credentials:**
   - Verify email and password are correct
   - Try resetting password if needed

### Admin routes to wrong screen

1. **Check userProfile:**
   - The profile must have `role: 'admin'`
   - Check AsyncStorage or Supabase database

2. **Clear app data:**
   - Clear AsyncStorage
   - Log out and log back in

### Script fails to create admin

1. **Check Supabase credentials:**
   - Verify `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are set
   - Or update them directly in `scripts/createAdmin.ts`

2. **Check RLS policies:**
   - Make sure RLS policies allow profile creation
   - The script uses RPC function `create_user_profile` to bypass RLS

3. **Check email:**
   - Email must be unique
   - If email exists, use a different email or change existing user's role

---

## 📝 Quick Reference

**Admin Creation:**
```bash
npx ts-node scripts/createAdmin.ts
```

**Admin Login:**
- Email: (your admin email)
- Password: (your admin password)
- Routes to: `/(admin)/home`

**Admin Role:**
- Database: `users.role = 'admin'`
- User Number: `a1`, `a2`, `a3`, etc.

**Admin Screens:**
- Dashboard: `/(admin)/home`
- Users: `/(admin)/users`
- Verifications: `/(admin)/verifications`
- Statistics: `/(admin)/statistics`
- Settings: `/(admin)/settings`
- Profile: `/(admin)/profile`

---

For more details, see `ADMIN.md` (if it exists) or the admin screen components in `app/(admin)/`.
