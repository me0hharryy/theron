import React from 'react';
// DIRECTLY APPLIED THEME: Teal border
const Spinner = () => (
    <div className="flex h-full w-full items-center justify-center" aria-label="Loading">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-[#44BBA4]"></div> {/* Teal */}
    </div>
);
export default Spinner;