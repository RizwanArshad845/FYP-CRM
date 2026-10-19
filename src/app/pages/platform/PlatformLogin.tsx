import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { BrandLogo, BRAND_NAME } from '../../components/shared/BrandMark';
import { getPlatformToken, platformFetch, setPlatformSession } from '../../utils/platformApi';

// Platform admin login (plan 4.4): the login card of Figure 4.1 without register or remember me.
export function PlatformLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (getPlatformToken()) navigate('/platform', { replace: true });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const res = await platformFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      setPlatformSession(res.token, res.admin);
      navigate('/platform', { replace: true });
    } catch (error: any) {
      toast.error(error.message || 'Could not sign in');
    } finally {
      setBusy(false);
    }
  };

  const inputClass = 'w-full rounded-[8px] border border-input-border bg-white px-3 py-[11px] text-[14px] text-[#1f2937] outline-none placeholder:text-placeholder focus:border-primary focus:ring-2 focus:ring-primary/20';

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg,#1e2a44 0%,#2f4170 55%,#3b6fe0 100%)' }}>
      <div className="w-full max-w-[420px] rounded-[14px] bg-white px-10 py-[38px] text-[#1f2937] shadow-[0_20px_50px_rgba(0,0,0,.25)]">
        <BrandLogo className="mx-auto mb-3 h-11 w-11" />
        <div className="text-center text-[28px] font-bold leading-tight text-[#1e2a44]">{BRAND_NAME}</div>
        <div className="mt-[6px] mb-[26px] text-center text-[13px] text-[#6b7383]">Platform Administration</div>
        <form onSubmit={submit}>
          <label htmlFor="email" className="mt-[14px] mb-[6px] block text-[13px] font-semibold">Email</label>
          <input id="email" type="email" autoComplete="username" placeholder="name@company.com" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          <label htmlFor="password" className="mt-[14px] mb-[6px] block text-[13px] font-semibold">Password</label>
          <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
          <button type="submit" disabled={busy} className="mt-[22px] w-full rounded-[8px] border-0 bg-[#3b6fe0] p-3 text-center text-[15px] font-semibold text-white hover:bg-[#3b6fe0]/90 disabled:opacity-60">
            {busy ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
