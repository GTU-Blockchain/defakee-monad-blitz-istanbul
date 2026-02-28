import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, Flame, Gavel, HandCoins, Search, User, MoreHorizontal, Image as ImageIcon, Zap, Globe, Sparkles } from 'lucide-react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, usePublicClient } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { parseAbi, parseEther, formatEther } from 'viem';
import { DeFakeSocialABI } from './abi';

const CONTRACT_ADDRESS = '0x9B0876D6ae703fe70EA38D9254da6db769b9f6f5';

type PostStatus = 'Pending' | 'Authentic' | 'Fake';
type Challenge = {
  endTime: number;
  votesFake: bigint;
  votesAuthentic: bigint;
  resolved: boolean;
};
type Post = {
  id: number;
  author: string;
  contentURI: string;
  contentHash: string;
  aiScore: number;
  isChallenged: boolean;
  finalStatus: PostStatus;
  timestamp: number;
  challengeData?: Challenge;
};

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [textPost, setTextPost] = useState('');
  const [hash, setHash] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [stakeAmount, setStakeAmount] = useState<Record<number, string>>({});
  const [searchQuery, setSearchQuery] = useState('');

  const { isConnected } = useAccount();
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const publicClient = usePublicClient();

  const { data: postCounter, refetch: refetchCounter } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: parseAbi(DeFakeSocialABI),
    functionName: 'postCounter',
  });

  useEffect(() => {
    const fetchPosts = async () => {
      if (!postCounter || !publicClient) return;
      const count = Number(postCounter);
      if (count === 0) return;
      const loadedPosts: Post[] = [];
      for (let i = count; i >= 1; i--) {
        try {
          const postData = await publicClient.readContract({ address: CONTRACT_ADDRESS, abi: parseAbi(DeFakeSocialABI), functionName: 'getPost', args: [BigInt(i)] }) as any;
          let challengeData = undefined;
          if (postData.isChallenged) {
            const cData = await publicClient.readContract({ address: CONTRACT_ADDRESS, abi: parseAbi(DeFakeSocialABI), functionName: 'getChallenge', args: [BigInt(i)] }) as any;
            challengeData = { endTime: Number(cData.endTime), votesFake: cData.votesFake, votesAuthentic: cData.votesAuthentic, resolved: cData.resolved };
          }
          loadedPosts.push({
            id: Number(postData.id), author: postData.author, contentURI: postData.contentURI, contentHash: postData.contentHash,
            aiScore: Number(postData.aiScore), isChallenged: postData.isChallenged,
            finalStatus: postData.finalStatus === 0 ? 'Pending' : postData.finalStatus === 1 ? 'Authentic' : 'Fake',
            timestamp: Number(postData.timestamp), challengeData
          });
        } catch (e) { console.error("Error fetching post", i, e); }
      }
      setPosts(loadedPosts);
    };
    fetchPosts();
  }, [postCounter, publicClient]);

  useEffect(() => {
    if (isSuccess) { refetchCounter(); setTextPost(''); setFile(null); setHash(''); setAnalysisResult(null); }
  }, [isSuccess, refetchCounter]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]; setFile(selectedFile); setAnalysisResult(null);
      const buffer = await selectedFile.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      setHash("0x" + hashArray.map(b => b.toString(16).padStart(2, '0')).join(''));
    }
  };

  const handleTextChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTextPost(e.target.value);
    if (e.target.value.length > 5) {
      const msgUint8 = new TextEncoder().encode(e.target.value);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      setHash("0x" + hashArray.map(b => b.toString(16).padStart(2, '0')).join(''));
    } else { setHash(''); }
  };

  const analyzeContent = async () => {
    if (!hash) return; setIsAnalyzing(true);
    try {
      const response = await fetch('http://localhost:3001/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hash, filename: file?.name || "text_post", size: file?.size || textPost.length }) });
      setAnalysisResult(await response.json());
    } catch { setAnalysisResult({ score: 45, message: 'Local fallback' }); }
    finally { setIsAnalyzing(false); }
  };

  const handleCreatePost = () => {
    if (!analysisResult) return;
    writeContract({ address: CONTRACT_ADDRESS, abi: parseAbi(DeFakeSocialABI), functionName: 'createPost', args: [textPost || 'file_uploaded', hash as `0x${string}`, analysisResult.score] });
  };
  const handleChallenge = (id: number, amount: string) => { if (!amount) return alert("Enter stake!"); writeContract({ address: CONTRACT_ADDRESS, abi: parseAbi(DeFakeSocialABI), functionName: 'challengePost', args: [BigInt(id)], value: parseEther(amount) }); };
  const handleVote = (id: number, voteFake: boolean, amount: string) => { if (!amount) return alert("Enter stake!"); writeContract({ address: CONTRACT_ADDRESS, abi: parseAbi(DeFakeSocialABI), functionName: 'vote', args: [BigInt(id), voteFake], value: parseEther(amount) }); };
  const handleResolve = (id: number) => writeContract({ address: CONTRACT_ADDRESS, abi: parseAbi(DeFakeSocialABI), functionName: 'resolveChallenge', args: [BigInt(id)] });
  const handleClaim = (id: number) => writeContract({ address: CONTRACT_ADDRESS, abi: parseAbi(DeFakeSocialABI), functionName: 'claimReward', args: [BigInt(id)] });

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor(Date.now() / 1000 - timestamp);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getScoreColor = (score: number) => score > 70 ? 'text-emerald-400' : score > 40 ? 'text-amber-400' : 'text-rose-400';
  const getScoreBg = (score: number) => score > 70 ? 'from-emerald-500/20 to-emerald-500/5' : score > 40 ? 'from-amber-500/20 to-amber-500/5' : 'from-rose-500/20 to-rose-500/5';
  const getScoreBorder = (score: number) => score > 70 ? 'border-emerald-500/30' : score > 40 ? 'border-amber-500/30' : 'border-rose-500/30';

  const filteredPosts = posts.filter(p => p.contentURI.toLowerCase().includes(searchQuery.toLowerCase()) || p.author.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="min-h-screen flex font-sans">

      {/* ───────── LEFT SIDEBAR ───────── */}
      <aside className="hidden md:flex flex-col w-[72px] xl:w-[260px] border-r border-zinc-800/60 h-screen sticky top-0 py-6 px-3 xl:px-5 bg-zinc-950/80 backdrop-blur-sm">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
            <Zap size={20} className="text-white" />
          </div>
          <div className="hidden xl:block">
            <h1 className="text-lg font-black tracking-tight text-white">De-Fake</h1>
            <p className="text-[11px] text-zinc-500 -mt-0.5 tracking-wide">TRUTH PROTOCOL</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1">
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-300 hover:bg-zinc-800/60 hover:text-white transition-all group">
            <Globe size={22} className="group-hover:text-violet-400 transition-colors" />
            <span className="hidden xl:inline text-[15px] font-medium">Explore</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-300 hover:bg-zinc-800/60 hover:text-white transition-all group">
            <User size={22} className="group-hover:text-violet-400 transition-colors" />
            <span className="hidden xl:inline text-[15px] font-medium">Profile</span>
          </a>
        </nav>

        {/* Post CTA */}
        <button className="mt-6 hidden xl:block w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-sm hover:from-violet-500 hover:to-indigo-500 transition-all shadow-lg shadow-violet-600/20 active:scale-[0.98]">
          New Post
        </button>
        <button className="mt-4 xl:hidden mx-auto w-11 h-11 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-violet-600/20">
          <Flame size={20} />
        </button>

        {/* Connect */}
        <div className="mt-auto pt-4 border-t border-zinc-800/40">
          <ConnectButton showBalance={false} />
        </div>
      </aside>

      {/* ───────── MAIN FEED ───────── */}
      <main className="flex-1 max-w-2xl mx-auto min-h-screen">

        {/* Top Bar */}
        <div className="sticky top-0 z-20 bg-zinc-950/70 backdrop-blur-xl border-b border-zinc-800/40 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles size={18} className="text-violet-400" />
            <h2 className="text-lg font-bold text-white tracking-tight">Feed</h2>
          </div>
          <button onClick={() => refetchCounter()} className="text-xs text-zinc-500 hover:text-violet-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-zinc-800/50">↻ Refresh</button>
        </div>

        {/* ── COMPOSER ── */}
        <div className="mx-4 mt-4 mb-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/50 backdrop-blur-sm p-5">
          <div className="flex gap-4">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex-shrink-0 flex items-center justify-center shadow-md shadow-violet-500/20">
              <Zap size={18} className="text-white" />
            </div>
            <div className="flex-1">
              <textarea
                placeholder="Share something to verify..."
                className="w-full bg-transparent text-[15px] text-zinc-100 placeholder-zinc-600 focus:outline-none resize-none min-h-[60px] leading-relaxed"
                value={textPost}
                onChange={handleTextChange}
              />

              {file && (
                <div className="mb-3 text-sm text-violet-400 flex items-center gap-2 bg-violet-500/10 px-3 py-1.5 rounded-lg w-fit">
                  <ImageIcon size={14} /> {file.name}
                </div>
              )}

              {hash && textPost.length > 5 && !analysisResult && (
                <div className="mb-3 bg-zinc-800/50 rounded-xl p-3 border border-zinc-700/40 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <ShieldAlert size={16} className="text-amber-400" />
                    <span className="text-sm text-zinc-400">AI verification required</span>
                  </div>
                  <button onClick={analyzeContent} disabled={isAnalyzing}
                    className="text-xs font-semibold px-4 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500 transition-all disabled:opacity-50">
                    {isAnalyzing ? "Scanning..." : "⚡ Verify"}
                  </button>
                </div>
              )}

              {analysisResult && (
                <div className={`mb-3 flex items-center gap-2.5 px-3 py-2 rounded-xl border bg-gradient-to-r w-fit ${getScoreBg(analysisResult.score)} ${getScoreBorder(analysisResult.score)}`}>
                  <ShieldCheck size={16} className={getScoreColor(analysisResult.score)} />
                  <span className="text-sm font-medium text-zinc-200">Authenticity: <span className={`font-bold ${getScoreColor(analysisResult.score)}`}>{analysisResult.score}%</span></span>
                </div>
              )}

              <div className="flex justify-between items-center pt-3 border-t border-zinc-800/40 mt-2">
                <div className="flex gap-1">
                  <label className="p-2 rounded-lg hover:bg-zinc-800/60 cursor-pointer transition-colors text-zinc-500 hover:text-violet-400">
                    <ImageIcon size={18} />
                    <input type="file" className="hidden" onChange={handleFileChange} />
                  </label>
                </div>
                <button
                  onClick={handleCreatePost}
                  disabled={!analysisResult || isPending || isConfirming || !isConnected}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-bold hover:from-violet-500 hover:to-indigo-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-violet-600/15 active:scale-[0.97]"
                >
                  {isPending ? '⏳ Confirming...' : isConfirming ? '⛏ Minting...' : '⚡ Post to De-Fake'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── FEED ── */}
        <div className="px-4 pb-24 space-y-4">
          {filteredPosts.length === 0 && postCounter && Number(postCounter) > 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
              <span className="text-zinc-500 text-sm">Loading posts...</span>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-zinc-800/50 flex items-center justify-center">
                <Zap size={28} className="text-zinc-600" />
              </div>
              <p className="text-zinc-500 font-medium">No posts yet</p>
              <p className="text-zinc-600 text-sm mt-1">Be the first to share content on De-Fake</p>
            </div>
          ) : null}

          {filteredPosts.map(post => (
            <article key={post.id} className="rounded-2xl bg-zinc-900/50 border border-zinc-800/40 backdrop-blur-sm hover:border-zinc-700/50 transition-all duration-200 overflow-hidden group">
              <div className="p-5">
                <div className="flex gap-3.5">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex-shrink-0 flex items-center justify-center font-bold text-xs text-white shadow-md shadow-indigo-500/20 mt-0.5">
                    {post.author.substring(2, 4).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Author */}
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-100 text-[14px]">{post.author.substring(0, 6)}...{post.author.substring(38)}</span>
                        <span className="text-zinc-600 text-xs">·</span>
                        <span className="text-zinc-600 text-xs">{formatTimeAgo(post.timestamp)}</span>
                      </div>
                      <button className="text-zinc-600 hover:text-zinc-400 p-1 rounded-lg hover:bg-zinc-800/50 transition-colors opacity-0 group-hover:opacity-100">
                        <MoreHorizontal size={16} />
                      </button>
                    </div>

                    {/* Content */}
                    <p className="text-zinc-200 text-[15px] leading-relaxed mb-4 whitespace-pre-wrap break-words">{post.contentURI}</p>
                  </div>
                </div>
              </div>

              {/* AI Score Bar */}
              <div className={`px-5 py-3 border-t border-zinc-800/30 bg-gradient-to-r ${getScoreBg(post.aiScore)}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className={getScoreColor(post.aiScore)} />
                    <span className="text-sm text-zinc-300">AI Authenticity Score</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 rounded-full bg-zinc-700/50 overflow-hidden">
                      <div className={`h-full rounded-full ${post.aiScore > 70 ? 'bg-emerald-400' : post.aiScore > 40 ? 'bg-amber-400' : 'bg-rose-400'}`} style={{ width: `${post.aiScore}%` }} />
                    </div>
                    <span className={`text-sm font-bold ${getScoreColor(post.aiScore)}`}>{post.aiScore}%</span>
                  </div>
                </div>
              </div>

              {/* Challenge / Voting Section */}
              <div className="px-5 py-3 border-t border-zinc-800/30 bg-zinc-900/30">
                {!post.isChallenged ? (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-zinc-500 text-sm">
                      <Gavel size={14} />
                      <span>Community Tribunal</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number" placeholder="MON"
                        className="bg-zinc-800/60 border border-zinc-700/40 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-violet-500/50 w-20 text-zinc-200 placeholder-zinc-600"
                        onChange={(e) => setStakeAmount({ ...stakeAmount, [post.id]: e.target.value })}
                      />
                      <button onClick={(e) => { e.stopPropagation(); handleChallenge(post.id, stakeAmount[post.id]); }}
                        className="text-sm text-white font-semibold px-4 py-1.5 rounded-lg bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 transition-all shadow-sm">
                        Challenge
                      </button>
                    </div>
                  </div>
                ) : post.challengeData ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold">
                        <Gavel size={14} />
                        <span>Tribunal Active</span>
                      </div>
                      <span className="text-zinc-500 text-xs font-mono bg-zinc-800/50 px-2 py-0.5 rounded-md">
                        {((post.challengeData.endTime * 1000 - Date.now()) / 3600000).toFixed(1)}h left
                      </span>
                    </div>

                    {/* Vote Progress */}
                    <div className="flex rounded-full h-2 bg-zinc-800 overflow-hidden">
                      <div className="bg-gradient-to-r from-rose-500 to-rose-400 transition-all duration-500" style={{ width: `${(Number(post.challengeData.votesFake) / (Number(post.challengeData.votesFake) + Number(post.challengeData.votesAuthentic) || 1)) * 100}%` }} />
                      <div className="bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-500" style={{ width: `${(Number(post.challengeData.votesAuthentic) / (Number(post.challengeData.votesFake) + Number(post.challengeData.votesAuthentic) || 1)) * 100}%` }} />
                    </div>
                    <div className="flex justify-between text-[11px] text-zinc-500 font-medium uppercase tracking-widest">
                      <span>Fake: {formatEther(post.challengeData.votesFake)} MON</span>
                      <span>Auth: {formatEther(post.challengeData.votesAuthentic)} MON</span>
                    </div>

                    <div className="flex gap-2 mt-1">
                      <input type="number" placeholder="Stake"
                        className="bg-zinc-800/60 border border-zinc-700/40 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-violet-500/50 w-[80px] text-zinc-200 placeholder-zinc-600"
                        onChange={(e) => setStakeAmount({ ...stakeAmount, [post.id]: e.target.value })}
                      />
                      <button onClick={(e) => { e.stopPropagation(); handleVote(post.id, true, stakeAmount[post.id]); }}
                        className="text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 px-3 py-1.5 rounded-lg transition-all flex-1">Vote Fake</button>
                      <button onClick={(e) => { e.stopPropagation(); handleVote(post.id, false, stakeAmount[post.id]); }}
                        className="text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 px-3 py-1.5 rounded-lg transition-all flex-1">Vote Auth</button>
                    </div>

                    <div className="flex justify-end gap-4 pt-2 border-t border-zinc-800/30 mt-2">
                      <button onClick={(e) => { e.stopPropagation(); handleResolve(post.id); }} className="text-xs text-zinc-500 hover:text-zinc-300 font-medium transition-colors">Resolve</button>
                      <button onClick={(e) => { e.stopPropagation(); handleClaim(post.id); }}
                        className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 transition-colors">
                        <HandCoins size={12} /> Claim
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </main>

      {/* ───────── RIGHT PANEL ───────── */}
      <aside className="hidden lg:flex flex-col w-[300px] border-l border-zinc-800/60 h-screen sticky top-0 py-6 px-5 bg-zinc-950/80 backdrop-blur-sm">
        {/* Search */}
        <div className="mb-6">
          <div className="flex items-center gap-2.5 bg-zinc-800/40 border border-zinc-700/30 rounded-xl px-3.5 py-2.5 focus-within:border-violet-500/50 transition-colors group">
            <Search size={16} className="text-zinc-500 group-focus-within:text-violet-400 transition-colors" />
            <input
              type="text" placeholder="Search posts..."
              className="bg-transparent focus:outline-none text-sm text-zinc-200 w-full placeholder-zinc-600"
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800/40 p-4 mb-5">
          <h3 className="text-sm font-bold text-zinc-300 mb-3 flex items-center gap-2">
            <Sparkles size={14} className="text-violet-400" /> Network Stats
          </h3>
          <div className="space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-xs text-zinc-500">Total Posts</span>
              <span className="text-sm font-bold text-zinc-200">{postCounter ? Number(postCounter) : 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-zinc-500">Challenges</span>
              <span className="text-sm font-bold text-amber-400">{posts.filter(p => p.isChallenged).length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-zinc-500">Avg AI Score</span>
              <span className="text-sm font-bold text-emerald-400">{posts.length > 0 ? Math.round(posts.reduce((a, b) => a + b.aiScore, 0) / posts.length) : 0}%</span>
            </div>
          </div>
        </div>

        {/* About */}
        <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800/40 p-4">
          <h3 className="text-sm font-bold text-zinc-300 mb-2">About De-Fake</h3>
          <p className="text-xs text-zinc-500 leading-relaxed">
            Community-powered truth verification on Monad. Post content, get AI analysis, and let the community stake on authenticity.
          </p>
        </div>

        {/* Footer */}
        <div className="mt-auto pt-4 text-[11px] text-zinc-600">
          <p>Built on Monad Testnet</p>
          <p className="mt-1">© 2026 De-Fake Protocol</p>
        </div>
      </aside>
    </div>
  );
}

export default App;
