import React from 'react';
const Card = ({ children, className = '' }) => <div className={`rounded-lg bg-card p-6 shadow-sm ${className}`}>{children}</div>;
export default Card;
