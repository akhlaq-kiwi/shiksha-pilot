import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function DropdownMenu({ trigger, children, align = 'right' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, right: 0 });
  const containerRef = useRef(null);

  const toggle = (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setCoords({
      top: rect.bottom,
      left: rect.left,
      right: rect.right
    });
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        const portalMenu = document.getElementById('dropdown-portal-menu');
        if (portalMenu && portalMenu.contains(event.target)) {
          return;
        }
        setIsOpen(false);
      }
    };
    
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleScroll = () => {
      setIsOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);

    if (isOpen) {
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleScroll);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block text-left font-sans" ref={containerRef}>
      {React.isValidElement(trigger) && trigger.type === 'button' ? (
        React.cloneElement(trigger, {
          onClick: (e) => {
            if (trigger.props.onClick) trigger.props.onClick(e);
            toggle(e);
          },
          'aria-haspopup': 'menu',
          'aria-expanded': isOpen
        })
      ) : (
        <button
          type="button"
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          className="flex items-center justify-center rounded-lg p-1.5 text-text-muted transition-colors hover:bg-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          {trigger || <MoreVertical className="h-4 w-4" />}
        </button>
      )}

      {isOpen && createPortal(
        <div
          id="dropdown-portal-menu"
          style={{
            position: 'fixed',
            top: `${coords.top + 4}px`,
            ...(align === 'right'
              ? { right: `${Math.max(0, window.innerWidth - coords.right)}px` }
              : { left: `${coords.left}px` }),
          }}
          className={twMerge(
            clsx(
              "bg-white dark:bg-slate-900 border border-border rounded-xl shadow-xl py-1 z-[9999] animate-in fade-in zoom-in-95 duration-100 min-w-[150px] text-body-sm"
            )
          )}
        >
          {React.Children.map(children, (child) => {
            if (React.isValidElement(child)) {
              return React.cloneElement(child, {
                onClick: (e) => {
                  e.stopPropagation();
                  if (child.props.disabled) return;
                  if (child.props.onClick) {
                    child.props.onClick(e);
                  }
                  setIsOpen(false);
                },
              });
            }
            return child;
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

export function DropdownItem({ children, className, onClick, destructive = false, disabled = false, title, ...props }) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      className={twMerge(
        clsx(
          "block w-full text-left px-4 py-2 font-medium transition-colors text-body-md whitespace-nowrap rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50",
          disabled 
            ? "opacity-40 cursor-not-allowed text-text-muted hover:bg-transparent" 
            : destructive 
              ? "text-danger-700 hover:bg-danger-50 cursor-pointer" 
              : "text-text-primary hover:bg-secondary/80 cursor-pointer",
          className
        )
      )}
      {...props}
    >
      {children}
    </button>
  );
}
