import { useLocation, useNavigate } from 'react-router';
import { Clock } from 'lucide-react';
import { useAuth, useOrgPath } from '../../context/AuthContext';
import { activeNavItem } from '../../config/portalNav';
import { type PortalTheme } from '../../styles/portal-themes';
import { Button } from '../ui/button';
import { SidebarTrigger } from '../ui/sidebar';

interface DashboardHeaderProps {
    title: string;
    theme?: PortalTheme;
}

// The white top bar of the app shell (plan 9.2): page title left, user and avatar right.
// The title is the current nav item's label; `title` is the fallback.
export function DashboardHeader({ title }: DashboardHeaderProps) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const to = useOrgPath();
    const location = useLocation();
    const pageTitle = activeNavItem(user?.role, location.pathname, location.search)?.label ?? title;
    const initials = (user?.name ?? '').split(' ').filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase();

    return (
        <header className="sticky top-0 z-20 flex h-[58px] shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-6">
            <div className="flex min-w-0 items-center gap-2">
                <SidebarTrigger className="md:hidden" />
                <h1 className="truncate text-[19px] font-bold leading-none tracking-normal text-foreground">{pageTitle}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-[10px] text-[13px] text-text-secondary">
                {/* Attendance stays reachable from every portal, as before the restyle */}
                <Button variant="outline" size="sm" onClick={() => navigate(to('/clock-in'))}>
                    <Clock className="h-4 w-4" />
                    Attendance
                    {user?.clockedIn && <span className="h-2 w-2 rounded-full bg-success" title="Clocked in" />}
                </Button>
                <span className="hidden sm:inline">{user?.name}</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-line text-[13px] font-bold text-white">
                    {initials}
                </div>
            </div>
        </header>
    );
}
