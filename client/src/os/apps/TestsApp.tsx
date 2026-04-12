
import { useEffect, useState } from 'react';
import api from '../../lib/axios';
import { useOSStore } from '../store/useOSStore';
import { useAuth } from '../../context/AuthContext';
import { FiCheckCircle, FiChevronRight, FiClock, FiBarChart2, FiShield, FiPlay, FiLock } from 'react-icons/fi';
import { GlassIcon } from '../components/AppIcons';
import AnimatedList from '../../components/AnimatedList';

interface Test {
    id: string;
    title: string;
    subject: string;
    duration_mins: number;
    status: string;
    start_time: string;
    attempt?: {
        id: string;
        status: string;
        started_at: string;
        submitted_at: string;
    };
}

export default function TestsApp() {
    const [tests, setTests] = useState<Test[]>([]);
    const [loading, setLoading] = useState(true);
    const { openWindow } = useOSStore();
    const { user } = useAuth();

    const fetchTests = async () => {
        setLoading(true);
        try {
            const r = await api.get('/tests/available');
            setTests(r.data.tests || []);
        } catch (e) {
            console.error('Failed to sync hub:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTests();
    }, []);

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin" />
                    <p className="text-[10px] font-black text-white/20 tracking-[0.4em] uppercase">Syncing Hub</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-transparent animate-in fade-in duration-700 overflow-hidden">
            {/* Unified Hub Header */}
            <div className="p-8 pb-6 flex items-center justify-between shrink-0 border-b border-white/5 bg-black/5">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black text-primary tracking-tighter flex items-center gap-4 uppercase">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.8)]" />
                        ACADEMIC HUB
                    </h1>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-secondary opacity-40">
                        Enrollment: {user?.year || '—'} • Division: {user?.division || '—'}
                    </p>
                </div>
                <button onClick={fetchTests} className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300 transition-colors">
                   Sync Schedule
                </button>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar p-8 space-y-6">
                <AnimatedList 
                    items={tests}
                    className="flex flex-col gap-4"
                    renderItem={(t) => {
                        const isPast = t.attempt?.status === 'submitted' || t.attempt?.status === 'auto_submitted';
                        const isInProgress = t.attempt?.status === 'in_progress';
                        const isUpcoming = t.status === 'active' && !t.attempt && new Date(t.start_time) > new Date();
                        const isReady = t.status === 'active' && !t.attempt && new Date(t.start_time) <= new Date();

                        return (
                            <div className="relative group">
                                <div className={`glass no-shadow p-6 flex items-center gap-8 rounded-[2rem] border-white/5 transition-all duration-500 ${isPast ? 'hover:bg-white/[0.04]' : 'bg-white/[0.02] border-indigo-500/10'}`}>
                                    {/* Icon Indicator */}
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-500 ${isPast ? 'bg-white/5 border-white/5 group-hover:bg-indigo-500/10 group-hover:border-indigo-500/20' : 'bg-indigo-500/10 border-indigo-500/20 animate-pulse'}`}>
                                        {isPast ? <FiCheckCircle className="text-secondary text-2xl group-hover:text-indigo-400" /> : <FiPlay className="text-indigo-400 text-2xl" />}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-1">
                                            <h3 className="text-lg font-black text-primary truncate uppercase tracking-tight">{t.title}</h3>
                                            <span className={`text-[8px] font-black uppercase tracking-[.2em] px-2 py-0.5 rounded ${isPast ? 'bg-white/5 text-secondary opacity-40' : 'bg-indigo-500/20 text-indigo-400'}`}>
                                                {isPast ? 'Concluded' : isInProgress ? 'In Progress' : isUpcoming ? 'Locked' : 'Open'}
                                            </span>
                                        </div>
                                        <p className="text-[10px] font-black text-secondary uppercase tracking-[0.3em] opacity-40">{t.subject} • {t.duration_mins} Minutes</p>
                                    </div>

                                    {/* Conditional Action Zone */}
                                    <div className="flex items-center gap-2 relative z-50">
                                        {isPast ? (
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => openWindow('results', { attemptId: t.attempt?.id })} className="px-5 py-2.5 rounded-2xl bg-white/5 border border-white/5 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-white/10 transition-all active:scale-95">Results</button>
                                                <button onClick={() => openWindow('analytics', { attemptId: t.attempt?.id })} className="p-3 rounded-2xl bg-white/5 border border-white/5 text-secondary hover:text-indigo-400 hover:bg-white/10 transition-all active:scale-95" title="Analytics"><FiBarChart2 /></button>
                                                <button onClick={() => openWindow('integrity', { testId: t.id, testTitle: t.title })} className="p-3 rounded-2xl bg-white/5 border border-white/5 text-secondary hover:text-indigo-400 hover:bg-white/10 transition-all active:scale-95" title="Integrity Audit"><FiShield /></button>
                                            </div>
                                        ) : isInProgress ? (
                                            <button onClick={() => openWindow('test-session', { testId: t.id })} className="flex items-center gap-3 px-8 py-3 rounded-2xl bg-indigo-500 text-white font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all">
                                                Resume Session <FiChevronRight />
                                            </button>
                                        ) : isUpcoming ? (
                                            <div className="flex items-center gap-3 px-8 py-3 rounded-2xl bg-black/10 border border-white/10 opacity-60">
                                                <FiLock className="text-secondary" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-secondary">Session Pending — Please Wait</span>
                                            </div>
                                        ) : isReady ? (
                                            <button onClick={() => openWindow('test-session', { testId: t.id })} className="flex items-center gap-3 px-8 py-3 rounded-2xl bg-indigo-500 text-white font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all">
                                                Initiate Session <FiChevronRight />
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        );
                    }}
                />
            </div>
        </div>
    );
}
