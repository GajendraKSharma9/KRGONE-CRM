import { db } from '../firebase/config';
import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  addDoc 
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../firebase/firestoreErrors';
import { MarketingChannel, MarketingSOP, MarketingActivity, MarketingInsight } from '../types';

const CHANNELS_COLLECTION = 'marketing_channels';
const SOPS_COLLECTION = 'marketing_sops';
const ACTIVITIES_COLLECTION = 'marketing_activities';
const INSIGHTS_COLLECTION = 'marketing_insights';

export const marketingService = {
  // --- CHANNELS ---
  async getChannels(organizationId: string): Promise<MarketingChannel[]> {
    const cacheKey = `marketing_channels_${organizationId}`;
    try {
      const q = query(
        collection(db, CHANNELS_COLLECTION),
        where('organizationId', '==', organizationId)
      );
      const snapshot = await getDocs(q);
      const channels: MarketingChannel[] = [];
      snapshot.forEach((docSnap) => {
        channels.push({ id: docSnap.id, ...docSnap.data() } as MarketingChannel);
      });
      
      // Sort client-side to eliminate composite index requirements
      channels.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      localStorage.setItem(cacheKey, JSON.stringify(channels));
      return channels;
    } catch (error) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {
          // ignore
        }
      }
      handleFirestoreError(error, OperationType.GET, CHANNELS_COLLECTION);
    }
  },

  async createChannel(channel: Omit<MarketingChannel, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, CHANNELS_COLLECTION), {
        ...channel,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, CHANNELS_COLLECTION);
    }
  },

  async updateChannel(id: string, channel: Partial<MarketingChannel>): Promise<void> {
    try {
      const docRef = doc(db, CHANNELS_COLLECTION, id);
      await updateDoc(docRef, {
        ...channel,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${CHANNELS_COLLECTION}/${id}`);
    }
  },

  async archiveChannel(id: string): Promise<void> {
    try {
      const docRef = doc(db, CHANNELS_COLLECTION, id);
      await updateDoc(docRef, {
        active: false,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${CHANNELS_COLLECTION}/${id}`);
    }
  },

  // --- SOPs ---
  async getSOPs(organizationId: string): Promise<MarketingSOP[]> {
    const cacheKey = `marketing_sops_${organizationId}`;
    try {
      const q = query(
        collection(db, SOPS_COLLECTION),
        where('organizationId', '==', organizationId)
      );
      const snapshot = await getDocs(q);
      const sops: MarketingSOP[] = [];
      snapshot.forEach((docSnap) => {
        sops.push({ id: docSnap.id, ...docSnap.data() } as MarketingSOP);
      });

      // Sort client-side to eliminate composite index requirements
      sops.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      localStorage.setItem(cacheKey, JSON.stringify(sops));
      return sops;
    } catch (error) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {
          // ignore
        }
      }
      handleFirestoreError(error, OperationType.GET, SOPS_COLLECTION);
    }
  },

  async createSOP(sop: Omit<MarketingSOP, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, SOPS_COLLECTION), {
        ...sop,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, SOPS_COLLECTION);
    }
  },

  async updateSOP(id: string, sop: Partial<MarketingSOP>): Promise<void> {
    try {
      const docRef = doc(db, SOPS_COLLECTION, id);
      await updateDoc(docRef, {
        ...sop,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${SOPS_COLLECTION}/${id}`);
    }
  },

  async archiveSOP(id: string): Promise<void> {
    try {
      const docRef = doc(db, SOPS_COLLECTION, id);
      await updateDoc(docRef, {
        active: false,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${SOPS_COLLECTION}/${id}`);
    }
  },

  // --- ACTIVITIES ---
  async getActivities(organizationId: string): Promise<MarketingActivity[]> {
    const cacheKey = `marketing_activities_${organizationId}`;
    try {
      const q = query(
        collection(db, ACTIVITIES_COLLECTION),
        where('organizationId', '==', organizationId)
      );
      const snapshot = await getDocs(q);
      const activities: MarketingActivity[] = [];
      snapshot.forEach((docSnap) => {
        activities.push({ id: docSnap.id, ...docSnap.data() } as MarketingActivity);
      });

      // Sort client-side to eliminate composite index requirements
      activities.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      localStorage.setItem(cacheKey, JSON.stringify(activities));
      return activities;
    } catch (error) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {
          // ignore
        }
      }
      handleFirestoreError(error, OperationType.GET, ACTIVITIES_COLLECTION);
    }
  },

  async createActivity(activity: Omit<MarketingActivity, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, ACTIVITIES_COLLECTION), {
        ...activity,
        createdAt: new Date().toISOString()
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, ACTIVITIES_COLLECTION);
    }
  },

  async updateActivity(id: string, activity: Partial<MarketingActivity>): Promise<void> {
    try {
      const docRef = doc(db, ACTIVITIES_COLLECTION, id);
      await updateDoc(docRef, activity);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${ACTIVITIES_COLLECTION}/${id}`);
    }
  },

  // --- INSIGHTS ---
  async getInsights(organizationId: string): Promise<MarketingInsight[]> {
    const cacheKey = `marketing_insights_${organizationId}`;
    try {
      const q = query(
        collection(db, INSIGHTS_COLLECTION),
        where('organizationId', '==', organizationId)
      );
      const snapshot = await getDocs(q);
      const insights: MarketingInsight[] = [];
      snapshot.forEach((docSnap) => {
        insights.push({ id: docSnap.id, ...docSnap.data() } as MarketingInsight);
      });

      // Sort client-side to eliminate composite index requirements
      insights.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      localStorage.setItem(cacheKey, JSON.stringify(insights));
      return insights;
    } catch (error) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {
          // ignore
        }
      }
      handleFirestoreError(error, OperationType.GET, INSIGHTS_COLLECTION);
    }
  },

  async createInsight(insight: Omit<MarketingInsight, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, INSIGHTS_COLLECTION), {
        ...insight,
        createdAt: new Date().toISOString()
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, INSIGHTS_COLLECTION);
    }
  },

  async updateInsight(id: string, insight: Partial<MarketingInsight>): Promise<void> {
    try {
      const docRef = doc(db, INSIGHTS_COLLECTION, id);
      await updateDoc(docRef, insight);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${INSIGHTS_COLLECTION}/${id}`);
    }
  },

  async deleteInsight(id: string): Promise<void> {
    try {
      const docRef = doc(db, INSIGHTS_COLLECTION, id);
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${INSIGHTS_COLLECTION}/${id}`);
    }
  }
};
