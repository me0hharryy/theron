import React from 'react';
import PropTypes from 'prop-types';

// DIRECTLY APPLIED THEME & STYLE IMPROVEMENT
const Select = ({ id, value = "", onChange, label, children, className = '', ...props }) => (
  <div className="w-full relative"> {/* Added relative positioning */}
    {label && <label htmlFor={id} className="mb-2 block text-sm font-medium text-[#6C757D]">{label}</label>}
    <select
        id={id}
        name={props.name || id}
        value={value}
        onChange={onChange}
        // Added appearance-none, padding-right for arrow space, background styles for arrow
        className={`w-full appearance-none rounded-md border border-[#E0E0E0] bg-[#FFFFFF] px-3 py-2 pr-8 text-[#393E41] focus:border-[#44BBA4] focus:outline-none focus:ring-1 focus:ring-[#44BBA4] disabled:bg-gray-100 disabled:cursor-not-allowed ${className}`}
        {...props}
    >
        {children}
    </select>
    {/* Simple background arrow */}
    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#6C757D] top-[2.1rem] sm:top-auto"> {/* Adjusted top offset */}
        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
        </svg>
    </div>
  </div>
);

Select.propTypes = {
    id: PropTypes.string.isRequired,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    onChange: PropTypes.func,
    label: PropTypes.string,
    children: PropTypes.node.isRequired,
    className: PropTypes.string,
    name: PropTypes.string,
};

export default Select;