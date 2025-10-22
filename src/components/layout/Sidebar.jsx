import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Icon = ({ children }) => <span className="mr-3 h-5 w-5">{children}</span>;

const Sidebar = () => {
  const { userData } = useAuth();

  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', role: ['owner', 'employee'], icon: '📊' },
    { name: 'Orders', path: '/orders', role: ['owner', 'employee'], icon: '📋' },
    { name: 'Masters', path: '/masters', role: ['owner'], icon: '🛠️' },
    { name: 'Workers', path: '/workers', role: ['owner'], icon: '👷' },
    { name: 'Ledger', path: '/ledger', role: ['owner'], icon: '💰' },
    { name: 'Reports', path: '/reports', role: ['owner'], icon: '📈' },
  ];

  const activeClass = 'bg-primary text-white';
  const inactiveClass = 'text-text-secondary hover:bg-stone-100 hover:text-text-primary';

  return (
    <aside className="flex w-64 flex-col border-r border-border-color bg-card p-4">
      <div className="mb-10 p-4 text-center">
        <h1 className="text-3xl font-bold tracking-wider text-primary">THERON</h1>
      </div>
      <nav className="flex-1 space-y-2">
        {menuItems
          .filter((item) => item.role.includes(userData?.role))
          .map((item) => (
            <NavLink key={item.name} to={item.path} className={({ isActive }) => `flex items-center rounded-md px-3 py-2 text-sm font-medium transition ${isActive ? activeClass : inactiveClass}`}>
              <Icon>{item.icon}</Icon>
              <span>{item.name}</span>
            </NavLink>
          ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
