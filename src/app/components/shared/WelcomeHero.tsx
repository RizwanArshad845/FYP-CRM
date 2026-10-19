import { ReactNode } from 'react';
import { type PortalTheme } from '../../styles/portal-themes';

interface WelcomeHeroProps {
    theme?: PortalTheme;
    children: ReactNode;
}

// Plain mockup card (plan 9.2): white, 1px border, radius 10px, no heavy shadow.
export function WelcomeHero({ children }: WelcomeHeroProps) {
    return (
        <div className="mb-6 rounded-[10px] border border-border bg-card p-5">
            {children}
        </div>
    );
}
