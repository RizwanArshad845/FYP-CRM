import { Clock, LogOut, Sun, Moon, Bug, AlertTriangle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router';
import { useState, useEffect } from 'react';
import { useAuth, useOrgPath } from '../../context/AuthContext';
import { PORTAL_NAV, activeNavItem, navItemPath, type NavBadge } from '../../config/portalNav';
import { BRAND_NAME } from './BrandMark';
import { usePortals } from '../../hooks/usePortals';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '../ui/sidebar';
import { useClientInbox } from '../../context/ClientInboxContext';
import { useClients } from '../../context/ClientContext';
import { useCSTManagerTasks } from '../../context/CSTManagerTaskContext';
import { useManagerTasks } from '../../context/ManagerTaskContext';
import { useConcerns } from '../../context/ConcernContext';
import { useFollowUps } from '../../context/FollowUpContext';
import { Button } from '../ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '../ui/dialog';

// Mockup nav item: 14px #cfd8ea, 10px 22px; active navy-active with a 3px accent line (plan 9.2).
// Shared with the platform admin shell.
export const NAV_ITEM_CLASS = 'h-auto rounded-none px-[22px] py-[10px] text-[14px] text-sidebar-foreground hover:bg-navy-active/60 hover:text-white data-[active=true]:bg-navy-active data-[active=true]:font-normal data-[active=true]:text-white data-[active=true]:border-l-[3px] data-[active=true]:border-accent-line data-[active=true]:pl-[19px]';

export function AppSidebar() {
  const { user, logout } = useAuth();
  const { tierLabel, labelFor, can } = usePortals();
  const navigate = useNavigate();
  const to = useOrgPath();
  const location = useLocation();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  const [isDark, setIsDark] = useState(() =>
    typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
  );
  const [logoutOpen, setLogoutOpen] = useState(false);

  const { inboxClients = [] } = useClientInbox() || {};
  const { clients = [], deactivationRequests = [] } = useClients() || {};
  const { tasks = [] } = useCSTManagerTasks() || {};
  const { tasks: salesTasks = [] } = useManagerTasks() || {};
  const { externalConcerns = [], internalConcerns = [] } = useConcerns() || {};
  const { leads = [] } = useFollowUps() || {};

  const isPending = (c: any) => ['pending', 'open'].includes(c.status?.toLowerCase());
  const badgeCounts: Record<NavBadge, number> = {
    cstInbox: inboxClients.filter((c: any) => (c.status === 'onboarding' || c.status === 'new' || c.status === 'existing') && !c.cst_agent_id).length,
    cstManagerTasks: tasks.filter((t: any) => t.assignedBy === 'admin' && t.status !== 'completed').length,
    deactivations: deactivationRequests.length,
    cstPortfolio: clients.filter(c => c.status === 'onboarding' || c.status === 'flagged').length,
    internalConcerns: internalConcerns.filter(isPending).length,
    salesManagerTasks: salesTasks.filter((t: any) => t.assignedBy === 'admin' && t.status !== 'completed').length,
    pendingFollowUps: leads.filter(l => l.status === 'pending').length,
    teamConcerns: [...externalConcerns, ...internalConcerns].filter(isPending).length,
    ownConcerns: externalConcerns.filter((c) => isPending(c) && String(c.raised_by) === String(user?.id)).length,
    allConcerns: [...externalConcerns, ...internalConcerns].filter(c => c.status === 'pending' || c.status === 'open').length,
  };

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') setIsDark(true);
  }, []);

  const handleLogout = () => setLogoutOpen(true);

  const doLogout = async (clockOutAlso: boolean) => {
    setLogoutOpen(false);
    await logout(clockOutAlso);
    navigate(to('/login'));
  };



  // Navigation comes from the fixed portal map, never from role comparisons (plan 5.2)
  const portal = user?.role;
  const navItems = (portal ? PORTAL_NAV[portal]?.items ?? [] : [])
    .filter((item) => !item.actionKey || can(item.actionKey));
  const active = activeNavItem(portal, location.pathname, location.search);

  const brand = user?.organization?.name ?? BRAND_NAME;
  const tierName = portal && user?.tier ? tierLabel(portal, user.tier) : '';
  const portalCaption = portal ? `${labelFor(portal)}${tierName && tierName !== user?.tier ? ` · ${tierName}` : ''}` : '';

  const navClass = NAV_ITEM_CLASS;

  const toggleDark = () => {
    setIsDark((d) => !d);
    window.dispatchEvent(new Event('theme-change'));
  };

  return (
    <>
      <Sidebar collapsible="icon" className="border-r-0">
        <SidebarHeader className="p-0 pt-[18px] pb-[18px]">
          {collapsed ? (
            <div className="text-center text-[20px] font-bold text-white" title={brand}>{brand.charAt(0).toUpperCase()}</div>
          ) : (
            <div className="px-[22px] text-[20px] font-bold leading-tight tracking-[0.5px] text-white">
              <span className="block break-words">{brand}</span>
              <small className="mt-[2px] block truncate text-[11px] font-normal tracking-normal text-sidebar-caption">{portalCaption}</small>
            </div>
          )}
        </SidebarHeader>

        <SidebarContent className="gap-0">
          <SidebarMenu className="gap-0">
            {navItems.map((item) => {
              const badge = item.badge ? badgeCounts[item.badge] : 0;
              return (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton isActive={item === active} tooltip={item.label} className={navClass} onClick={() => navigate(to(navItemPath(item)))}>
                    <item.icon className="h-4 w-4" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {!collapsed && badge > 0 && (
                      <span className="rounded-[12px] bg-accent-line px-[7px] py-[1px] text-[11px] font-bold text-white">{badge}</span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="p-0 pb-3">
          <SidebarMenu className="gap-0">
            <SidebarMenuItem>
              <SidebarMenuButton tooltip={isDark ? 'Light mode' : 'Dark mode'} className={navClass} onClick={toggleDark}>
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                <span>{isDark ? 'Light mode' : 'Dark mode'}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Report Bug" className={navClass} onClick={() => window.open('https://tally.so/r/BzLb0R', '_blank')}>
                <Bug className="h-4 w-4" />
                <span>Report Bug</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {user && (
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Logout" className={navClass} onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>


      {/* Logout Confirmation Dialog */}
      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm Logout
            </DialogTitle>
            <DialogDescription>
              {user?.clockedIn
                ? 'You are still clocked in. Would you like to clock out as well?'
                : 'Are you sure you want to log out?'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col gap-2 sm:flex-col">
            {user?.clockedIn && (
              <Button
                className="w-full"
                onClick={() => doLogout(true)}
              >
                <Clock className="h-4 w-4 mr-2" />Clock Out & Logout
              </Button>
            )}
            <Button
              variant={user?.clockedIn ? 'outline' : 'default'}
              className="w-full"
              onClick={() => doLogout(false)}
            >
              <LogOut className="h-4 w-4 mr-2" />{user?.clockedIn ? 'Logout Only' : 'Logout'}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setLogoutOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
