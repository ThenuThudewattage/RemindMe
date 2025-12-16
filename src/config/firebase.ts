import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFunctions, Functions, connectFunctionsEmulator } from 'firebase/functions';
import { initializeAuth, getReactNativePersistence, Auth } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Firebase configuration
// These values come from your Firebase project settings
// In Expo, EXPO_PUBLIC_ prefix makes variables available at runtime
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'YOUR_FIREBASE_API_KEY',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'YOUR_PROJECT_ID',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || 'YOUR_MESSAGING_SENDER_ID',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || 'YOUR_APP_ID'
};

// Debug: Log configuration (remove in production)
console.log('🔥 Firebase Config:', {
  apiKey: firebaseConfig.apiKey?.substring(0, 20) + '...',
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  appId: firebaseConfig.appId?.substring(0, 20) + '...',
});

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;
let functions: Functions;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  // Initialize Auth with persistence
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage)
  });
} else {
  app = getApps()[0];
  // If app is already initialized, get the existing auth instance
  // Note: In a hot-reload environment, we might not be able to re-initialize auth with persistence
  // if it was already initialized without it. But for a fresh reload it works.
  // We import getAuth to retrieve it, but we can't re-initialize it.
  // For simplicity in this file, we assume we are the ones initializing it.
  // If we need to access it later, we use getAuth(app).
}

// Initialize Cloud Functions
functions = getFunctions(app);

// Use emulator in development (optional)
// Uncomment this if you want to test with local Firebase emulator
// if (__DEV__) {
//   connectFunctionsEmulator(functions, 'localhost', 5001);
// }

export { app, functions };
