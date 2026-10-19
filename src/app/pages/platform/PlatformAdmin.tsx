import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { Building2, LayoutDashboard, LogOut, Search, CheckCircle2, Clock } from 'lucide-react';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarTrigger,
} from '../../components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { StatCard } from '../../components/shared/StatCard';
import { NAV_ITEM_CLASS } from '../../components/shared/AppSidebar';
import { BRAND_NAME } from '../../components/shared/BrandMark';
import { PORTAL_CARDS } from '../onboarding/PortalEditors';
import { clearPlatformSession, getPlatformAdmin, getPlatformToken, platformFetch } from '../../utils/platformApi';

// Platform administrator module (plan Section 4): view only, never tenant records.

interface PlatformOrg {
  id: number;
  name: string;
  slug: string;
  industry: string | null;
  size: string | null;
  created_at: string;
  onboarding: { completed: boolean; current_step: string | null };
  enabled_portals: { key: string; custom_label: string | null }[];
  employee_count: { active: number; total: number };
  portals?: { key: string; default_label: string; enabled: boolean; custom_label: string | null; employee_count: number }[];
}

const STEP_LABELS: Record<string, string> = { portals: 'Portals', labels: 'Tier labels', employees: 'Employees', review: 'Finish' };

function OnboardingTag({ onboarding }: { onboarding: PlatformOrg['onboarding'] }) {
  if (onboarding.completed) return <Badge variant="success">Completed</Badge>;
  return <Badge variant="warning">Step: {STEP_LABELS[onboarding.current_step ?? 'portals'] ?? 'Portals'}</Badge>;
}

const joined = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// Same navy sidebar and white top bar as the portals (plan 9.2)
function PlatformShell({ title, children }: { title: string; children: ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const admin = getPlatformAdmin();
  const signedIn = !!getPlatformToken();

  useEffect(() => {
    if (!signedIn) navigate('/platform/login', { replace: true });
  }, [signedIn, navigate]);
  if (!signedIn) return null;

  const initials = (admin?.name ?? '').split(' ').filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  const nav = [
    { label: 'Overview', path: '/platform', icon: LayoutDashboard, active: pathname === '/platform' },
    { label: 'Organizations', path: '/platform/organizations', icon: Building2, active: pathname.startsWith('/platform/organizations') },
  ];

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <Sidebar collapsible="icon" className="border-r-0">
          <SidebarHeader className="p-0 pt-[18px] pb-[18px]">
            <div className="px-[22px] text-[20px] font-bold leading-tight tracking-[0.5px] text-white group-data-[collapsible=icon]:hidden">
              {BRAND_NAME}
              <small className="mt-[2px] block text-[11px] font-normal tracking-normal text-sidebar-caption">Platform Admin</small>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu className="gap-0">
              {nav.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton isActive={item.active} tooltip={item.label} className={NAV_ITEM_CLASS} onClick={() => navigate(item.path)}>
                    <item.icon className="h-4 w-4" /><span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="p-0 pb-3">
            <SidebarMenu className="gap-0">
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Logout" className={NAV_ITEM_CLASS} onClick={() => { clearPlatformSession(); navigate('/platform/login'); }}>
                  <LogOut className="h-4 w-4" /><span>Logout</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-20 flex h-[58px] shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-6">
            <div className="flex min-w-0 items-center gap-2">
              <SidebarTrigger className="md:hidden" />
              <h1 className="truncate text-[19px] font-bold leading-none tracking-normal text-foreground">{title}</h1>
            </div>
            <div className="flex items-center gap-[10px] text-[13px] text-text-secondary">
              <span className="hidden sm:inline">{admin?.name}</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-line text-[13px] font-bold text-white">{initials}</div>
            </div>
          </header>
          <main className="flex-1 overflow-auto px-6 py-5">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}

// Loads platform data; a rejected session goes back to the platform login.
function usePlatformData<T>(path: string) {
  const navigate = useNavigate();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    setError('');
    platformFetch(path)
      .then((res) => { if (live) setData(res.data); })
      .catch((e) => {
        if (!live) return;
        if (e.status === 401) navigate('/platform/login', { replace: true });
        else setError(e.message || 'Could not load data');
      });
    return () => { live = false; };
  }, [path, navigate]);
  return { data, error };
}

export function PlatformOverview() {
  const { data, error } = usePlatformData<{ total: number; completed: number; onboarding: number }>('/summary');
  return (
    <PlatformShell title="Overview">
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard icon={<Building2 className="h-5 w-5" />} title="Organizations" value={data?.total ?? '—'} subtitle="Registered on AICRE" />
        <StatCard icon={<CheckCircle2 className="h-5 w-5" />} title="Onboarding complete" value={data?.completed ?? '—'} subtitle="Working in their portals" />
        <StatCard icon={<Clock className="h-5 w-5" />} title="Still onboarding" value={data?.onboarding ?? '—'} subtitle="Setup not finished yet" />
      </div>
    </PlatformShell>
  );
}

export function PlatformOrganizations() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  // Search after a short pause in typing
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);
  const params = new URLSearchParams({ ...(query && { search: query }), ...(status !== 'all' && { status }) }).toString();
  const { data, error } = usePlatformData<PlatformOrg[]>(`/organizations${params ? `?${params}` : ''}`);

  return (
    <PlatformShell title="Organizations">
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name or slug" value={search} onChange={(e) => setSearch(e.target.value)} className="w-[280px] pl-9" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label="Onboarding status" className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="in_progress">In progress</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      <Card className="gap-0 overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              {['Organization', 'Industry', 'Size', 'Joined', 'Onboarding', 'Portals', 'Employees'].map((h) => <TableHead key={h}>{h}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((o) => (
              <TableRow key={o.id} className="cursor-pointer" onClick={() => navigate(`/platform/organizations/${o.id}`)}>
                <TableCell>
                  <div className="font-medium">{o.name}</div>
                  <div className="text-xs text-muted-foreground">{o.slug}</div>
                </TableCell>
                <TableCell>{o.industry || '—'}</TableCell>
                <TableCell>{o.size || '—'}</TableCell>
                <TableCell>{joined(o.created_at)}</TableCell>
                <TableCell><OnboardingTag onboarding={o.onboarding} /></TableCell>
                <TableCell>{o.enabled_portals.length}</TableCell>
                <TableCell>{o.employee_count.total} <span className="text-muted-foreground">({o.employee_count.active} active)</span></TableCell>
              </TableRow>
            ))}
            {data && data.length === 0 && (
              <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No organizations found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </PlatformShell>
  );
}

export function PlatformOrganizationDetail() {
  const { id } = useParams();
  const { data: org, error } = usePlatformData<PlatformOrg>(`/organizations/${id}`);
  return (
    <PlatformShell title={org?.name ?? 'Organization'}>
      {error && <p className="text-sm text-danger">{error}</p>}
      {org && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Organization details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <div><p className="text-xs text-muted-foreground">Name</p><p className="font-medium">{org.name}</p></div>
              <div><p className="text-xs text-muted-foreground">Slug</p><p className="font-medium">{org.slug}</p></div>
              <div><p className="text-xs text-muted-foreground">Industry</p><p className="font-medium">{org.industry || '—'}</p></div>
              <div><p className="text-xs text-muted-foreground">Size</p><p className="font-medium">{org.size || '—'}</p></div>
              <div><p className="text-xs text-muted-foreground">Joined</p><p className="font-medium">{joined(org.created_at)}</p></div>
              <div><p className="text-xs text-muted-foreground">Onboarding</p><OnboardingTag onboarding={org.onboarding} /></div>
              <div><p className="text-xs text-muted-foreground">Employees</p><p className="font-medium">{org.employee_count.total} ({org.employee_count.active} active)</p></div>
            </CardContent>
          </Card>
          <Card className="gap-0 overflow-hidden">
            <CardHeader className="pb-4"><CardTitle>Portals</CardTitle></CardHeader>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Portal type</TableHead><TableHead>Status</TableHead><TableHead>Organization's label</TableHead><TableHead>Employees</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {(org.portals ?? []).map((p) => (
                  <TableRow key={p.key}>
                    <TableCell className="font-medium">{PORTAL_CARDS[p.key]?.name ?? p.default_label}</TableCell>
                    <TableCell>{p.enabled ? <Badge variant="success">Enabled</Badge> : <Badge variant="secondary">Off</Badge>}</TableCell>
                    <TableCell>{p.custom_label || p.default_label}</TableCell>
                    <TableCell>{p.employee_count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}
    </PlatformShell>
  );
}
