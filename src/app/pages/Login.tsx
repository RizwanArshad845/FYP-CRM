import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { BrandLogo, BrandMark, BRAND_NAME, BRAND_TAGLINE } from '../components/shared/BrandMark';
import { useAuth, nextRouteFor } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { Lock, Mail, ArrowRight, Eye, EyeOff, Waves } from 'lucide-react';
import { toast } from 'sonner';

const REMEMBER_EMAIL_KEY = 'crm_remember_email';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login, user, isLoading } = useAuth();
  const navigate = useNavigate();

  // Auto-redirect if already logged in and load Remember Me
  useEffect(() => {
    if (!isLoading && user) {
      navigate(nextRouteFor(user));
    }
    
  }, [user, isLoading, navigate]);

  // Remember me stores the email only. Older builds also stored the password
  // (base64), so that legacy key is wiped on sight.
  useEffect(() => {
    try {
      localStorage.removeItem('crm_remember_me');
      const storedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY);
      if (storedEmail) {
        setEmail(storedEmail);
        setRememberMe(true);
      }
    } catch {
      // storage unavailable (private mode): nothing to restore
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoggingIn) return;

    setIsLoggingIn(true);
    const signedIn = await login(email, password);
    if (signedIn) {
      try {
        if (rememberMe) localStorage.setItem(REMEMBER_EMAIL_KEY, email);
        else localStorage.removeItem(REMEMBER_EMAIL_KEY);
      } catch {
        // storage unavailable: skip remember me
      }
      navigate(nextRouteFor(signedIn));
    }
    setIsLoggingIn(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left branding panel */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 text-white relative overflow-hidden animate-in fade-in duration-1000"
        style={{ 
          background: '#1a237e', // Deep dark blue from Image 3
          backgroundImage: 'radial-gradient(circle at top right, #283593, #1a237e)',
        }}
      >
        <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-white blur-[120px]" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-400 blur-[100px]" />
        </div>

        <div className="relative z-10 animate-in slide-in-from-left-8 duration-700 delay-200">
          <BrandMark logoClassName="h-10 w-10" textClassName="text-2xl" />
        </div>

        <div className="space-y-6 relative z-10 flex flex-col items-center text-center">
          <BrandLogo className="h-28 w-28 drop-shadow-xl" />
          <div className="space-y-2">
            <p className="text-3xl font-bold tracking-tight">{BRAND_NAME}</p>
            <p className="text-blue-200 text-sm uppercase tracking-[0.2em]">{BRAND_TAGLINE}</p>
          </div>
          <p className="text-blue-100 text-base leading-relaxed max-w-sm">
            One workspace for sales, customer success and finance teams, built for every organization that joins.
          </p>
        </div>

        <p className="text-blue-200/60 text-sm relative z-10">© {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.</p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-6">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <BrandMark className="lg:hidden mb-4" textClassName="text-lg text-gray-900 dark:text-white" />

          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome back</h2>
            <p className="mt-1 text-gray-500 dark:text-gray-400 text-sm">Sign in to your account to continue</p>
          </div>

          <form id="login-form" name="login" onSubmit={handleSubmit} className="space-y-5" autoComplete="on">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                />
                <label htmlFor="remember" className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                  Remember me
                </label>
              </div>
              <Button
                variant="link"
                type="button"
                className="px-0 text-sm text-blue-600"
                onClick={() => toast.info('Ask your administrator to set a temporary password for you from Employee Management.')}
              >
                Forgot password?
              </Button>
            </div>

            <Button 
              type="submit" 
              className="w-full h-11 text-base font-semibold gap-2"
              disabled={isLoggingIn}
            >
              {isLoggingIn ? 'Signing in...' : 'Sign In'}
              {!isLoggingIn && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            New to the platform?{' '}
            <Link to="/signup" className="font-medium text-blue-600 hover:underline">
              Create an organization
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
}