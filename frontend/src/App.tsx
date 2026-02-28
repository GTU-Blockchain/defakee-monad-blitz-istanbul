import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, Flame, Gavel, HandCoins, Home, Search, Bell, User, MoreHorizontal, Image as ImageIcon } from 'lucide-react';
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

  const { address, isConnected } = useAccount();
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
          const postData = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: parseAbi(DeFakeSocialABI),
            functionName: 'getPost',
            args: [BigInt(i)]
          }) as any;

          let challengeData = undefined;
          if (postData.isChallenged) {
            const cData = await publicClient.readContract({
              address: CONTRACT_ADDRESS,
              abi: parseAbi(DeFakeSocialABI),
              functionName: 'getChallenge',
              args: [BigInt(i)]
            }) as any;

            challengeData = {
              endTime: Number(cData.endTime),
              votesFake: cData.votesFake,
              votesAuthentic: cData.votesAuthentic,
              resolved: cData.resolved
            };
          }

          loadedPosts.push({
            id: Number(postData.id),
            author: postData.author,
            contentURI: postData.contentURI,
            contentHash: postData.contentHash,
            aiScore: Number(postData.aiScore),
            isChallenged: postData.isChallenged,
            finalStatus: postData.finalStatus === 0 ? 'Pending' : postData.finalStatus === 1 ? 'Authentic' : 'Fake',
            timestamp: Number(postData.timestamp),
            challengeData
          });
        } catch (e) {
          console.error("Error fetching post", i, e);
        }
      }
      setPosts(loadedPosts);
    };

    fetchPosts();
  }, [postCounter, publicClient]);

  useEffect(() => {
    if (isSuccess) {
      refetchCounter();
      setTextPost('');
      setFile(null);
      setHash('');
      setAnalysisResult(null);
    }
  }, [isSuccess, refetchCounter]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setAnalysisResult(null);

      const buffer = await selectedFile.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      setHash("0x" + hashHex);
    }
  };

  const handleTextChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTextPost(e.target.value);
    if (e.target.value.length > 5) {
      const msgUint8 = new TextEncoder().encode(e.target.value);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      setHash("0x" + hashHex);
    } else {
      setHash('');
    }
  };

  const analyzeContent = async () => {
    if (!hash) return;
    setIsAnalyzing(true);
    try {
      const response = await fetch('http://localhost:3001/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash, filename: file?.name || "text_post", size: file?.size || textPost.length })
      });
      const data = await response.json();
      setAnalysisResult(data);
    } catch {
      setAnalysisResult({ score: 45, message: 'Local fallback' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCreatePost = () => {
    if (!analysisResult) return;
    writeContract({ address: CONTRACT_ADDRESS, abi: parseAbi(DeFakeSocialABI), functionName: 'createPost', args: [textPost || 'file_uploaded', hash as `0x${string}`, analysisResult.score] });
  };

  const handleChallenge = (id: number, amount: string) => {
    if (!amount) return alert("Enter stake amount!");
    writeContract({ address: CONTRACT_ADDRESS, abi: parseAbi(DeFakeSocialABI), functionName: 'challengePost', args: [BigInt(id)], value: parseEther(amount) });
  };
  const handleVote = (id: number, voteFake: boolean, amount: string) => {
    if (!amount) return alert("Enter stake amount!");
    writeContract({ address: CONTRACT_ADDRESS, abi: parseAbi(DeFakeSocialABI), functionName: 'vote', args: [BigInt(id), voteFake], value: parseEther(amount) });
  };
  const handleResolve = (id: number) => writeContract({ address: CONTRACT_ADDRESS, abi: parseAbi(DeFakeSocialABI), functionName: 'resolveChallenge', args: [BigInt(id)] });
  const handleClaim = (id: number) => writeContract({ address: CONTRACT_ADDRESS, abi: parseAbi(DeFakeSocialABI), functionName: 'claimReward', args: [BigInt(id)] });

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor(Date.now() / 1000 - timestamp);
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  return (
    <div className="min-h-screen bg-black text-[#E7E9EA] flex justify-center font-sans tracking-tight">
      <header className="hidden sm:flex flex-col w-[80px] xl:w-[275px] border-r border-[#2F3336] h-screen sticky top-0 py-4 px-2 xl:px-6">
        <div className="text-2xl font-bold mb-8 pl-2 flex items-center gap-3 w-fit cursor-pointer hover:bg-[#181818] p-3 rounded-full transition-colors">
          <span className="text-blue-500 text-3xl">⚡</span>
          <span className="hidden xl:inline tracking-wide font-black">De-Fake</span>
        </div>
        <nav className="flex flex-col gap-2 w-full">
          <a href="#" className="flex items-center gap-4 text-xl p-3 w-fit hover:bg-[#181818] rounded-full transition-colors font-bold"><Home size={28} /> <span className="hidden xl:inline">Home</span></a>
          <a href="#" className="flex items-center gap-4 text-xl p-3 w-fit hover:bg-[#181818] rounded-full transition-colors"><Search size={28} /> <span className="hidden xl:inline">Explore</span></a>
          <a href="#" className="flex items-center gap-4 text-xl p-3 w-fit hover:bg-[#181818] rounded-full transition-colors"><Bell size={28} /> <span className="hidden xl:inline">Notifications</span></a>
          <a href="#" className="flex items-center gap-4 text-xl p-3 w-fit hover:bg-[#181818] rounded-full transition-colors"><Gavel size={28} /> <span className="hidden xl:inline">Tribune (Staking)</span></a>
          <a href="#" className="flex items-center gap-4 text-xl p-3 w-fit hover:bg-[#181818] rounded-full transition-colors"><User size={28} /> <span className="hidden xl:inline">Profile</span></a>
          <button className="bg-[#1D9BF0] text-white rounded-full py-4 mt-6 font-bold text-lg hidden xl:block hover:bg-[#1A8CD8] transition-colors shadow-sm">Post</button>
          <button className="bg-[#1D9BF0] text-white rounded-full p-3 mt-4 mx-auto block xl:hidden hover:bg-[#1A8CD8] transition-colors shadow-sm"><Flame size={24} /></button>
        </nav>
        <div className="mt-auto mb-4 w-full flex justify-center xl:justify-start">
          <ConnectButton showBalance={false} />
        </div>
      </header>

      <main className="w-full max-w-[600px] border-r border-[#2F3336] min-h-screen pb-24">
        <div className="sticky top-0 bg-black/80 backdrop-blur-md z-10 border-b border-[#2F3336] p-4 flex justify-between items-center cursor-pointer">
          <h1 className="text-xl font-bold">For you</h1>
          <button onClick={() => refetchCounter()} className="text-sm text-[#71767B] hover:text-[#EFF3F4] transition-colors">Refresh</button>
        </div>

        <div className="border-b border-[#2F3336] p-4 flex gap-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1D9BF0] to-purple-600 flex-shrink-0" />
          <div className="flex-1">
            <textarea
              placeholder="What is happening?!"
              className="w-full bg-transparent text-xl placeholder-[#71767B] focus:outline-none resize-none pt-2 pb-6 min-h-[50px]"
              value={textPost}
              onChange={handleTextChange}
            />
            {file && <div className="mb-4 text-sm text-[#1D9BF0] flex items-center gap-2"><ImageIcon size={16} /> Attached: {file.name}</div>}

            {hash && textPost.length > 5 && !analysisResult && (
              <div className="mb-4 bg-[#16181C] rounded-2xl p-4 border border-[#2F3336] flex justify-between items-center">
                <span className="text-sm text-[#71767B]">Content requires AI verification</span>
                <button onClick={analyzeContent} disabled={isAnalyzing} className="text-sm bg-white text-black font-bold px-4 py-1.5 rounded-full hover:bg-[#D7DBDC]">
                  {isAnalyzing ? "Scanning..." : "Run AI Scan"}
                </button>
              </div>
            )}

            {analysisResult && (
              <div className="mb-4 flex items-center gap-3 bg-[#16181C] py-2 px-4 rounded-full border border-[#2F3336] w-fit">
                <ShieldCheck className={analysisResult.score > 70 ? 'text-green-500' : analysisResult.score > 40 ? 'text-yellow-500' : 'text-red-500'} size={18} />
                <span className="text-sm font-medium">AI Authenticity: <span className={analysisResult.score > 70 ? 'text-green-500' : analysisResult.score > 40 ? 'text-yellow-500' : 'text-red-500'}>{analysisResult.score}/100</span></span>
              </div>
            )}

            <div className="flex justify-between items-center pt-2 border-t border-[#2F3336] mt-2">
              <div className="flex gap-2 text-[#1D9BF0]">
                <label className="p-2 rounded-full hover:bg-[#1D9BF0]/10 cursor-pointer transition-colors">
                  <ImageIcon size={20} />
                  <input type="file" className="hidden" onChange={handleFileChange} />
                </label>
                <button className="p-2 rounded-full hover:bg-[#1D9BF0]/10 cursor-pointer transition-colors"><ShieldAlert size={20} /></button>
              </div>
              <button
                onClick={handleCreatePost}
                disabled={!analysisResult || isPending || isConfirming || !isConnected}
                className="bg-[#1D9BF0] text-white font-bold px-5 py-1.5 rounded-full hover:bg-[#1A8CD8] transition-colors disabled:opacity-50 text-sm"
              >
                {isPending ? 'Confirming...' : isConfirming ? 'Minting...' : 'Post'}
              </button>
            </div>
          </div>
        </div>

        <div>
          {posts.length === 0 && postCounter && Number(postCounter) > 0 ? (
            <div className="flex justify-center py-10"><div className="w-8 h-8 rounded-full border-2 border-[#1D9BF0] border-t-transparent animate-spin" /></div>
          ) : posts.length === 0 ? (
            <div className="text-center text-[#71767B] py-10 font-medium">Welcome to De-Fake. No posts yet.</div>
          ) : null}

          {posts.map(post => (
            <article key={post.id} className="p-4 border-b border-[#2F3336] hover:bg-[#080808] transition-colors cursor-pointer">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex-shrink-0 flex items-center justify-center font-bold text-sm shadow-inner mt-1 text-white">
                  {post.author.substring(2, 4).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-bold text-[#EFF3F4] hover:underline truncate">User {post.author.substring(0, 6)}...</span>
                      <span className="text-[#71767B] text-sm hidden sm:inline">@{post.author.substring(38)}</span>
                      <span className="text-[#71767B]">·</span>
                      <span className="text-[#71767B] text-sm hover:underline">{formatTimeAgo(post.timestamp)}</span>
                    </div>
                    <button className="text-[#71767B] hover:text-[#1D9BF0] hover:bg-[#1D9BF0]/10 p-1.5 rounded-full transition-colors flex-shrink-0"><MoreHorizontal size={18} /></button>
                  </div>

                  <p className="text-[#EFF3F4] text-[15px] leading-[20px] mb-3 whitespace-pre-wrap break-words">{post.contentURI}</p>

                  <div className="mb-3 rounded-2xl border border-[#2F3336] overflow-hidden">
                    <div className={`p-3 border-b border-[#2F3336] flex items-center gap-2 ${post.aiScore > 70 ? 'bg-[#00BA7C]/10' : post.aiScore > 40 ? 'bg-yellow-500/10' : 'bg-[#F91880]/10'}`}>
                      <ShieldCheck size={18} className={post.aiScore > 70 ? 'text-[#00BA7C]' : post.aiScore > 40 ? 'text-yellow-500' : 'text-[#F91880]'} />
                      <span className="text-sm font-medium text-[#EFF3F4]">De-Fake AI Analysis: <span className={post.aiScore > 70 ? 'text-[#00BA7C]' : post.aiScore > 40 ? 'text-yellow-500' : 'text-[#F91880]'}>{post.aiScore}% Authentic</span></span>
                    </div>

                    <div className="p-3 bg-[#16181C]">
                      {!post.isChallenged ? (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                          <span className="text-sm text-[#71767B]">Community Notes (Tribunal)</span>
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <input
                              type="number"
                              placeholder="MON"
                              className="bg-black border border-[#2F3336] rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#F4212E] w-20 text-[#EFF3F4]"
                              onChange={(e) => setStakeAmount({ ...stakeAmount, [post.id]: e.target.value })}
                            />
                            <button onClick={(e) => { e.stopPropagation(); handleChallenge(post.id, stakeAmount[post.id]); }} className="text-sm text-white font-bold px-4 py-1.5 rounded-full bg-[#F4212E] hover:bg-[#dd1e2a] transition-colors">
                              Challenge
                            </button>
                          </div>
                        </div>
                      ) : post.challengeData ? (
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5 text-yellow-500 text-sm font-bold"><Gavel size={16} /> Community Tribune</div>
                            <div className="text-[#71767B] text-xs font-mono">{((post.challengeData.endTime * 1000 - Date.now()) / 3600000).toFixed(1)}h left</div>
                          </div>

                          <div className="flex rounded-full h-1.5 bg-[#2F3336] overflow-hidden">
                            <div className="bg-[#F4212E]" style={{ width: `${(Number(post.challengeData.votesFake) / (Number(post.challengeData.votesFake) + Number(post.challengeData.votesAuthentic) || 1)) * 100}%` }} />
                            <div className="bg-[#00BA7C]" style={{ width: `${(Number(post.challengeData.votesAuthentic) / (Number(post.challengeData.votesFake) + Number(post.challengeData.votesAuthentic) || 1)) * 100}%` }} />
                          </div>
                          <div className="flex justify-between text-[11px] text-[#71767B] font-medium uppercase tracking-wider">
                            <span>Fake: {formatEther(post.challengeData.votesFake)} MON</span>
                            <span>Auth: {formatEther(post.challengeData.votesAuthentic)} MON</span>
                          </div>

                          <div className="flex gap-2.5 mt-2">
                            <input
                              type="number"
                              placeholder="Stake"
                              className="bg-black border border-[#2F3336] rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-[#1D9BF0] w-[80px] text-[#EFF3F4]"
                              onChange={(e) => setStakeAmount({ ...stakeAmount, [post.id]: e.target.value })}
                            />
                            <button onClick={(e) => { e.stopPropagation(); handleVote(post.id, true, stakeAmount[post.id]); }} className="text-xs font-bold text-white bg-[#F4212E] hover:bg-[#dd1e2a] px-3 py-1.5 rounded-full transition-colors flex-1">Vote Fake</button>
                            <button onClick={(e) => { e.stopPropagation(); handleVote(post.id, false, stakeAmount[post.id]); }} className="text-xs font-bold text-white bg-[#00BA7C] hover:bg-[#00a870] px-3 py-1.5 rounded-full transition-colors flex-1">Vote Auth</button>
                          </div>

                          <div className="flex justify-end gap-4 pt-1 text-[#71767B] border-t border-[#2F3336] mt-3 pt-3">
                            <button onClick={(e) => { e.stopPropagation(); handleResolve(post.id); }} className="text-[13px] hover:text-[#EFF3F4] transition-colors font-medium">Resolve</button>
                            <button onClick={(e) => { e.stopPropagation(); handleClaim(post.id); }} className="text-[13px] text-[#00BA7C] hover:text-[#009c68] transition-colors font-bold flex items-center gap-1.5"><HandCoins size={14} /> Claim Rewards</button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex justify-between text-[#71767B] max-w-md mt-1">
                    <button className="flex items-center gap-2 hover:text-[#1D9BF0] group"><div className="p-2 rounded-full group-hover:bg-[#1D9BF0]/10 transition-colors"><svg viewBox="0 0 24 24" aria-hidden="true" className="w-[18px] h-[18px] fill-current"><g><path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z"></path></g></svg></div></button>
                    <button className="flex items-center gap-2 hover:text-[#00BA7C] group"><div className="p-2 rounded-full group-hover:bg-[#00BA7C]/10 transition-colors"><svg viewBox="0 0 24 24" aria-hidden="true" className="w-[18px] h-[18px] fill-current"><g><path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"></path></g></svg></div></button>
                    <button className="flex items-center gap-2 hover:text-[#F91880] group"><div className="p-2 rounded-full group-hover:bg-[#F91880]/10 transition-colors"><svg viewBox="0 0 24 24" aria-hidden="true" className="w-[18px] h-[18px] fill-current"><g><path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"></path></g></svg></div></button>
                    <button className="flex items-center gap-2 hover:text-[#1D9BF0] group"><div className="p-2 rounded-full group-hover:bg-[#1D9BF0]/10 transition-colors"><svg viewBox="0 0 24 24" aria-hidden="true" className="w-[18px] h-[18px] fill-current"><g><path d="M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z"></path></g></svg></div></button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>

      <aside className="hidden lg:block w-[350px] pl-8 py-4">
        <div className="sticky top-4 space-y-4">
          <div className="bg-[#202327] rounded-full flex items-center px-4 py-2 border border-transparent focus-within:bg-black focus-within:border-[#1D9BF0] group">
            <Search size={18} className="text-[#71767B] group-focus-within:text-[#1D9BF0]" />
            <input type="text" placeholder="Search" className="bg-transparent border-none focus:outline-none text-[#EFF3F4] ml-3 w-full placeholder-[#71767B]" />
          </div>

          <div className="bg-[#16181C] rounded-2xl p-4 border border-[#2F3336]">
            <h2 className="text-xl font-bold mb-4 text-[#EFF3F4]">What's happening</h2>
            <div className="mb-4 cursor-pointer hover:bg-white/5 p-2 -mx-2 rounded-lg transition-colors">
              <p className="text-[#71767B] text-[13px] flex justify-between"><span>Monad Ecosystem · Trending</span><span><MoreHorizontal size={16} /></span></p>
              <p className="font-bold text-[#EFF3F4] mt-0.5">#DeFake Monad</p>
              <p className="text-[#71767B] text-[13px] mt-0.5">15.2K Posts</p>
            </div>
            <div className="mb-4 cursor-pointer hover:bg-white/5 p-2 -mx-2 rounded-lg transition-colors">
              <p className="text-[#71767B] text-[13px] flex justify-between"><span>Technology · Trending</span><span><MoreHorizontal size={16} /></span></p>
              <p className="font-bold text-[#EFF3F4] mt-0.5">AI Deepfakes</p>
              <p className="text-[#71767B] text-[13px] mt-0.5">Community notes resolving issues</p>
            </div>
            <div className="mb-2 cursor-pointer hover:bg-white/5 p-2 -mx-2 rounded-lg transition-colors">
              <p className="text-[#71767B] text-[13px] flex justify-between"><span>Crypto · Trending</span><span><MoreHorizontal size={16} /></span></p>
              <p className="font-bold text-[#EFF3F4] mt-0.5">$MON</p>
              <p className="text-[#71767B] text-[13px] mt-0.5">Testnet Faucet</p>
            </div>
            <button className="text-[#1D9BF0] text-[15px] hover:bg-white/5 p-2 -mx-2 rounded-lg mt-2 w-full text-left transition-colors">Show more</button>
          </div>

          <div className="bg-[#16181C] rounded-2xl p-4 border border-[#2F3336]">
            <h2 className="text-xl font-bold mb-4 text-[#EFF3F4]">Who to follow</h2>

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold">M</div>
                <div>
                  <p className="font-bold text-[#EFF3F4] text-[15px] hover:underline cursor-pointer">Monad</p>
                  <p className="text-[#71767B] text-[15px]">@monad_xyz</p>
                </div>
              </div>
              <button className="bg-[#EFF3F4] text-black font-bold px-4 py-1.5 rounded-full hover:bg-[#D7DBDC] transition-colors text-sm">Follow</button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">V</div>
                <div>
                  <p className="font-bold text-[#EFF3F4] text-[15px] hover:underline cursor-pointer flex items-center gap-1">Viem <svg className="w-4 h-4 text-[#1D9BF0] fill-current" viewBox="0 0 24 24"><path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.918-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.337 2.25c-.416-.165-.866-.25-1.336-.25-2.21 0-3.918 1.79-3.918 4 0 .495.084.965.238 1.4-1.273.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.918 4 .58 0 1.132-.153 1.626-.43 1.03 1.258 2.553 2.054 4.144 2.054 1.59 0 3.112-.796 4.143-2.053.495.277 1.047.43 1.626.43 2.21 0 3.918-1.79 3.918-4 0-.174-.012-.344-.033-.513 1.158-.69 1.943-1.99 1.943-3.487zm-11.45 6.446l-4.74-5.14 1.47-1.36 3.25 3.53 6.64-6.86 1.48 1.4-8.1 8.43z"></path></svg></p>
                  <p className="text-[#71767B] text-[15px]">@wagmi_sh</p>
                </div>
              </div>
              <button className="bg-[#EFF3F4] text-black font-bold px-4 py-1.5 rounded-full hover:bg-[#D7DBDC] transition-colors text-sm">Follow</button>
            </div>
          </div>

          <nav className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-[#71767B] px-4 pt-2">
            <a href="#" className="hover:underline">Terms of Service</a>
            <a href="#" className="hover:underline">Privacy Policy</a>
            <a href="#" className="hover:underline">Cookie Policy</a>
            <a href="#" className="hover:underline">Accessibility</a>
            <a href="#" className="hover:underline">Ads info</a>
            <span className="flex items-center gap-1">More <MoreHorizontal size={12} /></span>
            <span>© 2026 De-Fake Social Corp.</span>
          </nav>
        </div>
      </aside>
    </div>
  );
}

export default App;
