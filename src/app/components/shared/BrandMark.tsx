import { cn } from '../ui/utils';

export const BRAND_NAME = 'AICRE';
export const BRAND_TAGLINE = 'AI Integrated Client Relations Engine';

/**
 * The AICRE mark (same artwork as public/favicon.svg): a bold "A" whose blue crossbar is
 * the engine that links both sides, with a spark for the assistant. `onDark` lifts the
 * tile so it still reads on the navy sidebar and top bars.
 */
export function BrandLogo({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('h-8 w-8 shrink-0', className)} role="img" aria-label={BRAND_NAME}>
      <rect width="64" height="64" rx="15" fill={onDark ? '#2f4170' : '#1e2a44'} />
      <path d="M14 50 L29 17 a3.4 3.4 0 0 1 6 0 L50 50" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22.5 38.5 H41.5" stroke="#5b8def" strokeWidth="7" strokeLinecap="round" />
      <circle cx="48.5" cy="15.5" r="5" fill="#5b8def" />
    </svg>
  );
}

/** Logo and wordmark side by side */
export function BrandMark({ className, logoClassName, textClassName, onDark = false }: {
  className?: string;
  logoClassName?: string;
  textClassName?: string;
  onDark?: boolean;
}) {
  return (
    <span className={cn('flex items-center gap-[10px]', className)}>
      <BrandLogo className={logoClassName} onDark={onDark} />
      <span className={cn('font-bold tracking-[0.5px]', onDark && 'text-white', textClassName)}>{BRAND_NAME}</span>
    </span>
  );
}
