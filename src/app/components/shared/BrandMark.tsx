import { cn } from '../ui/utils';

export const BRAND_NAME = 'AICRE';
export const BRAND_TAGLINE = 'AI Integrated Client Relations Engine';

// The AICRE logo mark (same artwork as public/favicon.svg), inline so it inherits sizing.
export function BrandLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('h-8 w-8 shrink-0', className)} role="img" aria-label={BRAND_NAME}>
      <defs>
        <linearGradient id="aicre-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4f46e5" />
          <stop offset="1" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#aicre-g)" />
      <path d="M32 13 L49 51 H41.5 L38 43 H26 L22.5 51 H15 Z M28.6 37 H35.4 L32 28.8 Z" fill="#fff" />
      <circle cx="47" cy="17" r="4" fill="#fff" opacity="0.9" />
    </svg>
  );
}

// Logo + wordmark
export function BrandMark({ className, logoClassName, textClassName }: {
  className?: string;
  logoClassName?: string;
  textClassName?: string;
}) {
  return (
    <span className={cn('flex items-center gap-3', className)}>
      <BrandLogo className={logoClassName} />
      <span className={cn('font-bold tracking-tight', textClassName)}>{BRAND_NAME}</span>
    </span>
  );
}
