import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { Lock, Mail, ArrowRight, Eye, EyeOff, Waves } from 'lucide-react';
import { toast } from 'sonner';

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
      navigate('/clock-in');
    }
    
    // Load remember me
    const stored = localStorage.getItem('crm_remember_me');
    if (stored) {
      try {
        const decoded = atob(stored);
        const { storedEmail, storedPassword } = JSON.parse(decoded);
        if (storedEmail && storedPassword) {
          setEmail(storedEmail);
          setPassword(storedPassword);
          setRememberMe(true);
        }
      } catch (e) {
        console.error('Failed to parse remember me credentials');
      }
    }
  }, [user, isLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoggingIn) return;

    setIsLoggingIn(true);
    const success = await login(email, password);
    if (success) {
      if (rememberMe) {
        const encoded = btoa(JSON.stringify({ storedEmail: email, storedPassword: password }));
        localStorage.setItem('crm_remember_me', encoded);
      } else {
        localStorage.removeItem('crm_remember_me');
      }

      navigate('/clock-in');
      
      setTimeout(() => {
          window.location.reload();
      }, 100);
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

        <div className="flex items-center gap-3 relative z-10 animate-in slide-in-from-left-8 duration-700 delay-200">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl flex items-center justify-center">
            <img 
              src="branding/logo_n.png" 
              alt="N" 
              className="h-full w-full object-cover mix-blend-screen" 
              style={{ maskImage: 'radial-gradient(circle, black 80%, transparent 100%)' }}
            />
          </div>
          <span className="text-2xl font-bold tracking-tight">Nexuswave</span>
        </div>

        <div className="space-y-8 relative z-10 flex flex-col items-center text-center">
            <img 
                src="branding/nexuswave_watermark.png" 
                alt="Nexuswave BPO Marketing" 
                className="max-w-[400px] w-full h-auto object-contain opacity-60 mix-blend-screen drop-shadow-xl"
                style={{ 
                    maskImage: 'radial-gradient(circle, black 70%, transparent 100%)',
                    WebkitMaskImage: 'radial-gradient(circle, black 70%, transparent 100%)'
                }}
            />
          <p className="text-blue-100 text-base leading-relaxed max-w-sm">
            A centralised platform for sales, finance, and customer success teams to collaborate and grow.
          </p>
        </div>

        <p className="text-blue-200/60 text-sm relative z-10">© 2026 Nexuswave. All rights reserved.</p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-6">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-4">
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg">
              <img src="branding/logo_n.png" alt="N" className="h-full w-full object-cover" />
            </div>
            <span className="text-lg font-bold text-gray-900 dark:text-white">Nexuswave</span>
          </div>

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
              <Button variant="link" type="button" className="px-0 text-sm text-blue-600">
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

        </div>
      </div>
    </div>
  );
}