import React, { useState, useEffect } from 'react';
import { Upload, ShieldCheck, ShieldAlert, FileText, CheckCircle, Flame, Clock, Gavel, HandCoins } from 'lucide-react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, usePublicClient } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { parseAbi, parseEther, formatEther } from 'viem';
import { DeFakeSocialABI } from './abi';

const CONTRACT_ADDRESS = '0x9B0876D6ae703fe70EA38D9254da6db769b9f6f5';

// Types
type PostStatus = 'Pending' | 'Authentic' | 'Fake';
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

type Challenge = {
  endTime: number;
  votesFake: bigint;
  votesAuthentic: bigint;
  resolved: boolean;
};

function App() {
  const [activeTab, setActiveTab] = useState<'feed' | 'create'>('feed');
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

  // Read total post count
  const { data: postCounter, refetch: refetchCounter } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: parseAbi(DeFakeSocialABI),
    functionName: 'postCounter',
  });

  // Fetch real posts from the blockchain
  useEffect(() => {
    const fetchPosts = async () => {
      if (!postCounter || !publicClient) return;
      const count = Number(postCounter);
      console.log("Total posts in contract:", count);
      if (count === 0) return;

      const loadedPosts: Post[] = [];

      for (let i = count; i >= 1; i--) {
        try {
          console.log(`Fetching post ID ${i}...`);
          const postData = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: parseAbi(DeFakeSocialABI),
            functionName: 'getPost',
            args: [BigInt(i)]
          }) as any;

          let challengeData = undefined;
          if (postData.isChallenged) { // isChallenged
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
      console.log("Successfully loaded posts array:", loadedPosts);
      setPosts(loadedPosts);
    };

    fetchPosts();
  }, [postCounter, publicClient]);

  // Auto-refresh when a transaction completes
  useEffect(() => {
    if (isSuccess) {
      refetchCounter();
      setActiveTab('feed');
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
    }
  };

  const analyzeContent = async () => {
    if (!hash) return;
    setIsAnalyzing(true);

    try {
      const response = await fetch('http://localhost:3001/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hash: hash,
          filename: file?.name || "text_post",
          size: file?.size || textPost.length
        })
      });

      const data = await response.json();
      setAnalysisResult(data);
    } catch (error) {
      console.error("Analysis failed", error);
      setAnalysisResult({ score: 45, message: 'Local fallback: API not reachable.' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCreatePost = () => {
    if (!analysisResult) return;
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: parseAbi(DeFakeSocialABI),
      functionName: 'createPost',
      args: [
        textPost || 'file_uploaded',
        hash as `0x${string}`,
        analysisResult.score
      ]
    });
  };

  // Staking/Voting functions
  const handleChallenge = (id: number, amount: string) => {
    if (!amount) return alert("Enter stake amount!");
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: parseAbi(DeFakeSocialABI),
      functionName: 'challengePost',
      args: [BigInt(id)],
      value: parseEther(amount)
    });
  };

  const handleVote = (id: number, voteFake: boolean, amount: string) => {
    if (!amount) return alert("Enter stake amount!");
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: parseAbi(DeFakeSocialABI),
      functionName: 'vote',
      args: [BigInt(id), voteFake],
      value: parseEther(amount)
    });
  };

  const handleResolve = (id: number) => {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: parseAbi(DeFakeSocialABI),
      functionName: 'resolveChallenge',
      args: [BigInt(id)]
    });
  };

  const handleClaim = (id: number) => {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: parseAbi(DeFakeSocialABI),
      functionName: 'claimReward',
      args: [BigInt(id)]
    });
  };


  return (
    <div className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight flex items-center gap-3">
            <span className="text-yellow-400">⚡</span>
            De-Fake Social
          </h1>
          <p className="text-zinc-400 mt-2 tracking-wide">Post. Verify. Stake. Challenge.</p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="hidden md:block px-4 py-2 rounded-full bg-indigo-500/10 text-indigo-400 text-sm font-medium border border-indigo-500/20">
            Monad Testnet
          </div>
          <ConnectButton />
        </div>
      </header>

      {/* Main Tabs */}
      <div className="flex justify-between items-center mb-8">
        <div className="glass-panel p-1 rounded-2xl flex gap-1 w-full md:w-auto">
          <button
            onClick={() => { setActiveTab('feed'); refetchCounter(); }}
            className={`flex-1 md:flex-none px-8 py-2.5 rounded-xl font-medium transition-all ${activeTab === 'feed' ? 'bg-zinc-100 text-zinc-900 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            Timeline
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 md:flex-none px-8 py-2.5 rounded-xl font-medium transition-all ${activeTab === 'create' ? 'primary-gradient text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            Post Content
          </button>
        </div>
        {activeTab === 'feed' && (
          <button onClick={() => refetchCounter()} className="text-sm text-zinc-400 hover:text-zinc-200 underline hidden md:block">
            Refresh Feed
          </button>
        )}
      </div>

      <main>
        {activeTab === 'create' ? (
          <div className="glass-panel rounded-3xl p-6 md:p-10">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <Flame className="text-indigo-400" /> Share to Timeline
            </h2>

            <div className="space-y-6">
              <textarea
                placeholder="What's happening? (or describe the file you are uploading)"
                className="w-full bg-zinc-950/50 border border-zinc-800 rounded-2xl p-4 text-zinc-100 focus:outline-none focus:border-indigo-500 resize-none h-32"
                value={textPost}
                onChange={handleTextChange}
              />

              <label className="border-2 border-dashed border-zinc-800 hover:border-indigo-500/50 bg-zinc-900/30 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors text-center group">
                <div className="p-3 bg-zinc-800 rounded-full mb-3 group-hover:scale-110 transition-transform">
                  <Upload size={24} className="text-zinc-400 group-hover:text-indigo-400" />
                </div>
                <p className="text-base font-medium text-zinc-200 mb-1">
                  {file ? file.name : "Optional: Attach Image / Media"}
                </p>
                <input type="file" className="hidden" onChange={handleFileChange} />
              </label>

              {/* AI Scoring Area */}
              <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div className="flex-1">
                    <h3 className="font-semibold text-zinc-200 mb-1">AI Authenticity Scan</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">
                      Before posting, the AI Scorer must evaluate your content. This score will be written to the Monad registry alongside your post.
                    </p>
                  </div>

                  {!analysisResult ? (
                    <button onClick={analyzeContent} disabled={isAnalyzing || !hash} className="w-full sm:w-auto primary-gradient px-6 py-3 rounded-xl font-bold hover:shadow-lg hover:shadow-indigo-500/20 transition-all disabled:opacity-50">
                      {isAnalyzing ? 'Scanning...' : 'Scan Content'}
                    </button>
                  ) : (
                    <div className="flex items-center gap-4 bg-zinc-950 py-3 px-6 rounded-xl border border-zinc-800">
                      <div className="text-center">
                        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Score</p>
                        <p className={`text-2xl font-black ${analysisResult.score > 70 ? 'text-green-400' : analysisResult.score > 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {analysisResult.score}
                        </p>
                      </div>
                      <ShieldCheck className={analysisResult.score > 70 ? 'text-green-500' : analysisResult.score > 40 ? 'text-yellow-500' : 'text-red-500'} size={32} />
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={handleCreatePost}
                disabled={!analysisResult || isPending || isConfirming || !isConnected}
                className="w-full bg-white text-zinc-900 font-bold py-4 rounded-xl hover:bg-zinc-200 transition-colors disabled:opacity-50"
              >
                {isPending ? 'Confirming in Wallet...' : isConfirming ? 'Minting Post to Monad...' : 'Post to De-Fake'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {posts.length === 0 && postCounter && Number(postCounter) > 0 ? (
              <div className="text-center text-zinc-400 py-10">
                <Flame className="mx-auto mb-4 text-indigo-500 animate-pulse" size={32} />
                Loading posts from Monad Testnet...
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center text-zinc-500 py-10">
                No posts yet. Be the first to share!
              </div>
            ) : null}
            {posts.map(post => (
              <div key={post.id} className="glass-panel p-6 rounded-3xl border border-zinc-800">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold shadow-inner">
                      {post.author.substring(2, 4)}
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-100">{post.author}</p>
                      <p className="text-xs text-zinc-500 flex items-center gap-1">
                        <Clock size={12} /> {new Date(post.timestamp * 1000).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-lg flex items-center gap-2 border ${post.aiScore > 70 ? 'bg-green-500/10 border-green-500/20 text-green-400' : post.aiScore > 40 ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                    <ShieldAlert size={14} /> AI Score: {post.aiScore}/100
                  </div>
                </div>

                <p className="text-lg text-zinc-200 mb-6 leading-relaxed">
                  {post.contentURI}
                </p>

                {/* Staking & Challenging Section */}
                <div className="bg-zinc-950/60 rounded-2xl p-5 border border-zinc-800/80">
                  {!post.isChallenged ? (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      <p className="text-sm text-zinc-400">Think this is fake? Put your money on it.</p>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <input
                          type="number"
                          placeholder="0.01 MON"
                          className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 w-full sm:w-28 focus:outline-none focus:border-red-500"
                          onChange={(e) => setStakeAmount({ ...stakeAmount, [post.id]: e.target.value })}
                        />
                        <button onClick={() => handleChallenge(post.id, stakeAmount[post.id])} className="bg-red-500/20 text-red-400 border border-red-500/30 px-4 py-2 rounded-lg font-medium hover:bg-red-500/30 transition-colors whitespace-nowrap">
                          Challenge
                        </button>
                      </div>
                    </div>
                  ) : post.challengeData ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2 text-yellow-400 font-medium">
                          <Gavel size={18} /> Community Tribune Active
                        </div>
                        <div className="text-zinc-500 text-sm flex items-center gap-1">
                          <Clock size={14} /> {((post.challengeData.endTime * 1000 - Date.now()) / 3600000).toFixed(1)}h remaining
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
                          <p className="text-xs text-red-400/80 uppercase tracking-widest mb-1">Voted Fake</p>
                          <p className="text-2xl font-black text-red-400">{formatEther(post.challengeData.votesFake)} <span className="text-sm">MON</span></p>
                        </div>
                        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
                          <p className="text-xs text-green-400/80 uppercase tracking-widest mb-1">Voted Authentic</p>
                          <p className="text-2xl font-black text-green-400">{formatEther(post.challengeData.votesAuthentic)} <span className="text-sm">MON</span></p>
                        </div>
                      </div>

                      {/* Vote UI */}
                      <div className="flex flex-col sm:flex-row gap-2 border-t border-zinc-800 pt-4">
                        <input
                          type="number"
                          placeholder="Amount to stake (MON)"
                          className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 flex-1 focus:outline-none focus:border-indigo-500"
                          onChange={(e) => setStakeAmount({ ...stakeAmount, [post.id]: e.target.value })}
                        />
                        <button onClick={() => handleVote(post.id, true, stakeAmount[post.id])} className="bg-red-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-600 transition-colors">
                          Vote Fake
                        </button>
                        <button onClick={() => handleVote(post.id, false, stakeAmount[post.id])} className="bg-green-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-600 transition-colors">
                          Vote Authentic
                        </button>
                      </div>

                      {/* Resolve & Claim UI - Shows if time naturally expired in real app */}
                      <div className="flex gap-2 pt-2">
                        <button onClick={() => handleResolve(post.id)} className="text-sm text-zinc-400 hover:text-zinc-200 border border-zinc-700 px-3 py-1.5 rounded-lg">
                          Resolve (if elapsed)
                        </button>
                        <button onClick={() => handleClaim(post.id)} className="text-sm text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 rounded-lg flex items-center gap-1">
                          <HandCoins size={14} /> Claim Rewards
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  );
}

export default App;
