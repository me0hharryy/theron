import React from 'react';
import { createPortal } from 'react-dom';
const CloseIcon = () => <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={onClose}>
      <div className="m-4 w-full max-w-lg rounded-lg bg-card shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border-color p-4">
          <h3 className="text-xl font-semibold text-text-primary">{title}</h3>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary"><CloseIcon /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>,
    document.body
  );
};
export default Modal;
