import { useNavigate } from 'react-router';
import { Clock, Sun, Moon } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { type PortalTheme } from '../../styles/portal-themes';
import { Button } from '../ui/button';

interface DashboardHeaderProps {
    title: string;
    theme: PortalTheme;
}

export function DashboardHeader({ title, theme }: DashboardHeaderProps) {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [isDark, setIsDark] = useState(() => 
        typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
    );

    useEffect(() => {
        const handleThemeChange = () => {
            setIsDark(document.documentElement.classList.contains('dark'));
        };
        window.addEventListener('theme-change', handleThemeChange);
        return () => window.removeEventListener('theme-change', handleThemeChange);
    }, []);

    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });

    const greeting = today.getHours() < 12 ? 'Good morning' : today.getHours() < 17 ? 'Good afternoon' : 'Good evening';

    return (
        <header
            className="border-b text-white relative overflow-hidden animate-fade-in"
            style={{ background: theme.headerGradient }}
        >
            {/* Subtle pattern overlay */}
            <div className="absolute inset-0 opacity-[0.04]" style={{
                backgroundImage: 'radial-gradient(circle at 25% 25%, white 1px, transparent 1px)',
                backgroundSize: '24px 24px',
            }} />

            <div className="container mx-auto px-4 py-5 relative z-10">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
                            <span
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-white/90 backdrop-blur-sm animate-pulse"
                                style={{ backgroundColor: `${theme.accent}88`, border: `1px solid ${theme.accent}cc` }}
                            >
                                <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                                {theme.label}
                            </span>
                        </div>
                        <p className="text-sm text-white/75 mt-0.5">
                            {greeting}, {user?.name} · <span className="text-white/60">{dateStr}</span>
                        </p>
                    </div>
                    
                    {/* Global Actions: Dark Mode & Attendance */}
                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                                const newIsDark = !document.documentElement.classList.contains('dark');
                                if (!newIsDark) {
                                    document.documentElement.classList.remove('dark');
                                    localStorage.setItem('theme', 'light');
                                } else {
                                    document.documentElement.classList.add('dark');
                                    localStorage.setItem('theme', 'dark');
                                }
                                setIsDark(newIsDark);
                                window.dispatchEvent(new Event('theme-change'));
                            }}
                            className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white hover:text-white border border-white/20"
                            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
                            aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
                        >
                            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                        </Button>

                        <Button
                            variant="ghost"
                            onClick={() => navigate('/clock-in')}
                            className="h-auto gap-2 bg-white/10 hover:bg-white/20 px-4 py-1.5 rounded-full border border-white/20"
                        >
                            <Clock className="h-4 w-4 text-white" />
                            <span className="text-xs font-medium text-white">Attendance</span>
                            {user?.clockedIn && <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse ml-1" title="Clocked In" />}
                        </Button>
                    </div>
                </div>
            </div>
        </header>
    );
}
