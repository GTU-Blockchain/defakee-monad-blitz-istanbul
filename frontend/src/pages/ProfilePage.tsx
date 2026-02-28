import React, { useState, useEffect } from 'react';
import { ShieldCheck, Wallet, Clock, Award, Zap, Copy, CheckCircle } from 'lucide-react';
import { useAccount, useReadContract, usePublicClient } from 'wagmi';
import { parseAbi, formatEther } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { DeFakeSocialABI } from '../abi';

const CONTRACT_ADDRESS = '0x9B0876D6ae703fe70EA38D9254da6db769b9f6f5';

type Post = { id: number; author: string; contentURI: string; aiScore: number; timestamp: number; isChallenged: boolean; };

const getScoreColor = (s: number) => s > 70 ? 'text-emerald-400' : s > 40 ? 'text-amber-400' : 'text-rose-400';

export default function ProfilePage() {
    const { address, isConnected } = useAccount();
    const [userPosts, setUserPosts] = useState<Post[]>([]);
    const [copied, setCopied] = useState(false);
    const publicClient = usePublicClient();

    const { data: postCounter } = useReadContract({ address: CONTRACT_ADDRESS, abi: parseAbi(DeFakeSocialABI), functionName: 'postCounter' });

    useEffect(() => {
        const fetchUserPosts = async () => {
            if (!postCounter || !publicClient || !address) return;
            const count = Number(postCounter);
            if (count === 0) return;
            const loaded: Post[] = [];
            for (let i = count; i >= 1; i--) {
                try {
                    const pd = await publicClient.readContract({ address: CONTRACT_ADDRESS, abi: parseAbi(DeFakeSocialABI), functionName: 'getPost', args: [BigInt(i)] }) as any;
                    if (pd.author.toLowerCase() === address.toLowerCase()) {
                        loaded.push({ id: Number(pd.id), author: pd.author, contentURI: pd.contentURI, aiScore: Number(pd.aiScore), timestamp: Number(pd.timestamp), isChallenged: pd.isChallenged });
                    }
                } catch (e) { console.error(e); }
            }
            setUserPosts(loaded);
        };
        fetchUserPosts();
    }, [postCounter, publicClient, address]);

    const copyAddress = () => {
        if (address) { navigator.clipboard.writeText(address); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    };

    const formatTimeAgo = (ts: number) => { const s = Math.floor(Date.now() / 1000 - ts); if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return `${Math.floor(s / 86400)}d ago`; };

    const stats = {
        totalPosts: userPosts.length,
        avgScore: userPosts.length ? Math.round(userPosts.reduce((a, b) => a + b.aiScore, 0) / userPosts.length) : 0,
        challenged: userPosts.filter(p => p.isChallenged).length,
        highAuth: userPosts.filter(p => p.aiScore > 70).length,
    };

    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] gap-6 px-4">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-violet-500/30">
                    <Wallet size={36} className="text-white" />
                </div>
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h2>
                    <p className="text-zinc-500 text-sm max-w-xs">Connect your wallet to see your posts, scores, and activity on De-Fake</p>
                </div>
                <ConnectButton />
            </div>
        );
    }

    return (
        <>
            {/* Profile Header */}
            <div className="relative">
                {/* Banner */}
                <div className="h-32 bg-gradient-to-r from-violet-600/30 via-indigo-600/20 to-purple-600/30 border-b border-zinc-800/40" />

                {/* Avatar + Info */}
                <div className="px-5 -mt-10">
                    <div className="flex items-end gap-4 mb-4">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-2xl font-black text-white shadow-xl shadow-violet-500/30 border-4 border-zinc-950">
                            {address?.substring(2, 4).toUpperCase()}
                        </div>
                        <div className="pb-1">
                            <h2 className="text-xl font-bold text-white">De-Fake User</h2>
                            <button onClick={copyAddress} className="flex items-center gap-1.5 text-zinc-500 text-sm hover:text-violet-400 transition-colors mt-0.5">
                                {address?.substring(0, 6)}...{address?.substring(38)}
                                {copied ? <CheckCircle size={12} className="text-emerald-400" /> : <Copy size={12} />}
                            </button>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-4 gap-3 mb-6">
                        <div className="rounded-xl bg-zinc-900/60 border border-zinc-800/40 p-3 text-center">
                            <p className="text-xl font-black text-white">{stats.totalPosts}</p>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Posts</p>
                        </div>
                        <div className="rounded-xl bg-zinc-900/60 border border-zinc-800/40 p-3 text-center">
                            <p className="text-xl font-black text-violet-400">{stats.avgScore}%</p>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Avg Score</p>
                        </div>
                        <div className="rounded-xl bg-zinc-900/60 border border-zinc-800/40 p-3 text-center">
                            <p className="text-xl font-black text-emerald-400">{stats.highAuth}</p>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Verified</p>
                        </div>
                        <div className="rounded-xl bg-zinc-900/60 border border-zinc-800/40 p-3 text-center">
                            <p className="text-xl font-black text-amber-400">{stats.challenged}</p>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Disputed</p>
                        </div>
                    </div>

                    {/* Reputation Badge */}
                    <div className="rounded-2xl bg-gradient-to-r from-violet-600/10 to-indigo-600/10 border border-violet-500/20 p-4 mb-6 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                            <Award size={24} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-white">
                                {stats.avgScore > 70 ? 'Trusted Contributor' : stats.avgScore > 40 ? 'Active Participant' : stats.totalPosts > 0 ? 'New Explorer' : 'Getting Started'}
                            </h3>
                            <p className="text-xs text-zinc-500 mt-0.5">
                                {stats.avgScore > 70 ? 'Your content is consistently verified as authentic' : stats.avgScore > 40 ? 'Keep posting to build your reputation' : stats.totalPosts > 0 ? 'Your journey on De-Fake has begun' : 'Post your first content to get started'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* User's Posts */}
            <div className="px-5 pb-24">
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Clock size={14} /> Your Posts
                </h3>

                {userPosts.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-zinc-800/50 flex items-center justify-center"><Zap size={24} className="text-zinc-600" /></div>
                        <p className="text-zinc-500 font-medium text-sm">No posts yet</p>
                        <p className="text-zinc-600 text-xs mt-1">Head to the feed to create your first post</p>
                    </div>
                ) : null}

                <div className="space-y-3">
                    {userPosts.map(post => (
                        <div key={post.id} className="rounded-xl bg-zinc-900/50 border border-zinc-800/40 p-4 hover:border-zinc-700/50 transition-all">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-zinc-600 text-xs flex items-center gap-1.5">
                                    <Clock size={12} /> {formatTimeAgo(post.timestamp)}
                                    {post.isChallenged && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-400">CHALLENGED</span>}
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <ShieldCheck size={14} className={getScoreColor(post.aiScore)} />
                                    <span className={`text-sm font-bold ${getScoreColor(post.aiScore)}`}>{post.aiScore}%</span>
                                </div>
                            </div>
                            <p className="text-zinc-200 text-[14px] leading-relaxed">{post.contentURI}</p>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}
