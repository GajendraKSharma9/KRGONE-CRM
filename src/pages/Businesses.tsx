import React, { useEffect, useState, useMemo } from 'react';
import { 
  Building2, 
  Search, 
  Filter, 
  Plus, 
  Edit3, 
  Trash2, 
  Eye, 
  Phone, 
  Mail as MailIcon, 
  User, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Activity as ActivityIcon,
  Tag,
  CloudUpload,
  RefreshCw
} from 'lucide-react';
import { UserProfile, Business, BusinessStatus, Activity, ActivityType } from '../types';
import { businessService } from '../services/businessService';
import { activityService } from '../services/activityService';
import { Modal } from '../components/Modal';
import { ConfirmModal } from '../components/ConfirmModal';

interface BusinessesProps {
  user: UserProfile;
}

export const Businesses: React.FC<BusinessesProps> = ({ user }) => {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [industryFilter, setIndustryFilter] = useState<string>('All');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Selected Business for View/Edit/Delete
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [relatedActivities, setRelatedActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // Form States
  const [formData, setFormData] = useState({
    companyName: '',
    contactPerson: '',
    mobile: '',
    email: '',
    industry: 'Technology',
    status: 'New' as BusinessStatus
  });

  // Quick activity form state inside View Detail modal
  const [quickActivity, setQuickActivity] = useState({
    type: 'Call' as ActivityType,
    notes: '',
    activityDate: new Date().toISOString().split('T')[0]
  });
  const [addingActivity, setAddingActivity] = useState(false);

  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [unsyncedCount, setUnsyncedCount] = useState<number>(0);

  const handleSyncToCloud = async () => {
    if (!user.organizationId) return;
    try {
      setSyncing(true);
      setError('');
      const res = await businessService.syncUnsyncedToFirestore(user.organizationId);
      if (res.syncedCount > 0) {
        setSuccessMessage(`Successfully synced ${res.syncedCount} business contact(s) to Cloud Firestore!`);
        setTimeout(() => setSuccessMessage(''), 4000);
        await loadBusinesses();
      } else {
        setSuccessMessage('All business contacts are already saved in Cloud Firestore.');
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (err: any) {
      console.error('Error syncing to cloud:', err);
      setError(err.message || 'Failed to sync contacts to Cloud Firestore.');
    } finally {
      setSyncing(false);
    }
  };

  // Load Businesses
  const loadBusinesses = async () => {
    if (!user.organizationId) return;
    try {
      setLoading(true);
      setError('');
      const [data, unCount] = await Promise.all([
        businessService.getBusinesses(user.organizationId),
        businessService.getUnsyncedCount(user.organizationId)
      ]);
      setBusinesses(data);
      setUnsyncedCount(unCount);
    } catch (err: any) {
      console.error('Error fetching businesses:', err);
      setError(err.message || 'Failed to load businesses.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBusinesses();
  }, [user.organizationId]);

  // Extract unique industries for filter
  const industries = useMemo(() => {
    const set = new Set<string>();
    businesses.forEach(b => {
      if (b.industry) set.add(b.industry);
    });
    return Array.from(set);
  }, [businesses]);

  // Filtered Businesses
  const filteredBusinesses = useMemo(() => {
    return businesses.filter(b => {
      // Search
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = !query || 
        b.companyName.toLowerCase().includes(query) ||
        b.contactPerson.toLowerCase().includes(query) ||
        b.mobile.toLowerCase().includes(query) ||
        b.email.toLowerCase().includes(query);

      // Status
      const matchesStatus = statusFilter === 'All' || b.status === statusFilter;

      // Industry
      const matchesIndustry = industryFilter === 'All' || b.industry === industryFilter;

      return matchesSearch && matchesStatus && matchesIndustry;
    });
  }, [businesses, searchQuery, statusFilter, industryFilter]);

  // Open Add Modal
  const handleOpenAdd = () => {
    setFormData({
      companyName: '',
      contactPerson: '',
      mobile: '',
      email: '',
      industry: 'Technology',
      status: 'New'
    });
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (biz: Business) => {
    setSelectedBusiness(biz);
    setFormData({
      companyName: biz.companyName,
      contactPerson: biz.contactPerson || '',
      mobile: biz.mobile || '',
      email: biz.email || '',
      industry: biz.industry || 'General',
      status: biz.status
    });
    setIsEditModalOpen(true);
  };

  // Open View Detail Modal
  const handleOpenView = async (biz: Business) => {
    setSelectedBusiness(biz);
    setIsViewModalOpen(true);
    if (biz.id) {
      try {
        setLoadingActivities(true);
        const acts = await activityService.getActivitiesByBusiness(biz.id);
        setRelatedActivities(acts);
      } catch (err) {
        console.error('Error fetching business activities:', err);
      } finally {
        setLoadingActivities(false);
      }
    }
  };

  // Open Delete Confirm Modal
  const handleOpenDelete = (biz: Business) => {
    setSelectedBusiness(biz);
    setIsDeleteModalOpen(true);
  };

  // Save New Business
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName.trim()) return;

    try {
      setSaving(true);
      const newBiz = await businessService.addBusiness({
        organizationId: user.organizationId,
        companyName: formData.companyName,
        contactPerson: formData.contactPerson,
        mobile: formData.mobile,
        email: formData.email,
        industry: formData.industry,
        status: formData.status,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      setBusinesses(prev => [newBiz, ...prev]);
      setIsAddModalOpen(false);
      showSuccess('Business created successfully!');
    } catch (err: any) {
      console.error('Error adding business:', err);
      alert('Failed to add business: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Save Edit Business
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBusiness?.id || !formData.companyName.trim()) return;

    try {
      setSaving(true);
      await businessService.updateBusiness(selectedBusiness.id, {
        companyName: formData.companyName,
        contactPerson: formData.contactPerson,
        mobile: formData.mobile,
        email: formData.email,
        industry: formData.industry,
        status: formData.status
      });

      setBusinesses(prev => prev.map(b => b.id === selectedBusiness.id ? {
        ...b,
        ...formData,
        updatedAt: new Date().toISOString()
      } : b));

      setIsEditModalOpen(false);
      showSuccess('Business updated successfully!');
    } catch (err: any) {
      console.error('Error updating business:', err);
      alert('Failed to update business: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Confirm Delete Business
  const handleDeleteConfirm = async () => {
    if (!selectedBusiness?.id) return;

    try {
      setSaving(true);
      await businessService.deleteBusiness(selectedBusiness.id);
      setBusinesses(prev => prev.filter(b => b.id !== selectedBusiness.id));
      setIsDeleteModalOpen(false);
      showSuccess('Business deleted successfully.');
    } catch (err: any) {
      console.error('Error deleting business:', err);
      alert('Failed to delete business: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Quick Add Activity inside Business Detail view
  const handleQuickActivitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBusiness?.id || !quickActivity.notes.trim()) return;

    try {
      setAddingActivity(true);
      const newAct = await activityService.addActivity({
        organizationId: user.organizationId,
        businessId: selectedBusiness.id,
        businessName: selectedBusiness.companyName,
        type: quickActivity.type,
        notes: quickActivity.notes,
        activityDate: quickActivity.activityDate,
        createdAt: new Date().toISOString()
      });

      setRelatedActivities(prev => [newAct, ...prev]);
      setQuickActivity({
        type: 'Call',
        notes: '',
        activityDate: new Date().toISOString().split('T')[0]
      });
      showSuccess('Activity logged!');
    } catch (err: any) {
      console.error('Error adding activity:', err);
      alert('Failed to log activity: ' + err.message);
    } finally {
      setAddingActivity(false);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Businesses Directory</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage your client accounts, leads, and organizational records.</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleSyncToCloud}
            disabled={syncing}
            className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-500 active:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer border border-amber-500 disabled:opacity-50"
            title="Sync records to Cloud Firestore database (default)"
          >
            <CloudUpload className={`w-4 h-4 text-amber-950 ${syncing ? 'animate-bounce' : ''}`} />
            <span>
              {syncing 
                ? 'Syncing to Cloud...' 
                : unsyncedCount > 0 
                  ? `⚡ Sync ${unsyncedCount} Unsynced Records` 
                  : '⚡ Sync to Cloud Firestore'}
            </span>
          </button>
          <button
            onClick={() => loadBusinesses()}
            className="inline-flex items-center justify-center p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl shadow-xs transition-colors"
            title="Refresh from Cloud Firestore"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Business</span>
          </button>
        </div>
      </div>

      {/* Always-Visible Universal Cloud Sync Banner */}
      <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white rounded-2xl shadow-md border border-slate-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl flex-shrink-0">
            <CloudUpload className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                Cloud Firestore Database Sync Engine
              </h3>
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[10px] font-bold">
                Target: (default)
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              {unsyncedCount > 0 ? (
                <span className="text-amber-300 font-semibold">
                  ⚠️ {unsyncedCount} contact(s) waiting in local cache. Click <strong>Sync Now</strong> to upload directly to Cloud Firestore.
                </span>
              ) : (
                <span className="text-slate-300">
                  ✓ All {businesses.length} contact records are verified and synced with your Cloud Firestore database.
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 self-end md:self-auto">
          <button
            onClick={() => loadBusinesses()}
            disabled={loading}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition-colors flex items-center space-x-1.5"
            title="Refresh from Cloud Firestore"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleSyncToCloud}
            disabled={syncing}
            className="px-4 py-2 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center space-x-2 border border-amber-500 disabled:opacity-50 cursor-pointer"
          >
            <CloudUpload className={`w-4 h-4 ${syncing ? 'animate-bounce' : ''}`} />
            <span>{syncing ? 'Syncing...' : '⚡ Sync to Cloud Now'}</span>
          </button>
        </div>
      </div>

      {/* Success Banner */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium rounded-xl animate-in fade-in">
          {successMessage}
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3 md:space-y-0 md:flex md:items-center md:space-x-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search company, contact, phone, email..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center space-x-3">
          {/* Status Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Statuses</option>
              <option value="New">New</option>
              <option value="Won">Won</option>
              <option value="Lost">Lost</option>
            </select>
          </div>

          {/* Industry Filter */}
          <select
            value={industryFilter}
            onChange={(e) => setIndustryFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Industries</option>
            {industries.map(ind => (
              <option key={ind} value={ind}>{ind}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content Table / List */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs text-slate-400">Loading business records...</p>
        </div>
      ) : filteredBusinesses.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700 mb-1">No businesses found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            {searchQuery || statusFilter !== 'All' || industryFilter !== 'All'
              ? 'No businesses match your current filter parameters.'
              : 'No businesses yet. Start by creating a new business or bulk importing an Excel file.'}
          </p>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white font-semibold text-xs rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Business</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Company Name</th>
                  <th className="px-6 py-3.5">Contact Person</th>
                  <th className="px-6 py-3.5">Mobile</th>
                  <th className="px-6 py-3.5">Email</th>
                  <th className="px-6 py-3.5">Industry</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {filteredBusinesses.map((biz) => (
                  <tr key={biz.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900">{biz.companyName}</p>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{biz.contactPerson || '-'}</td>
                    <td className="px-6 py-4 font-mono text-slate-600">{biz.mobile || '-'}</td>
                    <td className="px-6 py-4 text-slate-600">{biz.email || '-'}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-semibold rounded text-[11px]">
                        {biz.industry || 'General'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 text-[11px] font-semibold rounded-full ${
                          biz.status === 'Won'
                            ? 'bg-emerald-50 text-emerald-700'
                            : biz.status === 'Lost'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-blue-50 text-blue-700'
                        }`}
                      >
                        {biz.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleOpenView(biz)}
                          title="View Detail"
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(biz)}
                          title="Edit"
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(biz)}
                          title="Delete"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADD BUSINESS MODAL */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add New Business">
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Company Name *</label>
            <input
              type="text"
              required
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              placeholder="Acme Corporation"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Person</label>
              <input
                type="text"
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                placeholder="Jane Smith"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number</label>
              <input
                type="text"
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                placeholder="+1 555-0192"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="contact@acme.com"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Industry</label>
              <input
                type="text"
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                placeholder="Technology, Finance, Healthcare..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as BusinessStatus })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
            >
              <option value="New">New</option>
              <option value="Won">Won</option>
              <option value="Lost">Lost</option>
            </select>
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
              {saving ? 'Saving...' : 'Save Business'}
            </button>
          </div>
        </form>
      </Modal>

      {/* EDIT BUSINESS MODAL */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Business">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Company Name *</label>
            <input
              type="text"
              required
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Person</label>
              <input
                type="text"
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number</label>
              <input
                type="text"
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Industry</label>
              <input
                type="text"
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as BusinessStatus })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
            >
              <option value="New">New</option>
              <option value="Won">Won</option>
              <option value="Lost">Lost</option>
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs"
            >
              {saving ? 'Saving...' : 'Update Business'}
            </button>
          </div>
        </form>
      </Modal>

      {/* VIEW BUSINESS DETAIL MODAL */}
      <Modal 
        isOpen={isViewModalOpen} 
        onClose={() => setIsViewModalOpen(false)} 
        title={selectedBusiness?.companyName || 'Business Detail'}
        maxWidth="max-w-2xl"
      >
        {selectedBusiness && (
          <div className="space-y-6">
            {/* Overview Header */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 block font-semibold">Contact Person</span>
                <span className="font-bold text-slate-800 flex items-center mt-0.5">
                  <User className="w-3.5 h-3.5 mr-1 text-slate-500" />
                  {selectedBusiness.contactPerson || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Mobile</span>
                <span className="font-bold text-slate-800 flex items-center mt-0.5 font-mono">
                  <Phone className="w-3.5 h-3.5 mr-1 text-slate-500" />
                  {selectedBusiness.mobile || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Email</span>
                <span className="font-bold text-slate-800 flex items-center mt-0.5">
                  <MailIcon className="w-3.5 h-3.5 mr-1 text-slate-500" />
                  {selectedBusiness.email || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Industry</span>
                <span className="font-bold text-slate-800 flex items-center mt-0.5">
                  <Tag className="w-3.5 h-3.5 mr-1 text-slate-500" />
                  {selectedBusiness.industry || 'General'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Status</span>
                <span className="font-bold text-blue-600 mt-0.5 block">{selectedBusiness.status}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Created Date</span>
                <span className="font-bold text-slate-800 flex items-center mt-0.5">
                  <Calendar className="w-3.5 h-3.5 mr-1 text-slate-500" />
                  {selectedBusiness.createdAt ? new Date(selectedBusiness.createdAt).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>

            {/* Quick Add Activity Form */}
            <div className="border border-blue-100 bg-blue-50/40 p-4 rounded-xl">
              <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center">
                <ActivityIcon className="w-4 h-4 mr-1.5 text-blue-600" />
                Log New Sales Activity
              </h4>
              <form onSubmit={handleQuickActivitySubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Activity Type</label>
                    <select
                      value={quickActivity.type}
                      onChange={(e) => setQuickActivity({ ...quickActivity, type: e.target.value as ActivityType })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                    >
                      <option value="Call">Call</option>
                      <option value="Meeting">Meeting</option>
                      <option value="Email">Email</option>
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="Note">Note</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Date</label>
                    <input
                      type="date"
                      value={quickActivity.activityDate}
                      onChange={(e) => setQuickActivity({ ...quickActivity, activityDate: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Notes *</label>
                  <textarea
                    required
                    rows={2}
                    value={quickActivity.notes}
                    onChange={(e) => setQuickActivity({ ...quickActivity, notes: e.target.value })}
                    placeholder="Log summary of conversation, next follow-up step..."
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  ></textarea>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={addingActivity}
                    className="px-3 py-1.5 bg-blue-600 text-white font-semibold text-xs rounded-lg hover:bg-blue-700"
                  >
                    {addingActivity ? 'Logging...' : 'Log Activity'}
                  </button>
                </div>
              </form>
            </div>

            {/* Related Activities List */}
            <div>
              <h4 className="text-xs font-bold text-slate-800 mb-3 uppercase tracking-wider">
                Activity History ({relatedActivities.length})
              </h4>
              {loadingActivities ? (
                <div className="py-6 text-center text-xs text-slate-400">Loading activities history...</div>
              ) : relatedActivities.length === 0 ? (
                <div className="py-6 text-center bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-400">
                  No activities recorded yet for this business.
                </div>
              ) : (
                <div className="space-y-2">
                  {relatedActivities.map((act) => (
                    <div key={act.id} className="p-3 bg-white border border-slate-200 rounded-lg text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold rounded text-[10px]">
                          {act.type}
                        </span>
                        <span className="text-slate-400 font-mono text-[11px]">{act.activityDate}</span>
                      </div>
                      <p className="text-slate-700">{act.notes}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Business"
        message={`Are you sure you want to delete ${selectedBusiness?.companyName || 'this business'}? This action cannot be undone.`}
        confirmText="Delete"
        isLoading={saving}
      />
    </div>
  );
};
