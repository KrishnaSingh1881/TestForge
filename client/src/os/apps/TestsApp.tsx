import { useEffect, useState } from 'react';
import api from '../../lib/axios';
import { useOSStore } from '../store/useOSStore';
import { useAuth } from '../../context/AuthContext';
import { FiCheckCircle, FiChevronRight, FiBarChart2, FiShield, FiPlay, FiActivity, FiLayers } from 'react-icons/fi';
import { GlassIcon } from '../components/AppIcons';
import AnimatedList from '../../components/AnimatedList';
import OrbitalBuffer from '../components/OrbitalBuffer';

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

function HeroCard({ test: t, onAction }: { test: Test; onAction: (t: Test) => void }) {
    const isPast = t.attempt?.status === 'submitted' || t.attempt?.status === 'auto_submitted';
    const isInProgress = t.attempt?.status === 'in_progress';
    const isUpcoming = t.status === 'active' && !t.attempt && new Date(t.start_time) > new Date();
    const isReady = t.status === 'active' && !t.attempt && new Date(t.start_time) <= new Date();

    return (
        <div className="relative overflow-hidden rounded-[3rem] p-1 border border-white/10 group transition-all duration-700 hover:border-accent/40">
            {/* Background Glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-purple-600/5 opacity-40" />
            
            <div className="relative glass p-10 flex flex-col md:flex-row items-center gap-10 bg-white/[0.01]">
                {/* Visual Icon */}
                <div className="w-32 h-32 rounded-[2.5rem] bg-accent/10 flex items-center justify-center border border-accent/20 shadow-2xl shadow-accent/10 relative">
                    <div className="absolute inset-0 bg-accent/20 blur-3xl rounded-full scale-50 group-hover:scale-100 transition-transform duration-1000" />
                    <FiCheckCircle className="text-xl text-accent opacity-20" />
                </div>

                {/* Content */}
                <div className="flex-1 text-center md:text-left">
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mb-3">
                        <span className="px-4 py-1.5 rounded-full bg-accent text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-accent/30">
                            {isInProgress ? 'In Progress' : 'Featured Trial'}
                        </span>
                        <span className="text-[10px] font-black text-secondary uppercase tracking-[0.4em] opacity-40">
                            ID: {t.id.slice(0, 8)}
                        </span>
                    </div>
                    <h2 className="text-4xl font-black text-primary tracking-tighter leading-none mb-4 uppercase group-hover:text-accent/50 transition-colors">
                        {t.title}
                    </h2>
                    <p className="text-secondary font-bold uppercase tracking-[0.3em] opacity-60">
                        {t.subject} • {t.duration_mins} Minutes
                    </p>
                </div>

                {/* CTA */}
                <button 
                    onClick={() => onAction(t)}
                    className="px-10 py-5 rounded-web bg-white text-accent font-black text-sm uppercase tracking-[0.25em] shadow-2xl hover:opacity-90 hover:-translate-y-1 active:translate-y-0 transition-all flex items-center gap-4"
                >
                    {isInProgress ? 'Resume Session' : 'Initiate Session'} <FiChevronRight />
                </button>
            </div>
        </div>
    );
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
                <div className="h-64 flex items-center justify-center">
                    <OrbitalBuffer size={40} className="text-accent" />
                </div>
                <p className="text-[10px] font-black text-white/20 tracking-[0.4em] uppercase">Syncing Hub</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-transparent animate-in fade-in duration-700 overflow-hidden">
            {/* Unified Hub Header */}
            <div className="p-8 pb-6 flex items-center justify-between shrink-0 border-b border-white/5 bg-white/[0.02] backdrop-blur-md">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black text-primary tracking-tighter flex items-center gap-4 uppercase">
                        <span className="w-2.5 h-2.5 rounded-full bg-accent shadow-[0_0_15px_rgba(var(--accent-rgb),0.8)]" />
                        ACADEMIC HUB
                    </h1>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-secondary opacity-40">
                        Enrollment: {user?.year || '—'} • Division: {user?.division || '—'}
                    </p>
                </div>
                <button onClick={fetchTests} className="p-2 hover:bg-white/5 rounded-lg text-accent transition-colors">
                    <FiActivity className="animate-spin" />
                </button>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar p-8 space-y-10">
                {/* Hero Slot */}
                {(() => {
                    const hero = tests.find(t => 
                        t.attempt?.status === 'in_progress' || 
                        (t.status === 'active' && !t.attempt && new Date(t.start_time) <= new Date())
                    );
                    if (!hero) return null;
                    return (
                        <div className="animate-in fade-in slide-in-from-top-10 duration-1000">
                             <p className="text-[10px] font-black uppercase tracking-[0.5em] text-secondary opacity-30 mb-6 px-4">Prioritized Evaluation</p>
                             <HeroCard test={hero} onAction={(t) => openWindow('test-session', { testId: t.id })} />
                        </div>
                    );
                })()}

                {/* Other Tests */}
                <div className="space-y-12">
                    {/* Active Trials Section */}
                    {(() => {
                        const activeTests = tests.filter(t => {
                             const hero = tests.find(h => h.attempt?.status === 'in_progress' || (h.status === 'active' && !h.attempt && new Date(h.start_time) <= new Date()));
                             if (t.id === hero?.id) return false;
                             const isPast = t.attempt?.status === 'submitted' || t.attempt?.status === 'auto_submitted';
                             return !isPast;
                        });
                        if (activeTests.length === 0) return null;
                        return (
                            <div className="space-y-6">
                                <p className="text-[10px] font-black uppercase tracking-[0.5em] text-secondary opacity-30 px-4">Active & Incoming Trials</p>
                                <AnimatedList 
                                    className="grid grid-cols-1"
                                    items={activeTests}
                                    gap={16}
                                    renderItem={(t) => (
                                        <TestRow t={t} onAction={() => openWindow('test-session', { testId: t.id })} />
                                    )}
                                />
                            </div>
                        );
                    })()}

                    {/* Historical Trials Section */}
                    {(() => {
                        const history = tests.filter(t => t.attempt?.status === 'submitted' || t.attempt?.status === 'auto_submitted');
                        if (history.length === 0) return null;
                        return (
                            <div className="space-y-6">
                                <p className="text-[10px] font-black uppercase tracking-[0.5em] text-secondary opacity-30 px-4">Concluded Evaluations</p>
                                <AnimatedList 
                                    className="grid grid-cols-1"
                                    items={history}
                                    gap={16}
                                    renderItem={(t) => (
                                        <TestRow t={t} onAction={() => openWindow('results', { attemptId: t.attempt?.id })} />
                                    )}
                                />
                            </div>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
}

function TestRow({ t, onAction }: { t: Test; onAction: (aid?: string) => void }) {
    const { openWindow } = useOSStore();
    const isPast = t.attempt?.status === 'submitted' || t.attempt?.status === 'auto_submitted';
    const isInProgress = t.attempt?.status === 'in_progress';
    const isUpcoming = t.status === 'active' && !t.attempt && new Date(t.start_time) > new Date();
    const isReady = t.status === 'active' && !t.attempt && new Date(t.start_time) <= new Date();

    return (
        <div className="relative group">
            <div className={`glass-2 p-8 flex items-center gap-8 rounded-[3.5rem] border transition-all duration-500 shadow-xl hover:shadow-2xl ${isPast ? 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]' : 'bg-white/[0.02] hover:border-accent/40 border-accent/10'}`}>
                
                {/* Icon Indicator */}
                <div className={`w-16 h-16 rounded-3xl flex items-center justify-center border transition-all duration-500 shadow-2xl shrink-0 ${isPast ? 'bg-white/5 border-white/10 group-hover:bg-accent/10 group-hover:border-accent/20' : 'bg-accent/10 border-accent/20'}`}>
                    {isPast ? <FiCheckCircle className="text-secondary text-2xl group-hover:text-accent" /> : <FiPlay className={`text-accent text-2xl ${isReady ? 'animate-pulse' : ''}`} />}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-xl font-black text-primary truncate uppercase tracking-tight group-hover:text-accent transition-colors">{t.title}</h3>
                        <span className={`text-[8px] font-black uppercase tracking-[.2em] px-3 py-1 rounded-full border ${isPast ? 'bg-white/5 text-secondary border-white/10 opacity-40' : 'bg-accent/10 text-accent border-accent/20'}`}>
                            {isPast ? 'Concluded' : isInProgress ? 'In Progress' : isUpcoming ? 'Locked' : 'Open'}
                        </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-[10px] font-black uppercase tracking-widest text-secondary opacity-40 mt-1">
                        <span>{t.subject}</span>
                        <span>•</span>
                        <span>{t.duration_mins || t.duration_minutes} Minutes</span>
                        <span>•</span>
                        <span>{new Date(t.start_time).toLocaleDateString()}</span>
                    </div>
                </div>

                {/* Action */}
                <div className="flex items-center gap-4">
                    {isPast ? (
                        <button 
                            onClick={() => onAction()}
                            className="px-8 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-secondary font-black text-[10px] uppercase tracking-widest transition-all border border-white/5"
                        >
                            Review Results
                        </button>
                    ) : (
                        <button 
                            disabled={!isReady && !isInProgress}
                            onClick={() => onAction()}
                            className="px-10 py-4 rounded-[2rem] bg-accent hover:opacity-90 disabled:opacity-30 text-white font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-accent/20 transition-all active:scale-95"
                        >
                            {isInProgress ? 'Resume Sync' : 'Initialize Protocol'}
                        </button>
                    )}
                    <FiChevronRight className="text-secondary opacity-10 group-hover:opacity-100 group-hover:translate-x-2 transition-all text-2xl" />
                </div>
            </div>
        </div>
    );
}
