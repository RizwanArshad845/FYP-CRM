import { ReactNode } from 'react';
import { Card, CardContent } from '../ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
    icon: ReactNode;
    title: string;
    value: string | number;
    subtitle?: string;
    valueClassName?: string;
    trend?: { value: number; label?: string };
    accentColor?: string;
}

export function StatCard({ icon, title, value, subtitle, valueClassName, trend, accentColor }: StatCardProps) {
    return (
        <Card className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border-border/50">
            {/* Top accent bar with glow */}
            {accentColor && (
                <>
                    <div className="absolute top-0 left-0 right-0 h-1 rounded-t-lg" style={{ backgroundColor: accentColor }} />
                    <div className="absolute top-0 left-0 right-0 h-8 opacity-[0.06] pointer-events-none" style={{ background: `linear-gradient(to bottom, ${accentColor}, transparent)` }} />
                </>
            )}
            <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between mb-3">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-muted/80 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                        {icon}
                    </div>
                    {trend && (
                        <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                            trend.value >= 0
                                ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                            {trend.value >= 0 ? (
                                <TrendingUp className="h-3 w-3" />
                            ) : (
                                <TrendingDown className="h-3 w-3" />
                            )}
                            {trend.value >= 0 ? '+' : ''}{trend.value}%
                        </div>
                    )}
                </div>
                <p className="text-xs font-medium text-muted-foreground mb-1">{title}</p>
                <div className={`text-2xl font-bold tracking-tight ${valueClassName ?? ''}`}>{value}</div>
                {subtitle && <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>}
            </CardContent>
        </Card>
    );
}
