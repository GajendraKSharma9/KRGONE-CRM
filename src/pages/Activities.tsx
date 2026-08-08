import React, { useEffect, useState, useMemo } from 'react';
import { 
  Activity as ActivityIcon, 
  Plus, 
  Trash2, 
  Filter, 
  Building2, 
  Calendar,
  Search
} from 'lucide-react';
import { UserProfile, Activity, ActivityType, Business } from '../types';
import { activityService } from '../services/activityService';
import { businessService } from '../services/businessService';
import { Modal } from '../components/Modal';
import { ConfirmModal } from '../components/ConfirmModal';

interface ActivitiesProps {
  user: UserProfile;
}

export const Activities: React.FC<ActivitiesProps> = ({ user }) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('All');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

  // Add Form state
  const [formData, setFormData] = useState({
    businessId: '',
    type: 'Call' as ActivityType,
    notes: '',
    activityDate: new Date().toISOString().split('T')[0]
  });
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    if (!user.organizationId) return;
    try {
      setLoading(true);
      setError('');
      const [acts, bizs] = await Promise.all([
        activityService.getActivities(user.organizationId),
        businessService.getBusinesses(user.organizationId)
      ]);
      setActivities(acts);
      setBusinesses(bizs);
    } catch (err: any) {
      console.error('Error fetching activities:', err);
      setError(err.message || 'Failed to load activities.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user.organizationId]);

  // Filtered activities
  const filteredActivities = useMemo(() => {
    return activities.filter(a => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery = !q || 
        a.notes.toLowerCase().includes(q) ||
        (a.businessName && a.businessName.toLowerCase().includes(q));

      const matchesType = typeFilter === 'All' || a.type === typeFilter;

      return matchesQuery && matchesType;
    });
  }, [activities, searchQuery, typeFilter]);

  const handleOpenAdd = () => {
    setFormData({
      businessId: businesses.length > 0 ? (businesses[0].id || '') : '',
      type: 'Call',
      notes: '',
      activityDate: new Date().toISOString().split('T')[0]
    });
    setIsAddModalOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.notes.trim()) return;

    try {
      setSaving(true);
      const selectedBiz = businesses.find(b => b.id === formData.businessId);

      const newAct = await activityService.addActivity({
        organizationId: user.organizationId,
        businessId: formData.businessId,
        businessName: selectedBiz?.companyName || 'General',
        type: formData.type,
        notes: formData.notes,
        activityDate: formData.activityDate,
        createdAt: new Date().toISOString()
      });

      setActivities(prev => [newAct, ...prev]);
      setIsAddModalOpen(false);
      showSuccess('Activity logged successfully!');
    } catch (err: any) {
      console.error('Error adding activity:', err);
      alert('Failed to save activity: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedActivity?.id) return;

    try {
      setSaving(true);
      await activityService.deleteActivity(selectedActivity.id);
      setActivities(prev => prev.filter(a => a.id !== selectedActivity.id));
      setIsDeleteModalOpen(false);
      showSuccess('Activity deleted.');
    } catch (err: any) {
      console.error('Error deleting activity:', err);
      alert('Failed to delete activity: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Sales Activities</h1>
          <p className="text-xs text-slate-500 mt-0.5">Track calls, meetings, emails, and follow-ups with prospective accounts.</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Activity</span>
        </button>
      </div>

      {/* Success Banner */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium rounded-xl animate-in fade-in">
          {successMessage}
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3 md:space-y-0 md:flex md:items-center md:space-x-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes or business name..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Types</option>
            <option value="Call">Call</option>
            <option value="Meeting">Meeting</option>
            <option value="Email">Email</option>
            <option value="WhatsApp">WhatsApp</option>
            <option value="Note">Note</option>
          </select>
        </div>
      </div>

      {/* Main List */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs text-slate-400">Loading activities...</p>
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <ActivityIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700 mb-1">No activities found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            {searchQuery || typeFilter !== 'All'
              ? 'No activities match your current search filters.'
              : 'No activities logged yet. Start recording sales interactions with your clients.'}
          </p>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white font-semibold text-xs rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Activity</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredActivities.map((act) => (
            <div
              key={act.id}
              className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 font-bold rounded-md text-[11px]">
                    {act.type}
                  </span>
                  {act.businessName && (
                    <span className="flex items-center text-xs font-semibold text-blue-600">
                      <Building2 className="w-3.5 h-3.5 mr-1 text-blue-500" />
                      {act.businessName}
                    </span>
                  )}
                  <span className="flex items-center text-[11px] text-slate-400 font-mono ml-auto md:ml-0">
                    <Calendar className="w-3 h-3 mr-1 text-slate-400" />
                    {act.activityDate}
                  </span>
                </div>
                <p className="text-xs text-slate-700 whitespace-pre-wrap">{act.notes}</p>
              </div>

              <div className="flex items-center justify-end">
                <button
                  onClick={() => {
                    setSelectedActivity(act);
                    setIsDeleteModalOpen(true);
                  }}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Delete activity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ADD ACTIVITY MODAL */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Log New Activity">
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Link to Business</label>
            <select
              value={formData.businessId}
              onChange={(e) => setFormData({ ...formData, businessId: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
            >
              <option value="">-- General Activity (No Business) --</option>
              {businesses.map(b => (
                <option key={b.id} value={b.id}>{b.companyName}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Activity Type *</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as ActivityType })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
              >
                <option value="Call">Call</option>
                <option value="Meeting">Meeting</option>
                <option value="Email">Email</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Note">Note</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date *</label>
              <input
                type="date"
                required
                value={formData.activityDate}
                onChange={(e) => setFormData({ ...formData, activityDate: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes *</label>
            <textarea
              required
              rows={4}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Record summary of conversation, key points, follow-up actions..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs"
            >
              {saving ? 'Saving...' : 'Save Activity'}
            </button>
          </div>
        </form>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Activity"
        message="Are you sure you want to delete this activity log?"
        confirmText="Delete"
        isLoading={saving}
      />
    </div>
  );
};
