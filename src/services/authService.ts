import { initializeApp, deleteApp } from 'firebase/app';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  signOut, 
  onAuthStateChanged,
  getAuth,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { firebaseConfig, auth, db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/firestoreErrors';
import { UserProfile } from '../types';

const USERS_LOCAL_STORAGE_KEY = 'krg_users_store';

function getLocalUsers(): UserProfile[] {
  try {
    const raw = localStorage.getItem(USERS_LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalUsers(users: UserProfile[]): void {
  try {
    localStorage.setItem(USERS_LOCAL_STORAGE_KEY, JSON.stringify(users));
  } catch (e) {
    console.warn('Failed to save users to localStorage:', e);
  }
}

export const authService = {
  // Listen for auth state changes
  onAuthChange(callback: (user: UserProfile | null) => void) {
    return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        try {
          const profile = await this.ensureUserProfile(firebaseUser);
          if (profile.active === false) {
            await signOut(auth);
            callback(null);
            return;
          }
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
      role: 'Manager',
      active: true,
      organizationId: orgId,
      createdAt: new Date().toISOString()
    };

    const userDocRef = doc(db, 'users', firebaseUser.uid);
    try {
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap && userDocSnap.exists()) {
        const data = userDocSnap.data() as UserProfile;
        // ensure local cache is synced
        const locals = getLocalUsers();
        const idx = locals.findIndex(u => u.uid === data.uid);
        if (idx !== -1) {
          locals[idx] = data;
        } else {
          locals.push(data);
        }
        saveLocalUsers(locals);
        return data;
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

    const locals = getLocalUsers();
    if (!locals.some(u => u.uid === fallbackProfile.uid)) {
      locals.push(fallbackProfile);
      saveLocalUsers(locals);
    }

    return fallbackProfile;
  },

  async login(email: string, pass: string): Promise<UserProfile> {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const profile = await this.ensureUserProfile(cred.user);
    if (profile.active === false) {
      await signOut(auth);
      throw new Error('Account has been deactivated. Please contact your manager.');
    }
    return profile;
  },

  async register(email: string, pass: string, name: string): Promise<UserProfile> {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    return await this.ensureUserProfile(cred.user, name);
  },

  async logout(): Promise<void> {
    await signOut(auth);
  },

  async sendPasswordResetLink(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email);
  },

  async getCurrentUserProfile(): Promise<UserProfile | null> {
    const currentUser = auth.currentUser;
    if (!currentUser) return null;
    return await this.ensureUserProfile(currentUser);
  },

  // Fetch team members for the organization
  async getTeamMembers(organizationId: string): Promise<UserProfile[]> {
    if (!organizationId) return [];

    let fetched: UserProfile[] = [];

    try {
      const q = query(collection(db, 'users'), where('organizationId', '==', organizationId));
      const snap = await getDocs(q);
      snap.forEach((docSnap) => {
        fetched.push(docSnap.data() as UserProfile);
      });
    } catch (error) {
      console.warn('Error fetching team members from Firestore:', error);
    }

    // Merge with local store users
    const locals = getLocalUsers().filter(u => u.organizationId === organizationId);
    const map = new Map<string, UserProfile>();
    
    // Add default currentUser if logged in
    if (auth.currentUser) {
      map.set(auth.currentUser.uid, {
        uid: auth.currentUser.uid,
        email: auth.currentUser.email || '',
        name: auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'Manager',
        role: 'Manager',
        active: true,
        organizationId,
        createdAt: new Date().toISOString()
      });
    }

    fetched.forEach(u => map.set(u.uid, u));
    locals.forEach(u => map.set(u.uid, { ...map.get(u.uid), ...u }));

    const combined = Array.from(map.values());
    saveLocalUsers(combined);
    return combined;
  },

  // Update a team member's role and/or active status
  async updateUserRoleAndStatus(uid: string, role: 'Manager' | 'Telecaller' | 'Salesperson', active: boolean): Promise<void> {
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, { role, active });
    } catch (error) {
      console.warn('Firestore user update failed, updating local cache:', error);
    }

    const locals = getLocalUsers();
    const idx = locals.findIndex(u => u.uid === uid);
    if (idx !== -1) {
      locals[idx].role = role;
      locals[idx].active = active;
      saveLocalUsers(locals);
    }
  },

  // Add a team member using REAL Firebase Authentication with a secondary Auth App instance
  // so the Manager's active session is NEVER logged out or disrupted.
  async addTeamMember(
    organizationId: string, 
    name: string, 
    email: string, 
    role: 'Manager' | 'Telecaller' | 'Salesperson',
    customPassword?: string
  ): Promise<UserProfile & { tempPassword?: string; emailSent?: boolean; firestoreSaved?: boolean }> {
    console.log('[TEAM AUTH DIAGNOSTIC] 2. INPUT VALIDATION', { name, email, role, organizationId, customPasswordProvided: !!customPassword });
    
    const primaryUid = auth.currentUser?.uid;
    const primaryEmail = auth.currentUser?.email;
    console.log('[TEAM AUTH DIAGNOSTIC] 3. PRIMARY AUTH USER UID:', primaryUid);
    console.log('[TEAM AUTH DIAGNOSTIC] 4. PRIMARY AUTH USER EMAIL:', primaryEmail);
    console.log('[TEAM AUTH DIAGNOSTIC] 5. ORGANIZATION ID:', organizationId);

    if (!organizationId) {
      const err = new Error('Organization ID is missing. Cannot add team member.');
      console.error('[TEAM AUTH ERROR]', { operation: 'INPUT_VALIDATION', code: 'MISSING_ORG_ID', message: err.message });
      throw err;
    }

    const tempPassword = customPassword && customPassword.length >= 6 
      ? customPassword 
      : `KrgNav@${Math.floor(100000 + Math.random() * 900000)}`;

    const secondaryAppName = `SecondaryAuth_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    console.log('[TEAM AUTH DIAGNOSTIC] 6. SECONDARY APP INITIALIZATION START:', secondaryAppName);
    let secondaryApp;
    try {
      secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
      console.log('[TEAM AUTH DIAGNOSTIC] 6. SECONDARY APP INITIALIZATION SUCCESS');
    } catch (err: any) {
      console.error('[TEAM AUTH ERROR]', { operation: 'SECONDARY_APP_INIT', code: err.code || err.name, message: err.message, error: err });
      throw new Error(`Failed to initialize secondary app: ${err.message}`);
    }

    console.log('[TEAM AUTH DIAGNOSTIC] 7. SECONDARY AUTH INITIALIZATION START');
    let secondaryAuth;
    try {
      secondaryAuth = getAuth(secondaryApp);
      console.log('[TEAM AUTH DIAGNOSTIC] 7. SECONDARY AUTH INITIALIZATION SUCCESS');
    } catch (err: any) {
      console.error('[TEAM AUTH ERROR]', { operation: 'SECONDARY_AUTH_INIT', code: err.code || err.name, message: err.message, error: err });
      throw new Error(`Failed to initialize secondary auth: ${err.message}`);
    }

    let realUid = '';
    console.log('[TEAM AUTH DIAGNOSTIC] 8. createUserWithEmailAndPassword START for email:', email);
    try {
      const userCred = await createUserWithEmailAndPassword(secondaryAuth, email, tempPassword);
      realUid = userCred.user.uid;
      console.log('[TEAM AUTH DIAGNOSTIC] 9. createUserWithEmailAndPassword SUCCESS');
      console.log('[TEAM AUTH DIAGNOSTIC] 10. GENERATED FIREBASE UID:', realUid);
    } catch (authError: any) {
      console.error('[TEAM AUTH ERROR]', { 
        operation: 'createUserWithEmailAndPassword', 
        code: authError.code || authError.name, 
        message: authError.message, 
        error: authError 
      });

      // Cleanup secondary app on failure
      try { await deleteApp(secondaryApp); } catch (e) {}

      if (authError.code === 'auth/email-already-in-use') {
        throw new Error('This email is already registered. Use another email or resend the password setup link.');
      }
      if (authError.code === 'auth/invalid-email') {
        throw new Error('Invalid email address format.');
      }
      if (authError.code === 'auth/weak-password') {
        throw new Error('Password should be at least 6 characters long.');
      }
      if (authError.code === 'auth/operation-not-allowed') {
        throw new Error('Email/Password authentication is not enabled in Firebase Console.');
      }
      throw new Error(authError.message || 'Failed to create real Firebase Auth user.');
    }

    // 4. Build UserProfile with real Firebase UID
    const newMember: UserProfile = {
      uid: realUid,
      name,
      email,
      role,
      active: true,
      organizationId,
      createdAt: new Date().toISOString()
    };

    // 5. Store user profile in Firestore at users/{realUid}
    let firestoreSaved = false;
    console.log('[TEAM AUTH DIAGNOSTIC] 11. users/{uid} FIRESTORE WRITE START for path: users/' + realUid);
    try {
      const userRef = doc(db, 'users', realUid);
      await setDoc(userRef, newMember);
      firestoreSaved = true;
      console.log('[TEAM AUTH DIAGNOSTIC] 12. users/{uid} FIRESTORE WRITE SUCCESS');
    } catch (error: any) {
      console.error('[TEAM AUTH ERROR]', { 
        operation: 'FIRESTORE_WRITE', 
        code: error.code || error.name, 
        message: error.message, 
        error 
      });
      console.warn('Firestore setDoc failed for new team profile, caching locally:', error);
    }

    // 6. Attempt password setup email
    let emailSent = false;
    console.log('[TEAM AUTH DIAGNOSTIC] 13. sendPasswordResetEmail START for email:', email);
    try {
      await sendPasswordResetEmail(auth, email);
      emailSent = true;
      console.log('[TEAM AUTH DIAGNOSTIC] 14. sendPasswordResetEmail SUCCESS via primary auth');
    } catch (resetErr: any) {
      console.error('[TEAM AUTH ERROR]', { 
        operation: 'sendPasswordResetEmail_primary', 
        code: resetErr.code || resetErr.name, 
        message: resetErr.message, 
        error: resetErr 
      });
      // Fallback: try secondaryAuth
      try {
        await sendPasswordResetEmail(secondaryAuth, email);
        emailSent = true;
        console.log('[TEAM AUTH DIAGNOSTIC] 14. sendPasswordResetEmail SUCCESS via secondaryAuth');
      } catch (fallbackErr: any) {
        console.error('[TEAM AUTH ERROR]', { 
          operation: 'sendPasswordResetEmail_secondary', 
          code: fallbackErr.code || fallbackErr.name, 
          message: fallbackErr.message, 
          error: fallbackErr 
        });
      }
    }

    // 7. Cleanup secondary auth and app
    console.log('[TEAM AUTH DIAGNOSTIC] 15. SECONDARY SIGN OUT');
    try {
      await signOut(secondaryAuth);
    } catch (e: any) {
      console.error('[TEAM AUTH ERROR]', { operation: 'SECONDARY_SIGN_OUT', code: e.code || e.name, message: e.message });
    }

    console.log('[TEAM AUTH DIAGNOSTIC] 16. deleteApp START');
    try {
      await deleteApp(secondaryApp);
      console.log('[TEAM AUTH DIAGNOSTIC] 16. deleteApp SUCCESS');
    } catch (e: any) {
      console.error('[TEAM AUTH ERROR]', { operation: 'DELETE_SECONDARY_APP', code: e.code || e.name, message: e.message });
    }

    // Verify Manager primary session was preserved
    const postPrimaryUid = auth.currentUser?.uid;
    console.log('[TEAM AUTH DIAGNOSTIC] SESSION CHECK - PRE:', primaryUid, 'POST:', postPrimaryUid);
    if (primaryUid && postPrimaryUid !== primaryUid) {
      console.error('[TEAM AUTH ERROR]', { operation: 'SESSION_PRESERVATION', code: 'SESSION_SWITCHED', message: 'Manager session was replaced!' });
    }

    // Update local cache
    const locals = getLocalUsers();
    locals.push(newMember);
    saveLocalUsers(locals);

    console.log('[TEAM AUTH DIAGNOSTIC] 18. FINAL SUCCESS STATE created UID:', realUid);

    return { ...newMember, tempPassword, emailSent, firestoreSaved };
  }
};

