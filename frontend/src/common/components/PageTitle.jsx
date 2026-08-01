import React from 'react';

const PageTitle = ({ title, subtitle, action }) => {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-bold text-text-primary font-display tracking-tight leading-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm text-text-secondary leading-relaxed">{subtitle}</p>
        )}
      </div>
      {action && (
        <div className="flex-shrink-0">{action}</div>
      )}
    </div>
  );
};

export default PageTitle;
