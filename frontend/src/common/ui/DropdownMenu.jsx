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
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="flex items-center justify-center rounded-lg p-1.5 text-text-muted transition-colors hover:bg-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        {trigger || <MoreVertical className="h-4 w-4" />}
      </button>

      {isOpen && createPortal(
        <div
          id="dropdown-portal-menu"
          style={{
            position: 'fixed',
            top: `${coords.top + 4}px`,
            left: align === 'right' ? `${coords.right}px` : `${coords.left}px`,
            transform: align === 'right' ? 'translateX(-100%)' : 'none',
          }}
          className={twMerge(
            clsx(
              "bg-surface-overlay border border-border rounded-xl shadow-lg py-1 z-[9999] animate-slide-in-top min-w-[140px] text-body-sm"
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

export function DropdownItem({ children, className, onClick, destructive = false, ...props }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={twMerge(
        clsx(
          "block w-full text-left px-4 py-2 font-medium transition-colors text-body-md whitespace-nowrap rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50",
          destructive 
            ? "text-danger-700 hover:bg-danger-50" 
            : "text-text-primary hover:bg-secondary/80",
          className
        )
      )}
      {...props}
    >
      {children}
    </button>
  );
}
