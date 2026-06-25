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
                flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm font-medium
                transition-colors duration-100 text-left focus-visible:outline-none
                focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300
                ${isActive
                  ? 'bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900'
                  : 'text-text-secondary hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-text-primary'
                }
              `}
            >
              {Icon && (
                <Icon className="w-4 h-4 flex-shrink-0" />
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
