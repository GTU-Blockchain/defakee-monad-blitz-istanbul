import React, { useState, useEffect } from 'react';
import { ShieldCheck, Gavel, HandCoins, Sparkles, Zap, MoreHorizontal, Image as ImageIcon, Search } from 'lucide-react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, usePublicClient } from 'wagmi';
import { parseAbi, parseEther, formatEther } from 'viem';
import { DeFakeSocialABI } from '../abi';
import { analyzeWithGemini } from '../gemini';

const CONTRACT_ADDRESS = '0x1eb6e7A1f8682bd33AaFD242384Be0734c98Cf53';

type PostStatus = 'Pending' | 'Authentic' | 'Fake';
type Challenge = { endTime: number; votesFake: bigint; votesAuthentic: bigint; resolved: boolean; };
type Post = { id: number; author: string; contentURI: string; contentHash: string; aiScore: number; isChallenged: boolean; finalStatus: PostStatus; timestamp: number; challengeData?: Challenge; hasVoted?: boolean; votedFake?: boolean; };

const getScoreColor = (s: number) => s > 70 ? 'text-emerald-400' : s > 40 ? 'text-amber-400' : 'text-rose-400';
const getScoreBg = (s: number) => s > 70 ? 'from-emerald-500/20 to-emerald-500/5' : s > 40 ? 'from-amber-500/20 to-amber-500/5' : 'from-rose-500/20 to-rose-500/5';

export default function FeedPage() {
    const [file, setFile] = useState<File | null>(null);
    const [textPost, setTextPost] = useState('');
    const [hash, setHash] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<any>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [stakeAmount, setStakeAmount] = useState<Record<number, string>>({});
    const [searchQuery, setSearchQuery] = useState('');

    const { address, isConnected } = useAccount();
    const { writeContract, data: txHash, isPending } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
    const publicClient = usePublicClient();

    const { data: postCounter, refetch: refetchCounter } = useReadContract({
        address: CONTRACT_ADDRESS, abi: parseAbi(DeFakeSocialABI), functionName: 'postCounter',
    });

    useEffect(() => {
        const fetchPosts = async () => {
            if (!postCounter || !publicClient) return;
            const count = Number(postCounter);
            if (count === 0) return;
            const loaded: Post[] = [];
            for (let i = count; i >= 1; i--) {
                try {
                    const pd = await publicClient.readContract({ address: CONTRACT_ADDRESS, abi: parseAbi(DeFakeSocialABI), functionName: 'getPost', args: [BigInt(i)] }) as any;
                    let cd = undefined;
                    let hasVoted = false;
                    let votedFake = false;
                    if (pd.isChallenged) {
                        const c = await publicClient.readContract({ address: CONTRACT_ADDRESS, abi: parseAbi(DeFakeSocialABI), functionName: 'getChallenge', args: [BigInt(i)] }) as any;
                        cd = { endTime: Number(c.endTime), votesFake: c.votesFake, votesAuthentic: c.votesAuthentic, resolved: c.resolved };
                        if (address) {
                            const stake = await publicClient.readContract({ address: CONTRACT_ADDRESS, abi: parseAbi(DeFakeSocialABI), functionName: 'userStakeAmount', args: [BigInt(i), address] }) as bigint;
                            if (stake > 0n) {
                                hasVoted = true;
                                votedFake = await publicClient.readContract({ address: CONTRACT_ADDRESS, abi: parseAbi(DeFakeSocialABI), functionName: 'userVoteDirection', args: [BigInt(i), address] }) as boolean;
                            }
                        }
                    }
                    loaded.push({ id: Number(pd.id), author: pd.author, contentURI: pd.contentURI, contentHash: pd.contentHash, aiScore: Number(pd.aiScore), isChallenged: pd.isChallenged, finalStatus: pd.finalStatus === 0 ? 'Pending' : pd.finalStatus === 1 ? 'Authentic' : 'Fake', timestamp: Number(pd.timestamp), challengeData: cd, hasVoted, votedFake });
                } catch (e) { console.error("Error fetching post", i, e); }
            }
            setPosts(loaded);
        };
        fetchPosts();
    }, [postCounter, publicClient, address]);

    useEffect(() => { if (isSuccess) { refetchCounter(); setTextPost(''); setFile(null); setHash(''); setAnalysisResult(null); } }, [isSuccess, refetchCounter]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            setFile(e.target.files[0]); setAnalysisResult(null);
            const buf = await e.target.files[0].arrayBuffer();
            setHash("0x" + Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buf))).map(b => b.toString(16).padStart(2, '0')).join(''));
        }
    };
    const handleTextChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setTextPost(e.target.value);
        if (e.target.value.length > 5) {
            setHash("0x" + Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(e.target.value)))).map(b => b.toString(16).padStart(2, '0')).join(''));
        } else { setHash(''); }
    };
    const analyzeContent = async (): Promise<any> => {
        if (!hash) return null;
        setIsAnalyzing(true);
        try {
            const result = await analyzeWithGemini(textPost || file?.name || 'content');
            setAnalysisResult(result);
            return result;
        } catch {
            const fallback = { score: 45, message: 'AI service unreachable. Fallback score applied.', model: 'fallback' };
            setAnalysisResult(fallback);
            return fallback;
        } finally { setIsAnalyzing(false); }
    };
    const handleCreatePost = async () => {
        if (!hash || !isConnected) return;
        let result = analysisResult;
        if (!result) {
            result = await analyzeContent();
        }
        if (!result) return;
        writeContract({ address: CONTRACT_ADDRESS, abi: parseAbi(DeFakeSocialABI), functionName: 'createPost', args: [textPost || 'file_uploaded', hash as `0x${string}`, result.score] });
    };
    const handleChallenge = (id: number, amt: string) => { if (!amt) return alert("Enter stake!"); writeContract({ address: CONTRACT_ADDRESS, abi: parseAbi(DeFakeSocialABI), functionName: 'challengePost', args: [BigInt(id)], value: parseEther(amt) }); };
    const handleVote = (id: number, fake: boolean, amt: string) => { if (!amt) return alert("Enter stake!"); writeContract({ address: CONTRACT_ADDRESS, abi: parseAbi(DeFakeSocialABI), functionName: 'vote', args: [BigInt(id), fake], value: parseEther(amt) }); };
    const handleResolve = (id: number) => writeContract({ address: CONTRACT_ADDRESS, abi: parseAbi(DeFakeSocialABI), functionName: 'resolveChallenge', args: [BigInt(id)] });
    const handleClaim = (id: number) => writeContract({ address: CONTRACT_ADDRESS, abi: parseAbi(DeFakeSocialABI), functionName: 'claimReward', args: [BigInt(id)] });

    const formatTimeAgo = (ts: number) => { const s = Math.floor(Date.now() / 1000 - ts); if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return `${Math.floor(s / 86400)}d ago`; };

    const filtered = posts.filter(p => p.contentURI.toLowerCase().includes(searchQuery.toLowerCase()) || p.author.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <>
            {/* Top Bar */}
            <div className="sticky top-0 z-20 bg-zinc-950/70 backdrop-blur-xl border-b border-zinc-800/40 px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Sparkles size={18} className="text-violet-400" />
                    <h2 className="text-lg font-bold text-white tracking-tight">Feed</h2>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-zinc-800/40 border border-zinc-700/30 rounded-xl px-3 py-1.5 focus-within:border-violet-500/50 transition-colors">
                        <Search size={14} className="text-zinc-500" />
                        <input type="text" placeholder="Search..." className="bg-transparent focus:outline-none text-sm text-zinc-200 w-32 placeholder-zinc-600" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                    <button onClick={() => refetchCounter()} className="text-xs text-zinc-500 hover:text-violet-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-zinc-800/50">↻</button>
                </div>
            </div>

            {/* Composer */}
            <div className="mx-4 mt-4 mb-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/50 backdrop-blur-sm p-5">
                <div className="flex gap-4">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex-shrink-0 flex items-center justify-center shadow-md shadow-violet-500/20">
                        <Zap size={18} className="text-white" />
                    </div>
                    <div className="flex-1">
                        {analysisResult ? (
                            <div className="mb-3">
                                <p className="text-[15px] text-zinc-200 leading-relaxed line-clamp-3">{textPost}</p>
                                <button onClick={() => setAnalysisResult(null)} className="text-xs text-violet-400 hover:text-violet-300 mt-1.5 transition-colors">✏ Edit post</button>
                            </div>
                        ) : (
                            <textarea id="composer-textarea" placeholder="Share something to verify..." className="w-full bg-transparent text-[15px] text-zinc-100 placeholder-zinc-600 focus:outline-none resize-none min-h-[60px] max-h-[120px] overflow-y-auto leading-relaxed" value={textPost} onChange={handleTextChange} />
                        )}
                        {file && <div className="mb-3 text-sm text-violet-400 flex items-center gap-2 bg-violet-500/10 px-3 py-1.5 rounded-lg w-fit"><ImageIcon size={14} /> {file.name}</div>}
                        {analysisResult && (
                            <div className={`mb-3 rounded-xl border bg-gradient-to-r ${getScoreBg(analysisResult.score)} ${getScoreColor(analysisResult.score) === 'text-emerald-400' ? 'border-emerald-500/30' : getScoreColor(analysisResult.score) === 'text-amber-400' ? 'border-amber-500/30' : 'border-rose-500/30'} p-3`}>
                                <div className="flex items-center gap-2.5 mb-1.5">
                                    <ShieldCheck size={16} className={getScoreColor(analysisResult.score)} />
                                    <span className="text-sm font-medium text-zinc-200">Authenticity: <span className={`font-bold ${getScoreColor(analysisResult.score)}`}>{analysisResult.score}%</span></span>
                                    {analysisResult.model && <span className="text-[10px] text-zinc-500 bg-zinc-800/50 px-1.5 py-0.5 rounded-md ml-auto">{analysisResult.model}</span>}
                                </div>
                                {analysisResult.message && <p className="text-xs text-zinc-400 leading-relaxed">{analysisResult.message}</p>}
                            </div>
                        )}
                        <div className="flex justify-between items-center pt-3 border-t border-zinc-800/40 mt-2">
                            <label className="p-2 rounded-lg hover:bg-zinc-800/60 cursor-pointer transition-colors text-zinc-500 hover:text-violet-400"><ImageIcon size={18} /><input type="file" className="hidden" onChange={handleFileChange} /></label>
                            <button onClick={handleCreatePost} disabled={(!hash || textPost.length <= 5) || isAnalyzing || isPending || isConfirming || !isConnected} className="btn-press px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-bold hover:from-violet-500 hover:to-indigo-500 transition-all disabled:opacity-40 shadow-md shadow-violet-600/15 hover:shadow-violet-500/30">
                                {isAnalyzing ? '🔍 Analyzing...' : isPending ? '⏳ Confirming...' : isConfirming ? '⛏ Minting...' : '⚡ Post to De-Fake'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Posts */}
            <div className="px-4 pb-24 space-y-4">
                {filtered.length === 0 && postCounter && Number(postCounter) > 0 ? (
                    <div className="flex flex-col items-center py-16 gap-3"><div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" /><span className="text-zinc-500 text-sm">Loading...</span></div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16"><div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-zinc-800/50 flex items-center justify-center"><Zap size={28} className="text-zinc-600" /></div><p className="text-zinc-500 font-medium">No posts yet</p><p className="text-zinc-600 text-sm mt-1">Be the first to share content</p></div>
                ) : null}

                {filtered.map(post => (
                    <article key={post.id} className="post-card rounded-2xl bg-zinc-900/50 border border-zinc-800/40 backdrop-blur-sm hover:border-violet-500/20 transition-all duration-300 overflow-hidden group">
                        <div className="p-5">
                            <div className="flex gap-3.5">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex-shrink-0 flex items-center justify-center font-bold text-xs text-white shadow-md shadow-indigo-500/20 mt-0.5">{post.author.substring(2, 4).toUpperCase()}</div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-zinc-100 text-[14px]">{post.author.substring(0, 6)}...{post.author.substring(38)}</span>
                                            <span className="text-zinc-600 text-xs">·</span>
                                            <span className="text-zinc-600 text-xs">{formatTimeAgo(post.timestamp)}</span>
                                        </div>
                                        <button className="text-zinc-600 hover:text-zinc-400 p-1 rounded-lg hover:bg-zinc-800/50 transition-colors opacity-0 group-hover:opacity-100"><MoreHorizontal size={16} /></button>
                                    </div>
                                    <p className="text-zinc-200 text-[15px] leading-relaxed mb-4 whitespace-pre-wrap break-words">{post.contentURI}</p>
                                </div>
                            </div>
                        </div>

                        {/* AI Score */}
                        <div className={`px-5 py-3 border-t border-zinc-800/30 bg-gradient-to-r ${getScoreBg(post.aiScore)}`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2"><ShieldCheck size={16} className={getScoreColor(post.aiScore)} /><span className="text-sm text-zinc-300">AI Score</span></div>
                                <div className="flex items-center gap-2">
                                    <div className="w-24 h-1.5 rounded-full bg-zinc-700/50 overflow-hidden"><div className={`score-bar h-full rounded-full ${post.aiScore > 70 ? 'bg-emerald-400' : post.aiScore > 40 ? 'bg-amber-400' : 'bg-rose-400'}`} style={{ width: `${post.aiScore}%` }} /></div>
                                    <span className={`text-sm font-bold ${getScoreColor(post.aiScore)}`}>{post.aiScore}%</span>
                                </div>
                            </div>
                        </div>

                        {/* Challenge */}
                        <div className="px-5 py-3 border-t border-zinc-800/30 bg-zinc-900/30">
                            {!post.isChallenged ? (
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 text-zinc-500 text-sm"><Gavel size={14} /><span>Community Tribunal</span></div>
                                    <div className="flex items-center gap-2">
                                        <input type="number" placeholder="MON" className="bg-zinc-800/60 border border-zinc-700/40 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-violet-500/50 w-20 text-zinc-200 placeholder-zinc-600" onChange={(e) => setStakeAmount({ ...stakeAmount, [post.id]: e.target.value })} />
                                        <button onClick={(e) => { e.stopPropagation(); handleChallenge(post.id, stakeAmount[post.id]); }} className="text-sm text-white font-semibold px-4 py-1.5 rounded-lg bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 transition-all shadow-sm">Challenge</button>
                                    </div>
                                </div>
                            ) : post.challengeData ? (
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold"><Gavel size={14} /> Tribunal Active</div>
                                        <span className="text-zinc-500 text-xs font-mono bg-zinc-800/50 px-2 py-0.5 rounded-md">{((post.challengeData.endTime * 1000 - Date.now()) / 3600000).toFixed(1)}h left</span>
                                    </div>
                                    <div className="flex rounded-full h-2 bg-zinc-800 overflow-hidden">
                                        <div className="bg-gradient-to-r from-rose-500 to-rose-400" style={{ width: `${(Number(post.challengeData.votesFake) / (Number(post.challengeData.votesFake) + Number(post.challengeData.votesAuthentic) || 1)) * 100}%` }} />
                                        <div className="bg-gradient-to-r from-emerald-400 to-emerald-500" style={{ width: `${(Number(post.challengeData.votesAuthentic) / (Number(post.challengeData.votesFake) + Number(post.challengeData.votesAuthentic) || 1)) * 100}%` }} />
                                    </div>
                                    <div className="flex justify-between text-[11px] text-zinc-500 font-medium uppercase tracking-widest">
                                        <span>Fake: {formatEther(post.challengeData.votesFake)} MON</span>
                                        <span>Auth: {formatEther(post.challengeData.votesAuthentic)} MON</span>
                                    </div>
                                    {post.hasVoted ? (
                                        <div className="flex items-center gap-2 mt-1 px-3 py-2 rounded-lg bg-zinc-800/40 border border-zinc-700/30">
                                            <ShieldCheck size={14} className={post.votedFake ? 'text-rose-400' : 'text-emerald-400'} />
                                            <span className="text-xs text-zinc-400">You voted <span className={`font-bold ${post.votedFake ? 'text-rose-400' : 'text-emerald-400'}`}>{post.votedFake ? 'Fake' : 'Authentic'}</span></span>
                                        </div>
                                    ) : (
                                        <div className="flex gap-2 mt-1">
                                            <input type="number" placeholder="Stake" className="bg-zinc-800/60 border border-zinc-700/40 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-violet-500/50 w-[80px] text-zinc-200 placeholder-zinc-600" onChange={(e) => setStakeAmount({ ...stakeAmount, [post.id]: e.target.value })} />
                                            <button onClick={(e) => { e.stopPropagation(); handleVote(post.id, true, stakeAmount[post.id]); }} className="text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-rose-500 px-3 py-1.5 rounded-lg transition-all flex-1">Vote Fake</button>
                                            <button onClick={(e) => { e.stopPropagation(); handleVote(post.id, false, stakeAmount[post.id]); }} className="text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 px-3 py-1.5 rounded-lg transition-all flex-1">Vote Auth</button>
                                        </div>
                                    )}
                                    {post.challengeData.endTime * 1000 < Date.now() && (
                                        <div className="flex justify-end gap-4 pt-2 border-t border-zinc-800/30 mt-2">
                                            <button onClick={(e) => { e.stopPropagation(); handleResolve(post.id); }} className="text-xs text-zinc-500 hover:text-zinc-300 font-medium transition-colors">Resolve</button>
                                            <button onClick={(e) => { e.stopPropagation(); handleClaim(post.id); }} className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 transition-colors"><HandCoins size={12} /> Claim</button>
                                        </div>
                                    )}
                                </div>
                            ) : null}
                        </div>
                    </article>
                ))}
            </div>
        </>
    );
}
