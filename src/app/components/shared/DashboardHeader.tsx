import { useLocation, useNavigate } from 'react-router';
import { CalendarDays } from 'lucide-react';
import { useAuth, useOrgPath } from '../../context/AuthContext';
import { activeNavItem } from '../../config/portalNav';
import { usePortals } from '../../hooks/usePortals';
import { type PortalTheme } from '../../styles/portal-themes';
import { SidebarTrigger } from '../ui/sidebar';
import { cn } from '../ui/utils';

interface DashboardHeaderProps {
    title: string;
    theme?: PortalTheme;
}

// The white top bar of the app shell (plan 9.2): where you are (organization and
// portal above the page title) on the left; date, shift status and who you are on the right.
export function DashboardHeader({ title }: DashboardHeaderProps) {
    const { user } = useAuth();
    const { labelFor, tierLabel } = usePortals();
    const navigate = useNavigate();
    const to = useOrgPath();
    const location = useLocation();
    const pageTitle = activeNavItem(user?.role, location.pathname, location.search)?.label ?? title;
    const initials = (user?.name ?? '').split(' ').filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase();
    const portal = user?.role ? labelFor(user.role) : '';
    const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

    return (
        <header className="sticky top-0 z-20 flex h-[58px] shrink-0 items-center justify-between gap-4 border-b border-border bg-card/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-card/85">
            <div className="flex min-w-0 items-center gap-2">
                <SidebarTrigger className="md:hidden" />
                <div className="min-w-0">
                    <p className="truncate text-[11.5px] leading-none text-muted-foreground">
                        {user?.organization?.name}{portal ? <span className="text-border"> / </span> : null}{portal}
                    </p>
                    <h1 className="mt-1 truncate text-[19px] font-bold leading-none tracking-normal text-foreground">{pageTitle}</h1>
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-3 text-[13px] text-text-secondary">
                <span className="hidden items-center gap-1.5 lg:flex"><CalendarDays className="h-4 w-4" />{today}</span>
                <button
                    type="button"
                    onClick={() => navigate(to('/clock-in'))}
                    className={cn(
                        'inline-flex h-8 cursor-pointer items-center gap-2 rounded-full border px-3 text-[12.5px] font-medium transition-colors',
                        user?.clockedIn
                            ? 'border-success/30 bg-success-bg text-success hover:bg-success-bg/70'
                            : 'border-input-border bg-card text-foreground hover:bg-th',
                    )}
                    title="Attendance"
                >
                    <span className={cn('h-2 w-2 rounded-full', user?.clockedIn ? (user.onBreak ? 'bg-warning' : 'bg-success') : 'bg-muted-foreground')} />
                    {user?.clockedIn ? (user.onBreak ? 'On break' : 'On shift') : 'Clock in'}
                </button>
                <span className="hidden h-6 w-px bg-border sm:block" />
                <div className="flex items-center gap-2.5">
                    <div className="hidden text-right leading-tight sm:block">
                        <p className="text-[13px] font-medium text-foreground">{user?.name}</p>
                        {user?.tier && user.role && <p className="text-[11.5px] text-muted-foreground">{tierLabel(user.role, user.tier)}</p>}
                    </div>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-line text-[13px] font-bold text-white">
                        {initials}
                    </div>
                </div>
            </div>
        </header>
    );
}
