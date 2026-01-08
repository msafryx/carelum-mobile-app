# Admin System Documentation

Complete guide for the Carelum admin system - account creation, features, and usage.

---

## 📋 Table of Contents

1. [Admin Account Creation](#admin-account-creation)
2. [Admin Features](#admin-features)
3. [How It Works](#how-it-works)
4. [Quick Reference](#quick-reference)

---

## 🔐 Admin Account Creation

### ⚠️ Important: No Default Admin Account

**There is NO default admin username/password.** Admin accounts must be created manually.

### Method 1: Supabase Dashboard (Recommended)

1. **Register a user account** via the app:
   - Email: `admin@carelum.com` (or your choice)
   - Password: `YourSecurePassword123!`
   - Role: Choose **Parent** (we'll change it)

2. **Change role in Supabase Dashboard:**
   - Go to [Supabase Dashboard](https://app.supabase.com)
   - Select your project → Table Editor
   - Open `users` table
   - Find the user by email
   - Edit the row
   - Change `role: 'parent'` → `role: 'admin'`
   - Save

3. **Login:**
   - Email: `admin@carelum.com`
   - Password: `YourSecurePassword123!`
   - You'll be redirected to Admin Dashboard

### Method 2: Using REST API (Admin Endpoint)

If you already have an admin account, you can use the REST API:

```bash
curl -X PUT http://localhost:8000/api/admin/users/{user_id} \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}'
```

### Method 3: Using Script

1. Install dependencies:
   ```bash
   npm install --save-dev ts-node
   ```

2. Edit `scripts/createAdmin.ts`:
   - Update `ADMIN_EMAIL` and `ADMIN_PASSWORD`
   - Update Supabase config (or use `.env`)

3. Run:
   ```bash
   npm run create-admin
   ```

---

## 📱 Admin Features

### 1. Admin Dashboard (`/(admin)/home`)

**Features:**
- Quick stats cards (Total Users, Pending Verifications, Active Sessions)
- User breakdown by role (Parents, Sitters, Admins)
- Quick action buttons
- Navigation shortcuts
- Real-time statistics

### 2. Admin Profile (`/(admin)/profile`)

**Features:**
- Edit profile (name, email, phone)
- Admin badge display
- Dark mode toggle
- Notification preferences:
  - Verification requests
  - User reports
  - System alerts
  - Weekly reports
- Security settings (2FA, security settings)
- Account management (settings, help, logout)

### 3. Admin Settings (`/(admin)/settings`)

**Security Settings:**
- Require Strong Password
- Session Timeout
- IP Whitelist
- Audit Log

**System Settings:**
- Maintenance Mode (with confirmation)
- Allow New Registrations
- Auto-Approve Sitters (with confirmation)
- Email Notifications

**Data Management:**
- Export Data
- Backup Database
- Clear Cache

### 4. Statistics (`/(admin)/statistics`)

**Features:**
- Real-time statistics dashboard
- User statistics with icons
- System status (Pending Verifications, Active Sessions)
- Quick actions (Export Report, View Analytics)
- Pull-to-refresh

### 5. Verification Queue (`/(admin)/verifications`)

**Features:**
- View pending verification requests
- Review submitted documents (ID, background check, certifications)
- Approve/Reject requests
- View verification history

**Flow:**
```
Sitter submits request → Appears in queue → Admin reviews → Approve/Reject → Sitter notified
```

### 6. User Management (`/(admin)/users`)

**Features:**
- View all users (parents, sitters, admins)
- Search and filter users
- Edit user information
- Change user roles
- Activate/Deactivate users
- View user statistics

---

## 🔧 How It Works

### Authentication & Routing

1. **Admin Role Assignment:**
   - Admins have `role: 'admin'` in Firestore `users` collection
   - Role is checked on login

2. **Role-Based Routing:**
   ```typescript
   // app/landing.tsx
   switch (userProfile.role) {
     case USER_ROLES.ADMIN:
       return <Redirect href="/(admin)/home" />;
     case USER_ROLES.PARENT:
       return <Redirect href="/(parent)/home" />;
     case USER_ROLES.BABYSITTER:
       return <Redirect href="/(sitter)/home" />;
   }
   ```

3. **Access Control:**
   - Only users with `role: 'admin'` can access admin screens
   - Supabase Row Level Security (RLS) policies enforce this

### Verification Review Process

1. **Sitter submits verification:**
   - Uploads documents (ID, background check, certifications)
   - Creates `verificationRequests/{requestId}` document
   - Status: `'pending'`

2. **Admin reviews:**
   - Views request in Verification Queue
   - Reviews documents
   - Makes decision

3. **Admin approves/rejects:**
   ```typescript
   await updateVerificationStatus(
     requestId,
     'approved', // or 'rejected'
     adminUserId,
     rejectionReason // optional
   );
   ```

4. **System updates:**
   - Verification request status updated
   - Sitter's `isVerified` and `verificationStatus` updated
   - Notification sent to sitter

### User Management

**Get all users:**
```typescript
import { getAllUsers } from '@/src/services/admin.service';

const result = await getAllUsers('parent'); // Filter by role
const parents = result.data;
```

**Change user role:**
```typescript
import { changeUserRole } from '@/src/services/admin.service';

await changeUserRole('userId', 'admin');
```

**Update user:**
```typescript
import { updateUser } from '@/src/services/admin.service';

await updateUser('userId', {
  displayName: 'New Name',
  // ... other fields
});
```

### Statistics

**Get admin statistics:**
```typescript
import { getAdminStats } from '@/src/services/admin.service';

const stats = await getAdminStats();
// Returns: totalUsers, totalParents, totalSitters, totalAdmins,
//          pendingVerifications, activeSessions
```

**Note:** Statistics count users by their current role. If an admin was created as a parent and then changed to admin, they will only appear in the admin count, not the parent count.

---

## 📊 Database Structure

### Users Collection
```typescript
users/{userId}
{
  email: string
  displayName: string
  role: 'parent' | 'babysitter' | 'admin'
  isVerified: boolean
  verificationStatus: 'pending' | 'approved' | 'rejected'
  createdAt: Timestamp
  // ... other fields
}
```

### Verification Requests Collection
```typescript
verificationRequests/{requestId}
{
  sitterId: string
  fullName: string
  idDocumentUrl: string
  backgroundCheckUrl: string
  certifications: Array<{...}>
  status: 'pending' | 'approved' | 'rejected'
  submittedAt: Timestamp
  reviewedAt?: Timestamp
  reviewedBy?: string // Admin user ID
  rejectionReason?: string
}
```

---

## 🔒 Security Rules

### Firestore Security Rules for Admin

```javascript
match /verificationRequests/{requestId} {
  // Admins can read all
  allow read: if getUserRole() == 'admin';
  
  // Admins can update status
  allow update: if getUserRole() == 'admin' && 
    request.resource.data.diff(resource.data).affectedKeys()
      .hasOnly(['status', 'reviewedAt', 'reviewedBy', 'rejectionReason']);
}

match /users/{userId} {
  // Admins can read all users
  allow read: if getUserRole() == 'admin';
  
  // Admins can update any user
  allow update: if getUserRole() == 'admin';
}
```

---

## 📝 Quick Reference

### Services

| Service | Function | Purpose |
|---------|----------|---------|
| `admin.service.ts` | `getAllUsers()` | Get all users with optional role filter |
| `admin.service.ts` | `getUserById()` | Get specific user |
| `admin.service.ts` | `updateUser()` | Update user information |
| `admin.service.ts` | `changeUserRole()` | Change user role |
| `admin.service.ts` | `getAdminStats()` | Get system statistics |
| `verification.service.ts` | `getPendingVerifications()` | Get pending verification requests |
| `verification.service.ts` | `updateVerificationStatus()` | Approve/reject verification |

### Screens

| Screen | Route | Purpose |
|--------|-------|---------|
| Dashboard | `/(admin)/home` | Main admin dashboard with stats |
| Profile | `/(admin)/profile` | Admin profile management |
| Settings | `/(admin)/settings` | System and security settings |
| Statistics | `/(admin)/statistics` | Detailed statistics view |
| Verification Queue | `/(admin)/verifications` | Review verification requests |
| User Management | `/(admin)/users` | Manage all users |

---

## 🚀 Implementation Status

### ✅ Completed
- [x] Admin Dashboard with stats
- [x] Admin Profile screen
- [x] Admin Settings screen
- [x] Statistics screen
- [x] Admin Hamburger Menu
- [x] Theme integration
- [x] Navigation structure
- [x] UI components

### ⏳ Needs Backend Integration
- [ ] Verification Queue (UI ready, needs data)
- [ ] User Management (UI ready, needs data)
- [ ] Settings persistence
- [ ] Profile updates

---

## 🎯 Key Features Summary

1. **Complete Profile Management** - Edit profile, manage settings
2. **System Control** - Maintenance mode, registration control
3. **Security Settings** - Password policies, session management
4. **Statistics Dashboard** - Real-time system metrics
5. **User Management** - View and manage all users
6. **Verification Queue** - Review and approve sitters
7. **Data Management** - Export, backup, cache control
8. **Consistent UI** - Matches parent/sitter app quality

---

## 🔍 Troubleshooting

### Problem: Can't login as admin
**Solution:** Check that `role: 'admin'` is set in Firestore `users` collection

### Problem: Not redirected to admin dashboard
**Solution:** Check `app/landing.tsx` routing logic includes admin case

### Problem: Statistics showing wrong counts
**Solution:** Verify user roles in Firestore. Each user should have only one role.

### Problem: Admin can't access admin screens
**Solution:** Verify Supabase RLS policies allow admin access

### Problem: Forgot admin password
**Solution:** Use Supabase Dashboard → Authentication → Reset password

---

## 📞 Support

For admin-related issues:
- Check Supabase Dashboard for user roles
- Verify Security Rules are configured
- Review `src/services/admin.service.ts` for available functions
- See `DATABASE_GUIDE.md` for database structure

---

**Last Updated:** January 2024
