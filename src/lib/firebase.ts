import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.setCustomParameters({ prompt: 'select_account' });

// Ensure auth state persists reliably across reloads/tabs on mobile & desktop
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn('Auth persistence fallback:', err);
});

export async function completeRedirectSignIn() {
  try {
    return await getRedirectResult(auth);
  } catch (err) {
    console.warn('Redirect sign-in check:', err);
    return null;
  }
}

export async function signInWithGoogle() {
  try {
    return await signInWithPopup(auth, googleAuthProvider);
  } catch (err: unknown) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: string }).code)
        : '';

    // Mobile browsers / Safari / WebViews often block popups; fall back to redirect
    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/operation-not-supported-in-this-environment'
    ) {
      await signInWithRedirect(auth, googleAuthProvider);
      return null;
    }

    if (code === 'auth/unauthorized-domain') {
      throw new Error(
        `This domain (${window.location.hostname}) is not yet authorized in Firebase Authentication. Add it under Authorized Domains in Firebase Console.`
      );
    }

    throw err;
  }
}

export async function signOutOwner() {
  return signOut(auth);
}
