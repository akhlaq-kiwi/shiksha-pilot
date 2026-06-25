import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from './button';

export const Dialog = ({ isOpen, onClose, title, description, children, footer, className = '' }) => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* Dialog Content */}
      <div className={`relative z-10 w-full max-w-lg rounded-lg border border-border bg-surface text-text-primary shadow-lg transition-all transform duration-300 scale-100 flex flex-col max-h-[90vh] ${className}`}>
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-5">
          <div>
            <h3 className="text-lg font-bold font-display">{title}</h3>
            {description && <p className="text-xs text-text-muted mt-1">{description}</p>}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
        
        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-border p-4 bg-background/50 rounded-b-lg">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
