import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Business } from '../types';

const COLLECTION_NAME = 'businesses';
const LOCAL_STORAGE_KEY = 'krg_businesses_store';

function getLocalStore(): Business[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalStore(items: Business[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn('Failed to save to localStorage:', e);
  }
}

function mergeUniqueBusinesses(items: Business[]): Business[] {
  const map = new Map<string, Business>();
  items.forEach(item => {
    if (item.id) {
      map.set(item.id, item);
    }
  });
  return Array.from(map.values());
}

export const businessService = {
  // Retrieve all businesses belonging to the user's organization
  async getBusinesses(organizationId: string): Promise<Business[]> {
    if (!organizationId) return [];

    let firestoreList: Business[] = [];
    
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
        } as Business);
      });
    } catch (error) {
      console.warn('Query with where clause failed in getBusinesses, attempting collection fetch:', error);
      try {
        const snapshot = await getDocs(collection(db, COLLECTION_NAME));
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (!organizationId || data.organizationId === organizationId) {
            firestoreList.push({
              id: docSnap.id,
              ...data
            } as Business);
          }
        });
      } catch (fallbackError) {
        console.warn('Firestore fetch failed completely, relying on local storage:', fallbackError);
      }
    }

    // Merge Firestore list with local storage cache
    const localStore = getLocalStore();
    const filteredLocal = localStore.filter(b => b.organizationId === organizationId || !b.organizationId);
    
    const combined = mergeUniqueBusinesses([...firestoreList, ...filteredLocal]);

    // Keep local storage updated
    saveLocalStore(combined);

    // Sort descending by createdAt
    return combined.sort((a, b) => 
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  },

  // Get single business by ID
  async getBusinessById(id: string): Promise<Business | null> {
    if (!id) return null;
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return {
          id: snapshot.id,
          ...snapshot.data()
        } as Business;
      }
    } catch (error) {
      console.warn('Error in getBusinessById Firestore fetch:', error);
    }

    // Fallback to local store
    const local = getLocalStore().find(b => b.id === id);
    return local || null;
  },

  // Add a single business
  async addBusiness(data: Omit<Business, 'id'>): Promise<Business> {
    const now = new Date().toISOString();
    const payload = {
      organizationId: data.organizationId || 'org_default',
      companyName: (data.companyName || '').trim(),
      contactPerson: (data.contactPerson || '').trim(),
      mobile: (data.mobile || '').trim(),
      email: (data.email || '').trim(),
      industry: (data.industry || 'General').trim(),
      status: data.status || 'New',
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now
    };

    let generatedId = `biz_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    try {
      const docRef = await addDoc(collection(db, COLLECTION_NAME), payload);
      generatedId = docRef.id;
    } catch (error) {
      console.warn('Firestore addDoc failed, persisting to local storage:', error);
    }

    const newBusiness: Business = {
      id: generatedId,
      ...payload
    };

    // Always update local store
    const localStore = getLocalStore();
    localStore.unshift(newBusiness);
    saveLocalStore(localStore);

    return newBusiness;
  },

  // Add multiple businesses in batches with local storage fallback
  async addBusinessesBatch(businessesData: Omit<Business, 'id'>[], onProgress?: (current: number, total: number) => void): Promise<Business[]> {
    if (!businessesData.length) return [];
    
    const now = new Date().toISOString();
    const preparedRecords = businessesData.map(data => ({
      organizationId: data.organizationId || 'org_default',
      companyName: (data.companyName || '').trim(),
      contactPerson: (data.contactPerson || '').trim(),
      mobile: (data.mobile || '').trim(),
      email: (data.email || '').trim(),
      industry: (data.industry || 'General').trim(),
      status: data.status || 'New',
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now
    }));

    const chunkSize = 100;
    const inserted: Business[] = [];

    for (let i = 0; i < preparedRecords.length; i += chunkSize) {
      const chunk = preparedRecords.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      const chunkDocRefs: { ref: any; payload: any; tempId: string }[] = [];

      chunk.forEach(payload => {
        const docRef = doc(collection(db, COLLECTION_NAME));
        batch.set(docRef, payload);
        chunkDocRefs.push({ 
          ref: docRef, 
          payload, 
          tempId: docRef.id || `biz_${Date.now()}_${Math.random().toString(36).substring(2, 7)}` 
        });
      });

      try {
        await batch.commit();
        chunkDocRefs.forEach(({ ref, payload }) => {
          inserted.push({
            id: ref.id,
            ...payload
          });
        });
        if (onProgress) {
          onProgress(inserted.length, preparedRecords.length);
        }
      } catch (error) {
        console.warn('Batch write to Firestore failed, processing individual inserts / local storage fallback:', error);
        
        for (const { payload, tempId } of chunkDocRefs) {
          let recId = tempId;
          try {
            const docRef = await addDoc(collection(db, COLLECTION_NAME), payload);
            recId = docRef.id;
          } catch (singleErr) {
            // Permission or network error - assign local ID
          }

          inserted.push({
            id: recId,
            ...payload
          });

          if (onProgress) {
            onProgress(inserted.length, preparedRecords.length);
          }
        }
      }
    }

    // Save all inserted records to local storage cache
    const currentLocal = getLocalStore();
    const updatedLocal = mergeUniqueBusinesses([...inserted, ...currentLocal]);
    saveLocalStore(updatedLocal);

    return inserted;
  },

  // Update existing business
  async updateBusiness(id: string, data: Partial<Business>): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const updateData = {
      ...data,
      updatedAt: new Date().toISOString()
    };
    delete updateData.id;

    try {
      await updateDoc(docRef, updateData);
    } catch (error) {
      console.warn('Firestore updateDoc failed, updating local storage:', error);
    }

    // Update local storage
    const localStore = getLocalStore();
    const index = localStore.findIndex(b => b.id === id);
    if (index !== -1) {
      localStore[index] = { ...localStore[index], ...updateData };
      saveLocalStore(localStore);
    }
  },

  // Delete business
  async deleteBusiness(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    try {
      await deleteDoc(docRef);
    } catch (error) {
      console.warn('Firestore deleteDoc failed, deleting from local storage:', error);
    }

    // Delete from local storage
    const localStore = getLocalStore();
    const filtered = localStore.filter(b => b.id !== id);
    saveLocalStore(filtered);
  }
};
