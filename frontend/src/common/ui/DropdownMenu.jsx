import React, { useState, useEffect, useRef } from 'react';
import { MoreVertical } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function DropdownMenu({ trigger, children, align = 'right' }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const toggle = (e) => {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="relative inline-block text-left font-sans" ref={containerRef}>
      <button
        type="button"
        onClick={toggle}
        className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-text-muted hover:text-text-primary transition-colors focus:outline-none flex items-center justify-center"
      >
        {trigger || <MoreVertical className="h-4 w-4" />}
      </button>

      {isOpen && (
        <div
          className={twMerge(
            clsx(
              "absolute mt-1 bg-surface border border-border rounded-xl shadow-lg py-1 z-30 animate-in fade-in slide-in-from-top-1 duration-150 min-w-[120px] text-xs",
              align === 'right' ? 'right-0' : 'left-0'
            )
          )}
        >
          {React.Children.map(children, (child) => {
            if (React.isValidElement(child)) {
              return React.cloneElement(child, {
                onClick: (e) => {
                  e.stopPropagation();
                  if (child.props.onClick) {
                    child.props.onClick(e);
                  }
                  setIsOpen(false);
                },
              });
            }
            return child;
          })}
        </div>
      )}
    </div>
  );
}

export function DropdownItem({ children, className, onClick, destructive = false, ...props }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={twMerge(
        clsx(
          "block w-full text-left px-4 py-2 font-semibold transition-colors whitespace-nowrap",
          destructive 
            ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20" 
            : "text-text-primary hover:bg-zinc-100 dark:hover:bg-zinc-900",
          className
        )
      )}
      {...props}
    >
      {children}
    </button>
  );
}
