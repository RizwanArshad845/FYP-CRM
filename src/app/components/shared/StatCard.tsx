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

// Mockup card (plan 9.2): white, 1px border, radius 10px, no lift or glow.
export function StatCard({ icon, title, value, subtitle, valueClassName, trend }: StatCardProps) {
    return (
        <Card className="gap-0">
            <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between mb-3">
                    <div className="h-10 w-10 rounded-[8px] flex items-center justify-center bg-primary-soft text-primary">
                        {icon}
                    </div>
                    {trend && (
                        <span className={`inline-flex items-center gap-1 rounded-[12px] px-[9px] py-[3px] text-xs ${
                            trend.value >= 0 ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger'
                        }`}>
                            {trend.value >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {trend.value >= 0 ? '+' : ''}{trend.value}%
                        </span>
                    )}
                </div>
                <p className="text-xs font-medium uppercase tracking-[0.4px] text-muted-foreground mb-1">{title}</p>
                <div className={`text-2xl font-bold ${valueClassName ?? ''}`}>{value}</div>
                {subtitle && <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>}
            </CardContent>
        </Card>
    );
}
