import React, { useState } from 'react';
import { Upload, ShieldCheck, ShieldAlert, FileText, CheckCircle, Search, Hash } from 'lucide-react';
import { parseAbi } from 'viem';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';

// Contract configuration
const CONTRACT_ADDRESS = '0xC037Aa4b08E2dE261C9bF595e2187D492F6F2Ab6'; // Replace with deployed address
const CONTRACT_ABI = parseAbi([
  'function registerContent(bytes32 _hash, uint8 _score, string _type, string _uri) external returns (bool)',
  'function verify(bytes32 _hash) external view returns (address owner, uint256 ts, uint8 score)',
  'function registered(bytes32 _hash) external view returns (bool)'
]);

function App() {
  const [activeTab, setActiveTab] = useState<'register' | 'verify'>('register');
  const [file, setFile] = useState<File | null>(null);
  const [hash, setHash] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [verifyHash, setVerifyHash] = useState('');

  // Wagmi hooks
  const { isConnected } = useAccount();
  const { data: hashToRegister, writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: hashToRegister,
  });

  const { data: verifyData, refetch: checkVerify } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'verify',
    args: [verifyHash as `0x${string}`],
    query: { enabled: false }
  });

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

  const analyzeContent = async () => {
    if (!hash) return;
    setIsAnalyzing(true);

    try {
      const response = await fetch('http://localhost:3001/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hash: hash,
          filename: file?.name,
          size: file?.size
        })
      });

      const data = await response.json();
      setAnalysisResult(data);
    } catch (error) {
      console.error("Analysis failed", error);
      setAnalysisResult({
        score: 45,
        riskLevel: 'Medium',
        message: 'Local fallback: API not reachable.'
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRegister = () => {
    if (!analysisResult) return;
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'registerContent',
      args: [
        hash as `0x${string}`,
        analysisResult.score,
        'file',
        ''
      ]
    });
  };

  const handleVerify = () => {
    if (!verifyHash.startsWith('0x') || verifyHash.length !== 66) {
      alert("Invalid SHA-256 hash. Must start with 0x and be 66 characters long.");
      return;
    }
    checkVerify();
  };

  return (
    <div className="min-h-screen p-8 max-w-5xl mx-auto">
      {/* Header */}
      <header className="flex justify-between items-center mb-12">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight flex items-center gap-3">
            <span className="text-yellow-400">⚡</span>
            De-Fake
          </h1>
          <p className="text-zinc-400 mt-2 tracking-wide">Dijital İçerik Güvenilirlik & Telif Ağı</p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="px-4 py-2 rounded-full bg-indigo-500/10 text-indigo-400 text-sm font-medium border border-indigo-500/20">
            Monad Testnet
          </div>
          <ConnectButton />
        </div>
      </header>

      {/* Main Tabs */}
      <div className="flex justify-center mb-8">
        <div className="glass-panel p-1 rounded-2xl flex gap-1">
          <button
            onClick={() => setActiveTab('register')}
            className={`px-6 py-2.5 rounded-xl font-medium transition-all ${activeTab === 'register' ? 'bg-zinc-100 text-zinc-900 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            Register Content
          </button>
          <button
            onClick={() => setActiveTab('verify')}
            className={`px-6 py-2.5 rounded-xl font-medium transition-all ${activeTab === 'verify' ? 'bg-zinc-100 text-zinc-900 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            Verify Content
          </button>
        </div>
      </div>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {activeTab === 'register' ? (
          <>
            {/* Register: Left Column - Upload */}
            <div className="lg:col-span-7 space-y-6">
              <div className="glass-panel rounded-3xl p-8 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                  <Upload className="text-indigo-400" />
                  Upload Content
                </h2>

                <label className="border-2 border-dashed border-zinc-700/50 hover:border-indigo-500/50 bg-zinc-900/30 rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer transition-colors text-center group">
                  <div className="p-4 bg-zinc-800 rounded-full mb-4 group-hover:scale-110 transition-transform">
                    <FileText size={32} className="text-zinc-400 group-hover:text-indigo-400" />
                  </div>
                  <p className="text-lg font-medium text-zinc-200 mb-1">
                    {file ? file.name : "Drag & drop file or click to browse"}
                  </p>
                  <p className="text-sm text-zinc-500">
                    {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB • Supports Image, Video, Text` : "Image, Video, or Text file"}
                  </p>
                  <input type="file" className="hidden" onChange={handleFileChange} />
                </label>

                {hash && (
                  <div className="mt-6 p-4 bg-zinc-950/50 rounded-xl border border-zinc-800/50 flex items-start gap-4">
                    <Hash className="text-zinc-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold tracking-wider text-zinc-500 mb-1 uppercase">SHA-256 Signature (Local)</p>
                      <p className="text-sm font-mono text-zinc-300 break-all">{hash}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Register: Right Column - AI & Blockchain */}
            <div className="lg:col-span-5 space-y-6">

              {/* AI Score Card */}
              <div className={`glass-panel rounded-3xl p-8 transition-all duration-500 ${!hash ? 'opacity-50 pointer-events-none' : ''}`}>
                <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                  <ShieldCheck className="text-purple-400" />
                  Intelligence Analysis
                </h3>

                {!analysisResult ? (
                  <div className="text-center py-6">
                    <button
                      onClick={analyzeContent}
                      disabled={isAnalyzing || !hash}
                      className="w-full primary-gradient font-semibold p-4 rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-white"
                    >
                      {isAnalyzing ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          Analyzing Content...
                        </span>
                      ) : "Scan for Authenticity"}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-zinc-400 text-sm font-medium mb-1">Authenticity Score</p>
                        <div className="flex items-baseline gap-1">
                          <span className={`text-5xl font-black ${analysisResult.score > 70 ? 'text-green-400' : analysisResult.score > 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {analysisResult.score}
                          </span>
                          <span className="text-zinc-500 font-medium">/ 100</span>
                        </div>
                      </div>
                      {analysisResult.score > 70 ? <ShieldCheck size={48} className="text-green-500/20" /> : <ShieldAlert size={48} className="text-red-500/20" />}
                    </div>

                    <div className="p-4 bg-zinc-950/50 rounded-xl border border-zinc-800/50">
                      <p className="text-sm text-zinc-300">{analysisResult.message}</p>
                    </div>

                    <button
                      onClick={handleRegister}
                      disabled={isPending || isConfirming || !isConnected}
                      className={`w-full font-semibold p-4 rounded-xl flex items-center justify-center gap-2 transition-all ${isSuccess ? 'bg-green-500 text-white' : 'bg-white text-zinc-900 hover:bg-zinc-200'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {!isConnected ? "Connect Wallet to Register" :
                        isPending ? 'Confirming in Wallet...' :
                          isConfirming ? 'Waiting for block...' :
                            isSuccess ? <><CheckCircle size={20} /> Registered successfully</> : 'Register on Monad Testnet'}
                    </button>

                    {isSuccess && hashToRegister && (
                      <div className="text-center">
                        <a href={`https://testnet.monadexplorer.com/tx/${hashToRegister}`} target="_blank" rel="noreferrer" className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-4">
                          View on Explorer ↗
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="lg:col-span-12 flex justify-center">
            <div className="glass-panel w-full max-w-2xl rounded-3xl p-8">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <Search className="text-purple-400" />
                Verify Content Certificate
              </h2>

              <div className="flex gap-3 mb-8">
                <input
                  type="text"
                  placeholder="Enter SHA-256 Hash (0x...)"
                  value={verifyHash}
                  onChange={(e) => setVerifyHash(e.target.value)}
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                />
                <button
                  onClick={handleVerify}
                  className="primary-gradient font-semibold px-6 rounded-xl hover:opacity-90 transition-opacity text-white"
                >
                  Verify
                </button>
              </div>

              {!verifyData ? (
                <div className="border-2 border-dashed border-zinc-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center">
                  <ShieldCheck size={48} className="text-zinc-600 mb-4 opacity-50" />
                  <p className="text-zinc-400 font-medium">Enter a Hash to verify its registration record on Monad.</p>
                </div>
              ) : (
                <div className="p-6 bg-zinc-950/50 rounded-2xl border border-zinc-800/50 mt-8">
                  {/* Destructure the tuple (address owner, uint256 ts, uint8 score) */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3 text-green-400 font-medium">
                      <CheckCircle size={24} />
                      Record Found
                    </div>
                    <div className="px-3 py-1 bg-zinc-900 rounded-lg text-sm text-zinc-400 border border-zinc-800">
                      {verifyData[1] > 0n ? new Date(Number(verifyData[1]) * 1000).toLocaleString() : 'N/A'}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Owner Address</p>
                      <p className="font-mono text-zinc-300">{verifyData[0] as string}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">AI Authenticity Score</p>
                      <p className="text-2xl font-black text-indigo-400">{verifyData[2]?.toString() || '0'}/100</p>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;
