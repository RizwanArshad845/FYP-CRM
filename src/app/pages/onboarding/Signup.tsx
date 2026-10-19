import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAuth, nextRouteFor } from '../../context/AuthContext';
import { apiFetch, ApiError } from '../../utils/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { SetupShell, SetupStepper } from './SetupShell';

const SIZES = ['1-10', '11-50', '51-200', '201-1000', '1000+'];

// Step 0: create the organization and its first admin account.
export function Signup() {
  const { user, isLoading, startSession } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    orgName: '', industry: '', size: '',
    firstName: '', lastName: '', email: '', password: '', confirm: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState('');

  useEffect(() => {
    if (!isLoading && user) navigate(nextRouteFor(user));
  }, [user, isLoading, navigate]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) return toast.error('Password must be at least 8 characters');
    if (form.password !== form.confirm) return toast.error('Passwords do not match');

    setSubmitting(true);
    setEmailError('');
    try {
      const res = await apiFetch('/onboarding/organization', {
        method: 'POST',
        body: JSON.stringify({
          organization: {
            name: form.orgName,
            ...(form.industry && { industry: form.industry }),
            ...(form.size && { size: form.size }),
          },
          admin: { first_name: form.firstName, last_name: form.lastName, email: form.email, password: form.password },
        }),
      });
      const signedIn = await startSession(res.token, res.user);
      toast.success(`${res.user.organization.name} is ready. Let's set it up.`);
      navigate(nextRouteFor(signedIn));
    } catch (error: any) {
      // "An account with this email already exists." belongs next to the email field (UC2 4A)
      if (error instanceof ApiError && error.status === 409) setEmailError(error.message);
      else toast.error(error.message || 'Could not create the organization');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SetupShell
      headerRight={`Organization setup${form.orgName.trim() ? `: ${form.orgName.trim()}` : ''}`}
      stepper={<SetupStepper current={0} />}
      title="Register your organization"
      subtitle="You'll be the administrator. Next you'll pick portals, name your teams and invite employees."
    >
          <form onSubmit={handleSubmit} className="space-y-6">
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold text-foreground">Organization</legend>
              <div className="space-y-2">
                <Label htmlFor="orgName">Organization name</Label>
                <Input id="orgName" required minLength={2} value={form.orgName} onChange={set('orgName')} placeholder="Acme Corp" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry (optional)</Label>
                  <Input id="industry" value={form.industry} onChange={set('industry')} placeholder="Software" />
                </div>
                <div className="space-y-2">
                  <Label>Company size (optional)</Label>
                  <Select value={form.size} onValueChange={(size) => setForm((f) => ({ ...f, size }))}>
                    <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
                    <SelectContent>
                      {SIZES.map((s) => <SelectItem key={s} value={s}>{s} employees</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </fieldset>

            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold text-foreground">Your admin account</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First name</Label>
                  <Input id="firstName" required value={form.firstName} onChange={set('firstName')} autoComplete="given-name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input id="lastName" required value={form.lastName} onChange={set('lastName')} autoComplete="family-name" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Work email</Label>
                <Input id="email" type="email" required value={form.email} onChange={(e) => { setEmailError(''); set('email')(e); }} autoComplete="email" aria-invalid={!!emailError} />
                {emailError && <p className="text-[13px] text-danger">{emailError}</p>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" required minLength={8} value={form.password} onChange={set('password')} autoComplete="new-password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm password</Label>
                  <Input id="confirm" type="password" required value={form.confirm} onChange={set('confirm')} autoComplete="new-password" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">At least 8 characters.</p>
            </fieldset>

            <div className="flex items-center justify-between">
              <span className="text-[13px] text-text-secondary">
                Already have an account? <Link to="/login" className="font-bold text-primary hover:underline">Log in</Link>
              </span>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Creating…' : 'Save and continue'}
              </Button>
            </div>
          </form>
    </SetupShell>
  );
}
