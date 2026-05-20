import React, { useEffect, useState } from 'react';
import { StatCard, Card, ExerciseListItem } from '../components/Cards';
import { 
  Calendar, 
  Clock, 
  TrendingUp, 
  Flame, 
  AlertCircle,
  Play,
  History,
  Timer,
  User as UserIcon
} from 'lucide-react';
import { MOCK_EXERCISES } from '../constants';
import { ProgressChart } from '../components/Charts';
import { motion } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import { collection, query, orderBy, limit, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';

export function PatientDashboard() {
  const { profile, user, loading } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [fixing, setFixing] = useState(false);
  const navigate = useNavigate();

  const handleFixAccount = async () => {
    if (!user) return;
    setFixing(true);
    const path = `users/${user.uid}`;
    try {
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name: user.displayName || user.email?.split('@')[0] || 'Rehab Patient',
        email: user.email,
        role: 'patient',
        injuryType: 'Knee',
        recoveryProgress: 0,
        createdAt: serverTimestamp()
      });
      // Component will re-render automatically due to onSnapshot in AuthContext
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    } finally {
      setFixing(false);
    }
  };

  useEffect(() => {
    async function fetchSessions() {
      if (!user) return;
      const path = `users/${user.uid}/sessions`;
      try {
        const q = query(
          collection(db, path), 
          orderBy('date', 'desc'), 
          limit(7)
        );
        const querySnapshot = await getDocs(q);
        const sessionData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          // Convert timestamp to something usable for charts if needed
          day: doc.data().date?.toDate ? new Date(doc.data().date.toDate()).toLocaleDateString('en-US', { weekday: 'short' }) : '?'
        }));
        setSessions(sessionData);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
      } finally {
        setLoadingSessions(false);
      }
    }
    fetchSessions();
  }, [user]);

  if (loading || (loadingSessions && user && profile === null)) {
    return (
      <div className="flex flex-col items-center justify-center p-24 space-y-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Calibrating your recovery dashboard...</p>
      </div>
    );
  }

  if (!profile && !loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-center space-y-6">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
          <UserIcon size={40} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Patient Profile Missing</h2>
          <p className="text-slate-500 mt-2">We detected your authentication but your clinical profile hasn't been initialized in our records. This can happen if account setup was interrupted.</p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button 
            disabled={fixing}
            onClick={handleFixAccount} 
            className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 disabled:opacity-50"
          >
            {fixing ? 'Initializing...' : 'Fix Account Now'}
          </button>
          <button onClick={() => auth.signOut()} className="px-8 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold">
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="space-y-8 pb-12">
      {/* Welcome Card */}
      <div className="relative overflow-hidden bg-white p-8 rounded-3xl border border-blue-100 shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/50 rounded-full blur-[60px] -mr-32 -mt-32" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Welcome back, {profile.name} 👋</h1>
            <p className="text-slate-500 font-medium">You're making great progress in your <span className="text-blue-600 font-bold">{profile.injuryType || 'Physical'} Rehabilitation</span>.</p>
          </div>
          <Link to="/exercises" className="inline-flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all font-bold shadow-lg shadow-blue-200">
            <Play size={20} />
            Start Today's Session
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Recovery Progress" value={`${profile.recoveryProgress || 0}%`} trend="+0%" icon={TrendingUp} color="blue" />
        <StatCard label="Total Sessions" value={sessions.length.toString()} icon={History} color="green" />
        <StatCard label="Current Streak" value="0 Days" icon={Flame} color="red" />
        <StatCard label="Next Session" value="Scheduled" icon={Calendar} color="purple" />
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Column: Plan & Exercises */}
        <div className="lg:col-span-2 space-y-8">
          <Card title="Today's Exercises" subtitle="Daily targeted tasks" icon={<Clock size={20} />}>
            <div className="space-y-3">
              {MOCK_EXERCISES.map((ex, idx) => (
                 <ExerciseListItem 
                   key={ex.id}
                   title={ex.title}
                   details={`${ex.sets} sets • ${ex.reps} reps`}
                   status={idx === 0 ? 'completed' : 'pending'}
                   duration="10-15 min"
                 />
              ))}
              <div className="pt-4 border-t border-slate-50">
                 <Link to="/exercises" className="block w-full py-3 text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors uppercase tracking-widest text-center">
                    View Complete Exercise Library
                 </Link>
              </div>
            </div>
          </Card>

          <Card title="Recovery Overview" subtitle="Session Data" icon={<TrendingUp size={20} />}>
             {sessions.length > 0 ? (
               <ProgressChart data={sessions.reverse()} />
             ) : (
               <div className="p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No session data recorded yet</p>
               </div>
             )}
          </Card>
        </div>

        {/* Right Column: Health & Status */}
        <div className="space-y-8">
          <Card title="Current Plan Status" className="bg-slate-900 border-slate-800">
            <div className="space-y-6">
              <div className="p-4 bg-slate-800 rounded-2xl">
                 <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Next Milestone</p>
                 <h4 className="text-white font-bold text-lg mb-1">Mobility Target</h4>
                 <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                    <span>Level: {profile.recoveryProgress || 0}%</span>
                    <span>Goal: 100%</span>
                 </div>
                 <div className="h-2 w-full bg-slate-700 rounded-full mt-3 overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${profile.recoveryProgress || 0}%` }}
                      className="h-full bg-blue-500 rounded-full"
                    />
                 </div>
              </div>

              <div className="p-4 border border-slate-800 rounded-2xl bg-slate-800/50 flex items-start gap-3">
                <AlertCircle className="text-yellow-500 mt-0.5" size={18} />
                <div className="flex-1">
                   <p className="text-sm font-bold text-slate-200">Physician's Note</p>
                   <p className="text-xs text-slate-400 mt-1 leading-relaxed italic">Wait for clinician assignment to receive personalized recovery notes.</p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800">
                 <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-[10px] font-bold">RS</div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AI analysis <span className="text-green-500">Active</span></p>
                 </div>
              </div>
            </div>
          </Card>

          <Card title="Pain Tracking" subtitle="Daily discomfort log">
            <div className="space-y-4">
               <p className="text-sm text-slate-600 font-medium">How are you feeling today?</p>
               <div className="grid grid-cols-5 gap-2">
                 {[1, 2, 3, 4, 5].map(v => (
                   <button key={v} className="aspect-square rounded-xl border border-slate-200 flex items-center justify-center font-bold text-slate-400 hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50 transition-all">
                     {v}
                   </button>
                 ))}
               </div>
               <p className="text-[10px] text-slate-400 font-medium text-center uppercase tracking-tighter">1 = No Pain | 5 = Severe Pain</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
