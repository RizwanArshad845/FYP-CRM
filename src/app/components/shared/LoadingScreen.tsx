import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
  fullScreen?: boolean;
}

export function LoadingScreen({ message = "Loading specialized content...", fullScreen = true }: LoadingScreenProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 ${fullScreen ? 'fixed inset-0 min-h-screen bg-background/80 backdrop-blur-md z-[100]' : 'w-full min-h-[400px]'}`}>
      <div className="relative">
        {/* Outer Glow */}
        <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 animate-pulse" />
        
        {/* Animated Rings */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="relative w-24 h-24 border-t-2 border-b-2 border-l-2 border-primary rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/20"
        >
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-t-2 border-r-2 border-primary/30 rounded-full shadow-md"
          />
        </motion.div>
        
        {/* Static Icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-8 text-center"
      >
        <p className="text-xl font-bold tracking-tight text-foreground bg-clip-text text-transparent ">
          {message}
        </p>
        <p className="text-sm text-muted-foreground mt-2 font-medium">
          Please wait while we prepare your workspace
        </p>
      </motion.div>

      {/* Decorative Dots */}
      <div className="mt-6 flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
            className="w-1.5 h-1.5 rounded-full bg-primary"
          />
        ))}
      </div>
    </div>
  );
}
