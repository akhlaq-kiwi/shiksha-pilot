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
    <div className={twMerge('inline-flex h-9 items-center justify-center rounded-lg bg-secondary/80 p-0.5 text-text-secondary border border-border/60', className)}>
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
          'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
          isActive 
            ? 'bg-surface text-text-primary shadow-2xs border border-border/30 font-bold' 
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
