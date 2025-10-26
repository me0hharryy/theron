import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import PropTypes from 'prop-types';

// --- Import Logos ---
import logoExpanded from '../../assets/logo1.svg'; // Assuming logo1.svg is in the public directory
import logoCollapsed from '../../assets/logo2.svg'; // Assuming logo2.svg is in the public directory

// --- Icons --- (Using react-icons/fi)
import {
    FiGrid, FiFileText, FiSettings, FiUsers, FiDollarSign, FiBarChart2,
    FiChevronsLeft, FiChevronsRight, FiTag,
} from 'react-icons/fi';

// Wrapper ensures consistent icon size and centers content vertically
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
    { name: 'Fees/Extras', path: '/fees', role: ['owner'], icon: <FiTag /> }, // Added link to fees page
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
        isCollapsed ? 'w-30 md:w-30' : 'w-64' // Adjusted collapsed width for footer
      } flex-shrink-0`} // Manage width and mobile transform
    >
      {/* Logo Section */}
       <div className={`flex h-20 flex-shrink-0 items-center px-4 ${isCollapsed ? 'justify-center ' : 'justify-start px-6'}`}>
         {isCollapsed ? (
           <img src={logoCollapsed} alt="Theron Logo Collapsed" className="h-20 w-auto" /> // Slightly smaller collapsed logo maybe
         ) : (
           <img src={logoExpanded} alt="Theron Logo Expanded" className="h-auto w-36 pt-1 " /> // Adjusted expanded logo size
         )}
       </div>

      {/* Navigation Links */}
      <nav className="mt-5 flex-1 space-y-2 overflow-y-auto overflow-x-hidden px-4">
        {menuItems
          .filter((item) => item.role.includes(userRole))
          .map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `group flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
                  isCollapsed ? 'justify-center' : '' // Center ONLY icon when collapsed
                } ${
                  isActive ? activeClass : inactiveClass
                }`
              }
              title={isCollapsed ? item.name : undefined} // Tooltip when collapsed
            >
              <IconWrapper>{item.icon}</IconWrapper>
              {!isCollapsed && <span className="ml-3 truncate flex-grow">{item.name}</span>}
            </NavLink>
          ))}
      </nav>

      {/* Footer / Trademark */}
      <div className={`px-4 pb-2 text-center text-xs text-[#6C757D] ${isCollapsed ? 'hidden' : 'block'}`}>
         Product by{' '}
         <a
           href="https://hharryy.com"
           target="_blank"
           rel="noopener noreferrer"
           className="font-medium text-[#44BBA4] hover:underline"
         >
           hharryy
         </a>
      </div>

      {/* Toggle Button */}
      <div className="flex-shrink-0 border-t border-[#E0E0E0] p-4">
        <button
          onClick={toggleSidebar}
          className={`group flex w-full items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
             inactiveClass
          } ${isCollapsed ? 'justify-center' : ''}`}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
           <span className={`h-5 w-5 flex-shrink-0 ${isCollapsed ? '' : ''}`}> {/* Removed mr-3 */}
             {isCollapsed ? <FiChevronsRight /> : <FiChevronsLeft />}
           </span>
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