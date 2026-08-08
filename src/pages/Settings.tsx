import React, { useState, useEffect } from 'react';
import { User, Mail, Building, LogOut, Check, Save } from 'lucide-react';
import { UserProfile, Organization } from '../types';
import { authService } from '../services/authService';
import { orgService } from '../services/orgService';

interface SettingsProps {
  user: UserProfile;
}

export const Settings: React.FC<SettingsProps> = ({ user }) => {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [orgNameInput, setOrgNameInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    async function loadOrg() {
      if (!user.organizationId) return;
      try {
        setLoading(true);
        const org = await orgService.getOrganization(user.organizationId);
        if (org) {
          setOrganization(org);
          setOrgNameInput(org.name);
        }
      } catch (err) {
        console.error('Error loading organization:', err);
      } finally {
        setLoading(false);
      }
    }
    loadOrg();
  }, [user.organizationId]);

  const handleUpdateOrgName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgNameInput.trim() || !user.organizationId) return;

    try {
      setSaving(true);
      await orgService.updateOrganizationName(user.organizationId, orgNameInput.trim());
      setSuccessMsg('Organization name updated successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      console.error('Error updating org name:', err);
      alert('Failed to update organization name: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
      window.location.hash = '#/login';
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight mb-1">Account & Organization Settings</h1>
        <p className="text-xs text-slate-500">Manage your user profile and workspace configuration.</p>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium rounded-xl flex items-center space-x-2 animate-in fade-in">
          <Check className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* User Profile Info */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">User Profile</h2>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Full Name</label>
            <div className="flex items-center space-x-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <User className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-800">{user.name}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Email Address</label>
            <div className="flex items-center space-x-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <Mail className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-800">{user.email}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Organization Settings */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Organization Details</h2>

        {loading ? (
          <div className="py-4 text-xs text-slate-400">Loading organization details...</div>
        ) : (
          <form onSubmit={handleUpdateOrgName} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Organization Name</label>
              <div className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <Building className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={orgNameInput}
                    onChange={(e) => setOrgNameInput(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center space-x-1"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving...' : 'Save'}</span>
                </button>
              </div>
            </div>

            <div className="pt-2">
              <p className="text-[11px] text-slate-400 font-mono">
                Organization ID: {user.organizationId}
              </p>
            </div>
          </form>
        )}
      </div>

      {/* Logout Action */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-slate-800">Sign Out</h3>
          <p className="text-[11px] text-slate-500">End your current session on this browser.</p>
        </div>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-xs rounded-xl transition-colors flex items-center space-x-2"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};
