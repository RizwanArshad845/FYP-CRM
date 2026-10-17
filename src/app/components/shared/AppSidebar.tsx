import {
  LayoutDashboard, Clock, LogOut, Sun, Moon, Bell, Bug, AlertTriangle, Waves,
  Globe, Users, BookOpen, CalendarIcon, TrendingUp, UserCog, ClipboardList, AlertCircle, Target, StickyNote, Settings, Flag, Mic, FileText, PhoneCall, ClipboardCheck, Building2
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { type PortalTheme } from '../../styles/portal-themes';
import { BrandLogo, BRAND_NAME } from './BrandMark';
import { usePortals } from '../../hooks/usePortals';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
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
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner';

interface AppSidebarProps {
  theme: PortalTheme;
}

export function AppSidebar({ theme }: AppSidebarProps) {
  const { user, logout } = useAuth();
  const { tierLabel } = usePortals();
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

  return (
    <>
      <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-muted/50">
        <SidebarHeader className="p-3">
          <div className="flex items-center gap-3">
            <BrandLogo />
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-sm font-bold truncate text-sidebar-foreground">{user?.organization?.name ?? BRAND_NAME}</p>
                <p className="text-xs text-muted-foreground truncate opacity-80">
                  {theme.label}{user?.tier ? ` · ${tierLabel(user.role, user.tier)}` : ''}
                </p>
              </div>
            )}
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => {
                  const isActive = location.pathname + location.search === item.url ||
                    (item.url === '/dashboard?module=client-ops' && location.pathname === '/dashboard' && location.search === '') ||
                    (item.url === '/dashboard?module=team-performance' && user?.role === 'sales' && location.pathname === '/dashboard' && location.search === '');
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.title}
                        className={isActive ? "bg-primary/10 text-primary font-bold shadow-sm border-r-4 border-primary" : "text-sidebar-foreground/70 hover:text-sidebar-foreground"}
                      >
                        <button onClick={() => navigate(item.url)} className="flex items-center justify-between w-full gap-2">
                          <div className="flex items-center gap-2">
                            <item.icon className={`h-4 w-4 ${isActive ? 'text-primary' : ''}`} />
                            {!collapsed && <span>{item.title}</span>}
                          </div>
                          {!collapsed && item.badge > 0 && (
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-yellow-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white/10 animate-in zoom-in duration-300">
                              {item.badge}
                            </span>
                          )}
                        </button>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip="Report Bug"
                  >
                    <button onClick={() => window.open('https://tally.so/r/BzLb0R', '_blank')} className="flex items-center gap-2 text-rose-500 hover:text-rose-600 transition-colors">
                      <Bug className="h-4 w-4" />
                      {!collapsed && <span>Report Bug</span>}
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="p-3 border-t border-sidebar-border">
          {user && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                  style={{ backgroundColor: theme.accent }}
                >
                  {user.name.split(' ').map(n => n[0]).join('')}
                </div>
                {!collapsed && (
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground capitalize truncate">{user.role.replace('_', ' ')}</p>
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size={collapsed ? 'icon' : 'sm'}
                className="w-full justify-start text-muted-foreground hover:text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                {!collapsed && <span className="ml-2">Logout</span>}
              </Button>
            </div>
          )}
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
