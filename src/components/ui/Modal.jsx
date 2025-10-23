import React from 'react';
import { createPortal } from 'react-dom';

const CloseIcon = () => (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  // Ensure the portal target exists, create if not (useful for testing/SSR)
  let portalRoot = document.getElementById('modal-root');
  if (!portalRoot) {
    portalRoot = document.createElement('div');
    portalRoot.setAttribute('id', 'modal-root');
    document.body.appendChild(portalRoot);
  }


  return createPortal(
    // DIRECTLY APPLIED THEME: Using hex codes
    // Overlay: click outside to close
    <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 transition-opacity duration-300 ease-in-out"
        onClick={onClose} // Close when clicking overlay
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
    >
      {/* Modal Content: stop propagation to prevent closing when clicking inside */}
      <div
        className="m-4 w-full max-w-lg rounded-lg bg-[#FFFFFF] shadow-xl transform transition-all duration-300 ease-in-out scale-95 opacity-0 animate-fade-in-scale" // White bg, add animation classes
        onClick={e => e.stopPropagation()} // Prevent closing modal when clicking inside
        role="document"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E0E0E0] p-4"> {/* Light border */}
          <h3 id="modal-title" className="text-xl font-semibold text-[#393E41]">{title}</h3> {/* Dark text */}
          <button
            onClick={onClose}
            className="text-[#6C757D] hover:text-[#393E41] focus:outline-none focus:ring-2 focus:ring-[#D3D0CB] rounded-full p-1" // Medium gray hover dark gray, focus ring
            aria-label="Close modal"
          >
            <CloseIcon />
          </button>
        </div>
        {/* Body */}
        <div className="p-6">
            {children}
        </div>
      </div>
       {/* Simple animation keyframes (add to index.css if preferred) */}
       <style jsx global>{`
        @keyframes fade-in-scale {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in-scale {
          animation: fade-in-scale 0.2s ease-out forwards;
        }
      `}</style>
    </div>,
    portalRoot // Render into the portal target
  );
};

// Add default prop types for better component usage (optional but recommended)
import PropTypes from 'prop-types';
Modal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    title: PropTypes.string,
    children: PropTypes.node.isRequired,
};


export default Modal;
