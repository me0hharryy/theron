import React from 'react';
// DIRECTLY APPLIED THEME: Using hex codes
const Input = React.forwardRef(({ id, type, placeholder, value, onChange, label, className = '' }, ref) => (
  <div className="w-full">
    {label && <label htmlFor={id} className="mb-2 block text-sm font-medium text-[#6C757D]">{label}</label>} {/* Medium Gray */}
    <input ref={ref} id={id} type={type} placeholder={placeholder} value={value} onChange={onChange} className={`w-full rounded-md border border-[#E0E0E0] bg-[#FFFFFF] px-3 py-2 text-[#393E41] placeholder-gray-400 focus:border-[#44BBA4] focus:outline-none focus:ring-1 focus:ring-[#44BBA4] ${className}`} /> {/* Light border, white bg, dark text, teal focus */}
  </div>
));
export default Input;