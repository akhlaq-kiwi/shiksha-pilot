import React, { createContext, useContext } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const TabsContext = createContext(null);

export const Tabs = ({ value, onValueChange, children, className = '' }) => {
  return (
    <TabsContext.Provider value={{ activeValue: value, onValueChange }}>
      <div className={twMerge('w-full', className)}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

export const TabsList = ({ children, className = '' }) => {
  return (
    <div className={twMerge('inline-flex h-10 items-center justify-center rounded-md bg-background p-1 text-text-secondary border border-border/50', className)}>
      {children}
    </div>
  );
};

export const TabsTrigger = ({ value, children, className = '' }) => {
  const { activeValue, onValueChange } = useContext(TabsContext);
  const isActive = activeValue === value;
  
  return (
    <button
      type="button"
      onClick={() => onValueChange(value)}
      className={twMerge(
        clsx(
          'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
          isActive 
            ? 'bg-surface text-text-primary shadow-xs border border-border/20' 
            : 'hover:text-text-primary hover:bg-surface/30'
        ),
        className
      )}
    >
      {children}
    </button>
  );
};

export const TabsContent = ({ value, children, className = '' }) => {
  const { activeValue } = useContext(TabsContext);
  if (activeValue !== value) return null;
  
  return (
    <div className={twMerge('mt-4 focus-visible:outline-none', className)}>
      {children}
    </div>
  );
};
