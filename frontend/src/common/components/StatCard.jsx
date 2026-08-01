import React from 'react';
import { Card, CardContent } from '../../ui/card';

const StatCard = ({ label, value, sub, icon: Icon, color }) => {
  const iconColor = color ?? 'bg-primary/10 text-primary';

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          {Icon && (
            <div className={`flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0 ${iconColor}`}>
              <Icon className="w-5 h-5" />
            </div>
          )}
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">
              {label}
            </span>
            <span className="text-2xl font-bold text-text-primary font-display leading-tight tabular-nums">
              {value}
            </span>
            {sub && (
              <span className="text-[11px] text-text-muted leading-snug">{sub}</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StatCard;
