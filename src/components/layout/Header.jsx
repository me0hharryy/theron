import React, { Fragment, useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { auth } from '../../firebase';
import { signOut } from 'firebase/auth';
import { Link, useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { Menu, Transition } from '@headlessui/react';
import { 
  FiMenu, 
  FiUser, 
  FiLogOut, 
  FiCalendar,        // Icon for new Date display
} from 'react-icons/fi';

// Helper function to format the date
const getFormattedDate = () => {
  const date = new Date();
  // Formats to "Sun, 26 Oct"
  return date.toLocaleDateString('en-GB', { 
    weekday: 'short', 
    day: 'numeric', 
    month: 'short' 
  });
};

const Header = ({ toggleSidebar }) => { 
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(getFormattedDate());

  // Effect to update the date in case the user leaves the app open overnight
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(getFormattedDate());
    }, 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  const handleLogout = async () => {
      try {
          await signOut(auth);
      } catch (error) {
          console.error("Logout failed:", error);
          alert("Logout failed. Please try again.");
      }
  };

  return (
    <header className="flex h-16 w-full flex-shrink-0 items-center justify-between border-b border-[#E0E0E0] bg-[#FFFFFF] px-4 md:px-8">
      
      {/* Left Side: Sidebar Toggle (Mobile) & Date (Desktop) */}
      <div className="flex items-center gap-3">
        {/* Sidebar Toggle: Mobile Only */}
        <button
          onClick={toggleSidebar}
          className="rounded-full p-2 text-[#393E41] hover:bg-gray-100 md:hidden"
          aria-label="Toggle sidebar"
        >
          <FiMenu size={22} />
        </button>
        
        {/* Date Display: Desktop Only (md and up) */}
        <div className="hidden items-center gap-2 rounded-md bg-gray-50 px-3 py-1.5 text-sm font-medium text-[#393E41] md:flex">
          <FiCalendar size={16} className="text-[#44BBA4]" />
          <span>{currentDate}</span>
        </div>
      </div>

      {/* Right Side: User Menu */}
      <div className="flex items-center gap-2 md:gap-4">
        
        {/* User Dropdown Menu */}
        <Menu as="div" className="relative">
          <Menu.Button className="flex rounded-full p-2 text-[#393E41] hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#44BBA4] focus:ring-offset-2">
            <span className="sr-only">Open user menu</span>
            <FiUser size={20} />
          </Menu.Button>
          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-99"
          >
            <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
              <div className="py-1">
                <div className="border-b border-gray-100 px-4 py-3">
                  <p className="text-xs text-gray-500">Signed in as</p>
                  <p className="truncate text-sm font-medium text-gray-900">
                    {userData?.name || 'User'}
                  </p>
                </div>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={handleLogout}
                      className={`${
                        active ? 'bg-red-500 text-white' : 'text-gray-900'
                      } group flex w-full items-center rounded-md px-4 py-2 text-sm`}
                    >
                      <FiLogOut className="mr-2 h-5 w-5" aria-hidden="true" />
                      Logout
                    </button>
                  )}
                </Menu.Item>
              </div>
            </Menu.Items>
          </Transition>
        </Menu>
      </div>
    </header>
  );
};

Header.propTypes = {
  toggleSidebar: PropTypes.func.isRequired,
};

export default Header;