import type { ReactNode } from 'react';
import { BrandMark } from '../../components/shared/BrandMark';

// Shared frame for the pre-dashboard setup screens (signup, wizard, password change).
export function SetupShell({ title, subtitle, children, wide = false }: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background flex flex-col">
      <header
        className="text-white"
        style={{ background: '#1a237e', backgroundImage: 'radial-gradient(circle at top right, #283593, #1a237e)' }}
      >
        <div className="mx-auto max-w-5xl px-6 py-5">
          <BrandMark logoClassName="h-9 w-9" textClassName="text-lg" />
        </div>
      </header>
      <main className={`mx-auto w-full px-6 py-10 ${wide ? 'max-w-5xl' : 'max-w-xl'}`}>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-600 dark:text-muted-foreground">{subtitle}</p>}
        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}
