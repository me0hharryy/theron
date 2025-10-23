import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header'; // Header should not have the toggle button anymore

const MainLayout = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  return (
    // Main flex container
    <div className="flex h-screen overflow-hidden bg-[#F8F9FA] text-[#393E41]">

      {/* Sidebar now controls its own width via isCollapsed */}
      <Sidebar isCollapsed={isSidebarCollapsed} toggleSidebar={toggleSidebar} />

      {/* Main Content Area Wrapper */}
      <div className="flex flex-1 flex-col overflow-hidden"> {/* flex-1 takes remaining space */}
        <Header /> {/* Header doesn't need toggle prop */}

        {/* Scrollable Main Content Area */}
        {/* REMOVED dynamic pl-* classes. Flexbox should handle the layout. */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;