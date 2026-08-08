import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, 
  Activity as ActivityIcon, 
  Plus, 
  ArrowUpRight, 
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';
import { UserProfile, Business, Activity } from '../types';
import { businessService } from '../services/businessService';
import { activityService } from '../services/activityService';

interface DashboardProps {
  user: UserProfile;
}

export const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardData() {
      if (!user.organizationId) return;
      try {
        setLoading(true);
        setError('');
        const [bizData, actData] = await Promise.all([
          businessService.getBusinesses(user.organizationId),
          activityService.getActivities(user.organizationId)
        ]);

        if (isMounted) {
          setBusinesses(bizData);
          setActivities(actData);
        }
      } catch (err: any) {
        console.error('Error loading dashboard data:', err);
        if (isMounted) {
          setError(err.message || 'Failed to connect to database.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, [user.organizationId]);

  const totalBusinesses = businesses.length;
  const newBusinesses = businesses.filter(b => b.status === 'New').length;
  const wonBusinesses = businesses.filter(b => b.status === 'Won').length;
  const lostBusinesses = businesses.filter(b => b.status === 'Lost').length;
  const totalActivities = activities.length;

  const recentBusinesses = businesses.slice(0, 5);
  const recentActivities = activities.slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">
        <h3 className="font-semibold text-lg mb-1">Firestore Connection Warning</h3>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900 text-white rounded-2xl p-6 shadow-md">
        <div>
          <h1 className="text-xl font-bold">Welcome back, {user.name}!</h1>
          <p className="text-sm text-slate-300 mt-1">
            Here is a overview of your organization's sales activities and pipeline.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/businesses"
            className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Business</span>
          </Link>
          <Link
            to="/activities"
            className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg transition-colors border border-slate-700"
          >
            <ActivityIcon className="w-4 h-4" />
            <span>Add Activity</span>
          </Link>
          <Link
            to="/bulk-import"
            className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold rounded-lg transition-colors border border-slate-700"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel Import</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Businesses</span>
            <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-3">{totalBusinesses}</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">New Pipelines</span>
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-blue-600 mt-3">{newBusinesses}</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Won Deals</span>
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600 mt-3">{wonBusinesses}</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Lost Deals</span>
            <div className="p-2 bg-rose-50 rounded-lg text-rose-600">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-rose-600 mt-3">{lostBusinesses}</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Activities Logged</span>
            <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
              <ActivityIcon className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-purple-600 mt-3">{totalActivities}</p>
        </div>
      </div>

      {/* Lists Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Businesses */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              <span>Recent Businesses</span>
            </h2>
            <Link to="/businesses" className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center">
              <span>View all</span>
              <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>

          {recentBusinesses.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No businesses recorded yet. Click "Add Business" or use Bulk Import to get started.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentBusinesses.map((biz) => (
                <div key={biz.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{biz.companyName}</p>
                    <p className="text-xs text-slate-500">{biz.contactPerson || 'No contact person'} • {biz.industry}</p>
                  </div>
                  <span
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-full ${
                      biz.status === 'Won'
                        ? 'bg-emerald-50 text-emerald-700'
                        : biz.status === 'Lost'
                        ? 'bg-rose-50 text-rose-700'
                        : 'bg-blue-50 text-blue-700'
                    }`}
                  >
                    {biz.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activities */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <ActivityIcon className="w-5 h-5 text-purple-600" />
              <span>Recent Activities</span>
            </h2>
            <Link to="/activities" className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center">
              <span>View all</span>
              <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>

          {recentActivities.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No activities logged yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentActivities.map((act) => (
                <div key={act.id} className="py-3 flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 rounded-md">
                        {act.type}
                      </span>
                      <span className="text-xs font-medium text-slate-800">
                        {act.businessName || 'General Activity'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-1">{act.notes}</p>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono whitespace-nowrap ml-2">
                    {act.activityDate}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
