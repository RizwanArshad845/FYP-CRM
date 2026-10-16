import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { AlertCircle, Home, RefreshCcw, ChevronLeft } from 'lucide-react';

interface ErrorScreenProps {
  error?: any;
  onReset?: () => void;
}

export function ErrorScreen({ error, onReset }: ErrorScreenProps) {
  const navigate = useNavigate();

  let title = "Oops! An error occurred";
  let message = "We've encountered an unexpected issue while processing your request. Please return to the login page or try refreshing the dashboard.";
  let errorCode = "500";

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = "Page Not Found";
      message = "The page you looking for doesn't exist or has been moved.";
      errorCode = "404";
    } else if (error.status === 401) {
      title = "Unauthorized";
      message = "You don't have permission to access this page.";
      errorCode = "401";
    } else if (error.status === 503) {
      title = "Service Unavailable";
      message = "Looks like our servers are having a moment. Please check back soon.";
      errorCode = "503";
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 font-sans selection:bg-indigo-500/30">
      {/* Background Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-lg"
      >
        <div className="bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl rounded-3xl p-8 md:p-12 shadow-2xl">
          {/* Icon */}
          <motion.div 
            initial={{ scale: 0.8, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
            className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-indigo-500/20"
          >
            <AlertCircle className="w-8 h-8 text-white" />
          </motion.div>

          {/* Status Code */}
          <span className="inline-block px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-bold tracking-widest uppercase mb-4 border border-indigo-500/20">
            Error {errorCode}
          </span>

          {/* Content */}
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            {title}
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed mb-10">
            {message}
          </p>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => navigate('/')}
              className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/40 active:scale-[0.98]"
            >
              <Home className="w-4 h-4" />
              Return to Login
            </button>
            <button
              onClick={() => {
                if (onReset) onReset();
                window.location.reload();
              }}
              className="flex-1 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white font-semibold py-3 px-6 rounded-xl border border-white/10 transition-all duration-300 backdrop-blur-sm active:scale-[0.98]"
            >
              <RefreshCcw className="w-4 h-4" />
              Try Again
            </button>
          </div>

          <button
            onClick={() => navigate(-1)}
            className="mt-8 flex items-center gap-2 text-gray-500 hover:text-white transition-colors group mx-auto sm:mx-0"
          >
            <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span className="text-sm font-medium">Go back to previous page</span>
          </button>
        </div>

        {/* Footer info */}
        <p className="text-center mt-8 text-gray-600 text-xs italic">
          CRM Desktop v{errorCode === "404" ? "4.0.4" : "1.0.0"} • Protected Environment
        </p>
      </motion.div>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  return <ErrorScreen error={error} />;
}
