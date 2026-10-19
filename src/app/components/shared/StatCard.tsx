import { ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '../ui/utils';

export type StatTone = 'primary' | 'indigo' | 'success' | 'warning' | 'danger' | 'navy';

// Icon tile colours per tone (light and dark mode come from the tokens)
const TONES: Record<StatTone, string> = {
    primary: 'bg-primary-soft text-primary',
    indigo: 'bg-[#e6ebfb] text-[#3d5bb0] dark:bg-[#26325a] dark:text-[#9db6ee]',
    success: 'bg-success-bg text-success',
    warning: 'bg-warning-bg text-warning',
    danger: 'bg-danger-bg text-danger',
    navy: 'bg-[#e8ebf2] text-navy dark:bg-navy-active dark:text-white',
};

interface StatCardProps {
    icon: ReactNode;
    title: string;
    value: string | number;
    subtitle?: string;
    valueClassName?: string;
    trend?: { value: number; label?: string };
    /** Colour of the icon tile */
    tone?: StatTone;
    /** Makes the whole card a link-like button */
    onClick?: () => void;
    /** Kept for older callers; the tone decides the colour now */
    accentColor?: string;
}

// Metric card: label and icon on top, the number large, context underneath.
export function StatCard({ icon, title, value, subtitle, valueClassName, trend, tone = 'primary', onClick }: StatCardProps) {
    const body = (
        <>
            <div className="flex items-start justify-between gap-3">
                <p className="text-[13px] font-medium text-muted-foreground">{title}</p>
                <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] [&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:text-current', TONES[tone])}>
                    {icon}
                </span>
            </div>
            <div className={cn('mt-2 text-[26px] font-bold leading-tight tracking-tight text-foreground', valueClassName)}>{value}</div>
            <div className="mt-1.5 flex items-center gap-2">
                {trend && (
                    <span className={cn('inline-flex items-center gap-1 rounded-[12px] px-2 py-0.5 text-xs',
                        trend.value >= 0 ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger')}>
                        {trend.value >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {trend.value >= 0 ? '+' : ''}{trend.value}%
                    </span>
                )}
                {subtitle && <p className="text-[12.5px] text-muted-foreground">{subtitle}</p>}
            </div>
        </>
    );

    const shell = 'block w-full rounded-[12px] border border-border bg-card p-5 text-left';
    if (onClick) {
        return (
            <button type="button" onClick={onClick} className={cn(shell, 'cursor-pointer transition-colors duration-150 hover:border-primary/40 hover:bg-primary-soft/40 focus-visible:outline-2 focus-visible:outline-primary')}>
                {body}
            </button>
        );
    }
    return <div className={shell}>{body}</div>;
}
