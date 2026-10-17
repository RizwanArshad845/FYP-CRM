import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ArrowRight } from 'lucide-react';
import { useAuth, nextRouteFor } from '../../context/AuthContext';
import { apiFetch } from '../../utils/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent } from '../../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { SetupShell } from './SetupShell';

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
      toast.error(error.message || 'Could not create the organization');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SetupShell
      title="Create your organization"
      subtitle="You'll be the administrator. Next you'll pick portals, name your teams and invite employees."
    >
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold text-gray-900 dark:text-foreground">Organization</legend>
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
              <legend className="text-sm font-semibold text-gray-900 dark:text-foreground">Your admin account</legend>
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
                <Input id="email" type="email" required value={form.email} onChange={set('email')} autoComplete="email" />
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

            <Button type="submit" className="w-full h-11 gap-2" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create organization'}
              {!submitting && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>
        </CardContent>
      </Card>
      <p className="mt-6 text-center text-sm text-gray-600 dark:text-muted-foreground">
        Already have an account? <Link to="/login" className="font-medium text-blue-600 hover:underline">Sign in</Link>
      </p>
    </SetupShell>
  );
}
