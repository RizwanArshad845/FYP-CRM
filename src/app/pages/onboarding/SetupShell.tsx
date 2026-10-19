import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { BrandMark } from '../../components/shared/BrandMark';
import { cn } from '../../components/ui/utils';

// Shared frame for the pre-dashboard setup screens (signup, wizard, password change),
// Figure 4.2 (plan 9.4): 58px navy header, then one white card.
export function SetupShell({ title, subtitle, children, headerRight, stepper, wide = true }: {
  title?: string;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Right side of the header, e.g. "Organization setup: <name>" */
  headerRight?: ReactNode;
  stepper?: ReactNode;
  /** 900px card as in the mockup; narrow for single forms such as the password change */
  wide?: boolean;
}) {
  return (
    <div className="min-h-screen bg-brand-wash flex flex-col">
      <header className="flex h-[58px] shrink-0 items-center justify-between bg-navy px-7 text-white">
        <BrandMark onDark logoClassName="h-7 w-7" textClassName="text-[20px]" />
        {headerRight && <span className="text-[13px] text-sidebar-foreground">{headerRight}</span>}
      </header>
      <main className="px-4 pb-10">
        <div className={cn(
          'mx-auto mt-[22px] w-full rounded-[12px] border border-[#dbe3f1] bg-card px-5 py-6 shadow-[0_12px_32px_-16px_rgba(30,42,68,0.25)] sm:px-[30px] dark:border-border',
          wide ? 'max-w-[900px]' : 'max-w-[520px]',
        )}>
          {stepper}
          {title && <h2 className="mb-1 text-[19px] font-bold tracking-normal">{title}</h2>}
          {subtitle && <p className="mb-[18px] text-[13px] text-muted-foreground">{subtitle}</p>}
          {children}
        </div>
      </main>
    </div>
  );
}

export const SETUP_STEPS = ['Organization', 'Portals', 'Tier labels', 'Employees', 'Finish'] as const;

/** Five-step stepper of Figure 4.2: done (green tick), current (primary), upcoming (outline). */
export function SetupStepper({ current, canOpen, onOpen }: {
  current: number;
  canOpen?: (index: number) => boolean;
  onOpen?: (index: number) => void;
}) {
  return (
    <ol className="mb-[22px] flex justify-between">
      {SETUP_STEPS.map((label, i) => {
        const done = i < current;
        const isCurrent = i === current;
        const clickable = !isCurrent && !!onOpen && (canOpen?.(i) ?? false);
        return (
          <li key={label} className="flex-1">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => onOpen?.(i)}
              className={cn(
                'flex items-center gap-2 text-[13px] font-normal',
                done ? 'text-success' : isCurrent ? 'font-bold text-foreground' : 'text-[#8a93a3]',
                clickable ? 'cursor-pointer hover:underline' : 'cursor-default',
              )}
            >
              <i className={cn(
                'flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 text-[12px] font-bold not-italic',
                done ? 'border-success bg-success text-white'
                  : isCurrent ? 'border-primary bg-primary text-white'
                    : 'border-input-border bg-card',
              )}>
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
              </i>
              <span className={isCurrent ? '' : 'hidden sm:inline'}>{label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
