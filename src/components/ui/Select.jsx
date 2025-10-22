import React from 'react';
const Select = ({ id, value, onChange, label, children, className = '' }) => (
  <div className="w-full">
    {label && <label htmlFor={id} className="mb-2 block text-sm font-medium text-text-secondary">{label}</label>}
    <select id={id} value={value} onChange={onChange} className={`w-full rounded-md border border-border-color bg-background px-3 py-2 text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary ${className}`}>{children}</select>
  </div>
);
export default Select;
