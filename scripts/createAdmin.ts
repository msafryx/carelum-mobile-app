/**
 * Admin Creation Script
 * 
 * IMPORTANT: This script requires ts-node to be installed
 * Install: npm install --save-dev ts-node
 * 
 * Usage:
 * 1. Update firebaseConfig with your Firebase credentials (or use .env)
 * 2. Update ADMIN_EMAIL and ADMIN_PASSWORD below
 * 3. Run: npx ts-node scripts/createAdmin.ts
 * 
 * Alternative: Use Firebase Console method (see ADMIN_CREATION_GUIDE.md)
 */

import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, setDoc, doc, Timestamp } from 'firebase/firestore';

// ⚠️ UPDATE THESE WITH YOUR FIREBASE CONFIG
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "YOUR_AUTH_DOMAIN",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "YOUR_STORAGE_BUCKET",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "YOUR_SENDER_ID",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "YOUR_APP_ID",
};

// ⚠️ UPDATE THESE WITH YOUR DESIRED ADMIN CREDENTIALS
const ADMIN_EMAIL = 'admin@carelum.com';
const ADMIN_PASSWORD = 'AdminPassword123!';
const ADMIN_DISPLAY_NAME = 'Admin User';

async function createAdmin() {
  try {
    console.log('🚀 Starting admin creation...\n');

    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const firestore = getFirestore(app);

    console.log('📧 Creating auth user...');
    // 1. Create auth user
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      ADMIN_EMAIL,
      ADMIN_PASSWORD
    );
    
    const userId = userCredential.user.uid;
    console.log('✅ Auth user created:', userId);

    console.log('👤 Creating user profile with admin role...');
    // 2. Create user profile with admin role
    await setDoc(doc(firestore, 'users', userId), {
      email: ADMIN_EMAIL,
      displayName: ADMIN_DISPLAY_NAME,
      role: 'admin', // ← Admin role
      preferredLanguage: 'en',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    console.log('✅ User profile created with admin role\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Admin account created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email:', ADMIN_EMAIL);
    console.log('🔑 Password:', ADMIN_PASSWORD);
    console.log('👤 Display Name:', ADMIN_DISPLAY_NAME);
    console.log('🔐 Role: admin');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('⚠️  IMPORTANT: Save these credentials securely!');
    console.log('⚠️  You can now login to the app with these credentials.\n');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error creating admin:', error.message);
    
    if (error.code === 'auth/email-already-in-use') {
      console.log('\n💡 This email is already registered.');
      console.log('   Option 1: Use a different email');
      console.log('   Option 2: Change existing user role to admin in Firebase Console');
      console.log('   Option 3: Delete the existing user and run this script again\n');
    }
    
    process.exit(1);
  }
}

// Run the script
createAdmin();
