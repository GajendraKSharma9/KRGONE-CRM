import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Activity } from '../types';
import { businessService } from './businessService';

const COLLECTION_NAME = 'activities';
const LOCAL_STORAGE_KEY = 'krg_activities_store';

function getLocalStore(): Activity[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalStore(items: Activity[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn('Failed to save activities to localStorage:', e);
  }
}

function mergeUniqueActivities(items: Activity[]): Activity[] {
  const map = new Map<string, Activity>();
  items.forEach(item => {
    if (item.id) {
      map.set(item.id, item);
    }
  });
  return Array.from(map.values());
}

export const activityService = {
  // Get all activities for an organization
  async getActivities(organizationId: string): Promise<Activity[]> {
    if (!organizationId) return [];

    let firestoreList: Activity[] = [];

    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('organizationId', '==', organizationId)
      );

      const snapshot = await getDocs(q);
      snapshot.forEach((docSnap) => {
        firestoreList.push({
          id: docSnap.id,
          ...docSnap.data()
        } as Activity);
      });
    } catch (error) {
      console.warn('Query with where clause failed in getActivities, attempting fallback fetch:', error);
      try {
        const snapshot = await getDocs(collection(db, COLLECTION_NAME));
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (!organizationId || data.organizationId === organizationId) {
            firestoreList.push({
              id: docSnap.id,
              ...data
            } as Activity);
          }
        });
      } catch (fallbackError) {
        console.warn('Firestore fetch failed in getActivities, relying on local storage:', fallbackError);
      }
    }

    const localStore = getLocalStore();
    const filteredLocal = localStore.filter(a => a.organizationId === organizationId || !a.organizationId);

    const combined = mergeUniqueActivities([...firestoreList, ...filteredLocal]);
    saveLocalStore(combined);

    return combined.sort((a, b) => 
      new Date(b.activityDate || b.createdAt || 0).getTime() - new Date(a.activityDate || a.createdAt || 0).getTime()
    );
  },

  // Get activities for a specific business
  async getActivitiesByBusiness(businessId: string): Promise<Activity[]> {
    if (!businessId) return [];

    let firestoreList: Activity[] = [];

    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('businessId', '==', businessId)
      );

      const snapshot = await getDocs(q);
      snapshot.forEach((docSnap) => {
        firestoreList.push({
          id: docSnap.id,
          ...docSnap.data()
        } as Activity);
      });
    } catch (error) {
      console.warn('Query in getActivitiesByBusiness failed, attempting collection fetch:', error);
      try {
        const snapshot = await getDocs(collection(db, COLLECTION_NAME));
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.businessId === businessId) {
            firestoreList.push({
              id: docSnap.id,
              ...data
            } as Activity);
          }
        });
      } catch (fallbackError) {
        console.warn('Firestore fetch failed in getActivitiesByBusiness, relying on local storage:', fallbackError);
      }
    }

    const localStore = getLocalStore();
    const filteredLocal = localStore.filter(a => a.businessId === businessId);

    const combined = mergeUniqueActivities([...firestoreList, ...filteredLocal]);

    return combined.sort((a, b) => 
      new Date(b.activityDate || b.createdAt || 0).getTime() - new Date(a.activityDate || a.createdAt || 0).getTime()
    );
  },

  // Add activity
  async addActivity(data: Omit<Activity, 'id'>): Promise<Activity> {
    const now = new Date().toISOString();
    const payload: Record<string, any> = {
      organizationId: data.organizationId,
      businessId: data.businessId || '',
      businessName: data.businessName || '',
      type: data.type || data.channel || 'Call',
      channel: data.channel || data.type || 'Call',
      notes: (data.notes || '').trim(),
      activityDate: data.activityDate || new Date().toISOString().split('T')[0],
      createdAt: now
    };

    if (data.userId) payload.userId = data.userId;
    if (data.userName) payload.userName = data.userName;
    if (data.outcome) payload.outcome = data.outcome;
    if (data.followUpDate) payload.followUpDate = data.followUpDate;
    if (data.nextAction) payload.nextAction = data.nextAction;

    let generatedId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    try {
      const docRef = await addDoc(collection(db, COLLECTION_NAME), payload);
      generatedId = docRef.id;
    } catch (error) {
      console.warn('Firestore addDoc for activity failed, storing locally:', error);
    }

    const newActivity: Activity = {
      id: generatedId,
      ...payload
    } as Activity;

    const localStore = getLocalStore();
    localStore.unshift(newActivity);
    saveLocalStore(localStore);

    // If followUpDate or nextAction or outcome is provided, update parent business
    if (data.businessId) {
      const bizUpdate: Record<string, any> = {};
      if (data.followUpDate) bizUpdate.nextFollowUpDate = data.followUpDate;
      if (data.nextAction) bizUpdate.nextAction = data.nextAction;
      
      // Auto-update lead status to CONTACTED if it was NEW
      if (data.outcome) {
        try {
          const biz = await businessService.getBusinessById(data.businessId);
          if (biz && (biz.status === 'NEW' || biz.status === 'New')) {
            bizUpdate.status = 'CONTACTED';
          }
        } catch {
          // ignore error
        }
      }

      if (Object.keys(bizUpdate).length > 0) {
        businessService.updateBusiness(data.businessId, bizUpdate).catch(err => {
          console.warn('Failed to auto-update business follow-up from activity:', err);
        });
      }
    }

    return newActivity;
  },

  // Delete activity
  async deleteActivity(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    try {
      await deleteDoc(docRef);
    } catch (error) {
      console.warn('Firestore deleteDoc for activity failed, deleting locally:', error);
    }

    const localStore = getLocalStore();
    const filtered = localStore.filter(a => a.id !== id);
    saveLocalStore(filtered);
  }
};
