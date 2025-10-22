import React from 'react';
const Input = React.forwardRef(({ id, type, placeholder, value, onChange, label, className = '' }, ref) => (
  <div className="w-full">
    {label && <label htmlFor={id} className="mb-2 block text-sm font-medium text-text-secondary">{label}</label>}
    <input ref={ref} id={id} type={type} placeholder={placeholder} value={value} onChange={onChange} className={`w-full rounded-md border border-border-color bg-background px-3 py-2 text-text-primary placeholder-stone-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary ${className}`} />
  </div>
));
export default Input;
