import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { BRAND_NAME, BRAND_TAGLINE } from '../../components/shared/BrandMark';
import { useAuth, nextRouteFor } from '../../context/AuthContext';
import { PORTAL_CARDS } from '../onboarding/PortalEditors';

// Public AICRE landing page (plan Section 3). Copy comes from the report.

const FEATURES = [
  {
    title: 'Shaped around your teams',
    text: 'Choose portals from a fixed list, rename access tiers, add custom client fields and pipeline stages.',
  },
  {
    title: 'Private by design',
    text: 'Every record belongs to one organization, and each tier sees only the fields and actions you allow.',
  },
  {
    title: 'Less manual work',
    text: 'Follow up auto fill, bulk approvals, salary slips in one run and CSV import.',
  },
];

const STEPS = [
  'Register your organization',
  'Choose your portals and tier labels',
  'Add your employees',
  'Start working in your portals',
];

const PORTAL_ORDER = ['admin', 'sales', 'sales_manager', 'cst', 'cst_manager', 'finance'];

export function Landing() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  // A signed-in user goes straight to their next step
  useEffect(() => {
    if (!isLoading && user) navigate(nextRouteFor(user), { replace: true });
  }, [user, isLoading, navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-navy">
        <div className="mx-auto flex h-[58px] max-w-6xl items-center justify-between gap-4 px-6">
          <span className="text-[20px] font-bold tracking-[0.5px] text-white">{BRAND_NAME}</span>
          <nav className="flex items-center gap-2 sm:gap-4">
            <a href="#features" className="hidden text-[13px] text-sidebar-foreground hover:text-white sm:inline">Features</a>
            <a href="#how-it-works" className="hidden text-[13px] text-sidebar-foreground hover:text-white sm:inline">How it works</a>
            <Button asChild variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white">
              <Link to="/login">Log in</Link>
            </Button>
            <Button asChild>
              <Link to="/signup">Register your organization</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="text-white" style={{ background: 'linear-gradient(135deg,#1e2a44 0%,#2f4170 55%,#3b6fe0 100%)' }}>
        <div className="mx-auto max-w-6xl px-6 py-24 text-center">
          <h1 className="text-[48px] font-bold leading-tight tracking-[0.5px] text-white">{BRAND_NAME}</h1>
          <p className="mt-2 text-[18px] text-[#cfd8ea]">{BRAND_TAGLINE}</p>
          <p className="mx-auto mt-6 max-w-2xl text-[16px] text-white/90">
            One CRM that each organization can shape around its own teams, while every organization's data stays private.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild className="h-11 px-6 text-[15px]">
              <Link to="/signup">Register your organization</Link>
            </Button>
            <Button asChild variant="outline" className="h-11 border-white bg-transparent px-6 text-[15px] text-white hover:bg-white/10 hover:text-white">
              <Link to="/login">Log in</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-16 px-6 py-16">
        <h2 className="mb-6 text-center text-[24px] font-bold">Features</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title}>
              <CardContent className="pt-6">
                <h3 className="mb-2 text-[16px] font-bold">{f.title}</h3>
                <p className="text-[14px] text-muted-foreground">{f.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Portals */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <h2 className="mb-6 text-center text-[24px] font-bold">Portals</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {PORTAL_ORDER.map((key) => (
            <div key={key} className="rounded-[9px] border border-[#dfe4ee] bg-card px-[14px] py-[13px] dark:border-border">
              <b className="mb-[3px] block text-[14px]">{PORTAL_CARDS[key].name}</b>
              <small className="text-[12px] text-muted-foreground">{PORTAL_CARDS[key].description}</small>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-16 px-6 pb-20">
        <h2 className="mb-6 text-center text-[24px] font-bold">How it works</h2>
        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step} className="flex items-center gap-3 rounded-[10px] border border-border bg-card p-4">
              <i className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border-2 border-primary bg-primary text-[12px] font-bold not-italic text-white">
                {i + 1}
              </i>
              <span className="text-[14px] font-bold">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-[13px] text-muted-foreground">
          <span>AICRE, Final Year Project, FAST NUCES Lahore</span>
          <span className="flex gap-4">
            <Link to="/login" className="text-primary hover:underline">Log in</Link>
            <Link to="/signup" className="text-primary hover:underline">Register</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
