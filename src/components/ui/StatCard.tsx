import type { ReactNode } from "react";

interface StatCardProps {
    title: string;
    value: string;
    hint?: string;
    icon?: ReactNode;
}

export function StatCard({ title, value, hint, icon }: StatCardProps) {
    return (
        <div className="card stat-card">
            <div className="stat-top">
                <span className="stat-title">{title}</span>
                <span>{icon}</span>
            </div>
            <div className="stat-value">{value}</div>
            {hint ? <div className="stat-hint">{hint}</div> : null}
        </div>
    );
}