import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import PropTypes from 'prop-types';

// --- Icons --- (Using react-icons/fi)
import {
    FiGrid, FiFileText, FiSettings, FiUsers, FiDollarSign, FiBarChart2,
    FiChevronsLeft, FiChevronsRight
} from 'react-icons/fi';

// Wrapper ensures consistent icon size and centers content vertically
// Added: inline-flex, items-center. Removed conditional margin here.
const IconWrapper = ({ children }) => (
    <span className="inline-flex items-center justify-center h-5 w-5 flex-shrink-0">
        {children}
    </span>
);

IconWrapper.propTypes = {
    children: PropTypes.node.isRequired,
};

// Accept isCollapsed and toggleSidebar props
const Sidebar = ({ isCollapsed, toggleSidebar }) => {
  const { userData } = useAuth();

  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', role: ['owner', 'employee'], icon: <FiGrid /> },
    { name: 'Orders', path: '/orders', role: ['owner', 'employee'], icon: <FiFileText /> },
    { name: 'Masters', path: '/masters', role: ['owner'], icon: <FiSettings /> },
    { name: 'Workers', path: '/workers', role: ['owner'], icon: <FiUsers /> },
    { name: 'Ledger', path: '/ledger', role: ['owner'], icon: <FiDollarSign /> },
    { name: 'Reports', path: '/reports', role: ['owner'], icon: <FiBarChart2 /> },
  ];

  // DIRECTLY APPLIED THEME: Using hex codes for link states
  const activeClass = 'bg-[#44BBA4] text-white'; // Teal bg, white text
  const inactiveClass = 'text-[#6C757D] hover:bg-[#E9E8E5] hover:text-[#393E41]'; // Medium gray text, Lighter gray hover bg, Dark gray hover text

  const userRole = userData?.role || 'employee'; // Default role if needed

  return (
    // DIRECTLY APPLIED THEME: White bg, light border
    // Apply dynamic width, handle mobile overlay vs desktop fixed position
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-[#E0E0E0] bg-[#FFFFFF] transition-all duration-300 ease-in-out md:relative md:translate-x-0 ${
        isCollapsed ? 'w-20 -translate-x-full md:translate-x-0' : 'w-64 translate-x-0'
      } flex-shrink-0`} // Manage width and mobile transform
    >
      {/* Logo Section - Consistent height, centered when collapsed */}
       <div className={`flex h-16 flex-shrink-0 items-center px-4 ${isCollapsed ? 'justify-center' : 'justify-start px-6'}`}>
         <span className={`font-bold tracking-wider text-[#44BBA4] ${isCollapsed ? 'text-3xl' : 'text-3xl'}`}>
            {isCollapsed ? 'T' : 'THERON'}
         </span>
       </div>

      {/* Navigation Links - Improved Padding & Alignment */}
      {/* Adjusted padding px-4, space-y-2 */}
      <nav className="mt-1 flex-1 space-y-2 overflow-y-auto overflow-x-hidden px-4">
        {menuItems
          .filter((item) => item.role.includes(userRole))
          .map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                // Ensure items-center for vertical alignment
                // Conditionally add justify-center when collapsed
                `group flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
                  isCollapsed ? 'justify-center' : '' // Center ONLY icon when collapsed
                } ${
                  isActive ? activeClass : inactiveClass
                }`
              }
              title={isCollapsed ? item.name : undefined} // Tooltip when collapsed
            >
              <IconWrapper>{item.icon}</IconWrapper>
              {/* Hide text when collapsed, add margin-left when expanded */}
              {!isCollapsed && <span className="ml-3 truncate flex-grow">{item.name}</span>}
            </NavLink>
          ))}
      </nav>

      {/* Toggle Button at the bottom */}
      {/* Adjusted padding p-4 */}
      <div className="mt-auto flex-shrink-0 border-t border-[#E0E0E0] p-4">
        <button
          onClick={toggleSidebar}
          // Ensure items-center for vertical alignment
          // Conditionally add justify-center when collapsed
          className={`group flex w-full items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${ // Adjusted py
             inactiveClass // Use inactive style for the button itself
          } ${isCollapsed ? 'justify-center' : ''}`} // Center icon when collapsed
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
           {/* Icon positioning */}
           <span className={`h-5 w-5 flex-shrink-0 ${isCollapsed ? '' : 'mr-3'}`}>
             {isCollapsed ? <FiChevronsRight /> : <FiChevronsLeft />}
           </span>
           {/* Text hidden when collapsed, add margin-left when expanded */}
          {!isCollapsed && <span className="ml-3 truncate flex-grow">Collapse</span>}
        </button>
      </div>
    </aside>
  );
};

Sidebar.propTypes = {
  isCollapsed: PropTypes.bool.isRequired,
  toggleSidebar: PropTypes.func.isRequired,
};

export default Sidebar;