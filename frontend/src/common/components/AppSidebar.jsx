import React from 'react';

const AppSidebar = ({ navItems = [], currentPage, onNavigate }) => {
  return (
    <aside className="hidden md:flex flex-col w-56 lg:w-64 flex-shrink-0 border-r border-border bg-surface min-h-full">
      <nav className="flex flex-col gap-1 p-3 pt-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`
                flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider
                transition-all duration-150 text-left focus-visible:outline-none
                ${isActive
                  ? 'bg-primary text-surface dark:bg-primary dark:text-background shadow-xs font-extrabold'
                  : 'text-text-secondary hover:bg-secondary/70 hover:text-text-primary'
                }
              `}
            >
              {Icon && (
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              )}
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
};

export default AppSidebar;
