import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Organization } from '../types';

export const orgService = {
  async getOrganization(orgId: string): Promise<Organization | null> {
    if (!orgId) return null;
    try {
      const orgDoc = await getDoc(doc(db, 'organizations', orgId));
      if (orgDoc.exists()) {
        return { id: orgDoc.id, ...orgDoc.data() } as Organization;
      }
    } catch (error) {
      console.warn('Error fetching organization from Firestore:', error);
    }

    // Fallback to local representation
    return {
      id: orgId,
      name: 'Sales Workspace',
      createdAt: new Date().toISOString()
    };
  },

  async updateOrganizationName(orgId: string, name: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'organizations', orgId), { name });
    } catch (error) {
      console.warn('Error updating organization in Firestore:', error);
    }
  },

  async updateOrganizationTarget(orgId: string, monthlyTeamTarget: number): Promise<void> {
    try {
      await updateDoc(doc(db, 'organizations', orgId), { monthlyTeamTarget });
    } catch (error) {
      console.warn('Error updating organization target in Firestore:', error);
    }
  }
};
