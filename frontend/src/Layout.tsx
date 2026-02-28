import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Globe, User, Flame, Zap, Sparkles, Sun, Moon } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useTheme } from './ThemeContext';

export default function Layout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { theme, toggle } = useTheme();
    const navLinkClass = ({ isActive }: { isActive: boolean }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${isActive ? 'bg-violet-600/15 text-white' : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-white'}`;

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
            <aside className="hidden md:flex flex-col w-[72px] xl:w-[260px] border-r border-zinc-800/60 h-screen sticky top-0 py-6 px-3 xl:px-5 bg-zinc-950/80 backdrop-blur-sm">
                {/* Brand */}
                <NavLink to="/" className="flex items-center gap-3 mb-10 px-2 no-underline">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                        <Zap size={20} className="text-white" />
                    </div>
                    <div className="hidden xl:block">
                        <h1 className="text-lg font-black tracking-tight text-white">De-Fake</h1>
                        <p className="text-[11px] text-zinc-500 -mt-0.5 tracking-wide">TRUTH PROTOCOL</p>
                    </div>
                </NavLink>

                {/* Nav */}
                <nav className="flex flex-col gap-1">
                    <NavLink to="/explore" className={navLinkClass}>
                        <Globe size={22} className="group-hover:text-violet-400 transition-colors" />
                        <span className="hidden xl:inline text-[15px] font-medium">Explore</span>
                    </NavLink>
                    <NavLink to="/profile" className={navLinkClass}>
                        <User size={22} className="group-hover:text-violet-400 transition-colors" />
                        <span className="hidden xl:inline text-[15px] font-medium">Profile</span>
                    </NavLink>
                </nav>

                {/* Theme Toggle */}
                <button onClick={toggle} className="mt-3 flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-zinc-400 hover:bg-zinc-800/60 hover:text-white cursor-pointer" title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}>
                    {theme === 'dark' ? <Sun size={22} /> : <Moon size={22} />}
                    <span className="hidden xl:inline text-[15px] font-medium">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                </button>

                {/* Post CTA */}
                <button onClick={handleNewPost} className="mt-6 hidden xl:block w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-sm text-center hover:from-violet-500 hover:to-indigo-500 transition-all shadow-lg shadow-violet-600/20 active:scale-[0.98] cursor-pointer">
                    New Post
                </button>
                <button onClick={handleNewPost} className="mt-4 xl:hidden mx-auto w-11 h-11 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-violet-600/20 cursor-pointer">
                    <Flame size={20} />
                </button>

                {/* Connect */}
                <div className="mt-auto pt-4 border-t border-zinc-800/40">
                    <ConnectButton showBalance={false} />
                </div>
            </aside>

            {/* ── MAIN CONTENT ── */}
            <main className="flex-1 max-w-2xl mx-auto min-h-screen">
                <Outlet />
            </main>

            {/* ── RIGHT PANEL ── */}
            <aside className="hidden lg:flex flex-col w-[300px] border-l border-zinc-800/60 h-screen sticky top-0 py-6 px-5 bg-zinc-950/80 backdrop-blur-sm">
                {/* About */}
                <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800/40 p-4 mb-4">
                    <h3 className="text-sm font-bold text-zinc-300 mb-2 flex items-center gap-2">
                        <Sparkles size={14} className="text-violet-400" /> About De-Fake
                    </h3>
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
