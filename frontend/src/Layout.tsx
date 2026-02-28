import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Globe, User, Flame, Sparkles, Sun, Moon, Shield } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useTheme } from './ThemeContext';

export default function Layout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { theme, toggle } = useTheme();
    const navLinkClass = ({ isActive }: { isActive: boolean }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative ${isActive ? 'bg-violet-600/15 text-white nav-active' : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-white'}`;

    const handleNewPost = () => {
        if (location.pathname !== '/') {
            navigate('/');
        }
        setTimeout(() => {
            const el = document.getElementById('composer-textarea');
            if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); }
        }, 100);
    };

    return (
        <div className="min-h-screen flex font-sans">
            {/* ── LEFT SIDEBAR ── */}
            <aside className="hidden md:flex flex-col w-[72px] xl:w-[260px] border-r border-zinc-800/60 h-screen sticky top-0 py-6 px-3 xl:px-5 bg-zinc-950/80 backdrop-blur-xl">
                {/* Brand */}
                <NavLink to="/" className="flex items-center gap-3 mb-10 px-2 no-underline group">
                    <div className="brand-icon w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25 animate-gradient">
                        <Shield size={22} className="text-white drop-shadow-sm" />
                    </div>
                    <div className="hidden xl:block">
                        <h1 className="text-lg font-black tracking-tight text-white">De-Fake</h1>
                        <p className="text-[10px] text-zinc-500 -mt-0.5 tracking-[0.2em] uppercase font-semibold">Truth Protocol</p>
                    </div>
                </NavLink>

                {/* Nav */}
                <nav className="flex flex-col gap-1.5">
                    <NavLink to="/explore" className={navLinkClass}>
                        <Globe size={20} className="group-hover:text-violet-400 transition-colors" />
                        <span className="hidden xl:inline text-[15px] font-medium">Explore</span>
                    </NavLink>
                    <NavLink to="/profile" className={navLinkClass}>
                        <User size={20} className="group-hover:text-violet-400 transition-colors" />
                        <span className="hidden xl:inline text-[15px] font-medium">Profile</span>
                    </NavLink>
                </nav>

                {/* Theme Toggle */}
                <button onClick={toggle} className="mt-4 flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-zinc-400 hover:bg-zinc-800/60 hover:text-white cursor-pointer btn-press" title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}>
                    {theme === 'dark' ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-indigo-400" />}
                    <span className="hidden xl:inline text-[15px] font-medium">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                </button>

                {/* Post CTA */}
                <button onClick={handleNewPost} className="mt-6 hidden xl:block w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-sm text-center hover:from-violet-500 hover:to-indigo-500 transition-all shadow-lg shadow-violet-600/25 btn-press cursor-pointer hover:shadow-violet-500/35">
                    New Post
                </button>
                <button onClick={handleNewPost} className="mt-4 xl:hidden mx-auto w-11 h-11 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-violet-600/25 cursor-pointer btn-press">
                    <Flame size={20} />
                </button>

                {/* Connect */}
                <div className="mt-auto pt-4 border-t border-zinc-800/40">
                    <ConnectButton showBalance={false} />
                </div>
            </aside>

            {/* ── MAIN CONTENT ── */}
            <main className="flex-1 max-w-2xl mx-auto min-h-screen border-x border-zinc-800/30">
                <Outlet />
            </main>

            {/* ── RIGHT PANEL ── */}
            <aside className="hidden lg:flex flex-col w-[300px] border-l border-zinc-800/60 h-screen sticky top-0 py-6 px-5 bg-zinc-950/80 backdrop-blur-xl">
                {/* About Card */}
                <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800/40 p-5 mb-4 shimmer-bg overflow-hidden relative">
                    <div className="relative z-10">
                        <div className="flex items-center gap-2.5 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                                <Sparkles size={14} className="text-white" />
                            </div>
                            <h3 className="text-sm font-bold text-zinc-200">About De-Fake</h3>
                        </div>
                        <p className="text-xs text-zinc-500 leading-relaxed">
                            Community-powered truth verification on Monad. Post content, get AI analysis, and let the community stake on authenticity.
                        </p>
                    </div>
                </div>

                {/* How it works */}
                <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800/40 p-5 mb-4">
                    <h3 className="text-sm font-bold text-zinc-200 mb-3">How it works</h3>
                    <div className="space-y-3">
                        <div className="flex gap-3 items-start">
                            <div className="w-6 h-6 rounded-full bg-violet-500/15 flex items-center justify-center flex-shrink-0 mt-0.5"><span className="text-[10px] font-bold text-violet-400">1</span></div>
                            <p className="text-xs text-zinc-500 leading-relaxed">Post content and get an AI authenticity score</p>
                        </div>
                        <div className="flex gap-3 items-start">
                            <div className="w-6 h-6 rounded-full bg-indigo-500/15 flex items-center justify-center flex-shrink-0 mt-0.5"><span className="text-[10px] font-bold text-indigo-400">2</span></div>
                            <p className="text-xs text-zinc-500 leading-relaxed">Community challenges suspicious posts by staking MON</p>
                        </div>
                        <div className="flex gap-3 items-start">
                            <div className="w-6 h-6 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0 mt-0.5"><span className="text-[10px] font-bold text-emerald-400">3</span></div>
                            <p className="text-xs text-zinc-500 leading-relaxed">Winners earn rewards from the losing side's stake</p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-auto pt-4 text-[11px] text-zinc-600 space-y-1">
                    <p className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Monad Testnet
                    </p>
                    <p>© 2026 De-Fake Protocol</p>
                </div>
            </aside>
        </div>
    );
}
