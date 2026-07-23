import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from './button';

export const Dialog = ({ isOpen, onClose, title, description, children, footer, className = '', containerClassName = '' }) => {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${containerClassName}`}>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
      />
      
      {/* Dialog Content */}
      <div className={`relative z-10 w-full max-w-lg rounded-2xl border border-border bg-surface text-text-primary shadow-lg flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150 ease-out ${className}`}>
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 p-5">
          <div>
            <h3 className="text-base font-bold font-display tracking-tight">{title}</h3>
            {description && <p className="text-[11px] text-text-muted mt-1 leading-normal">{description}</p>}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 text-sm">
          {children}
        </div>
        
        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-border/40 p-4 bg-secondary/30 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

