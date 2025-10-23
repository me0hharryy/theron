import React from 'react';
// DIRECTLY APPLIED THEME: bg-[#FFFFFF], border-[#E0E0E0] (light gray border)
const Card = ({ children, className = '' }) => <div className={`rounded-lg bg-[#FFFFFF] border border-[#E0E0E0] p-6 shadow-sm ${className}`}>{children}</div>;
export default Card;