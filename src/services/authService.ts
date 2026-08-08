import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/firestoreErrors';
import { UserProfile } from '../types';

export const authService = {
  // Listen for auth state changes
  onAuthChange(callback: (user: UserProfile | null) => void) {
    return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        try {
          const profile = await this.ensureUserProfile(firebaseUser);
          callback(profile);
        } catch (error) {
          console.error("Error fetching user profile:", error);
          callback(null);
        }
      } else {
        callback(null);
      }
    });
  },

  // Ensure user profile and organization exist in Firestore
  async ensureUserProfile(firebaseUser: FirebaseUser, defaultName?: string): Promise<UserProfile> {
    const orgId = `org_${firebaseUser.uid}`;
    const userName = defaultName || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User';

    const fallbackProfile: UserProfile = {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      name: userName,
      organizationId: orgId,
      createdAt: new Date().toISOString()
    };

    const userDocRef = doc(db, 'users', firebaseUser.uid);
    try {
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap && userDocSnap.exists()) {
        return userDocSnap.data() as UserProfile;
      }
    } catch (error) {
      console.warn('Could not fetch user profile from Firestore:', error);
    }

    // New user - create default organization
    const orgDocRef = doc(db, 'organizations', orgId);
    try {
      const orgSnap = await getDoc(orgDocRef);
      if (!orgSnap || !orgSnap.exists()) {
        await setDoc(orgDocRef, {
          name: `${userName}'s Workspace`,
          createdAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.warn('Could not ensure organization in Firestore:', error);
    }

    try {
      await setDoc(userDocRef, fallbackProfile);
    } catch (error) {
      console.warn('Could not save user profile to Firestore:', error);
    }

    return fallbackProfile;
  },

  async login(email: string, pass: string): Promise<UserProfile> {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    return await this.ensureUserProfile(cred.user);
  },

  async register(email: string, pass: string, name: string): Promise<UserProfile> {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    return await this.ensureUserProfile(cred.user, name);
  },

  async logout(): Promise<void> {
    await signOut(auth);
  },

  async getCurrentUserProfile(): Promise<UserProfile | null> {
    const currentUser = auth.currentUser;
    if (!currentUser) return null;
    return await this.ensureUserProfile(currentUser);
  }
};

