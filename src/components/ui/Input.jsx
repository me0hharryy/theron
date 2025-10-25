// src/components/ui/Input.jsx
import React from 'react';
import PropTypes from 'prop-types'; // Import PropTypes

// DIRECTLY APPLIED THEME: Using hex codes
const Input = React.forwardRef(({ id, type, placeholder, value, onChange, label, className = '', ...props }, ref) => ( // Added ...props
  <div className="w-full">
    {label && <label htmlFor={id} className="mb-2 block text-sm font-medium text-[#6C757D]">{label}</label>} {/* Medium Gray */}
    <input
      ref={ref}
      id={id}
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      // Pass down any other props like 'name', 'required', 'min', 'step', etc.
      {...props}
      className={`w-full rounded-md border border-[#E0E0E0] bg-[#FFFFFF] px-3 py-2 text-[#393E41] placeholder-gray-400 focus:border-[#44BBA4] focus:outline-none focus:ring-1 focus:ring-[#44BBA4] disabled:bg-gray-100 disabled:opacity-70 ${className}`} /> {/* Added disabled styles */}
  </div>
));

// Add displayName for better debugging
Input.displayName = 'Input';

// Add PropTypes for better component usage validation
Input.propTypes = {
  id: PropTypes.string.isRequired,
  type: PropTypes.string,
  placeholder: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func,
  label: PropTypes.string,
  className: PropTypes.string,
};

// Set default prop values
Input.defaultProps = {
  type: 'text',
  placeholder: '',
  value: '',
  onChange: () => {},
  label: '',
  className: '',
};

export default Input;