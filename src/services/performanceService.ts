import { 
  collection, 
  doc, 
  getDocs, 
  setDoc,
  addDoc, 
  deleteDoc, 
  query, 
  where,
  updateDoc
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { KPI, SalesTarget, AchievementEntry, TeamReview } from '../types';

const KPIS_COL = 'kpis';
const TARGETS_COL = 'sales_targets';
const ACHIEVEMENTS_COL = 'achievement_entries';
const REVIEWS_COL = 'team_reviews';

const LOCAL_KPIS_KEY = 'krg_kpis_store';
const LOCAL_TARGETS_KEY = 'krg_targets_store';
const LOCAL_ACHIEVEMENTS_KEY = 'krg_achievements_store';
const LOCAL_REVIEWS_KEY = 'krg_reviews_store';

// Helper local-storage getters/setters
function getLocalItems<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalItems<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch (e) {
    console.warn(`Failed to save ${key} to localStorage:`, e);
  }
}

// Default Seed KPIs
const DEFAULT_KPIS = [
  { name: 'Sales Revenue', unit: 'Currency' as const, active: true },
  { name: 'New Client Onboarding', unit: 'Number' as const, active: true },
  { name: 'Client Meetings', unit: 'Number' as const, active: true }
];

export const performanceService = {
  // ==========================================
  // KPI MANAGEMENT
  // ==========================================
  async getKPIs(organizationId: string): Promise<KPI[]> {
    if (!organizationId) return [];
    let firestoreList: KPI[] = [];

    try {
      const q = query(
        collection(db, KPIS_COL),
        where('organizationId', '==', organizationId)
      );
      const snapshot = await getDocs(q);
      snapshot.forEach((d) => {
        firestoreList.push({ id: d.id, ...d.data() } as KPI);
      });
    } catch (err) {
      console.warn('Firestore getKPIs failed, fallback to collection query:', err);
      try {
        const snapshot = await getDocs(collection(db, KPIS_COL));
        snapshot.forEach((d) => {
          const data = d.data();
          if (data.organizationId === organizationId) {
            firestoreList.push({ id: d.id, ...data } as KPI);
          }
        });
      } catch (fallbackErr) {
        console.warn('Fallback Firestore collection fetch failed:', fallbackErr);
      }
    }

    // Merge with local storage and sync local-only items to Firestore
    const localList = getLocalItems<KPI>(LOCAL_KPIS_KEY).filter(k => k.organizationId === organizationId);
    const map = new Map<string, KPI>();
    firestoreList.forEach(k => map.set(k.id, k));

    for (const localKpi of localList) {
      if (!map.has(localKpi.id)) {
        try {
          await setDoc(doc(db, KPIS_COL, localKpi.id), {
            organizationId: localKpi.organizationId,
            name: localKpi.name,
            unit: localKpi.unit,
            kpiType: localKpi.kpiType,
            active: localKpi.active,
            createdAt: localKpi.createdAt || new Date().toISOString()
          });
        } catch (e) {
          console.warn(`Failed to sync local KPI ${localKpi.id} to Firestore:`, e);
        }
        map.set(localKpi.id, localKpi);
      }
    }
    let combined = Array.from(map.values());

    // Auto-seed defaults if list is completely empty
    if (combined.length === 0) {
      const now = new Date().toISOString();
      for (const item of DEFAULT_KPIS) {
        const id = `kpi_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const seedKpi: KPI = {
          id,
          organizationId,
          name: item.name,
          unit: item.unit,
          kpiType: 'system',
          active: item.active,
          createdAt: now
        };
        combined.push(seedKpi);
        // Try creating on Firestore asynchronously
        try {
          await setDoc(doc(db, KPIS_COL, id), {
            organizationId,
            name: item.name,
            unit: item.unit,
            kpiType: 'system',
            active: item.active,
            createdAt: now
          });
        } catch (e) {
          console.warn('Failed to seed default KPI on firestore:', e);
        }
      }
    }

    saveLocalItems(LOCAL_KPIS_KEY, combined);
    return combined;
  },

  async addKPI(organizationId: string, name: string, unit: 'Currency' | 'Number' | 'Percentage' | 'Units' | 'Custom'): Promise<KPI> {
    const id = `kpi_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const payload = {
      organizationId,
      name: name.trim(),
      unit,
      kpiType: 'custom' as const,
      active: true,
      createdAt: now
    };

    try {
      await setDoc(doc(db, KPIS_COL, id), payload);
    } catch (err) {
      console.warn('Firestore addKPI failed:', err);
    }

    const newKpi: KPI = { id, ...payload };
    const local = getLocalItems<KPI>(LOCAL_KPIS_KEY);
    local.push(newKpi);
    saveLocalItems(LOCAL_KPIS_KEY, local);
    return newKpi;
  },

  async updateKPI(kpiId: string, data: Partial<Omit<KPI, 'id' | 'organizationId' | 'createdAt'>>): Promise<void> {
    try {
      const docRef = doc(db, KPIS_COL, kpiId);
      await updateDoc(docRef, data);
    } catch (err) {
      console.warn('Firestore updateKPI failed:', err);
    }

    const local = getLocalItems<KPI>(LOCAL_KPIS_KEY);
    const updated = local.map(k => k.id === kpiId ? { ...k, ...data } : k);
    saveLocalItems(LOCAL_KPIS_KEY, updated);
  },

  async deleteKPI(kpiId: string): Promise<void> {
    try {
      const docRef = doc(db, KPIS_COL, kpiId);
      await deleteDoc(docRef);
    } catch (err) {
      console.warn('Firestore deleteKPI failed:', err);
    }

    const local = getLocalItems<KPI>(LOCAL_KPIS_KEY);
    const updated = local.filter(k => k.id !== kpiId);
    saveLocalItems(LOCAL_KPIS_KEY, updated);
  },

  // ==========================================
  // TARGET SETTING
  // ==========================================
  async getTargets(organizationId: string, period?: string): Promise<SalesTarget[]> {
    if (!organizationId) return [];
    let firestoreList: SalesTarget[] = [];

    try {
      let q = query(
        collection(db, TARGETS_COL),
        where('organizationId', '==', organizationId)
      );
      if (period) {
        q = query(q, where('period', '==', period));
      }
      const snapshot = await getDocs(q);
      snapshot.forEach((d) => {
        firestoreList.push({ id: d.id, ...d.data() } as SalesTarget);
      });
    } catch (err) {
      console.warn('Firestore getTargets failed, fallback to collection query:', err);
      try {
        const snapshot = await getDocs(collection(db, TARGETS_COL));
        snapshot.forEach((d) => {
          const data = d.data();
          if (data.organizationId === organizationId && (!period || data.period === period)) {
            firestoreList.push({ id: d.id, ...data } as SalesTarget);
          }
        });
      } catch (fallbackErr) {
        console.warn('Fallback Firestore collection fetch failed:', fallbackErr);
      }
    }

    const localList = getLocalItems<SalesTarget>(LOCAL_TARGETS_KEY).filter(t => t.organizationId === organizationId && (!period || t.period === period));
    const map = new Map<string, SalesTarget>();
    firestoreList.forEach(t => map.set(t.id, t));

    for (const localTarget of localList) {
      if (!map.has(localTarget.id)) {
        try {
          await setDoc(doc(db, TARGETS_COL, localTarget.id), {
            organizationId: localTarget.organizationId,
            salespersonUid: localTarget.salespersonUid,
            salespersonName: localTarget.salespersonName,
            kpiId: localTarget.kpiId,
            kpiName: localTarget.kpiName,
            period: localTarget.period,
            targetValue: localTarget.targetValue,
            managerComment: localTarget.managerComment || '',
            createdAt: localTarget.createdAt || new Date().toISOString()
          });
        } catch (e) {
          console.warn(`Failed to sync local target ${localTarget.id} to Firestore:`, e);
        }
        map.set(localTarget.id, localTarget);
      }
    }
    const combined = Array.from(map.values());

    saveLocalItems(LOCAL_TARGETS_KEY, combined);
    return combined;
  },

  async setTarget(
    organizationId: string,
    salespersonUid: string,
    salespersonName: string,
    kpiId: string,
    kpiName: string,
    period: string,
    targetValue: number,
    managerComment?: string
  ): Promise<SalesTarget> {
    const id = `target_${salespersonUid}_${kpiId}_${period}`;
    const now = new Date().toISOString();
    const payload = {
      organizationId,
      salespersonUid,
      salespersonName,
      kpiId,
      kpiName,
      period,
      targetValue,
      managerComment: managerComment || '',
      createdAt: now
    };

    try {
      await setDoc(doc(db, TARGETS_COL, id), payload);
    } catch (err) {
      console.warn('Firestore setTarget failed:', err);
    }

    const newTarget: SalesTarget = { id, ...payload };
    const local = getLocalItems<SalesTarget>(LOCAL_TARGETS_KEY);
    const filtered = local.filter(t => t.id !== id);
    filtered.push(newTarget);
    saveLocalItems(LOCAL_TARGETS_KEY, filtered);
    return newTarget;
  },

  async updateTargetComment(targetId: string, comment: string): Promise<void> {
    try {
      const docRef = doc(db, TARGETS_COL, targetId);
      await updateDoc(docRef, { managerComment: comment });
    } catch (err) {
      console.warn('Firestore updateTargetComment failed:', err);
    }

    const local = getLocalItems<SalesTarget>(LOCAL_TARGETS_KEY);
    const updated = local.map(t => t.id === targetId ? { ...t, managerComment: comment } : t);
    saveLocalItems(LOCAL_TARGETS_KEY, updated);
  },

  async saveBulkTargets(
    organizationId: string,
    period: string,
    targetsList: { salespersonUid: string; salespersonName: string; kpiId: string; kpiName: string; targetValue: number }[]
  ): Promise<SalesTarget[]> {
    const results: SalesTarget[] = [];
    for (const item of targetsList) {
      const targetObj = await this.setTarget(
        organizationId,
        item.salespersonUid,
        item.salespersonName,
        item.kpiId,
        item.kpiName,
        period,
        item.targetValue
      );
      results.push(targetObj);
    }
    return results;
  },

  async deleteTarget(targetId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, TARGETS_COL, targetId));
    } catch (err) {
      console.warn('Firestore deleteTarget failed:', err);
    }

    const local = getLocalItems<SalesTarget>(LOCAL_TARGETS_KEY);
    const updated = local.filter(t => t.id !== targetId);
    saveLocalItems(LOCAL_TARGETS_KEY, updated);
  },

  // ==========================================
  // MANUAL ACHIEVEMENT ENTRIES
  // ==========================================
  async getAchievements(organizationId: string): Promise<AchievementEntry[]> {
    if (!organizationId) return [];
    let firestoreList: AchievementEntry[] = [];

    try {
      const q = query(
        collection(db, ACHIEVEMENTS_COL),
        where('organizationId', '==', organizationId)
      );
      const snapshot = await getDocs(q);
      snapshot.forEach((d) => {
        firestoreList.push({ id: d.id, ...d.data() } as AchievementEntry);
      });
    } catch (err) {
      console.warn('Firestore getAchievements failed, fallback to collection query:', err);
      try {
        const snapshot = await getDocs(collection(db, ACHIEVEMENTS_COL));
        snapshot.forEach((d) => {
          const data = d.data();
          if (data.organizationId === organizationId) {
            firestoreList.push({ id: d.id, ...data } as AchievementEntry);
          }
        });
      } catch (fallbackErr) {
        console.warn('Fallback Firestore collection fetch failed:', fallbackErr);
      }
    }

    const localList = getLocalItems<AchievementEntry>(LOCAL_ACHIEVEMENTS_KEY).filter(a => a.organizationId === organizationId);
    const map = new Map<string, AchievementEntry>();
    firestoreList.forEach(a => map.set(a.id, a));

    for (const localAch of localList) {
      if (!map.has(localAch.id)) {
        try {
          await setDoc(doc(db, ACHIEVEMENTS_COL, localAch.id), {
            organizationId: localAch.organizationId,
            salespersonUid: localAch.salespersonUid,
            salespersonName: localAch.salespersonName,
            kpiId: localAch.kpiId,
            kpiName: localAch.kpiName,
            value: localAch.value,
            date: localAch.date,
            customerClient: localAch.customerClient || '',
            product: localAch.product || '',
            supportingReference: localAch.supportingReference || '',
            notes: localAch.notes || '',
            createdAt: localAch.createdAt || new Date().toISOString()
          });
        } catch (e) {
          console.warn(`Failed to sync local achievement ${localAch.id} to Firestore:`, e);
        }
        map.set(localAch.id, localAch);
      }
    }
    const combined = Array.from(map.values());

    saveLocalItems(LOCAL_ACHIEVEMENTS_KEY, combined);
    return combined;
  },

  async addAchievement(
    organizationId: string,
    salespersonUid: string,
    salespersonName: string,
    kpiId: string,
    kpiName: string,
    value: number,
    date: string,
    customerClient?: string,
    product?: string,
    supportingReference?: string,
    notes?: string
  ): Promise<AchievementEntry> {
    const id = `ach_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const payload = {
      organizationId,
      salespersonUid,
      salespersonName,
      kpiId,
      kpiName,
      value,
      date,
      customerClient: customerClient || '',
      product: product || '',
      supportingReference: supportingReference || '',
      notes: notes || '',
      createdAt: now
    };

    try {
      await setDoc(doc(db, ACHIEVEMENTS_COL, id), payload);
    } catch (err) {
      console.warn('Firestore addAchievement failed:', err);
    }

    const newEntry: AchievementEntry = { id, ...payload };
    const local = getLocalItems<AchievementEntry>(LOCAL_ACHIEVEMENTS_KEY);
    local.push(newEntry);
    saveLocalItems(LOCAL_ACHIEVEMENTS_KEY, local);
    return newEntry;
  },

  async deleteAchievement(achievementId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, ACHIEVEMENTS_COL, achievementId));
    } catch (err) {
      console.warn('Firestore deleteAchievement failed:', err);
    }

    const local = getLocalItems<AchievementEntry>(LOCAL_ACHIEVEMENTS_KEY);
    const updated = local.filter(a => a.id !== achievementId);
    saveLocalItems(LOCAL_ACHIEVEMENTS_KEY, updated);
  },

  // ==========================================
  // TEAM PERFORMANCE REVIEWS
  // ==========================================
  async getTeamReviews(organizationId: string): Promise<TeamReview[]> {
    if (!organizationId) return [];
    let firestoreList: TeamReview[] = [];

    try {
      const q = query(
        collection(db, REVIEWS_COL),
        where('organizationId', '==', organizationId)
      );
      const snapshot = await getDocs(q);
      snapshot.forEach((d) => {
        firestoreList.push({ id: d.id, ...d.data() } as TeamReview);
      });
    } catch (err) {
      console.warn('Firestore getTeamReviews failed, fallback to collection query:', err);
      try {
        const snapshot = await getDocs(collection(db, REVIEWS_COL));
        snapshot.forEach((d) => {
          const data = d.data();
          if (data.organizationId === organizationId) {
            firestoreList.push({ id: d.id, ...data } as TeamReview);
          }
        });
      } catch (fallbackErr) {
        console.warn('Fallback Firestore collection fetch failed:', fallbackErr);
      }
    }

    const localList = getLocalItems<TeamReview>(LOCAL_REVIEWS_KEY).filter(r => r.organizationId === organizationId);
    const map = new Map<string, TeamReview>();
    firestoreList.forEach(r => map.set(r.id!, r));

    for (const localReview of localList) {
      if (localReview.id && !map.has(localReview.id)) {
        try {
          await setDoc(doc(db, REVIEWS_COL, localReview.id), {
            organizationId: localReview.organizationId,
            salespersonUid: localReview.salespersonUid,
            salespersonName: localReview.salespersonName,
            kpiId: localReview.kpiId,
            kpiName: localReview.kpiName,
            target: localReview.target,
            achievement: localReview.achievement,
            gap: localReview.gap,
            completionPercentage: localReview.completionPercentage,
            status: localReview.status,
            reason: localReview.reason || '',
            managerComment: localReview.managerComment || '',
            actionPlan: localReview.actionPlan || '',
            reviewDate: localReview.reviewDate,
            nextReviewDate: localReview.nextReviewDate,
            reviewStatus: localReview.reviewStatus,
            createdBy: localReview.createdBy,
            createdAt: localReview.createdAt || new Date().toISOString(),
            updatedAt: localReview.updatedAt || new Date().toISOString()
          });
        } catch (e) {
          console.warn(`Failed to sync local review ${localReview.id} to Firestore:`, e);
        }
        map.set(localReview.id, localReview);
      }
    }
    const combined = Array.from(map.values());

    saveLocalItems(LOCAL_REVIEWS_KEY, combined);
    return combined;
  },

  async saveTeamReview(
    organizationId: string,
    reviewData: Omit<TeamReview, 'organizationId' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<TeamReview> {
    const id = reviewData.id || `rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    
    const local = getLocalItems<TeamReview>(LOCAL_REVIEWS_KEY);
    const existing = local.find(r => r.id === id);
    const createdAt = existing ? existing.createdAt : now;
    
    const payload = {
      organizationId,
      salespersonUid: reviewData.salespersonUid,
      salespersonName: reviewData.salespersonName,
      kpiId: reviewData.kpiId,
      kpiName: reviewData.kpiName,
      target: reviewData.target,
      achievement: reviewData.achievement,
      gap: reviewData.gap,
      completionPercentage: reviewData.completionPercentage,
      status: reviewData.status,
      reason: reviewData.reason || '',
      managerComment: reviewData.managerComment || '',
      actionPlan: reviewData.actionPlan || '',
      reviewDate: reviewData.reviewDate,
      nextReviewDate: reviewData.nextReviewDate,
      reviewStatus: reviewData.reviewStatus,
      createdBy: reviewData.createdBy,
      createdAt,
      updatedAt: now
    };

    try {
      await setDoc(doc(db, REVIEWS_COL, id), payload);
    } catch (err) {
      console.warn('Firestore saveTeamReview failed:', err);
    }

    const savedReview: TeamReview = { id, ...payload };
    const filtered = local.filter(r => r.id !== id);
    filtered.push(savedReview);
    saveLocalItems(LOCAL_REVIEWS_KEY, filtered);
    return savedReview;
  }
};
