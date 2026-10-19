import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { BRAND_NAME, BRAND_TAGLINE } from '../components/shared/BrandMark';
import { useAuth, nextRouteFor } from '../context/AuthContext';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { apiFetch } from '../utils/api';

// Older builds remembered the email (and once the password); remember me now keeps the token.
const LEGACY_REMEMBER_KEYS = ['crm_remember_me', 'crm_remember_email'];

// Login page, Figure 4.1 (plan 9.3; docs/design/gui/login.html). On an organization's
// own URL (/<slug>/login) it shows that organization's name instead of AICRE.
export function Login() {
  const { slug } = useParams();
  const [orgName, setOrgName] = useState<string | null>(null);
  const [orgMissing, setOrgMissing] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const { login, user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && user) navigate(nextRouteFor(user));
  }, [user, isLoading, navigate]);

  useEffect(() => {
    setOrgName(null);
    setOrgMissing(false);
    if (!slug) return;
    apiFetch(`/auth/organization/${encodeURIComponent(slug)}`)
      .then((res) => setOrgName(res.data.name))
      .catch(() => setOrgMissing(true));
  }, [slug]);

  useEffect(() => {
    try {
      LEGACY_REMEMBER_KEYS.forEach((k) => localStorage.removeItem(k));
    } catch {
      // storage unavailable (private mode)
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    const signedIn = await login(email, password, rememberMe, slug);
    if (signedIn) navigate(nextRouteFor(signedIn));
    setIsLoggingIn(false);
  };

  const inputClass = 'w-full rounded-[8px] border border-input-border bg-white px-3 py-[11px] text-[14px] text-[#1f2937] outline-none placeholder:text-placeholder focus:border-primary focus:ring-2 focus:ring-primary/20';

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg,#1e2a44 0%,#2f4170 55%,#3b6fe0 100%)' }}
    >
      <div className="w-full max-w-[420px] rounded-[14px] bg-white px-10 py-[38px] text-[#1f2937] shadow-[0_20px_50px_rgba(0,0,0,.25)]">
        <div className="text-center text-[28px] font-bold leading-tight text-[#1e2a44]">{slug && !orgMissing ? orgName ?? ' ' : BRAND_NAME}</div>
        <div className="mt-[6px] mb-[26px] text-center text-[13px] text-[#6b7383]">{BRAND_TAGLINE}</div>

        {orgMissing ? (
          <p className="text-center text-[13px] text-[#5b6475]">
            We could not find this organization. Check the link or{' '}
            <Link to="/login" className="font-bold text-[#3b6fe0] hover:underline">sign in here</Link>.
          </p>
        ) : (
        <>

        <form id="login-form" name="login" onSubmit={handleSubmit} autoComplete="on">
          <label htmlFor="email" className="mt-[14px] mb-[6px] block text-[13px] font-semibold">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            required
          />

          <label htmlFor="password" className="mt-[14px] mb-[6px] block text-[13px] font-semibold">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            required
          />

          <div className="mt-3 flex items-center justify-between text-[13px] text-[#5b6475]">
            <label htmlFor="remember" className="flex cursor-pointer items-center gap-[6px] text-[13px] font-normal">
              <input
                id="remember"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-[13px] w-[13px] accent-[#3b6fe0]"
              />
              Remember me
            </label>
            <button type="button" onClick={() => setForgotOpen(true)} className="text-[13px] font-normal text-[#3b6fe0] hover:underline">
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoggingIn}
            className="mt-[22px] w-full rounded-[8px] border-0 bg-[#3b6fe0] p-3 text-center text-[15px] font-semibold text-white hover:bg-[#3b6fe0]/90 disabled:opacity-60"
          >
            {isLoggingIn ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="mt-[18px] text-center text-[13px] text-[#5b6475]">
          New to AICRE?{' '}
          <Link to="/signup" className="font-bold text-[#3b6fe0] hover:underline">Register your organization</Link>
        </p>
        </>
        )}
      </div>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Forgot password?</DialogTitle>
            <DialogDescription>Please contact your organization administrator to reset your password.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setForgotOpen(false)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
