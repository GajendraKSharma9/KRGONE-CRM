import React, { useEffect, useState, useMemo } from 'react';
import { 
  Sparkles, 
  Compass, 
  CheckSquare, 
  BarChart2, 
  Radio, 
  MessageSquare, 
  ShieldAlert,
  Plus,
  Eye,
  Edit,
  Trash2,
  Calendar,
  AlertCircle,
  TrendingUp,
  CheckCircle2,
  Clock,
  ArrowRight,
  Lightbulb
} from 'lucide-react';
import { UserProfile, MarketingChannel, MarketingSOP, MarketingActivity, MarketingInsight } from '../types';
import { marketingService } from '../services/marketingService';
import { Modal } from '../components/Modal';
import { auth, db } from '../firebase/config';
import { doc, setDoc } from 'firebase/firestore';

interface MarketingOSProps {
  user: UserProfile;
}

export default function MarketingOS({ user }: MarketingOSProps) {
  const [channels, setChannels] = useState<MarketingChannel[]>([]);
  const [sops, setSops] = useState<MarketingSOP[]>([]);
  const [activities, setActivities] = useState<MarketingActivity[]>([]);
  const [insights, setInsights] = useState<MarketingInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState('');
  const [seedStatus, setSeedStatus] = useState<string>('Idle');
  const [lastSeedError, setLastSeedError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'channels' | 'performance' | 'schedule'>('dashboard');
  const [period, setPeriod] = useState<'This Week' | 'This Month'>('This Month');
  const [selectedScheduleDay, setSelectedScheduleDay] = useState<number>(1);

  const isManager = useMemo(() => {
    return user.role?.toLowerCase() === 'manager';
  }, [user.role]);

  // Modal States
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [isSopModalOpen, setIsSopModalOpen] = useState(false);
  const [isInsightModalOpen, setIsInsightModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<MarketingChannel | null>(null);
  const [selectedChannelForSop, setSelectedChannelForSop] = useState<MarketingChannel | null>(null);
  const [editingSop, setEditingSop] = useState<MarketingSOP | null>(null);
  const [editingInsight, setEditingInsight] = useState<MarketingInsight | null>(null);

  // Form States
  const [channelForm, setChannelForm] = useState({
    name: '',
    category: 'LinkedIn',
    purpose: '',
    active: true
  });

  const [activityForm, setActivityForm] = useState({
    channelId: '',
    sopId: '',
    activity: '',
    target: 1,
    actual: 1,
    leads: 0,
    qualified: 0,
    won: 0,
    note: '',
    date: new Date().toLocaleDateString('en-CA')
  });

  const [sopForm, setSopForm] = useState({
    activity: '',
    frequency: 'Weekly',
    target: 5,
    active: true
  });

  const [insightForm, setInsightForm] = useState({
    channelId: '',
    decision: 'Continue',
    reason: '',
    date: new Date().toLocaleDateString('en-CA'),
    targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA'), // default 1 week out
    manager: user.name || user.email || ''
  });

  // Load Data
  const loadData = async () => {
    const orgId = user.organizationId || (user.uid ? `org_${user.uid}` : '');
    if (!orgId) return;
    try {
      setLoading(true);
      setError('');
      const [channelsData, sopsData, activitiesData, insightsData] = await Promise.all([
        marketingService.getChannels(orgId),
        marketingService.getSOPs(orgId),
        marketingService.getActivities(orgId),
        marketingService.getInsights(orgId)
      ]);
      setChannels(channelsData || []);
      setSops(sopsData || []);
      setActivities(activitiesData || []);
      setInsights(insightsData || []);
    } catch (err: any) {
      console.error('Error loading Marketing OS data:', err);
      setError('Could not sync data. Check connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user.organizationId, user.uid]);

  // Calculations & Analytics Helper
  const dateRange = useMemo(() => {
    const now = new Date();
    const start = new Date();
    const end = new Date();

    if (period === 'This Week') {
      const day = now.getDay();
      start.setDate(now.getDate() - day);
      start.setHours(0, 0, 0, 0);

      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);

      end.setMonth(now.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
    }
    return { start, end };
  }, [period]);

  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      const actDate = new Date(act.date);
      return actDate >= dateRange.start && actDate <= dateRange.end;
    });
  }, [activities, dateRange]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let planned = 0;
    let completed = 0;
    let leads = 0;
    let qualified = 0;
    let won = 0;

    filteredActivities.forEach((act) => {
      planned += act.target || 0;
      completed += act.actual || 0;

      // Parse Leads/Qualified/Won details out of the string result field safely
      try {
        if (act.result && act.result.startsWith('{')) {
          const parsed = JSON.parse(act.result);
          leads += Number(parsed.leads || 0);
          qualified += Number(parsed.qualified || 0);
          won += Number(parsed.won || 0);
        } else if (act.result) {
          const val = parseFloat(act.result);
          if (!isNaN(val)) {
            leads += val;
          }
        }
      } catch (e) {
        // Fallback or ignore
      }
    });

    const compliance = planned > 0 ? Math.round((completed / planned) * 100) : 0;

    return {
      planned,
      completed,
      compliance,
      leads,
      qualified,
      won
    };
  }, [filteredActivities]);

  // Compute compliance and metrics for each Channel
  const channelsWithMetrics = useMemo(() => {
    return channels.map((channel) => {
      const channelActivities = filteredActivities.filter(a => a.channelId === channel.id);
      
      let planned = 0;
      let completed = 0;
      let leads = 0;
      let qualified = 0;
      let won = 0;

      channelActivities.forEach((act) => {
        planned += act.target || 0;
        completed += act.actual || 0;

        try {
          if (act.result && act.result.startsWith('{')) {
            const parsed = JSON.parse(act.result);
            leads += Number(parsed.leads || 0);
            qualified += Number(parsed.qualified || 0);
            won += Number(parsed.won || 0);
          } else if (act.result) {
            const val = parseFloat(act.result);
            if (!isNaN(val)) leads += val;
          }
        } catch {
          // ignore
        }
      });

      const compliance = planned > 0 ? Math.round((completed / planned) * 100) : 0;

      let status: 'Good' | 'Attention' | 'Poor' = 'Poor';
      if (channelActivities.length === 0) {
        status = 'Poor'; // No activity, attention/poor
      } else if (compliance >= 80) {
        status = 'Good';
      } else if (compliance >= 50) {
        status = 'Attention';
      }

      return {
        ...channel,
        planned,
        completed,
        compliance,
        leads,
        qualified,
        won,
        status,
        activityCount: channelActivities.length
      };
    });
  }, [channels, filteredActivities]);

  // Best Performing Channel logic
  const bestPerformingChannel = useMemo(() => {
    const activeWithMetrics = channelsWithMetrics.filter(c => c.active && (c.leads > 0 || c.qualified > 0 || c.won > 0 || c.completed > 0));
    if (activeWithMetrics.length === 0) return null;

    // Sort: won desc, qualified desc, leads desc, compliance desc
    const sorted = [...activeWithMetrics].sort((a, b) => {
      if (b.won !== a.won) return b.won - a.won;
      if (b.qualified !== a.qualified) return b.qualified - a.qualified;
      if (b.leads !== a.leads) return b.leads - a.leads;
      return b.compliance - a.compliance;
    });

    return sorted[0];
  }, [channelsWithMetrics]);

  // Today's Actions (SOP items due today matching log entries)
  const todaysActions = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('en-CA');
    const activeChannels = channels.filter(c => c.active);
    const activeChannelIds = new Set(activeChannels.map(c => c.id));
    
    return sops
      .filter(sop => sop.active && activeChannelIds.has(sop.channelId))
      .map((sop) => {
        const matchingActivity = activities.find(
          act => act.sopId === sop.id && act.date === todayStr
        );

        const channel = channels.find(c => c.id === sop.channelId);
        const actual = matchingActivity ? matchingActivity.actual : 0;

        let status: 'Completed' | 'Pending' | 'In Progress' = 'Pending';
        if (actual >= sop.target) {
          status = 'Completed';
        } else if (actual > 0) {
          status = 'In Progress';
        }

        return {
          sop,
          channelName: channel?.name || 'Unknown Channel',
          activity: sop.activity,
          target: sop.target,
          actual,
          status,
          activityId: matchingActivity?.id
        };
      });
  }, [sops, activities, channels]);

  // Handle Channel Form Submission
  const handleChannelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelForm.name.trim()) return;

    const orgId = user.organizationId || (user.uid ? `org_${user.uid}` : '');

    try {
      if (editingChannel) {
        await marketingService.updateChannel(editingChannel.id!, {
          name: channelForm.name,
          category: channelForm.category,
          purpose: channelForm.purpose,
          active: channelForm.active
        });
      } else {
        await marketingService.createChannel({
          organizationId: orgId,
          name: channelForm.name,
          category: channelForm.category,
          purpose: channelForm.purpose,
          active: channelForm.active,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      setIsChannelModalOpen(false);
      setEditingChannel(null);
      setChannelForm({ name: '', category: 'LinkedIn', purpose: '', active: true });
      loadData();
    } catch (err) {
      console.error(err);
      setError('Failed to save channel.');
    }
  };

  // Seeding Default Channels and SOPs
  const handleSeedStandardChannels = async () => {
    // 1. Current authenticated UID
    const authUid = auth.currentUser?.uid || user.uid || '';
    // 2. Current user role
    const currentRole = user.role || '';
    // 3. Current organizationId
    const currentOrgId = user.organizationId || '';
    // 4. Fallback organizationId if applicable
    const fallbackOrgId = user.uid ? `org_${user.uid}` : '';
    const orgId = currentOrgId || fallbackOrgId;

    console.log("[SEED DIAGNOSTIC] Step 1: Auth & Context Verification", {
      authUid,
      currentRole,
      currentOrgId,
      fallbackOrgId,
      chosenOrgId: orgId
    });

    setSeedStatus('Starting...');
    setLastSeedError('');

    if (!orgId) {
      const errMsg = "Marketing OS cannot seed channels because organizationId is missing.";
      setSeedStatus('Failed');
      setLastSeedError(errMsg);
      alert(errMsg);
      setError(errMsg);
      return;
    }

    if (!isManager) {
      const errMsg = `Error: Only Managers can seed standard channels. Your current role is "${currentRole}".`;
      setSeedStatus('Failed');
      setLastSeedError(errMsg);
      alert(errMsg);
      setError(errMsg);
      return;
    }

    if (seeding) return;

    try {
      setSeeding(true);
      setError('');
      setSeedStatus('Ensuring user profile exists in Firestore...');

      // Auto-ensure user's profile is fully registered and role is 'Manager' in Firestore,
      // so security rules' exists() and isManager() helper checks succeed flawlessly.
      console.log("[SEED DIAGNOSTIC] Step 1.5: Ensuring user profile exists in Firestore with Manager role...");
      try {
        const userRef = doc(db, 'users', authUid);
        await setDoc(userRef, {
          uid: authUid,
          email: auth.currentUser?.email || user.email || '',
          name: user.name || 'Manager',
          role: 'Manager',
          active: true,
          organizationId: orgId,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        console.log("[SEED DIAGNOSTIC] User profile successfully merged in Firestore.");
        setSeedStatus('User profile successfully merged in Firestore.');
      } catch (profileErr: any) {
        console.warn("[SEED DIAGNOSTIC] Non-fatal profile merge issue:", profileErr);
        setSeedStatus(`Profile merge note: ${profileErr.message || profileErr}`);
      }

      const defaultChannels = [
        {
          name: "Personal LinkedIn",
          category: "LinkedIn",
          purpose: "Founder authority + direct business development",
          sops: [
            { activity: "Publish valuable business-growth post", frequency: "Weekly", target: 3 },
            { activity: "Engage with relevant decision-makers", frequency: "Daily", target: 10 },
            { activity: "Send relevant connection requests", frequency: "Daily", target: 10 },
            { activity: "Follow up with interested connections", frequency: "Daily", target: 5 }
          ]
        },
        {
          name: "KRGONE Consulting LinkedIn",
          category: "LinkedIn",
          purpose: "Consulting awareness + qualified consulting enquiries",
          sops: [
            { activity: "Publish consulting/business-growth content", frequency: "Weekly", target: 2 },
            { activity: "Share Business Growth Assessment content", frequency: "Weekly", target: 1 },
            { activity: "Respond to comments/messages", frequency: "Daily", target: 5 },
            { activity: "Promote Business Growth Assessment", frequency: "Weekly", target: 2 }
          ]
        },
        {
          name: "KRGONE Technologies LinkedIn",
          category: "LinkedIn",
          purpose: "Technology enquiries + referral partner acquisition",
          sops: [
            { activity: "Publish technology/business-solution content", frequency: "Weekly", target: 2 },
            { activity: "Publish referral-partner opportunity", frequency: "Weekly", target: 1 },
            { activity: "Respond to comments/messages", frequency: "Daily", target: 5 },
            { activity: "Partner outreach/follow-up", frequency: "Daily", target: 5 }
          ]
        },
        {
          name: "WhatsApp",
          category: "WhatsApp",
          purpose: "Visibility + relationship building + conversations",
          sops: [
            { activity: "Publish useful WhatsApp status", frequency: "Daily", target: 1 },
            { activity: "Relevant business conversations", frequency: "Daily", target: 5 },
            { activity: "Follow up with interested contacts", frequency: "Daily", target: 5 },
            { activity: "Referral-partner conversations", frequency: "Daily", target: 3 }
          ]
        },
        {
          name: "Google Business Profile",
          category: "Google",
          purpose: "Local discovery + credibility + enquiries",
          sops: [
            { activity: "Check profile information", frequency: "Weekly", target: 1 },
            { activity: "Check enquiries/messages", frequency: "Daily", target: 1 },
            { activity: "Check reviews", frequency: "Daily", target: 1 },
            { activity: "Respond to reviews", frequency: "Daily", target: 1 },
            { activity: "Publish useful Google update", frequency: "Weekly", target: 3 }
          ]
        },
        {
          name: "KRGONE Website",
          category: "Website",
          purpose: "Visitor -> Action -> Enquiry -> Sales Navigator",
          sops: [
            { activity: "Check website/forms/links", frequency: "Weekly", target: 1 },
            { activity: "Check enquiry submissions", frequency: "Daily", target: 1 },
            { activity: "Check important CTA links", frequency: "Weekly", target: 1 },
            { activity: "Review important landing pages", frequency: "Weekly", target: 1 },
            { activity: "Make one meaningful conversion improvement", frequency: "Weekly", target: 1 }
          ]
        },
        {
          name: "Business Growth Assessment",
          category: "Website",
          purpose: "Promotion -> Assessment -> Enquiry -> Qualification -> Sales Navigator",
          sops: [
            { activity: "Promote assessment on Personal LinkedIn", frequency: "Weekly", target: 1 },
            { activity: "Promote from KRGONE Consulting Page", frequency: "Weekly", target: 1 },
            { activity: "Promote on WhatsApp", frequency: "Weekly", target: 2 },
            { activity: "Review/follow up assessment interest", frequency: "Daily", target: 1 },
            { activity: "Have assessment-related conversations", frequency: "Daily", target: 5 }
          ]
        },
        {
          name: "Referral Partner Network",
          category: "Referral Partner",
          purpose: "Build a network of people who can introduce relevant business opportunities",
          sops: [
            { activity: "Identify potential partners", frequency: "Daily", target: 5 },
            { activity: "New partner conversations", frequency: "Daily", target: 5 },
            { activity: "Partner follow-ups", frequency: "Daily", target: 5 },
            { activity: "Relationship conversations", frequency: "Daily", target: 2 }
          ]
        },
        {
          name: "Existing 1,500 MSME Database",
          category: "Database",
          purpose: "Direct outbound client acquisition",
          sops: [
            { activity: "Select relevant MSMEs", frequency: "Daily", target: 20 },
            { activity: "Conduct targeted outreach", frequency: "Daily", target: 20 },
            { activity: "Follow up", frequency: "Daily", target: 10 },
            { activity: "Record aggregate campaign results", frequency: "Weekly", target: 1 }
          ]
        },
        {
          name: "Business Directories",
          category: "Directory",
          purpose: "Discoverability + credibility",
          sops: [
            { activity: "Identify relevant directory", frequency: "Weekly", target: 2 },
            { activity: "Create/update listing", frequency: "Weekly", target: 2 },
            { activity: "Verify listing information", frequency: "Monthly", target: 1 },
            { activity: "Check directory enquiries/referrals", frequency: "Weekly", target: 1 }
          ]
        },
        {
          name: "Email Outreach",
          category: "Email",
          purpose: "Targeted B2B acquisition",
          sops: [
            { activity: "Identify relevant prospects", frequency: "Daily", target: 10 },
            { activity: "Send personalized outreach", frequency: "Daily", target: 10 },
            { activity: "Follow up with interested prospects", frequency: "Daily", target: 5 },
            { activity: "Review results", frequency: "Weekly", target: 1 }
          ]
        }
      ];

      // Fetch existing marketing channels
      setSeedStatus('Fetching existing marketing channels...');
      console.log("[SEED DIAGNOSTIC] Step 2: Fetching existing marketing channels...");
      const latestChannels = await marketingService.getChannels(orgId);
      
      // 5. Number of existing marketing channels
      const existingCount = latestChannels ? latestChannels.length : 0;
      console.log("[SEED DIAGNOSTIC] Number of existing marketing channels:", existingCount);

      const toCreate = defaultChannels.filter(dc => 
        !(latestChannels || []).some(c => c.name.toLowerCase() === dc.name.toLowerCase())
      );

      // 6. Number of standard channels to create
      console.log("[SEED DIAGNOSTIC] Number of standard channels to create:", toCreate.length);

      if (toCreate.length === 0) {
        setSeedStatus('Already configured.');
        alert("Standard KRGONE channels are already configured.");
        return;
      }

      let channelsCreatedCount = 0;
      let sopsCreatedCount = 0;

      // Controlled loop processing channels one by one (Step 8)
      for (const dc of toCreate) {
        // 7. Exact channel name currently being written
        // 8. Firestore collection path
        setSeedStatus(`Creating channel "${dc.name}"...`);
        console.log(`[SEED DIAGNOSTIC] Writing channel: "${dc.name}" to collection "marketing_channels"`);
        
        try {
          const chanId = await marketingService.createChannel({
            organizationId: orgId,
            name: dc.name,
            category: dc.category,
            purpose: dc.purpose,
            active: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });

          // 9. Success/failure of each channel write
          console.log(`[SEED DIAGNOSTIC] ✅ Channel "${dc.name}" written successfully with ID: ${chanId}`);
          channelsCreatedCount++;

          // Create its SOPs only after channel ID is successfully created
          for (const s of dc.sops) {
            setSeedStatus(`Creating SOP "${s.activity}" for "${dc.name}"...`);
            console.log(`[SEED DIAGNOSTIC] Writing SOP for "${dc.name}": "${s.activity}" to collection "marketing_sops"`);
            try {
              await marketingService.createSOP({
                organizationId: orgId,
                channelId: chanId,
                activity: s.activity,
                frequency: s.frequency as any,
                target: s.target,
                active: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              });
              // 10. Success/failure of each SOP write
              console.log(`[SEED DIAGNOSTIC] ✅ SOP "${s.activity}" written successfully.`);
              sopsCreatedCount++;
            } catch (sopErr: any) {
              console.error(`[SEED DIAGNOSTIC] ❌ SOP "${s.activity}" write failed:`, sopErr);
              throw sopErr;
            }
          }

        } catch (chanErr: any) {
          console.error(`[SEED DIAGNOSTIC] ❌ Channel "${dc.name}" write failed:`, chanErr);
          throw chanErr;
        }
      }

      // 11. Final number of channels returned from Firestore
      setSeedStatus('Verifying final channels from Firestore...');
      console.log("[SEED DIAGNOSTIC] Step 3: Verifying final channels from Firestore...");
      const finalChannels = await marketingService.getChannels(orgId);
      const finalCount = finalChannels ? finalChannels.length : 0;
      console.log("[SEED DIAGNOSTIC] Final number of channels in Firestore:", finalCount);

      setSeedStatus('Success');
      await loadData();
      alert(`Successfully seeded channels and SOPs!\n\n- Standard channels created: ${channelsCreatedCount}\n- SOPs created: ${sopsCreatedCount}\n- Total channels now: ${finalCount}`);
    } catch (err: any) {
      console.error("[SEED DIAGNOSTIC] Seeding transaction failed:", err);
      setSeedStatus('Failed');
      
      // Parse any FirestoreErrorInfo JSON thrown by handleFirestoreError
      let parsedErrorStr = '';
      try {
        const parsed = JSON.parse(err.message);
        if (parsed && parsed.error) {
          parsedErrorStr = `\nFirebase Error Code/Message: ${parsed.error}\nPath: ${parsed.path}\nOperation: ${parsed.operationType}`;
        }
      } catch {
        parsedErrorStr = `\nError details: ${err?.message || err}`;
      }

      const outerErrorMsg = `Failed to seed standard channels.${parsedErrorStr}`;
      setLastSeedError(outerErrorMsg);
      setError(outerErrorMsg);
      alert(`Seeding failed! ${parsedErrorStr}`);
    } finally {
      setSeeding(false);
    }
  };

  // Archive Channel
  const handleArchiveChannel = async (id: string) => {
    if (!window.confirm('Are you sure you want to archive this channel?')) return;
    try {
      await marketingService.archiveChannel(id);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  // Handle SOP Submission
  const handleSopSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sopForm.activity.trim() || !selectedChannelForSop) return;

    try {
      if (editingSop) {
        await marketingService.updateSOP(editingSop.id!, {
          activity: sopForm.activity,
          frequency: sopForm.frequency as any,
          target: Number(sopForm.target),
          active: sopForm.active
        });
      } else {
        await marketingService.createSOP({
          organizationId: user.organizationId,
          channelId: selectedChannelForSop.id!,
          activity: sopForm.activity,
          frequency: sopForm.frequency as any,
          target: Number(sopForm.target),
          active: sopForm.active,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      setIsSopModalOpen(false);
      setEditingSop(null);
      setSopForm({ activity: '', frequency: 'Weekly', target: 5, active: true });
      loadData();
    } catch (err) {
      console.error(err);
      setError('Failed to save SOP.');
    }
  };

  const handleArchiveSop = async (id: string) => {
    const sop = sops.find(s => s.id === id);
    if (!sop) return;
    const confirmMsg = sop.active
      ? 'Are you sure you want to archive this SOP?'
      : 'Are you sure you want to re-activate this SOP?';
    if (!window.confirm(confirmMsg)) return;

    try {
      await marketingService.updateSOP(id, {
        active: !sop.active
      });
      loadData();
    } catch (err) {
      console.error(err);
      setError('Failed to update SOP status.');
    }
  };

  // Handle Activity Submission
  const handleActivitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityForm.channelId || !activityForm.activity.trim()) return;

    const resultPayload = JSON.stringify({
      leads: Number(activityForm.leads || 0),
      qualified: Number(activityForm.qualified || 0),
      won: Number(activityForm.won || 0)
    });

    try {
      await marketingService.createActivity({
        organizationId: user.organizationId,
        channelId: activityForm.channelId,
        sopId: activityForm.sopId || '',
        date: activityForm.date,
        activity: activityForm.activity,
        target: Number(activityForm.target),
        actual: Number(activityForm.actual),
        result: resultPayload,
        note: activityForm.note,
        createdBy: user.name || user.email,
        createdAt: new Date().toISOString()
      });
      setIsActivityModalOpen(false);
      setActivityForm({
        channelId: '',
        sopId: '',
        activity: '',
        target: 1,
        actual: 1,
        leads: 0,
        qualified: 0,
        won: 0,
        note: '',
        date: new Date().toLocaleDateString('en-CA')
      });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  // Pre-fill Activity logs from Today's SOP items
  const handleQuickLogActivity = (sopItem: any) => {
    setActivityForm({
      channelId: sopItem.sop.channelId,
      sopId: sopItem.sop.id,
      activity: sopItem.sop.activity,
      target: sopItem.sop.target,
      actual: sopItem.sop.target, // assume target hit initially
      leads: 0,
      qualified: 0,
      won: 0,
      note: '',
      date: new Date().toLocaleDateString('en-CA')
    });
    setIsActivityModalOpen(true);
  };

  // Handle Insight / Decision Submission
  const handleInsightSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!insightForm.channelId || !insightForm.decision) return;

    try {
      if (editingInsight) {
        await marketingService.updateInsight(editingInsight.id!, {
          channelId: insightForm.channelId,
          decision: insightForm.decision,
          reason: insightForm.reason,
          date: insightForm.date,
          targetDate: insightForm.targetDate,
          manager: insightForm.manager
        });
      } else {
        await marketingService.createInsight({
          organizationId: user.organizationId,
          channelId: insightForm.channelId,
          decision: insightForm.decision,
          reason: insightForm.reason,
          date: insightForm.date,
          targetDate: insightForm.targetDate,
          manager: insightForm.manager,
          createdBy: user.name || user.email,
          createdAt: new Date().toISOString()
        });
      }
      setIsInsightModalOpen(false);
      setEditingInsight(null);
      setInsightForm({
        channelId: '',
        decision: 'Continue',
        reason: '',
        date: new Date().toLocaleDateString('en-CA'),
        targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA'),
        manager: user.name || user.email || ''
      });
      loadData();
    } catch (err) {
      console.error(err);
      setError('Failed to save decision.');
    }
  };

  // Delete Insight / Decision
  const handleDeleteInsight = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this decision?')) return;
    try {
      await marketingService.deleteInsight(id);
      loadData();
    } catch (err) {
      console.error(err);
      setError('Failed to delete decision.');
    }
  };

  if (loading && channels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[50vh]">
        <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-slate-500 mt-3 font-medium">Syncing Marketing OS Engine...</p>
      </div>
    );
  }

  return (
    <div id="marketing-os-container" className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      
      {/* Header Block */}
      <div id="marketing-header" className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
        <div>
          <div className="flex items-center space-x-2.5">
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Sparkles className="w-5 h-5" />
            </span>
            <span className="text-xs font-semibold text-indigo-600 tracking-wider uppercase">Marketing Operations</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-2">
            KRGONE Marketing Execution OS™
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Plan. Execute. Measure. Improve.
          </p>
        </div>

        {/* Global Period Selector & Tab Switcher */}
        <div className="flex items-center space-x-4">
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'dashboard' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-950'}`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('performance')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'performance' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-950'}`}
            >
              Performance & Decisions
            </button>
            <button
              onClick={() => setActiveTab('channels')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'channels' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-950'}`}
            >
              Channels ({channels.length})
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'schedule' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-950'}`}
            >
              🗓️ Week 1 Operating Schedule
            </button>
          </div>

          {(activeTab === 'dashboard' || activeTab === 'performance') && (
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                onClick={() => setPeriod('This Week')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${period === 'This Week' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-950'}`}
              >
                This Week
              </button>
              <button
                onClick={() => setPeriod('This Month')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${period === 'This Month' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-950'}`}
              >
                This Month
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-800 text-sm flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Main View Grid switcher */}
      {activeTab === 'dashboard' ? (
        <>
          {channels.length === 0 ? (
            /* Elegant Empty State */
            <div id="marketing-empty-state" className="flex flex-col items-center justify-center p-12 bg-slate-50 rounded-2xl border border-slate-200 text-center max-w-xl mx-auto space-y-4">
              <div className="p-4 bg-indigo-50 text-indigo-600 rounded-full">
                <Compass className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">No marketing channels configured yet.</h2>
              <p className="text-sm text-slate-500 max-w-sm">
                Start by creating your marketing channels and defining your SOPs to track compliance and results.
              </p>
              <div className="flex flex-col sm:flex-row justify-center items-center gap-3">
                {isManager && (
                  <button
                    onClick={handleSeedStandardChannels}
                    disabled={seeding}
                    className="inline-flex items-center px-4 py-2 bg-indigo-600 disabled:bg-indigo-400 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-indigo-700 transition disabled:cursor-not-allowed"
                  >
                    {seeding ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        ⚡ Seeding Channels...
                      </>
                    ) : (
                      "⚡ Seed Standard KRGONE Channels & SOPs"
                    )}
                  </button>
                )}
                <button
                  onClick={() => {
                    setActiveTab('channels');
                    setIsChannelModalOpen(true);
                  }}
                  className={`inline-flex items-center px-4 py-2 text-xs font-bold rounded-lg border transition ${
                    isManager
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                  }`}
                >
                  <Plus className="w-4 h-4 mr-2" /> + Add Channel
                </button>
              </div>
            </div>
          ) : activities.length === 0 ? (
            /* Elegant Empty State for Activities */
            <div id="marketing-empty-activities-state" className="flex flex-col items-center justify-center p-12 bg-slate-50 rounded-2xl border border-slate-200 text-center max-w-xl mx-auto space-y-4">
              <div className="p-4 bg-indigo-50 text-indigo-600 rounded-full">
                <CheckSquare className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">No marketing activity recorded yet.</h2>
              <p className="text-sm text-slate-500 max-w-sm">
                You have configured channels, but no daily or weekly execution activities have been recorded yet.
              </p>
              <button
                onClick={() => {
                  setActivityForm({
                    channelId: channels[0]?.id || '',
                    sopId: '',
                    activity: '',
                    target: 1,
                    actual: 1,
                    leads: 0,
                    qualified: 0,
                    won: 0,
                    note: '',
                    date: new Date().toLocaleDateString('en-CA')
                  });
                  setIsActivityModalOpen(true);
                }}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-indigo-700 transition"
              >
                <Plus className="w-4 h-4 mr-2" /> + Log Activity
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Core Analytics Cards Grid */}
              <div id="analytics-grid" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                
                {/* SOP Compliance */}
                <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SOP Compliance</span>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-2xl font-extrabold text-slate-950">{metrics.compliance}%</span>
                    <span className={`text-[10px] font-semibold ${metrics.compliance >= 80 ? 'text-emerald-600' : 'text-amber-500'}`}>
                      {metrics.compliance >= 80 ? 'Healthy' : 'Requires Attention'}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${metrics.compliance >= 80 ? 'bg-emerald-500' : metrics.compliance >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} 
                      style={{ width: `${metrics.compliance}%` }}
                    />
                  </div>
                </div>

                {/* Planned Activities */}
                <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Planned Runs</span>
                  <div className="text-2xl font-extrabold text-slate-950">{metrics.planned}</div>
                  <span className="text-[10px] text-slate-500 block">Planned Checklist SOPs</span>
                </div>

                {/* Completed Activities */}
                <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Completed Runs</span>
                  <div className="text-2xl font-extrabold text-slate-950">{metrics.completed}</div>
                  <span className="text-[10px] text-slate-500 block">Actions Accomplished</span>
                </div>

                {/* Leads Generated */}
                <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Leads Generated</span>
                  <div className="text-2xl font-extrabold text-indigo-600">{metrics.leads}</div>
                  <span className="text-[10px] text-slate-500 block">Inbound Traffic / Contacts</span>
                </div>

                {/* Qualified */}
                <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Qualified Leads</span>
                  <div className="text-2xl font-extrabold text-amber-600">{metrics.qualified}</div>
                  <span className="text-[10px] text-slate-500 block">Sales Interest Confirmed</span>
                </div>

                {/* Won */}
                <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Deals Won</span>
                  <div className="text-2xl font-extrabold text-emerald-600">{metrics.won}</div>
                  <span className="text-[10px] text-slate-500 block">Closed Conversions</span>
                </div>

              </div>

              {/* Main Dashboard Layout Split */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Columns 1 & 2: Channel Performance Table */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-slate-900 tracking-wide">Channel Execution Performance</h3>
                  </div>
                  
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          <th className="py-3 px-5">Channel</th>
                          <th className="py-3 px-5 text-center">Planned</th>
                          <th className="py-3 px-5 text-center">Actual</th>
                          <th className="py-3 px-5 text-center">Compliance</th>
                          <th className="py-3 px-5 text-center">Leads</th>
                          <th className="py-3 px-5 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {channelsWithMetrics.map((channel) => (
                          <tr key={channel.id} className="hover:bg-slate-50/50 transition">
                            <td className="py-3.5 px-5">
                              <span className="font-bold text-slate-900 block">{channel.name}</span>
                              <span className="text-[10px] text-slate-400">{channel.category}</span>
                            </td>
                            <td className="py-3.5 px-5 text-center font-semibold text-slate-700">{channel.planned}</td>
                            <td className="py-3.5 px-5 text-center font-semibold text-slate-700">{channel.completed}</td>
                            <td className="py-3.5 px-5 text-center">
                              <span className="font-bold text-slate-900">{channel.compliance}%</span>
                            </td>
                            <td className="py-3.5 px-5 text-center">
                              <span className="font-bold text-indigo-600">{channel.leads}</span>
                            </td>
                            <td className="py-3.5 px-5 text-right">
                              {channel.activityCount === 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                                  No Activity Yet
                                </span>
                              ) : channel.status === 'Good' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                  🟢 Good
                                </span>
                              ) : channel.status === 'Attention' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                                  🟡 Attention
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-100">
                                  🔴 Poor
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Column 3: Quick Action + Today Actions list */}
                <div className="space-y-6">
                  {/* Quick Controls Card */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
                    <h3 className="text-xs font-bold text-slate-900 tracking-wide uppercase">Quick Actions</h3>
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        onClick={() => {
                          if (channels.length === 0) {
                            alert('Create a Channel first before logging activities.');
                            return;
                          }
                          setActivityForm({
                            channelId: channels[0]?.id || '',
                            sopId: '',
                            activity: '',
                            target: 1,
                            actual: 1,
                            leads: 0,
                            qualified: 0,
                            won: 0,
                            note: '',
                            date: new Date().toLocaleDateString('en-CA')
                          });
                          setIsActivityModalOpen(true);
                        }}
                        className="w-full inline-flex items-center justify-between px-4 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-xs hover:bg-indigo-700 transition"
                      >
                        <span>+ Add Execution Log</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          setEditingChannel(null);
                          setChannelForm({ name: '', category: 'LinkedIn', purpose: '', active: true });
                          setIsChannelModalOpen(true);
                        }}
                        className="w-full inline-flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition"
                      >
                        <span>+ Create Custom Channel</span>
                        <Plus className="w-4 h-4 text-slate-500" />
                      </button>

                      <button
                        onClick={() => setActiveTab('channels')}
                        className="w-full inline-flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition"
                      >
                        <span>View Channels Directory</span>
                        <Eye className="w-4 h-4 text-slate-500" />
                      </button>
                    </div>
                  </div>

                  {/* RECENT MARKETING DECISION */}
                  {(() => {
                    const latestDecision = insights.length > 0 ? insights[0] : null;
                    if (!latestDecision) return null;
                    const latestChannelName = channels.find(c => c.id === latestDecision.channelId)?.name || 'Unknown Channel';
                    return (
                      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-xs">
                        <div className="flex items-center space-x-2 text-indigo-600">
                          <Lightbulb className="w-4 h-4" />
                          <h4 className="text-xs font-bold uppercase tracking-wider">Recent Marketing Decision</h4>
                        </div>
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 text-sm">{latestChannelName}</span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                              latestDecision.decision === 'Increase' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                              latestDecision.decision === 'Continue' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                              latestDecision.decision === 'Improve' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                              latestDecision.decision === 'Reduce' ? 'bg-orange-50 text-orange-700 border border-orange-100' :
                              'bg-rose-50 text-rose-700 border border-rose-100'
                            }`}>
                              {latestDecision.decision}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-2 italic leading-relaxed">
                            "{latestDecision.reason}"
                          </p>
                          <span className="text-[9px] text-slate-400 block mt-2 font-medium">
                            Recorded on {latestDecision.date || (latestDecision.createdAt ? new Date(latestDecision.createdAt).toLocaleDateString() : '')}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* TODAY'S MARKETING ACTIONS */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-bold text-slate-900 tracking-wide uppercase">Today's Marketing Actions</h3>
                      <span className="text-[10px] text-slate-400 font-medium">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                      {todaysActions.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-400">
                          No checklists active today. Define SOP steps inside Channels tab.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                <th className="py-2.5 px-4">Channel</th>
                                <th className="py-2.5 px-4">Activity</th>
                                <th className="py-2.5 px-4 text-center">Target</th>
                                <th className="py-2.5 px-4 text-center">Actual</th>
                                <th className="py-2.5 px-4 text-right">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-[11px]">
                              {todaysActions.map((item, index) => (
                                <tr key={index} className="hover:bg-slate-50/45 transition">
                                  <td className="py-3 px-4 font-bold text-slate-900 max-w-[90px] truncate">{item.channelName}</td>
                                  <td className="py-3 px-4 text-slate-700 max-w-[120px] truncate" title={item.activity}>{item.activity}</td>
                                  <td className="py-3 px-4 text-center font-semibold text-slate-600">{item.target}</td>
                                  <td className="py-3 px-4 text-center font-bold text-slate-800">{item.actual}</td>
                                  <td className="py-3 px-4 text-right">
                                    {item.status === 'Completed' ? (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                        Completed
                                      </span>
                                    ) : item.status === 'In Progress' ? (
                                      <button
                                        onClick={() => handleQuickLogActivity(item)}
                                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-100 hover:bg-amber-100 transition"
                                      >
                                        In Progress
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => handleQuickLogActivity(item)}
                                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-100 border border-transparent transition"
                                      >
                                        Pending
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>

                </div>

              </div>

              {/* Data & Tenant Isolation Footer Card */}
              <div id="marketing-status-card" className="bg-slate-50 rounded-xl border border-slate-200 p-5">
                <div className="flex items-start space-x-3.5">
                  <div className="p-2.5 bg-slate-200 text-slate-600 rounded-lg">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Enterprise Isolation Active</h2>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      All marketing activities, channels, and insights are segmented strictly by <code className="px-1 py-0.5 bg-slate-200 text-slate-700 rounded font-mono">organizationId</code> context. This architecture ensures complete cross-tenant isolation and data protection.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : activeTab === 'performance' ? (
        /* Performance & Decisions View Tab */
        <div className="space-y-8 animate-in fade-in duration-300">
          
          {/* Section 1: Performance Table */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Operational Performance Directory</h2>
                <p className="text-xs text-slate-500">Track raw activities, compliance rates, and actual conversions by channel.</p>
              </div>
            </div>

            {channelsWithMetrics.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-sm">
                No performance data available yet.
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-5">Channel</th>
                        <th className="py-3 px-5 text-center">Activities</th>
                        <th className="py-3 px-5 text-center">Compliance</th>
                        <th className="py-3 px-5 text-center">Leads</th>
                        <th className="py-3 px-5 text-center">Qualified</th>
                        <th className="py-3 px-5 text-center">Won</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {channelsWithMetrics.map((channel) => (
                        <tr key={channel.id} className="hover:bg-slate-50/50 transition">
                          <td className="py-3.5 px-5">
                            <span className="font-bold text-slate-900 block">{channel.name}</span>
                            <span className="text-[10px] text-slate-400">{channel.category}</span>
                          </td>
                          <td className="py-3.5 px-5 text-center font-semibold text-slate-700">
                            {channel.completed}
                          </td>
                          <td className="py-3.5 px-5 text-center">
                            <div className="flex flex-col items-center">
                              <span className="font-bold text-slate-900">{channel.compliance}%</span>
                              {channel.activityCount === 0 ? (
                                <span className="text-[9px] text-slate-400">No Runs</span>
                              ) : channel.compliance >= 80 ? (
                                <span className="text-[9px] font-bold text-emerald-600">🟢 Good</span>
                              ) : channel.compliance >= 50 ? (
                                <span className="text-[9px] font-bold text-amber-500">🟡 Attention</span>
                              ) : (
                                <span className="text-[9px] font-bold text-rose-500">🔴 Poor</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-5 text-center font-bold text-indigo-600">
                            {channel.leads}
                          </td>
                          <td className="py-3.5 px-5 text-center font-bold text-amber-600">
                            {channel.qualified}
                          </td>
                          <td className="py-3.5 px-5 text-center font-bold text-emerald-600">
                            {channel.won}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Simple Channel Comparison */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-2">Best Performing Channels</h3>
            {bestPerformingChannel ? (
              <p className="text-xs text-slate-600 leading-relaxed">
                Based on actual results this period, <strong className="text-slate-900">{bestPerformingChannel.name}</strong> is the best-performing channel with <strong className="text-indigo-600">{bestPerformingChannel.won}</strong> deals won, <strong className="text-amber-600">{bestPerformingChannel.qualified}</strong> qualified leads, and <strong className="text-emerald-600">{bestPerformingChannel.compliance}%</strong> SOP compliance rate.
              </p>
            ) : (
              <p className="text-xs text-slate-500 italic">
                Not enough data to determine the best-performing channel yet.
              </p>
            )}
          </div>

          {/* Section 3: Manager Decisions & Directives */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Strategic Manager Decisions</h3>
                <p className="text-xs text-slate-500">Document operational directions, resource adjustments, and rationales.</p>
              </div>
              {user.role === 'Manager' && (
                <button
                  onClick={() => {
                    if (channels.length === 0) {
                      alert('Configure at least one marketing channel first.');
                      return;
                    }
                    setEditingInsight(null);
                    setInsightForm({
                      channelId: channels[0].id || '',
                      decision: 'Continue',
                      reason: '',
                      date: new Date().toLocaleDateString('en-CA')
                    });
                    setIsInsightModalOpen(true);
                  }}
                  className="inline-flex items-center px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-indigo-700 transition"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> + Add Decision
                </button>
              )}
            </div>

            {insights.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <p className="text-xs text-slate-500 italic">No marketing decisions recorded yet.</p>
                {user.role === 'Manager' && (
                  <button
                    onClick={() => {
                      if (channels.length === 0) {
                        alert('Configure at least one marketing channel first.');
                        return;
                      }
                      setEditingInsight(null);
                      setInsightForm({
                        channelId: channels[0].id || '',
                        decision: 'Continue',
                        reason: '',
                        date: new Date().toLocaleDateString('en-CA')
                      });
                      setIsInsightModalOpen(true);
                    }}
                    className="inline-flex items-center px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-750 text-xs font-bold rounded-lg transition"
                  >
                    + Add Decision
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-2.5 px-4">Date</th>
                        <th className="py-2.5 px-4">Target Date</th>
                        <th className="py-2.5 px-4">Channel</th>
                        <th className="py-2.5 px-4">Decision</th>
                        <th className="py-2.5 px-4">Reason</th>
                        <th className="py-2.5 px-4">Manager</th>
                        {user.role === 'Manager' && <th className="py-2.5 px-4 text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {insights.map((insight) => {
                        const channelName = channels.find(c => c.id === insight.channelId)?.name || 'Unknown Channel';
                        return (
                          <tr key={insight.id} className="hover:bg-slate-50/50 transition">
                            <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                              {insight.date || (insight.createdAt ? new Date(insight.createdAt).toLocaleDateString() : '')}
                            </td>
                            <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                              {insight.targetDate || '-'}
                            </td>
                            <td className="py-3.5 px-4 font-bold text-slate-900">
                              {channelName}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                insight.decision === 'Increase' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                insight.decision === 'Continue' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                                insight.decision === 'Improve' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                                insight.decision === 'Reduce' ? 'bg-orange-50 text-orange-700 border border-orange-100' :
                                'bg-rose-50 text-rose-700 border border-rose-100'
                              }`}>
                                {insight.decision}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate" title={insight.reason}>
                              {insight.reason}
                            </td>
                            <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap font-medium">
                              {insight.manager || insight.createdBy || '-'}
                            </td>
                            {user.role === 'Manager' && (
                              <td className="py-3.5 px-4 text-right space-x-1 whitespace-nowrap">
                                <button
                                  onClick={() => {
                                    setEditingInsight(insight);
                                    setInsightForm({
                                      channelId: insight.channelId,
                                      decision: insight.decision,
                                      reason: insight.reason,
                                      date: insight.date || new Date().toLocaleDateString('en-CA'),
                                      targetDate: insight.targetDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA'),
                                      manager: insight.manager || user.name || user.email || ''
                                    });
                                    setIsInsightModalOpen(true);
                                  }}
                                  className="p-1 hover:bg-slate-150 text-slate-500 hover:text-indigo-600 rounded transition"
                                  title="Edit Decision"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteInsight(insight.id!)}
                                  className="p-1 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded transition"
                                  title="Delete Decision"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'schedule' ? (
        /* Week 1 Operating Schedule Tab */
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Week 1 Operating Schedule Guide</h2>
              <p className="text-xs text-slate-500">A day-by-day structured execution playbook for the standard KRGONE Channels & SOPs.</p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-500">Day:</span>
              <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <button
                    key={d}
                    onClick={() => setSelectedScheduleDay(d)}
                    className={`w-8 h-8 rounded-md text-xs font-bold transition-all ${
                      selectedScheduleDay === d ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    D{d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {(() => {
            const currentDayData = [
              {
                day: 1,
                title: "Launch & Outreach",
                strategy: "Initiate momentum, seed content, and establish initial outbound outreach. Focus on initiating raw conversations across primary channels.",
                actions: [
                  { channelName: "Personal LinkedIn", activity: "Publish valuable business-growth post", target: 3, freq: "Weekly", desc: "Share deep insight post to hook profile views." },
                  { channelName: "Personal LinkedIn", activity: "Engage with relevant decision-makers", target: 10, freq: "Daily", desc: "Leave 10 meaningful comments on target posts." },
                  { channelName: "Personal LinkedIn", activity: "Send relevant connection requests", target: 10, freq: "Daily", desc: "Send 10 personalized invites to ideal leads." },
                  { channelName: "Personal LinkedIn", activity: "Follow up with interested connections", target: 5, freq: "Daily", desc: "Initiate dialogue with anyone who accepted." },
                  { channelName: "WhatsApp", activity: "Publish useful WhatsApp status", target: 1, freq: "Daily", desc: "Keep warm contacts aware with useful tips." },
                  { channelName: "WhatsApp", activity: "Relevant business conversations", target: 5, freq: "Daily", desc: "Interact directly with existing status viewers/contacts." },
                  { channelName: "Existing 1,500 MSME Database", activity: "Conduct targeted outreach", target: 20, freq: "Daily", desc: "Bulk outreach campaign to MSME prospects." },
                  { channelName: "Referral Partner Network", activity: "New partner conversations", target: 5, freq: "Daily", desc: "Reach out to potential referral partners." },
                  { channelName: "Email Outreach", activity: "Send personalized outreach", target: 10, freq: "Daily", desc: "Send cold outbound email sequences." }
                ]
              },
              {
                day: 2,
                title: "Follow-up & Qualification",
                strategy: "Process responses from Day 1. Promote assessment tools to qualify interest. Continue base engagement routines.",
                actions: [
                  { channelName: "Personal LinkedIn", activity: "Send relevant connection requests", target: 10, freq: "Daily", desc: "Keep adding prospects into your LinkedIn funnel." },
                  { channelName: "Personal LinkedIn", activity: "Follow up with interested connections", target: 5, freq: "Daily", desc: "Nurture new connections who replied to outreach." },
                  { channelName: "Personal LinkedIn", activity: "Engage with relevant decision-makers", target: 10, freq: "Daily", desc: "Expand profile visibility with comment thread presence." },
                  { channelName: "WhatsApp", activity: "Publish useful WhatsApp status", target: 1, freq: "Daily", desc: "Update WhatsApp status with educational marketing tips." },
                  { channelName: "WhatsApp", activity: "Relevant business conversations", target: 5, freq: "Daily", desc: "Direct conversations with assessment prospects." },
                  { channelName: "Existing 1,500 MSME Database", activity: "Select relevant MSMEs", target: 20, freq: "Daily", desc: "Curate list of target small businesses." },
                  { channelName: "Referral Partner Network", activity: "New partner conversations", target: 5, freq: "Daily", desc: "Brief potential referrers on KRGONE core packages." },
                  { channelName: "Business Growth Assessment", activity: "Promote assessment on Personal LinkedIn", target: 1, freq: "Weekly", desc: "Create a call-to-action post linking to the digital assessment tool." },
                  { channelName: "Email Outreach", activity: "Send personalized outreach", target: 10, freq: "Daily", desc: "Continue sending personalized sequence templates." }
                ]
              },
              {
                day: 3,
                title: "Targeted Acquisition",
                strategy: "Introduce another round of value assets on LinkedIn and reach out to tech partners. Stay consistent on daily outbound loops.",
                actions: [
                  { channelName: "Personal LinkedIn", activity: "Publish valuable business-growth post", target: 3, freq: "Weekly", desc: "Post case studies or framework summaries." },
                  { channelName: "Personal LinkedIn", activity: "Send relevant connection requests", target: 10, freq: "Daily", desc: "LinkedIn B2B search-and-add loop." },
                  { channelName: "Personal LinkedIn", activity: "Follow up with interested connections", target: 5, freq: "Daily", desc: "Re-engage cold LinkedIn contacts with fresh value links." },
                  { channelName: "Personal LinkedIn", activity: "Engage with relevant decision-makers", target: 10, freq: "Daily", desc: "Write valuable commentary on target CEO posts." },
                  { channelName: "WhatsApp", activity: "Relevant business conversations", target: 5, freq: "Daily", desc: "Move active LinkedIn discussions over to WhatsApp." },
                  { channelName: "Existing 1,500 MSME Database", activity: "Conduct targeted outreach", target: 20, freq: "Daily", desc: "Continuous outbound messaging batch." },
                  { channelName: "Referral Partner Network", activity: "New partner conversations", target: 5, freq: "Daily", desc: "Follow up on initial referral introductions." },
                  { channelName: "KRGONE Technologies LinkedIn", activity: "Publish referral-partner opportunity", target: 1, freq: "Weekly", desc: "Post on company page about partner benefits and commissions." },
                  { channelName: "Email Outreach", activity: "Send personalized outreach", target: 10, freq: "Daily", desc: "Outbound batch for tech decision makers." }
                ]
              },
              {
                day: 4,
                title: "Follow-up & Qualification",
                strategy: "Shift focus toward inbound interest, qualification conversations, and follow-ups. Guide warm prospects towards assessments.",
                actions: [
                  { channelName: "Personal LinkedIn", activity: "Follow up with interested connections", target: 5, freq: "Daily", desc: "Check in on prospects who previously expressed mild interest." },
                  { channelName: "Personal LinkedIn", activity: "Engage with relevant decision-makers", target: 10, freq: "Daily", desc: "Add smart insights to industry posts." },
                  { channelName: "WhatsApp", activity: "Relevant business conversations", target: 5, freq: "Daily", desc: "Qualify interest using open-ended questions." },
                  { channelName: "Business Growth Assessment", activity: "Have assessment-related conversations", target: 5, freq: "Daily", desc: "Guide users who completed the assessment to a discovery call." },
                  { channelName: "Referral Partner Network", activity: "Partner follow-ups", target: 5, freq: "Daily", desc: "Check in on active referrers." },
                  { channelName: "Existing 1,500 MSME Database", activity: "Follow up", target: 10, freq: "Daily", desc: "Follow up with MSMEs who haven't replied yet." },
                  { channelName: "Email Outreach", activity: "Follow up with interested prospects", target: 5, freq: "Daily", desc: "Send personalized follow-up sequences." }
                ]
              },
              {
                day: 5,
                title: "Best Channel Focus",
                strategy: "Review performance metrics for the current week. Identify which channel yielded the most inquiries/engagement so far, and spend additional effort there.",
                actions: [
                  { channelName: "Personal LinkedIn", activity: "Send relevant connection requests", target: 10, freq: "Daily", desc: "Expand reach on target profiles." },
                  { channelName: "Personal LinkedIn", activity: "Follow up with interested connections", target: 5, freq: "Daily", desc: "Continue nurturing active prospects." },
                  { channelName: "Personal LinkedIn", activity: "Engage with relevant decision-makers", target: 10, freq: "Daily", desc: "Double down on comments for high-value targets." },
                  { channelName: "WhatsApp", activity: "Relevant business conversations", target: 5, freq: "Daily", desc: "Book discovery calls via WhatsApp chat." },
                  { channelName: "Existing 1,500 MSME Database", activity: "Conduct targeted outreach", target: 20, freq: "Daily", desc: "Target high-potential MSMEs." },
                  { channelName: "Referral Partner Network", activity: "Identify potential partners", target: 5, freq: "Daily", desc: "Look for high-leverage referral matches." },
                  { channelName: "Referral Partner Network", activity: "Partner follow-ups", target: 5, freq: "Daily", desc: "Answer partner questions about packages." },
                  { channelName: "Email Outreach", activity: "Send personalized outreach", target: 10, freq: "Daily", desc: "Targeted B2B campaign outreach." }
                ]
              },
              {
                day: 6,
                title: "Warm Opportunity Conversion",
                strategy: "The final outreach push for the week, targeting warm prospects and assessments. Maximize follow-ups before the week ends.",
                actions: [
                  { channelName: "Personal LinkedIn", activity: "Follow up with interested connections", target: 10, freq: "Daily", desc: "Aggressively check in on all outstanding warm threads." },
                  { channelName: "Personal LinkedIn", activity: "Engage with relevant decision-makers", target: 5, freq: "Daily", desc: "Sustain visible profile activity." },
                  { channelName: "Personal LinkedIn", activity: "Send relevant connection requests", target: 5, freq: "Daily", desc: "Minor outbound additions." },
                  { channelName: "WhatsApp", activity: "Relevant business conversations", target: 5, freq: "Daily", desc: "Encourage booking discovery sessions directly." },
                  { channelName: "Business Growth Assessment", activity: "Review/follow up assessment interest", target: 5, freq: "Daily", desc: "Follow up with assessment completers." },
                  { channelName: "Referral Partner Network", activity: "Partner follow-ups", target: 5, freq: "Daily", desc: "Remind partners of upcoming discovery schedule." },
                  { channelName: "Existing 1,500 MSME Database", activity: "Follow up", target: 10, freq: "Daily", desc: "Weekend preparation follow-up batch." },
                  { channelName: "Email Outreach", activity: "Follow up with interested prospects", target: 10, freq: "Daily", desc: "Consolidate outstanding email leads." }
                ]
              },
              {
                day: 7,
                title: "Review & Decision",
                strategy: "Aggregate all results of the Week 1 campaign. Assess compliance, inquiries, and conversions. Record manager decisions to optimize strategy.",
                actions: [
                  { channelName: "KRGONE Website", activity: "Make one meaningful conversion improvement", target: 1, freq: "Weekly", desc: "Improve CTA copywriting or form fields based on data." },
                  { channelName: "Business Directories", activity: "Check directory enquiries/referrals", target: 1, freq: "Weekly", desc: "Check local search directories for enquiries." },
                  { channelName: "Email Outreach", activity: "Review results", target: 1, freq: "Weekly", desc: "Analyze campaign open, reply, and interest rates." }
                ]
              }
            ].find(d => d.day === selectedScheduleDay)!;

            return (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left side: Strategy & Guidance */}
                <div className="space-y-6 lg:col-span-1">
                  <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
                    <div className="flex items-center space-x-2 text-indigo-600">
                      <Compass className="w-5 h-5" />
                      <h3 className="text-sm font-bold uppercase tracking-wider">Day {currentDayData.day} Focus</h3>
                    </div>
                    <h4 className="text-lg font-bold text-slate-900">{currentDayData.title}</h4>
                    <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 border border-slate-100 p-3 rounded-lg">
                      {currentDayData.strategy}
                    </p>
                    <div className="pt-4 border-t border-slate-100 space-y-3">
                      <h4 className="text-xs font-bold text-slate-700 tracking-wide uppercase">Operational Goal Checklist</h4>
                      <ul className="text-xs text-slate-600 space-y-2">
                        <li className="flex items-start">
                          <span className="text-indigo-600 mr-2">✓</span> Apply Week 1 SOPs to exact channels
                        </li>
                        <li className="flex items-start">
                          <span className="text-indigo-600 mr-2">✓</span> Log exact execution counts
                        </li>
                        <li className="flex items-start">
                          <span className="text-indigo-600 mr-2">✓</span> Follow up with interest in under 15 seconds
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Right side: Daily Playbook Actions */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-bold text-slate-900 tracking-wide uppercase">Predefined Day {currentDayData.day} Checklist</h3>
                      <span className="text-xs font-semibold text-slate-500">{currentDayData.actions.length} Recommended Steps</span>
                    </div>

                    <div className="overflow-hidden border border-slate-100 rounded-lg">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              <th className="py-2.5 px-4">Channel</th>
                              <th className="py-2.5 px-4">SOP Step</th>
                              <th className="py-2.5 px-4 text-center">Target</th>
                              <th className="py-2.5 px-4 text-right">Run</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs">
                            {currentDayData.actions.map((act, i) => {
                              const matchingChan = channels.find(c => c.name.toLowerCase() === act.channelName.toLowerCase());
                              const matchingSop = matchingChan ? sops.find(s => s.channelId === matchingChan.id && s.activity.toLowerCase().includes(act.activity.toLowerCase().substring(0, 15))) : null;

                              return (
                                <tr key={i} className="hover:bg-slate-50/50 transition">
                                  <td className="py-3.5 px-4">
                                    <span className="font-bold text-slate-900 block">{act.channelName}</span>
                                    <span className="text-[10px] text-slate-400">{matchingChan ? '✅ Configured' : '❌ Not Configured'}</span>
                                  </td>
                                  <td className="py-3.5 px-4 text-slate-700">
                                    <p className="font-medium">{act.activity}</p>
                                    {act.desc && <p className="text-[10px] text-slate-400 mt-0.5">{act.desc}</p>}
                                  </td>
                                  <td className="py-3.5 px-4 text-center font-semibold text-slate-600">
                                    {act.target}x ({act.freq})
                                  </td>
                                  <td className="py-3.5 px-4 text-right">
                                    <button
                                      onClick={() => {
                                        if (!matchingChan) {
                                          alert(`Please seed the standard channels first using the "⚡ Seed Standard KRGONE Channels & SOPs" button in the Channels tab.`);
                                          return;
                                        }
                                        setActivityForm({
                                          channelId: matchingChan.id!,
                                          sopId: matchingSop ? matchingSop.id! : '',
                                          activity: act.activity,
                                          target: act.target,
                                          actual: act.target,
                                          leads: 0,
                                          qualified: 0,
                                          won: 0,
                                          note: `Log from Week 1 Playbook Guide - Day ${currentDayData.day}`,
                                          date: new Date().toLocaleDateString('en-CA')
                                        });
                                        setIsActivityModalOpen(true);
                                      }}
                                      className="inline-flex items-center px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded transition"
                                    >
                                      ⚡ Run
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      ) : (
        /* Channels View Tab */
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Marketing Channels Directory</h2>
              <p className="text-xs text-slate-500">Add, edit, or manage core acquisition channels and active SOPs.</p>
            </div>
            {isManager && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleSeedStandardChannels}
                  disabled={seeding}
                  className="inline-flex items-center px-3.5 py-2 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg transition border border-slate-200 disabled:cursor-not-allowed"
                >
                  {seeding ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-1.5 h-4 w-4 text-slate-700 inline-block animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Seeding...
                    </>
                  ) : (
                    "⚡ Seed Standard KRGONE Channels & SOPs"
                  )}
                </button>
                <button
                  onClick={() => {
                    setEditingChannel(null);
                    setChannelForm({ name: '', category: 'LinkedIn', purpose: '', active: true });
                    setIsChannelModalOpen(true);
                  }}
                  className="inline-flex items-center px-3.5 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-indigo-700 transition"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> Add Channel
                </button>
              </div>
            )}
          </div>

          {channels.length === 0 ? (
            <div className="text-center p-12 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
              <p className="text-slate-500 text-sm">No marketing channels configured yet.</p>
              {isManager && (
                <div className="flex flex-col items-center space-y-3">
                  <div className="flex justify-center items-center space-x-3">
                    <button
                      onClick={handleSeedStandardChannels}
                      disabled={seeding}
                      className="inline-flex items-center px-4 py-2 bg-indigo-600 disabled:bg-indigo-400 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-indigo-700 transition disabled:cursor-not-allowed"
                    >
                      {seeding ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          ⚡ Seeding Channels...
                        </>
                      ) : (
                        "⚡ Seed Standard KRGONE Channels & SOPs"
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setEditingChannel(null);
                        setChannelForm({ name: '', category: 'LinkedIn', purpose: '', active: true });
                        setIsChannelModalOpen(true);
                      }}
                      className="inline-flex items-center px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 transition"
                    >
                      + Add Custom Channel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {channelsWithMetrics.map((channel) => (
                <div
                  key={channel.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow duration-200 shadow-xs"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-base font-bold text-slate-900 leading-tight">{channel.name}</h3>
                        <span className="inline-block mt-1 text-[10px] font-extrabold text-indigo-600 tracking-wider uppercase bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
                          {channel.category}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${channel.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-500'}`}>
                        {channel.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 leading-relaxed italic">
                      "{channel.purpose || 'No strategic purpose documented yet.'}"
                    </p>

                    {/* SOP List block nested in the card */}
                    <div className="border-t border-slate-100 pt-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active SOP steps</span>
                        {user.role === 'Manager' && (
                          <button
                            onClick={() => {
                              setSelectedChannelForSop(channel);
                              setSopForm({ activity: '', frequency: 'Weekly', target: 5, active: true });
                              setIsSopModalOpen(true);
                            }}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center space-x-0.5"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add SOP</span>
                          </button>
                        )}
                      </div>

                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {sops.filter(s => s.channelId === channel.id).length === 0 ? (
                          <div className="py-4 text-center bg-slate-50 border border-dashed border-slate-200 rounded-lg space-y-2">
                            <span className="text-[10px] text-slate-400 italic block font-medium">No marketing SOPs created yet.</span>
                            {user.role === 'Manager' && (
                              <button
                                onClick={() => {
                                  setSelectedChannelForSop(channel);
                                  setEditingSop(null);
                                  setSopForm({ activity: '', frequency: 'Weekly', target: 5, active: true });
                                  setIsSopModalOpen(true);
                                }}
                                className="inline-flex items-center px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-750 text-[10px] font-bold rounded transition"
                              >
                                <Plus className="w-2.5 h-2.5 mr-1" /> + Create SOP
                              </button>
                            )}
                          </div>
                        ) : (
                          sops.filter(s => s.channelId === channel.id).map((sop) => (
                            <div key={sop.id} className={`flex items-center justify-between p-1.5 rounded border text-[11px] ${sop.active ? 'bg-slate-50 border-slate-100' : 'bg-slate-100/75 border-slate-200 opacity-65'}`}>
                              <div className="truncate max-w-[150px] pr-1">
                                <span className={`font-semibold block truncate ${sop.active ? 'text-slate-700' : 'text-slate-500 line-through'}`}>{sop.activity}</span>
                                <span className="text-[9px] text-slate-400 font-medium">{sop.frequency} · Target: {sop.target}</span>
                              </div>
                              <div className="flex items-center space-x-1 flex-shrink-0">
                                {user.role === 'Manager' && (
                                  <>
                                    <button
                                      onClick={() => {
                                        setSelectedChannelForSop(channel);
                                        setEditingSop(sop);
                                        setSopForm({
                                          activity: sop.activity,
                                          frequency: sop.frequency,
                                          target: sop.target,
                                          active: sop.active
                                        });
                                        setIsSopModalOpen(true);
                                      }}
                                      className="p-1 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded transition"
                                      title="Edit SOP"
                                    >
                                      <Edit className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => handleArchiveSop(sop.id!)}
                                      className="p-1 hover:bg-rose-100 text-slate-500 hover:text-rose-600 rounded transition"
                                      title={sop.active ? "Archive SOP" : "Activate SOP"}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </>
                                )}
                                {!sop.active && (
                                  <span className="text-[9px] font-bold text-slate-400 bg-slate-200/80 px-1 rounded">Archived</span>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                    <div>
                      <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Compliance</span>
                      <span className="text-sm font-extrabold text-slate-900">{channel.compliance}%</span>
                    </div>

                    {user.role === 'Manager' && (
                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => {
                            setEditingChannel(channel);
                            setChannelForm({
                              name: channel.name,
                              category: channel.category,
                              purpose: channel.purpose || '',
                              active: channel.active
                            });
                            setIsChannelModalOpen(true);
                          }}
                          className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 rounded-lg transition"
                          title="Edit Channel"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleArchiveChannel(channel.id!)}
                          className="p-1.5 bg-slate-50 hover:bg-rose-50 border border-slate-200 text-slate-600 hover:text-rose-600 rounded-lg transition"
                          title="Archive Channel"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: Channel Creation & Edition */}
      <Modal
        isOpen={isChannelModalOpen}
        onClose={() => {
          setIsChannelModalOpen(false);
          setEditingChannel(null);
        }}
        title={editingChannel ? 'Edit Marketing Channel' : 'Create Custom Marketing Channel'}
      >
        <form onSubmit={handleChannelSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Channel Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Personal LinkedIn Outreach"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
              value={channelForm.name}
              onChange={e => setChannelForm({ ...channelForm, name: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Category</label>
            <select
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-hidden bg-white"
              value={channelForm.category}
              onChange={e => setChannelForm({ ...channelForm, category: e.target.value })}
            >
              {[
                'LinkedIn',
                'WhatsApp',
                'Google',
                'Website',
                'Email',
                'Phone',
                'Database',
                'Directory',
                'Referral Partner',
                'Other'
              ].map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Strategic Purpose</label>
            <textarea
              placeholder="e.g. Business awareness, relationship building and inbound query capture"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-hidden min-h-20"
              value={channelForm.purpose}
              onChange={e => setChannelForm({ ...channelForm, purpose: e.target.value })}
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="channelActive"
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              checked={channelForm.active}
              onChange={e => setChannelForm({ ...channelForm, active: e.target.checked })}
            />
            <label htmlFor="channelActive" className="text-xs font-semibold text-slate-700">Active Channel</label>
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setIsChannelModalOpen(false);
                setEditingChannel(null);
              }}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-xs font-semibold rounded-lg text-slate-600 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white rounded-lg transition"
            >
              {editingChannel ? 'Update Channel' : 'Add Channel'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: SOP Creation / Edition */}
      <Modal
        isOpen={isSopModalOpen}
        onClose={() => {
          setIsSopModalOpen(false);
          setEditingSop(null);
        }}
        title={editingSop ? 'Edit SOP Checklist Step' : `Add SOP Checklist Step — ${selectedChannelForSop?.name}`}
      >
        <form onSubmit={handleSopSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Activity / Checklist task</label>
            <input
              type="text"
              required
              placeholder="e.g. Direct message 15 prospects"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
              value={sopForm.activity}
              onChange={e => setSopForm({ ...sopForm, activity: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Frequency</label>
              <select
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-hidden bg-white"
                value={sopForm.frequency}
                onChange={e => setSopForm({ ...sopForm, frequency: e.target.value })}
              >
                <option value="Daily">Daily</option>
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Frequency Target Count</label>
              <input
                type="number"
                required
                min={1}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                value={sopForm.target}
                onChange={e => setSopForm({ ...sopForm, target: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="sopActive"
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              checked={sopForm.active}
              onChange={e => setSopForm({ ...sopForm, active: e.target.checked })}
            />
            <label htmlFor="sopActive" className="text-xs font-semibold text-slate-700">Active SOP Step</label>
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setIsSopModalOpen(false);
                setEditingSop(null);
              }}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-xs font-semibold rounded-lg text-slate-600 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white rounded-lg transition"
            >
              {editingSop ? 'Update SOP' : 'Create SOP'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Execution / Activity Logging */}
      <Modal
        isOpen={isActivityModalOpen}
        onClose={() => setIsActivityModalOpen(false)}
        title="Record Marketing Execution Log"
      >
        <form onSubmit={handleActivitySubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Target Marketing Channel</label>
            <select
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-hidden bg-white"
              value={activityForm.channelId}
              onChange={(e) => {
                const cId = e.target.value;
                setActivityForm({ ...activityForm, channelId: cId, sopId: '', activity: '' });
              }}
            >
              <option value="" disabled>-- Choose Channel --</option>
              {channels.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Quick-select SOP option */}
          {activityForm.channelId && sops.filter(s => s.channelId === activityForm.channelId).length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Pre-fill from Active SOP step</label>
              <select
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-hidden bg-white"
                value={activityForm.sopId}
                onChange={(e) => {
                  const sId = e.target.value;
                  const matchingSop = sops.find(s => s.id === sId);
                  if (matchingSop) {
                    setActivityForm({
                      ...activityForm,
                      sopId: sId,
                      activity: matchingSop.activity,
                      target: matchingSop.target,
                      actual: matchingSop.target
                    });
                  } else {
                    setActivityForm({ ...activityForm, sopId: '', activity: '' });
                  }
                }}
              >
                <option value="">-- No predefined SOP, input manually --</option>
                {sops.filter(s => s.channelId === activityForm.channelId).map(s => (
                  <option key={s.id} value={s.id}>{s.activity} ({s.target}x / {s.frequency})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Activity Description</label>
            <input
              type="text"
              required
              placeholder="e.g. Conduct outbound email outreach"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
              value={activityForm.activity}
              onChange={e => setActivityForm({ ...activityForm, activity: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">SOP Target</label>
              <input
                type="number"
                required
                min={1}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                value={activityForm.target}
                onChange={e => setActivityForm({ ...activityForm, target: Number(e.target.value) })}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Actual Completed</label>
              <input
                type="number"
                required
                min={0}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                value={activityForm.actual}
                onChange={e => setActivityForm({ ...activityForm, actual: Number(e.target.value) })}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Execution Date</label>
              <input
                type="date"
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-hidden bg-white"
                value={activityForm.date}
                onChange={e => setActivityForm({ ...activityForm, date: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 border-t border-slate-100 pt-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1">Leads Generated</label>
              <input
                type="number"
                min={0}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                value={activityForm.leads}
                onChange={e => setActivityForm({ ...activityForm, leads: Number(e.target.value) })}
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1">Sales Qualified</label>
              <input
                type="number"
                min={0}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                value={activityForm.qualified}
                onChange={e => setActivityForm({ ...activityForm, qualified: Number(e.target.value) })}
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1">Closed Won</label>
              <input
                type="number"
                min={0}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                value={activityForm.won}
                onChange={e => setActivityForm({ ...activityForm, won: Number(e.target.value) })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Checklist Notes / Assets</label>
            <textarea
              placeholder="e.g. Published campaign post. Track links on bit.ly..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-hidden min-h-20"
              value={activityForm.note}
              onChange={e => setActivityForm({ ...activityForm, note: e.target.value })}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsActivityModalOpen(false)}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-xs font-semibold rounded-lg text-slate-600 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white rounded-lg transition"
            >
              Log Execution
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Manager Strategic Decision */}
      <Modal
        isOpen={isInsightModalOpen}
        onClose={() => {
          setIsInsightModalOpen(false);
          setEditingInsight(null);
        }}
        title={editingInsight ? "Edit Operational Decision" : "Record Operational Decision"}
      >
        <form onSubmit={handleInsightSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Target Marketing Channel</label>
            <select
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-hidden bg-white"
              value={insightForm.channelId}
              onChange={e => setInsightForm({ ...insightForm, channelId: e.target.value })}
            >
              <option value="" disabled>-- Choose Channel --</option>
              {channels.filter(c => c.active).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Strategic Decision</label>
            <select
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-hidden bg-white"
              value={insightForm.decision}
              onChange={e => setInsightForm({ ...insightForm, decision: e.target.value })}
            >
              <option value="Increase">Increase</option>
              <option value="Continue">Continue</option>
              <option value="Improve">Improve</option>
              <option value="Reduce">Reduce</option>
              <option value="Stop">Stop</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Justification Reason</label>
            <textarea
              required
              placeholder="e.g. Higher qualified lead generation confirms fit."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-hidden min-h-20"
              value={insightForm.reason}
              onChange={e => setInsightForm({ ...insightForm, reason: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Decision Date</label>
            <input
              type="date"
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-hidden bg-white"
              value={insightForm.date}
              onChange={e => setInsightForm({ ...insightForm, date: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Target Implementation Date</label>
            <input
              type="date"
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-hidden bg-white"
              value={insightForm.targetDate}
              onChange={e => setInsightForm({ ...insightForm, targetDate: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Assigned Manager</label>
            <input
              type="text"
              required
              placeholder="Manager name"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-hidden bg-white"
              value={insightForm.manager}
              onChange={e => setInsightForm({ ...insightForm, manager: e.target.value })}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setIsInsightModalOpen(false);
                setEditingInsight(null);
              }}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-xs font-semibold rounded-lg text-slate-600 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white rounded-lg transition"
            >
              {editingInsight ? 'Update Decision' : 'Record Decision'}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
