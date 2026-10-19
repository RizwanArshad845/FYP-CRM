import {
  LayoutDashboard, Clock, LogOut, Sun, Moon, Bug, AlertTriangle,
  Globe, Users, BookOpen, CalendarIcon, TrendingUp, UserCog, ClipboardList, AlertCircle, Target, StickyNote, Flag, Mic, FileText, PhoneCall, ClipboardCheck, Building2
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
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

export function AppSidebar() {
  const { user, logout } = useAuth();
  const { tierLabel, labelFor } = usePortals();
  const navigate = useNavigate();
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

  const pendingCount = inboxClients.filter((c: any) => (c.status === 'onboarding' || c.status === 'new' || c.status === 'existing') && !c.cst_agent_id).length;
  const deactivationCount = deactivationRequests.length;
  const adminTaskCount = tasks.filter((t: any) => t.assignedBy === 'admin' && t.status !== 'completed').length;
  const salesManagerTaskCount = salesTasks.filter((t: any) => t.assignedBy === 'admin' && t.status !== 'completed').length;
  const pendingFollowupCount = leads.filter(l => l.status === 'pending').length;
  const pendingConcernsCount = [...externalConcerns, ...internalConcerns].filter(c => c.status === 'pending' || c.status === 'open').length;

  const cstPortfolioBadge = clients.filter(c => c.status === 'onboarding' || c.status === 'flagged').length;
  const cstOpsBadge = internalConcerns.filter(c => ['pending', 'open'].includes(c.status?.toLowerCase())).length;
  const salesConcernsBadge = [
    ...externalConcerns,
    ...(user?.role === 'sales_manager' ? internalConcerns : [])
  ].filter(c => {
    const isPending = ['pending', 'open'].includes(c.status?.toLowerCase());
    if (user?.role === 'sales') {
      return isPending && String(c.raised_by) === String(user?.id);
    }
    return isPending;
  }).length;

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
    navigate('/login');
  };



  let navItems: any[] = [
    { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
    { title: 'Attendance', url: '/clock-in', icon: Clock },
  ];

  if (user?.role === 'cst_manager') {
    navItems = [
      { title: 'Client Operations', url: '/dashboard?module=client-ops', icon: Globe, badge: pendingCount },
      { title: 'Agent Management', url: '/dashboard?module=agent-management', icon: Users, badge: adminTaskCount },
      { title: 'Strategy & Resources', url: '/dashboard?module=strategy-resources', icon: BookOpen },
      { title: 'Requests & Actions', url: '/dashboard?module=requests-actions', icon: AlertTriangle, badge: deactivationCount },
      { title: 'Team Calendar', url: '/dashboard?module=calendar', icon: CalendarIcon },
    ];
  }

  if (user?.role === 'cst') {
    navItems = [
      { title: 'Overview', url: '/dashboard?module=overview', icon: LayoutDashboard },
      { title: 'Client Portfolio', url: '/dashboard?module=clients', icon: Users, badge: cstPortfolioBadge },
      { title: 'Notes', url: '/dashboard?module=docs', icon: StickyNote },
      { title: 'Calendar', url: '/dashboard?module=calendar', icon: CalendarIcon },
      { title: 'Monthly Targets', url: '/dashboard?module=targets', icon: Flag },
      { title: 'Internal Concerns', url: '/dashboard?module=concerns', icon: AlertTriangle, badge: cstOpsBadge },
    ];
  }

  if (user?.role === 'sales_manager') {
    navItems = [
      { title: 'Overview', url: '/dashboard?module=overview', icon: LayoutDashboard },
      { title: 'Client Entry', url: '/dashboard?module=entry', icon: FileText },
      { title: 'Team Management', url: '/dashboard?module=team', icon: Users },
      { title: 'Manager Tasks', url: '/dashboard?module=mytasks', icon: ClipboardCheck, badge: salesManagerTaskCount },
      { title: 'Team Follow-ups', url: '/dashboard?module=followup', icon: PhoneCall, badge: pendingFollowupCount },
      { title: 'Important Calls', url: '/dashboard?module=recordings', icon: Mic },
      { title: 'My Target', url: '/dashboard?module=self', icon: UserCog },
      { title: 'Personal Notepad', url: '/dashboard?module=notepad', icon: StickyNote },
      { title: 'Concerns', url: '/dashboard?module=concerns', icon: AlertCircle, badge: salesConcernsBadge },
    ];
  }

  if (user?.role === 'sales') {
    navItems = [
      { title: 'Team Performance', url: '/dashboard?module=team-performance', icon: Users },
      { title: 'Follow-up Leads', url: '/dashboard?module=followup', icon: PhoneCall, badge: pendingFollowupCount },
      { title: 'Communication', url: '/dashboard?module=comms', icon: Mic },
      { title: 'Performance', url: '/dashboard?module=performance', icon: TrendingUp },
      { title: 'Personal Notepad', url: '/dashboard?module=notepad', icon: StickyNote },
      { title: 'Concerns', url: '/dashboard?module=concerns', icon: AlertCircle, badge: salesConcernsBadge },
    ];
  }

  if (user?.role === 'admin') {
    navItems = [
      { title: 'Overview', url: '/dashboard?module=overview', icon: TrendingUp },
      { title: 'Employees', url: '/dashboard?module=employees', icon: UserCog },
      { title: 'Performance', url: '/dashboard?module=performance', icon: ClipboardList },
      { title: 'Task Delegation', url: '/dashboard?module=tasks', icon: Target },
      { title: 'Active Clients', url: '/dashboard?module=clients', icon: Globe },
      { title: 'Concerns', url: '/dashboard?module=concerns', icon: AlertCircle, badge: pendingConcernsCount },
      { title: 'Events', url: '/dashboard?module=events', icon: CalendarIcon },
      { title: 'Organization', url: '/dashboard?module=org-settings', icon: Building2 },
    ];
  }

  const brand = user?.organization?.name ?? BRAND_NAME;
  const tierName = user?.tier ? tierLabel(user.role, user.tier) : '';
  const portalCaption = user ? `${labelFor(user.role)}${tierName && tierName !== user.tier ? ` · ${tierName}` : ''}` : '';

  // Mockup nav item: 14px #cfd8ea, 10px 22px; active navy-active with a 3px accent line (plan 9.2)
  const navClass = 'h-auto rounded-none px-[22px] py-[10px] text-[14px] text-sidebar-foreground hover:bg-navy-active/60 hover:text-white data-[active=true]:bg-navy-active data-[active=true]:font-normal data-[active=true]:text-white data-[active=true]:border-l-[3px] data-[active=true]:border-accent-line data-[active=true]:pl-[19px]';

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
              <span className="block truncate">{brand}</span>
              <small className="mt-[2px] block truncate text-[11px] font-normal tracking-normal text-sidebar-caption">{portalCaption}</small>
            </div>
          )}
        </SidebarHeader>

        <SidebarContent className="gap-0">
          <SidebarMenu className="gap-0">
            {navItems.map((item) => {
              const isActive = location.pathname + location.search === item.url ||
                (item.url === '/dashboard?module=client-ops' && location.pathname === '/dashboard' && location.search === '') ||
                (item.url === '/dashboard?module=team-performance' && user?.role === 'sales' && location.pathname === '/dashboard' && location.search === '');
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton isActive={isActive} tooltip={item.title} className={navClass} onClick={() => navigate(item.url)}>
                    <item.icon className="h-4 w-4" />
                    <span className="flex-1 truncate">{item.title}</span>
                    {!collapsed && item.badge > 0 && (
                      <span className="rounded-[12px] bg-accent-line px-[7px] py-[1px] text-[11px] font-bold text-white">{item.badge}</span>
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
