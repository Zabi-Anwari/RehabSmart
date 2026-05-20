import React, { useEffect, useState } from 'react';
import { Card, StatCard } from '../components/Cards';
import { 
  LineChart as LineChartIcon, 
  Target, 
  Calendar, 
  ClipboardCheck,
  Zap,
  TrendingDown,
  ChevronDown,
  LayoutDashboard
} from 'lucide-react';
import { ProgressChart } from '../components/Charts';
import { cn } from '../lib/utils';
import { useAuth } from '../components/AuthContext';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';

export function ProgressPage() {
  const { profile, user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSessions() {
      if (!user) return;
      const path = `users/${user.uid}/sessions`;
      try {
        const q = query(
          collection(db, path), 
          orderBy('date', 'desc'), 
          limit(14)
        );
        const querySnapshot = await getDocs(q);
        const sessionData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          day: doc.data().date?.toDate ? new Date(doc.data().date.toDate()).toLocaleDateString('en-US', { weekday: 'short' }) : '?',
          rom: doc.data().quality || 0, // Mocking some plot data
        }));
        setSessions(sessionData.reverse());
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
      } finally {
        setLoading(false);
      }
    }
    fetchSessions();
  }, [user]);

  if (!profile) return null;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Analytics & Progress</h1>
          <p className="text-slate-500 font-medium">Detailed metrics of your rehabilitation journey.</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2">
            Last 14 Days <ChevronDown size={16} />
          </button>
          <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2">
            Export Report
          </button>
        </div>
      </div>

      {/* Grid for main metrics */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card title="Movement Quality" subtitle="Session performance over time" className="lg:col-span-2">
           {sessions.length > 0 ? (
             <ProgressChart data={sessions} type="bar" />
           ) : (
             <div className="p-24 flex flex-col items-center justify-center text-center">
                <LayoutDashboard size={48} className="text-slate-200 mb-4" />
                <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">No analytical data collected yet</p>
             </div>
           )}
        </Card>

        <div className="space-y-6">
           <Card title="Recovery Goals">
              <div className="space-y-4">
                 <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex justify-between items-center mb-2">
                       <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Pain Management</span>
                       <span className="text-xs font-bold text-slate-400">Awaiting Data</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900">Reduced daily discomfort</p>
                 </div>
                 <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex justify-between items-center mb-2">
                       <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Range of Motion</span>
                       <span className="text-xs font-bold text-blue-600">Active Stage</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900">Current progress: {profile.recoveryProgress || 0}%</p>
                 </div>
              </div>
           </Card>
           
           <Card title="Clinical Summary">
              <div className="text-sm text-slate-600 space-y-4 font-medium leading-relaxed">
                 <p className="italic">Notes from your clinician will appear here once assigned.</p>
              </div>
           </Card>
        </div>
      </div>

      <div className="grid md:grid-cols-1 gap-6">
        <Card title="Pain Trend Analysis" subtitle="Visualizing discomfort over time" icon={<TrendingDown className="text-green-500" />}>
           <div className="h-[200px] w-full flex items-end justify-between px-4">
              {sessions.length > 0 ? sessions.map((s, i) => (
                <div key={i} className="flex flex-col items-center gap-2 w-full group">
                   <div 
                    className={cn(
                      "w-4 rounded-t-lg transition-all group-hover:bg-blue-400",
                      (s.painLevel || 0) > 7 ? "bg-red-200" : (s.painLevel || 0) > 4 ? "bg-yellow-200" : "bg-green-200"
                    )} 
                    style={{ height: `${(s.painLevel || 0) * 10 + 10}%` }} 
                   />
                   <span className="text-[10px] font-bold text-slate-400">{s.day}</span>
                </div>
              )) : (
                <div className="w-full h-full flex items-center justify-center">
                  <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Pain logs will sync here</p>
                </div>
              )}
           </div>
        </Card>
      </div>
    </div>
  );
}
