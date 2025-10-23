import React from 'react';

const Button = ({ children, onClick, variant = 'primary', className = '', type = 'button', disabled = false }) => {
  const baseClasses = 'px-4 py-2 rounded-md font-semibold text-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  // DIRECTLY APPLIED THEME: Using hex codes in arbitrary values
  const variants = {
    primary: 'bg-[#44BBA4] text-white hover:bg-[#3aa18e] focus:ring-[#44BBA4]', // Teal
    secondary: 'bg-[#E9E8E5] text-[#393E41] hover:bg-[#D3D0CB] focus:ring-[#D3D0CB]', // Light Gray derived/actual
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500', // Kept default red for danger
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

export default Button;