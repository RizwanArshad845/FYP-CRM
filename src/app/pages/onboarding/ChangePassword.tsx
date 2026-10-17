import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAuth, nextRouteFor } from '../../context/AuthContext';
import { apiFetch } from '../../utils/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent } from '../../components/ui/card';
import { SetupShell } from './SetupShell';

// Required after signing in with a temporary password; also usable any time.
export function ChangePassword() {
  const { user, isLoading, applySession, logout } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) navigate('/login');
  }, [user, isLoading, navigate]);

  if (!user) return null;
  const forced = user.mustChangePassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) return toast.error('New password must be at least 8 characters');
    if (next !== confirm) return toast.error('Passwords do not match');

    setSaving(true);
    try {
      const res = await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      applySession(res.data);
      toast.success('Password updated');
      navigate(nextRouteFor({ ...user, ...res.data, mustChangePassword: false }));
    } catch (error: any) {
      toast.error(error.message || 'Could not change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SetupShell
      title={forced ? 'Choose your password' : 'Change password'}
      subtitle={forced
        ? `Welcome to ${user.organization?.name ?? 'your organization'}, ${user.first_name}. Replace the temporary password you were given before continuing.`
        : undefined}
    >
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current">{forced ? 'Temporary password' : 'Current password'}</Label>
              <Input id="current" type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="next">New password</Label>
              <Input id="next" type="password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
              <p className="text-xs text-muted-foreground">At least 8 characters.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input id="confirm" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
            </div>
            <div className="flex items-center justify-between pt-2">
              <Button type="button" variant="ghost" onClick={() => logout(false)}>Sign out</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save password'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </SetupShell>
  );
}
