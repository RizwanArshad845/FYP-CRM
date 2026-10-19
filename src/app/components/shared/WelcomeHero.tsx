import { ReactNode } from 'react';
import { type PortalTheme } from '../../styles/portal-themes';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../ui/utils';

export interface HeroMetric {
    label: string;
    value: ReactNode;
    /** Highlights a number that needs attention */
    alert?: boolean;
}

interface WelcomeHeroProps {
    theme?: PortalTheme;
    title?: string;
    description?: string;
    metrics?: HeroMetric[];
    /** Extra content under the description, e.g. buttons */
    children?: ReactNode;
}

const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

// Opening banner of a portal: greeting, what the page is for, and its key numbers,
// on the navy-to-blue brand band.
export function WelcomeHero({ title, description, metrics = [], children }: WelcomeHeroProps) {
    const { user } = useAuth();
    return (
        <section
            className="relative mb-6 overflow-hidden rounded-[14px] px-6 py-6 text-white sm:px-8"
            style={{ background: 'linear-gradient(115deg, #1e2a44 0%, #2f4170 55%, #3a62c4 100%)' }}
        >
            {/* quiet arcs on the right, the only decoration */}
            <svg aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-[340px] w-[340px] opacity-[0.14]" viewBox="0 0 200 200" fill="none">
                <circle cx="100" cy="100" r="60" stroke="#fff" strokeWidth="1" />
                <circle cx="100" cy="100" r="80" stroke="#fff" strokeWidth="1" />
                <circle cx="100" cy="100" r="99" stroke="#fff" strokeWidth="1" />
            </svg>
            <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                    <p className="text-[13px] text-[#c9d6f2]">{greeting()}{user?.first_name ? `, ${user.first_name}` : ''}</p>
                    {title && <h2 className="mt-1 text-[22px] font-bold leading-tight tracking-tight text-white">{title}</h2>}
                    {description && <p className="mt-1 max-w-xl text-[14px] text-white/75">{description}</p>}
                    {children}
                </div>
                {metrics.length > 0 && (
                    <dl className="flex shrink-0 flex-wrap gap-3">
                        {metrics.map((m) => (
                            <div key={m.label} className="min-w-[112px] rounded-[10px] bg-white/10 px-4 py-3 ring-1 ring-white/15">
                                <dt className="text-[12px] text-[#c9d6f2]">{m.label}</dt>
                                <dd className={cn('mt-0.5 text-[24px] font-bold leading-tight', m.alert ? 'text-[#ffd27a]' : 'text-white')}>{m.value}</dd>
                            </div>
                        ))}
                    </dl>
                )}
            </div>
        </section>
    );
}
