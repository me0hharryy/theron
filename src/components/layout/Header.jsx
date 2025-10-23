import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { auth } from '../../firebase';
import { signOut } from 'firebase/auth';
import Button from '../ui/Button';
// No longer need PropTypes or toggleSidebar prop

const Header = () => { // Removed toggleSidebar prop
  const { userData } = useAuth();

  const handleLogout = async () => {
      try {
          await signOut(auth);
      } catch (error) {
          console.error("Logout failed:", error);
          alert("Logout failed. Please try again.");
      }
  };

  return (
    // DIRECTLY APPLIED THEME: White bg, light border, dark text, teal highlight
    <header className="flex h-16 w-full flex-shrink-0 items-center justify-between border-b border-[#E0E0E0] bg-[#FFFFFF] px-4 md:px-8">
      {/* Left side - Welcome Message */}
      {/* Added pl-1 to give a little space since the button is gone */}
      <h1 className="text-lg md:text-xl font-semibold text-[#39E41] truncate pl-1"> {/* Dark Gray, truncate long names */}
          Welcome, {userData?.name || 'User'}
      </h1>

      {/* Right side controls */}
      <div className="flex items-center gap-2 md:gap-4">
        {/* Role display (conditionally hide on small screens) */}
        <span className="hidden md:inline text-sm text-[#6C757D]">Role: <span className="font-semibold capitalize text-[#44BBA4]">{userData?.role || 'N/A'}</span></span> {/* Medium Gray, Teal */}
        {/* Logout Button */}
        <Button onClick={handleLogout} variant="secondary" className="text-xs md:text-sm px-3 py-1.5">Logout</Button>
      </div>
    </header>
  );
};

// Removed PropTypes related to toggleSidebar

export default Header;