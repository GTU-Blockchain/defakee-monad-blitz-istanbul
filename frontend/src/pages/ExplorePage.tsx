import React, { useState, useEffect } from 'react';
import { ShieldCheck, Search, TrendingUp, Clock, Filter, Zap } from 'lucide-react';
import { useReadContract, usePublicClient } from 'wagmi';
import { parseAbi } from 'viem';
import { DeFakeSocialABI } from '../abi';

const CONTRACT_ADDRESS = '0x9B0876D6ae703fe70EA38D9254da6db769b9f6f5';

type Post = { id: number; author: string; contentURI: string; aiScore: number; timestamp: number; isChallenged: boolean; };

const getScoreColor = (s: number) => s > 70 ? 'text-emerald-400' : s > 40 ? 'text-amber-400' : 'text-rose-400';
const getScoreBadge = (s: number) => s > 70 ? 'bg-emerald-500/15 border-emerald-500/30' : s > 40 ? 'bg-amber-500/15 border-amber-500/30' : 'bg-rose-500/15 border-rose-500/30';

export default function ExplorePage() {
    const [posts, setPosts] = useState<Post[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'recent' | 'score' | 'challenged'>('recent');

    const publicClient = usePublicClient();
    const { data: postCounter } = useReadContract({ address: CONTRACT_ADDRESS, abi: parseAbi(DeFakeSocialABI), functionName: 'postCounter' });

    useEffect(() => {
        const fetchPosts = async () => {
            if (!postCounter || !publicClient) return;
            const count = Number(postCounter);
            if (count === 0) return;
            const loaded: Post[] = [];
            for (let i = count; i >= 1; i--) {
                try {
                    const pd = await publicClient.readContract({ address: CONTRACT_ADDRESS, abi: parseAbi(DeFakeSocialABI), functionName: 'getPost', args: [BigInt(i)] }) as any;
                    loaded.push({ id: Number(pd.id), author: pd.author, contentURI: pd.contentURI, aiScore: Number(pd.aiScore), timestamp: Number(pd.timestamp), isChallenged: pd.isChallenged });
                } catch (e) { console.error(e); }
            }
            setPosts(loaded);
        };
        fetchPosts();
    }, [postCounter, publicClient]);

    const formatTimeAgo = (ts: number) => { const s = Math.floor(Date.now() / 1000 - ts); if (s < 60) return `${s}s`; if (s < 3600) return `${Math.floor(s / 60)}m`; if (s < 86400) return `${Math.floor(s / 3600)}h`; return `${Math.floor(s / 86400)}d`; };

    const filtered = posts
        .filter(p => p.contentURI.toLowerCase().includes(searchQuery.toLowerCase()) || p.author.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => {
            if (sortBy === 'score') return b.aiScore - a.aiScore;
            if (sortBy === 'challenged') return (b.isChallenged ? 1 : 0) - (a.isChallenged ? 1 : 0);
            return b.timestamp - a.timestamp;
        });

    const stats = {
        total: posts.length,
        highAuth: posts.filter(p => p.aiScore > 70).length,
        challenged: posts.filter(p => p.isChallenged).length,
        avgScore: posts.length ? Math.round(posts.reduce((a, b) => a + b.aiScore, 0) / posts.length) : 0,
    };

    return (
        <>
            {/* Header */}
            <div className="sticky top-0 z-20 bg-zinc-950/70 backdrop-blur-xl border-b border-zinc-800/40 px-5 py-4">
                <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2 mb-4">
                    <TrendingUp size={20} className="text-violet-400" /> Explore
                </h2>

                {/* Search */}
                <div className="flex items-center gap-2.5 bg-zinc-800/40 border border-zinc-700/30 rounded-xl px-4 py-2.5 focus-within:border-violet-500/50 transition-colors mb-4">
                    <Search size={16} className="text-zinc-500" />
                    <input type="text" placeholder="Search posts, authors..." className="bg-transparent focus:outline-none text-sm text-zinc-200 w-full placeholder-zinc-600" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-2">
                    {[
                        { key: 'recent' as const, label: 'Recent', icon: <Clock size={14} /> },
                        { key: 'score' as const, label: 'Top Score', icon: <ShieldCheck size={14} /> },
                        { key: 'challenged' as const, label: 'Challenged', icon: <Filter size={14} /> },
                    ].map(tab => (
                        <button key={tab.key} onClick={() => setSortBy(tab.key)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${sortBy === tab.key ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 border border-transparent'}`}>
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 mt-4">
                <div className="rounded-xl bg-zinc-900/50 border border-zinc-800/40 p-3 text-center">
                    <p className="text-2xl font-black text-white">{stats.total}</p>
                    <p className="text-[11px] text-zinc-500 uppercase tracking-wider mt-0.5">Total Posts</p>
                </div>
                <div className="rounded-xl bg-zinc-900/50 border border-zinc-800/40 p-3 text-center">
                    <p className="text-2xl font-black text-emerald-400">{stats.highAuth}</p>
                    <p className="text-[11px] text-zinc-500 uppercase tracking-wider mt-0.5">Authentic</p>
                </div>
                <div className="rounded-xl bg-zinc-900/50 border border-zinc-800/40 p-3 text-center">
                    <p className="text-2xl font-black text-amber-400">{stats.challenged}</p>
                    <p className="text-[11px] text-zinc-500 uppercase tracking-wider mt-0.5">Challenged</p>
                </div>
                <div className="rounded-xl bg-zinc-900/50 border border-zinc-800/40 p-3 text-center">
                    <p className="text-2xl font-black text-violet-400">{stats.avgScore}%</p>
                    <p className="text-[11px] text-zinc-500 uppercase tracking-wider mt-0.5">Avg Score</p>
                </div>
            </div>

            {/* Posts Grid */}
            <div className="px-4 mt-6 pb-24 space-y-3">
                {filtered.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-zinc-800/50 flex items-center justify-center"><Zap size={28} className="text-zinc-600" /></div>
                        <p className="text-zinc-500 font-medium">No posts found</p>
                        <p className="text-zinc-600 text-sm mt-1">Try adjusting your search or filters</p>
                    </div>
                ) : null}

                {filtered.map(post => (
                    <div key={post.id} className="rounded-xl bg-zinc-900/50 border border-zinc-800/40 p-4 hover:border-zinc-700/50 transition-all flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex-shrink-0 flex items-center justify-center font-bold text-[10px] text-white shadow-md shadow-indigo-500/20">
                            {post.author.substring(2, 4).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-zinc-200 text-sm">{post.author.substring(0, 6)}...{post.author.substring(38)}</span>
                                <span className="text-zinc-600 text-xs">{formatTimeAgo(post.timestamp)} ago</span>
                                {post.isChallenged && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-400 uppercase tracking-wider">Challenged</span>}
                            </div>
                            <p className="text-zinc-300 text-[14px] leading-relaxed line-clamp-2">{post.contentURI}</p>
                        </div>
                        <div className={`flex-shrink-0 px-2.5 py-1 rounded-lg border text-xs font-bold ${getScoreBadge(post.aiScore)} ${getScoreColor(post.aiScore)}`}>
                            {post.aiScore}%
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}
