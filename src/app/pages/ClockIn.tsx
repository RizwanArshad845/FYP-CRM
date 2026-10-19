import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth, pendingSetupRoute, useOrgPath } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Clock, CheckCircle, LogOut, User, AlertTriangle, CalendarDays, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { Progress } from '../components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '../components/ui/dialog';

interface AttendanceDay {
  day: string;
  clockIn: string;
  clockOut: string;
  hours: number;
  status: 'present' | 'absent' | 'today';
}

const STATUS_DOT = {
  present: 'bg-green-500',
  absent: 'bg-red-500',
  today: 'bg-blue-500 animate-pulse',
};

export function ClockIn() {
  const { user, isLoading, clockIn, clockOut, breakIn, breakOut, logout, staleSession, clearStaleSession } = useAuth();
  const navigate = useNavigate();
  const to = useOrgPath();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [hoursWorked, setHoursWorked] = useState(0);
  const [breakHours, setBreakHours] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [weeklyAttendance, setWeeklyAttendance] = useState<AttendanceDay[]>([]);
  const [logoutOpen, setLogoutOpen] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { navigate(to('/login')); return; }
    const setup = pendingSetupRoute(user);
    if (setup) { navigate(setup); return; }

    // Fetch History
    import('../utils/api').then(({ apiFetch }) => {
      apiFetch('/attendance/history').then(res => {
        if (res.success && res.data) {
          const formatted = res.data.slice(0, 5).map((record: any) => {
            const inTime = new Date(record.clock_in);
            const outTime = record.clock_out ? new Date(record.clock_out) : null;
            const hours = outTime ? (outTime.getTime() - inTime.getTime()) / 1000 / 60 / 60 : 0;
            return {
              day: inTime.toLocaleDateString('en-US', { weekday: 'short' }),
              clockIn: inTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
              clockOut: outTime ? outTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—',
              hours: Math.round(hours * 10) / 10,
              status: outTime ? 'present' : 'today',
            };
          });
          setWeeklyAttendance(formatted);
        } else if (!res.success) {
          toast.error('Could not sync attendance history');
        }
      }).catch(err => {
        console.error("Could not load attendance", err);
        toast.error('Network error while fetching attendance');
      });
    });

    const timer = setInterval(() => {
      setCurrentTime(new Date());
      if (user.clockedIn && user.clockInTime) {
        const diff = (new Date().getTime() - new Date(user.clockInTime).getTime()) / 1000 / 60 / 60;
        setHoursWorked(diff);
      }
      if (user.onBreak && user.breakInTime) {
        const bDiff = (new Date().getTime() - new Date(user.breakInTime).getTime()) / 1000 / 60 / 60;
        setBreakHours(bDiff);
      } else {
        setBreakHours(0);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [user, isLoading, navigate, to]);

  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading your profile...</div></div>;
  if (!user) return null;

  const handleClockIn = async () => {
    setIsProcessing(true);
    try {
      await clockIn();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClockOut = async () => {
    if (confirm('Are you sure you want to clock out?')) {
      setIsProcessing(true);
      try {
        await clockOut();
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleBreakIn = async () => {
    setIsProcessing(true);
    try {
      await breakIn();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBreakOut = async () => {
    setIsProcessing(true);
    try {
      await breakOut();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAccessPortal = () => {
    navigate(to('/dashboard'));
  };

  const handleLogout = () => setLogoutOpen(true);

  const doLogout = async (clockOutAlso: boolean) => {
    setLogoutOpen(false);
    await logout(clockOutAlso);
    navigate(to('/login'));
  };

  const formatTime = (date: Date) => date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const formatDate = (date: Date) => date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const formatHours = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    const s = Math.floor(((hours - h) * 60 - m) * 60);
    return `${h}h ${m}m ${s}s`;
  };

  const totalWeekHours = weeklyAttendance.reduce((s, d) => s + d.hours, 0) + (user.clockedIn ? hoursWorked : 0);
  const weeklyTarget = 45;
  const weeklyPct = Math.min(100, Math.round((totalWeekHours / weeklyTarget) * 100));

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-3xl space-y-6 animate-fade-in">
        {/* User Info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary rounded-full">
              <User className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">{user.name}</h2>
              <p className="text-sm text-muted-foreground capitalize">{user.role.replace('_', ' ')} • {user.department}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />Logout
          </Button>
        </div>

        {/* Main Clock Card */}
        <Card className="border-2 shadow-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className={`p-4 rounded-full transition-colors ${user.clockedIn ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'}`}>
                <Clock className={`h-12 w-12 transition-colors ${user.clockedIn ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`} />
              </div>
            </div>
            <CardTitle className="text-4xl font-bold tracking-tight">{formatTime(currentTime)}</CardTitle>
            <CardDescription className="text-base">{formatDate(currentTime)}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Status */}
            <div className="text-center p-4 bg-muted/50 rounded-xl">
              {user.clockedIn ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-semibold">Clocked In</span>
                  </div>
                  {user.clockInTime && (
                    <p className="text-sm text-muted-foreground">
                      Since {new Date(user.clockInTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                  <div className="mt-3 inline-flex items-center gap-2 bg-background px-4 py-2 rounded-lg border">
                    <Timer className="h-4 w-4 text-muted-foreground" />
                    <span className="text-2xl font-bold font-mono text-foreground">{formatHours(hoursWorked)}</span>
                  </div>
                  {user.onBreak && (
                    <div className="mt-2 text-amber-600 font-medium animate-pulse">
                      Currently on Break: {formatHours(breakHours)}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Clock className="h-5 w-5" />
                    <span className="font-semibold">Not Clocked In</span>
                  </div>
                  <p className="text-sm text-muted-foreground">You must clock in to access your portal</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-3">
              {!user.clockedIn ? (
                <Button
                  onClick={handleClockIn}
                  className="w-full h-14 text-lg"
                  size="lg"
                  disabled={isProcessing}
                >
                  <Clock className="h-5 w-5 mr-2" />
                  {isProcessing ? 'Processing...' : 'Clock In'}
                </Button>
              ) : (
                <>
                  <Button onClick={() => navigate(to('/dashboard'))} className="w-full h-14 text-lg" size="lg" disabled={user.onBreak}>
                    Access Portal
                  </Button>

                  {user.onBreak ? (
                    <Button
                      onClick={handleBreakOut}
                      className="w-full h-14 text-lg bg-amber-500 hover:bg-amber-600 text-white"
                      size="lg"
                      disabled={isProcessing}
                    >
                      <Timer className="h-5 w-5 mr-2" />
                      Resume Work
                    </Button>
                  ) : (
                    <Button
                      onClick={handleBreakIn}
                      variant="outline"
                      className="w-full h-14 text-lg border-amber-500 text-amber-600 hover:bg-amber-50"
                      size="lg"
                      disabled={isProcessing}
                    >
                      <Timer className="h-5 w-5 mr-2" />
                      Take Break
                    </Button>
                  )}

                  <Button
                    onClick={handleClockOut}
                    variant="outline"
                    className="w-full h-14 text-lg border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    size="lg"
                    disabled={isProcessing}
                  >
                    <LogOut className="h-5 w-5 mr-2" />
                    {isProcessing ? 'Processing...' : 'Clock Out'}
                  </Button>
                </>
              )}
            </div>

            {!user.clockedIn && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-center">
                <p className="text-sm text-amber-800 dark:text-amber-200">⚠️ Portal access is locked until you clock in</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stale session warning */}
        {staleSession && (
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl animate-fade-in">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-amber-800 dark:text-amber-200 text-sm">Missed Clock-Out Detected</p>
                <p className="text-amber-700 dark:text-amber-300 text-xs mt-0.5">
                  Last clock-in: <span className="font-mono font-bold">{new Date(staleSession.clockInTime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </p>
              </div>
              <Button variant="link" size="sm" onClick={clearStaleSession} className="text-amber-600 hover:text-amber-800 text-xs shrink-0 h-auto p-0">Dismiss</Button>
            </div>
          </div>
        )}

        {/* Weekly Summary */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">Weekly Attendance</CardTitle>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-foreground">{totalWeekHours.toFixed(1)}h / {weeklyTarget}h</p>
                <p className="text-xs text-muted-foreground">{weeklyPct}% completed</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={weeklyPct} className="h-2" />
            <div className="space-y-1">
              <div className="grid grid-cols-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2">
                <span>Day</span><span>Clock In</span><span>Clock Out</span><span>Hours</span><span className="text-right">Status</span>
              </div>
              {weeklyAttendance.length === 0 && (
                <p className="text-sm text-center text-muted-foreground py-4">No recent attendance records found.</p>
              )}
              {weeklyAttendance.map((day, idx) => (
                <div
                  key={idx + day.day}
                  className={`grid grid-cols-5 items-center text-sm px-3 py-2.5 rounded-lg transition-colors ${day.status === 'today' ? 'bg-primary/5 border border-primary/20' : 'hover:bg-muted/50'
                    }`}
                >
                  <span className="font-medium text-foreground">{day.day}</span>
                  <span className="text-muted-foreground font-mono text-xs">{day.clockIn}</span>
                  <span className="text-muted-foreground font-mono text-xs">{day.clockOut}</span>
                  <span className={`font-mono text-xs ${day.hours > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {day.hours > 0 ? `${day.hours}h` : '—'}
                  </span>
                  <div className="flex justify-end">
                    <div className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[day.status]}`} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

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
              <Button className="w-full" onClick={() => doLogout(true)}>
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
    </div>
  );
}
