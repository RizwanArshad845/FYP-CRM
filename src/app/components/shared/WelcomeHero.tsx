import { ReactNode } from 'react';
import { type PortalTheme } from '../../styles/portal-themes';

interface WelcomeHeroProps {
    theme: PortalTheme;
    children: ReactNode;
}

export function WelcomeHero({ theme, children }: WelcomeHeroProps) {
    return (
        <div
            className="rounded-xl p-5 mb-6 relative overflow-hidden bg-card dark:bg-secondary/50 animate-fade-in border border-border/50 shadow-sm hover:shadow-md transition-shadow duration-300"
            style={{
                borderLeft: `4px solid ${theme.accent}`,
            }}
        >
            {/* Light mode subtle accent tint */}
            <div
                className="absolute inset-0 opacity-[0.06] dark:opacity-[0.08] pointer-events-none"
                style={{ backgroundColor: theme.accent }}
            />
            <div className="relative z-10">{children}</div>
            {/* Subtle decorative circles */}
            <div
                className="absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-[0.07] dark:opacity-[0.04]"
                style={{ backgroundColor: theme.accent }}
            />
            <div
                className="absolute -right-2 -bottom-6 h-20 w-20 rounded-full opacity-[0.05] dark:opacity-[0.03]"
                style={{ backgroundColor: theme.accent }}
            />
        </div>
    );
}
