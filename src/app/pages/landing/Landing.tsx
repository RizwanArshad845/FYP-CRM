import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  ShieldCheck, SlidersHorizontal, Workflow, UserCog, TrendingUp, BarChart3, HeartHandshake, Users, Wallet, Check,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { BrandLogo, BRAND_NAME, BRAND_TAGLINE } from '../../components/shared/BrandMark';
import { useAuth, nextRouteFor } from '../../context/AuthContext';
import { PORTAL_CARDS } from '../onboarding/PortalEditors';

// Public AICRE landing page (plan Section 3), in the product-led style of modern CRM
// sites: the hero shows the real product, and each feature is shown, not described.

const FONT = { fontFamily: '"Hanken Grotesk", Arial, sans-serif' };

const PORTALS = [
  { key: 'admin', icon: UserCog },
  { key: 'sales', icon: TrendingUp },
  { key: 'sales_manager', icon: BarChart3 },
  { key: 'cst', icon: HeartHandshake },
  { key: 'cst_manager', icon: Users },
  { key: 'finance', icon: Wallet },
];

const STEPS = [
  { title: 'Register your organization', text: 'Create the organization and its first administrator.' },
  { title: 'Choose your portals and tier labels', text: 'Pick the workspaces you need and name the access tiers your way.' },
  { title: 'Add your employees', text: 'One portal and one tier each, typed in or uploaded as a CSV.' },
  { title: 'Start working in your portals', text: 'Every team signs in at your organization\'s own address.' },
];

// --- Product vignettes: small, faithful renders of real AICRE screens -----------

const BOARD = [
  { stage: 'New lead', cards: [['Nova Foods', 'Ali', '4 days'], ['Bolt Gyms', 'Omar', '1 day']] },
  { stage: 'Contacted', cards: [['Acme Travel', 'Sara', '6 days'], ['Peak Autos', 'Omar', '2 days']] },
  { stage: 'Proposal sent', cards: [['Orbit Media', 'Sara', '3 days']] },
  { stage: 'Won', cards: [['Zen Clinics', 'Ali', '12 days']] },
];

function AppWindow() {
  return (
    <div className="overflow-hidden rounded-[14px] border border-[#d7dde8] bg-white shadow-[0_30px_60px_-20px_rgba(30,42,68,0.35)]">
      <div className="flex items-center gap-1.5 border-b border-[#e3e7ef] bg-[#f8f9fc] px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#e3e7ef]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#e3e7ef]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#e3e7ef]" />
        <span className="ml-3 truncate rounded-md bg-white px-3 py-0.5 text-[11px] text-[#6b7383] ring-1 ring-[#e3e7ef]">app.aicre.com/bright-path/dashboard</span>
      </div>
      <div className="flex" style={{ fontFamily: 'Arial, sans-serif' }}>
        <div className="hidden w-[132px] shrink-0 bg-[#1e2a44] py-3 sm:block">
          <div className="px-3.5 pb-3 text-[13px] font-bold text-white">Bright Path<small className="block text-[9px] font-normal text-[#9fb0cf]">CST Manager</small></div>
          {['Client Operations', 'Agent Management', 'Pipeline', 'Requests'].map((n) => (
            <div key={n} className={`px-3.5 py-1.5 text-[11px] ${n === 'Pipeline' ? 'border-l-2 border-[#5b8def] bg-[#2f4170] pl-3 text-white' : 'text-[#cfd8ea]'}`}>{n}</div>
          ))}
        </div>
        <div className="min-w-0 flex-1 bg-[#f3f5f9] p-3">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-[13px] font-bold text-[#1f2937]">Active clients</span>
            <span className="flex overflow-hidden rounded-md border border-[#cfd6e3] text-[10px]">
              <span className="bg-white px-2 py-0.5">Table</span><span className="bg-[#3b6fe0] px-2 py-0.5 text-white">Kanban</span>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {BOARD.map((col, ci) => (
              <div key={col.stage} className={`min-h-[150px] rounded-lg bg-[#e9edf4] p-1.5 ${ci > 1 ? 'hidden sm:block' : ''}`}>
                <div className="flex justify-between px-1 pb-1.5 text-[10px] font-bold text-[#1f2937]">{col.stage}<span className="font-normal text-[#6b7383]">{col.cards.length}</span></div>
                {col.cards.map(([name, agent, days], i) => (
                  <div
                    key={name}
                    className={`mb-1.5 rounded-md border bg-white px-2 py-1.5 text-[10px] ${ci === 1 && i === 1 ? 'rotate-[-2deg] border-[#3b6fe0] shadow-[0_8px_18px_rgba(30,42,68,.25)]' : 'border-[#dfe4ee]'}`}
                  >
                    <b className="block text-[11px] text-[#1f2937]">{name}</b>
                    <span className="flex justify-between text-[#6b7383]"><span>{agent}</span><span>{days}</span></span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PortalsVignette() {
  const rows = [['Admin', true, true], ['Sales', true, false], ['Sales Manager', true, false], ['Customer Success', true, false], ['Finance', false, false]] as const;
  return (
    <div className="rounded-[12px] border border-[#e3e7ef] bg-white p-4" style={{ fontFamily: 'Arial, sans-serif' }}>
      <div className="mb-3 text-[12px] text-[#6b7383]">Portals for your organization</div>
      <div className="space-y-2">
        {rows.map(([name, on, locked]) => (
          <div key={name} className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-[13px] ${on ? 'border-[#3b6fe0] bg-[#f2f6ff]' : 'border-[#dfe4ee]'}`}>
            <span className={`flex h-4 w-4 items-center justify-center rounded ${on ? 'bg-[#3b6fe0] text-white' : 'border-2 border-[#b9c2d3]'}`}>{on && <Check className="h-3 w-3" strokeWidth={3} />}</span>
            <b className="font-semibold text-[#1f2937]">{name}</b>
            {locked && <span className="text-[11px] text-[#2d55b8]">always on</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function PermissionsVignette() {
  const rows = [['Client contact details', true], ['Payment details', false], ['Call recordings and transcripts', true], ['Internal notes', true]] as const;
  return (
    <div className="rounded-[12px] border border-[#e3e7ef] bg-white p-4" style={{ fontFamily: 'Arial, sans-serif' }}>
      <div className="mb-1 text-[14px] font-bold text-[#1f2937]">Field groups</div>
      <div className="mb-2 text-[12px] text-[#6b7383]">Customer Success · Member (Support Agent)</div>
      {rows.map(([label, on]) => (
        <div key={label} className="flex items-center justify-between border-b border-[#eef1f6] py-2 text-[13px] text-[#1f2937] last:border-0">
          {label}
          <span className={`relative h-[21px] w-[38px] rounded-full ${on ? 'bg-[#3b6fe0]' : 'bg-[#cfd6e3]'}`}>
            <span className={`absolute top-[2px] h-[17px] w-[17px] rounded-full bg-white ${on ? 'left-[19px]' : 'left-[2px]'}`} />
          </span>
        </div>
      ))}
    </div>
  );
}

function AutomationVignette() {
  return (
    <div className="space-y-2.5" style={{ fontFamily: 'Arial, sans-serif' }}>
      <div className="flex items-center justify-between rounded-[12px] border border-[#e3e7ef] bg-white p-3.5 text-[13px]">
        <span className="text-[#1f2937]">Suggested: <b>Sara Ahmed</b> <span className="text-[#6b7383]">(2 active)</span></span>
        <span className="rounded-[7px] bg-[#3b6fe0] px-3 py-1.5 text-[12px] text-white">Accept</span>
      </div>
      <div className="rounded-[12px] border border-[#e3e7ef] bg-white p-3.5 text-[13px] text-[#1f2937]">
        <div className="mb-2 flex items-center justify-between">
          <span><b>3 pending requests</b> <span className="text-[#6b7383]">· 2 selected</span></span>
          <span className="rounded-[7px] bg-[#3b6fe0] px-3 py-1.5 text-[12px] text-white">Approve selected (2)</span>
        </div>
        <div className="flex gap-2 text-[12px]">
          <span className="rounded-full bg-[#fde8e8] px-2.5 py-0.5 text-[#b42318]">Red</span>
          <span className="rounded-full bg-[#fff4d6] px-2.5 py-0.5 text-[#8a6100]">Pending</span>
        </div>
      </div>
      <div className="rounded-[12px] border border-[#e3e7ef] bg-white p-3.5 text-[13px] text-[#1f2937]">
        <b>Payroll for November saved</b> for 24 employees · <span className="text-[#3b6fe0]">Download all slips</span>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    icon: SlidersHorizontal,
    title: 'Shaped around your teams',
    text: 'Choose portals from a fixed list, rename access tiers, add custom client fields and pipeline stages.',
    points: ['Six portals for sales, customer success, finance and admin', 'Tier names in your own words', 'Custom fields and stages for your pipeline'],
    vignette: <PortalsVignette />,
  },
  {
    icon: ShieldCheck,
    title: 'Private by design',
    text: 'Every record belongs to one organization, and each tier sees only the fields and actions you allow.',
    points: ['Separate data for every organization', 'Members see their own records, managers their team', 'Switch field groups and actions off per tier'],
    vignette: <PermissionsVignette />,
  },
  {
    icon: Workflow,
    title: 'Less manual work',
    text: 'Follow up auto fill, bulk approvals, salary slips in one run and CSV import.',
    points: ['Follow ups filled from the client record', 'The least loaded agent suggested for each new client', 'Approvals and payroll in one step'],
    vignette: <AutomationVignette />,
  },
];

export function Landing() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  // A signed-in user goes straight to their next step
  useEffect(() => {
    if (!isLoading && user) navigate(nextRouteFor(user), { replace: true });
  }, [user, isLoading, navigate]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-[#1f2937]" style={FONT}>
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-[#e3e7ef] bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
          <Link to="/" className="flex items-center gap-2.5" aria-label={`${BRAND_NAME} home`}>
            <BrandLogo className="h-8 w-8" />
            <span className="text-[20px] font-extrabold tracking-[0.5px] text-[#1e2a44]">{BRAND_NAME}</span>
          </Link>
          <nav className="hidden items-center gap-7 text-[14px] font-medium text-[#5b6475] md:flex">
            <a href="#features" className="hover:text-[#1e2a44]">Features</a>
            <a href="#portals" className="hover:text-[#1e2a44]">Portals</a>
            <a href="#how-it-works" className="hover:text-[#1e2a44]">How it works</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="px-2 text-[14px] font-semibold text-[#1e2a44] sm:px-3"><Link to="/login">Log in</Link></Button>
            <Button asChild className="h-10 px-4 text-[14px] font-semibold"><Link to="/signup"><span className="sm:hidden">Register</span><span className="hidden sm:inline">Register your organization</span></Link></Button>
          </div>
        </div>
      </header>

      {/* Hero: the product, shown */}
      <section className="relative overflow-hidden bg-[#f3f5f9]">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:py-24">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[13px] font-medium text-[#2d55b8] ring-1 ring-[#dfe4ee]">
              <BrandLogo className="h-4 w-4" /> {BRAND_TAGLINE}
            </p>
            <h1 className="text-[38px] font-extrabold leading-[1.08] tracking-[-0.02em] text-[#1e2a44] sm:text-[46px]">
              One CRM for your sales and customer success teams
            </h1>
            <p className="mt-5 max-w-[34rem] text-[18px] leading-relaxed text-[#5b6475]">
              One CRM that each organization can shape around its own teams, while every organization's data stays private.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild className="h-12 px-6 text-[15px] font-semibold"><Link to="/signup">Register your organization</Link></Button>
              <Button asChild variant="outline" className="h-12 bg-white px-6 text-[15px] font-semibold"><Link to="/login">Log in</Link></Button>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[14px] text-[#5b6475]">
              {['Six ready-made portals', 'Your own sign-in address', 'Import employees and clients by CSV'].map((t) => (
                <li key={t} className="flex items-center gap-2"><Check className="h-4 w-4 text-[#1d7a3e]" strokeWidth={3} />{t}</li>
              ))}
            </ul>
          </div>
          <div className="lg:-mr-24">
            <AppWindow />
          </div>
        </div>
      </section>

      {/* Features: each one shown with the real screen */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-20">
        <h2 className="max-w-2xl text-[32px] font-extrabold leading-tight tracking-[-0.01em] text-[#1e2a44]">Built for the way sales and customer success teams work together</h2>
        <div className="mt-14 space-y-20">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="grid items-center gap-10 md:grid-cols-2">
              <div className={i % 2 ? 'md:order-2' : ''}>
                <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#f2f6ff] text-[#3b6fe0]"><f.icon className="h-5 w-5" /></span>
                <h3 className="text-[26px] font-bold text-[#1e2a44]">{f.title}</h3>
                <p className="mt-3 text-[17px] leading-relaxed text-[#5b6475]">{f.text}</p>
                <ul className="mt-5 space-y-2.5">
                  {f.points.map((p) => (
                    <li key={p} className="flex gap-2.5 text-[15px] text-[#1f2937]"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#3b6fe0]" strokeWidth={3} />{p}</li>
                  ))}
                </ul>
              </div>
              <div className={`rounded-[18px] bg-[#f3f5f9] p-6 sm:p-8 ${i % 2 ? 'md:order-1' : ''}`}>{f.vignette}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Portals */}
      <section id="portals" className="scroll-mt-20 border-y border-[#e3e7ef] bg-[#f8f9fc]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-[32px] font-extrabold tracking-[-0.01em] text-[#1e2a44]">A portal for every team</h2>
          <p className="mt-3 max-w-2xl text-[17px] text-[#5b6475]">Each employee works in one portal with one access tier. Turn on the portals your organization needs.</p>
          <div className="mt-10 grid gap-px overflow-hidden rounded-[14px] border border-[#e3e7ef] bg-[#e3e7ef] sm:grid-cols-2 lg:grid-cols-3">
            {PORTALS.map(({ key, icon: Icon }) => (
              <div key={key} className="flex gap-4 bg-white p-6">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1e2a44] text-white"><Icon className="h-5 w-5" /></span>
                <div>
                  <h3 className="text-[16px] font-bold text-[#1e2a44]">{PORTAL_CARDS[key].name}</h3>
                  <p className="mt-1 text-[14px] text-[#5b6475]">{PORTAL_CARDS[key].description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works: a real sequence, so it is numbered */}
      <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-20">
        <h2 className="text-[32px] font-extrabold tracking-[-0.01em] text-[#1e2a44]">How it works</h2>
        <ol className="mt-10 grid gap-8 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative">
              {i < STEPS.length - 1 && <span className="absolute left-10 right-0 top-[13px] hidden h-px bg-[#cfd6e3] md:block" aria-hidden />}
              <span className="relative flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[#3b6fe0] text-[12px] font-bold text-white" style={{ fontFamily: 'Arial, sans-serif' }}>{i + 1}</span>
              <h3 className="mt-4 text-[17px] font-bold text-[#1e2a44]">{s.title}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-[#5b6475]">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Closing call to action */}
      <section className="px-6 pb-20">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 rounded-[20px] bg-[#1e2a44] px-8 py-10 sm:flex-row sm:items-center sm:px-12">
          <div>
            <h2 className="text-[28px] font-extrabold text-white">Bring your teams into one CRM</h2>
            <p className="mt-2 text-[16px] text-[#cfd8ea]">Register your organization, choose your portals and invite your team.</p>
          </div>
          <div className="flex shrink-0 gap-3">
            <Button asChild className="h-12 px-6 text-[15px] font-semibold"><Link to="/signup">Register your organization</Link></Button>
            <Button asChild variant="outline" className="h-12 border-white/40 bg-transparent px-6 text-[15px] font-semibold text-white hover:bg-white/10 hover:text-white"><Link to="/login">Log in</Link></Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#e3e7ef]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-[14px] text-[#6b7383]">
          <span className="flex items-center gap-2.5"><BrandLogo className="h-6 w-6" /><span>AICRE, Final Year Project, FAST NUCES Lahore</span></span>
          <span className="flex gap-6">
            <Link to="/login" className="hover:text-[#1e2a44]">Log in</Link>
            <Link to="/signup" className="hover:text-[#1e2a44]">Register</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
