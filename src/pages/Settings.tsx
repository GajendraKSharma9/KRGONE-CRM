import React, { useState, useEffect } from 'react';
import { User, Mail, Building, LogOut, Check, Save, Users, UserPlus, Shield, Power, KeyRound, Send, CheckCircle2 } from 'lucide-react';
import { UserProfile, Organization } from '../types';
import { authService } from '../services/authService';
import { orgService } from '../services/orgService';
import { Modal } from '../components/Modal';

interface SettingsProps {
  user: UserProfile;
}

export const Settings: React.FC<SettingsProps> = ({ user }) => {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [orgNameInput, setOrgNameInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Team Management state
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'Manager' | 'Telecaller' | 'Salesperson'>('Telecaller');
  const [newMemberPassword, setNewMemberPassword] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [createdMemberDetails, setCreatedMemberDetails] = useState<{ email: string; tempPass: string; uid: string } | null>(null);
  const [resettingEmail, setResettingEmail] = useState<string | null>(null);

  const effectiveOrgId = user.organizationId || `org_${user.uid}`;

  useEffect(() => {
    async function loadOrg() {
      try {
        setLoading(true);
        const org = await orgService.getOrganization(effectiveOrgId);
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
  }, [effectiveOrgId]);

  useEffect(() => {
    async function loadTeam() {
      try {
        setLoadingTeam(true);
        const members = await authService.getTeamMembers(effectiveOrgId);
        setTeamMembers(members);
      } catch (err) {
        console.error('Error loading team members:', err);
      } finally {
        setLoadingTeam(false);
      }
    }
    loadTeam();
  }, [effectiveOrgId]);

  const handleUpdateOrgName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgNameInput.trim()) return;

    try {
      setSaving(true);
      await orgService.updateOrganizationName(effectiveOrgId, orgNameInput.trim());
      setSuccessMsg('Organization name updated successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      console.error('Error updating org name:', err);
      alert('Failed to update organization name: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSendResetEmail = async (email: string) => {
    try {
      setResettingEmail(email);
      await authService.sendPasswordResetLink(email);
      setSuccessMsg(`Password reset & setup email sent to ${email}!`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error('Failed to send reset link:', err);
      alert('Failed to send password setup email: ' + err.message);
    } finally {
      setResettingEmail(null);
    }
  };

  const handleRoleChange = async (targetUid: string, newRole: 'Manager' | 'Telecaller' | 'Salesperson', currentActive: boolean) => {
    try {
      await authService.updateUserRoleAndStatus(targetUid, newRole, currentActive);
      setTeamMembers(prev => prev.map(m => m.uid === targetUid ? { ...m, role: newRole } : m));
      setSuccessMsg('Team member role updated!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      console.error('Failed to update role:', err);
    }
  };

  const handleStatusToggle = async (targetUid: string, currentRole: 'Manager' | 'Telecaller' | 'Salesperson', currentActive: boolean) => {
    try {
      const nextActive = !currentActive;
      await authService.updateUserRoleAndStatus(targetUid, currentRole, nextActive);
      setTeamMembers(prev => prev.map(m => m.uid === targetUid ? { ...m, active: nextActive } : m));
      setSuccessMsg(`Team member ${nextActive ? 'activated' : 'deactivated'}!`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      console.error('Failed to update status:', err);
    }
  };

  const handleAddTeamMember = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[TEAM AUTH DIAGNOSTIC] 1. FORM SUBMIT START');

    if (!newMemberName.trim() || !newMemberEmail.trim()) {
      alert('Please enter both Full Name and Email Address.');
      return;
    }

    try {
      setAddingMember(true);
      const created = await authService.addTeamMember(
        effectiveOrgId,
        newMemberName.trim(),
        newMemberEmail.trim(),
        newMemberRole,
        newMemberPassword.trim() || undefined
      );

      console.log('[TEAM AUTH DIAGNOSTIC] 17. TEAM MEMBER LIST REFRESH');
      setTeamMembers(prev => [...prev.filter(m => m.uid !== created.uid), created]);

      setCreatedMemberDetails({
        email: created.email,
        tempPass: created.tempPassword || 'Auto-generated',
        uid: created.uid
      });

      if (created.emailSent) {
        setSuccessMsg(`Real Firebase Auth account created for ${created.name}! Password setup link sent.`);
      } else {
        setSuccessMsg(`Real Firebase Auth account created for ${created.name}! (Note: Auto email delivery skipped/failed; use Password Setup Link button).`);
      }
      setTimeout(() => setSuccessMsg(''), 6000);
    } catch (err: any) {
      console.error('[TEAM AUTH ERROR] handleAddTeamMember submission failed:', err);
      alert('Unable to create team member: ' + (err.message || 'Unknown error'));
    } finally {
      setAddingMember(false);
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
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight mb-1">Account & Organization Settings</h1>
        <p className="text-xs text-slate-500">Manage your user profile, team members, and workspace configuration.</p>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium rounded-xl flex items-center space-x-2 animate-in fade-in">
          <Check className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* User Profile Info */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
          <User className="w-4 h-4 text-blue-600" />
          <span>User Profile</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Assigned Role</label>
            <div className="flex items-center space-x-3 p-3 bg-blue-50/50 border border-blue-200 rounded-xl">
              <Shield className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold text-blue-800">{user.role || 'Manager'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* TEAM MANAGEMENT SECTION */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
              <Users className="w-4 h-4 text-indigo-600" />
              <span>Team Management</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Manage team members, roles, and status within your workspace.</p>
          </div>
          <button
            onClick={() => setIsAddMemberModalOpen(true)}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center space-x-1.5 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Team Member</span>
          </button>
        </div>

        {loadingTeam ? (
          <div className="py-6 text-center text-xs text-slate-400">Loading team members...</div>
        ) : teamMembers.length === 0 ? (
          <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
            No team members added yet. Click "Add Team Member" to add telecallers or salespeople.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Email & Firebase Auth UID</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium">
                {teamMembers.map((member) => {
                  const isActive = member.active !== false;
                  return (
                    <tr key={member.uid} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-bold text-slate-800">
                        <div className="flex items-center space-x-1.5">
                          <span>{member.name}</span>
                          <span className="text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-bold border border-indigo-100">
                            Firebase Auth
                          </span>
                        </div>
                      </td>
                      <td className="p-3 text-slate-600 font-mono">
                        <div>{member.email}</div>
                        <div className="text-[10px] text-slate-400">UID: {member.uid}</div>
                      </td>
                      <td className="p-3">
                        <select
                          value={member.role || 'Telecaller'}
                          onChange={(e) => handleRoleChange(member.uid, e.target.value as any, isActive)}
                          className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="Manager">Manager</option>
                          <option value="Telecaller">Telecaller</option>
                          <option value="Salesperson">Salesperson</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            type="button"
                            onClick={() => handleSendResetEmail(member.email)}
                            disabled={resettingEmail === member.email}
                            title="Send Password Reset & Setup Link to Employee Email"
                            className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-[11px] font-semibold transition-colors flex items-center space-x-1"
                          >
                            <Send className="w-3 h-3 text-blue-600" />
                            <span>{resettingEmail === member.email ? 'Sending...' : 'Password Setup Link'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStatusToggle(member.uid, member.role || 'Telecaller', isActive)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors flex items-center space-x-1 ${
                              isActive
                                ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                            }`}
                          >
                            <Power className="w-3 h-3" />
                            <span>{isActive ? 'Deactivate' : 'Activate'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Organization Settings */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
          <Building className="w-4 h-4 text-slate-600" />
          <span>Organization Details</span>
        </h2>

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

      {/* ADD TEAM MEMBER MODAL */}
      <Modal 
        isOpen={isAddMemberModalOpen} 
        onClose={() => {
          setIsAddMemberModalOpen(false);
          setCreatedMemberDetails(null);
        }} 
        title="Add Team Member (Firebase Auth)"
      >
        {createdMemberDetails ? (
          <div className="space-y-4 py-2">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
              <div className="flex items-center space-x-2 text-emerald-800 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Real Firebase Authentication Account Created!</span>
              </div>
              <p className="text-xs text-emerald-700">
                A password setup/reset email has been automatically dispatched to <strong>{createdMemberDetails.email}</strong>.
              </p>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-2 font-mono">
              <div><span className="font-bold text-slate-500">Email:</span> {createdMemberDetails.email}</div>
              <div><span className="font-bold text-slate-500">Temp Password:</span> {createdMemberDetails.tempPass}</div>
              <div><span className="font-bold text-slate-500">Firebase Auth UID:</span> {createdMemberDetails.uid}</div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setCreatedMemberDetails(null);
                  setNewMemberName('');
                  setNewMemberEmail('');
                  setNewMemberPassword('');
                  setIsAddMemberModalOpen(false);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleAddTeamMember} className="space-y-4">
            <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl text-[11px] text-indigo-900 leading-relaxed">
              🔑 <strong>Real Firebase Authentication:</strong> Creates a genuine Firebase Auth account with a real UID. The Manager session will remain logged in. An automated setup email is sent so the employee can set their password.
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Rahul Sharma"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                required
                placeholder="e.g. rahul@company.com"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Role</label>
              <select
                value={newMemberRole}
                onChange={(e) => setNewMemberRole(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              >
                <option value="Telecaller">Telecaller</option>
                <option value="Salesperson">Salesperson</option>
                <option value="Manager">Manager</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Initial / Temporary Password <span className="font-normal text-slate-400">(Optional, min 6 chars)</span>
              </label>
              <input
                type="text"
                placeholder="Leave blank for auto-generated password"
                value={newMemberPassword}
                onChange={(e) => setNewMemberPassword(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsAddMemberModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 font-semibold text-xs rounded-xl hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addingMember}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs"
              >
                {addingMember ? 'Creating Firebase Auth...' : 'Create Team Member'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
