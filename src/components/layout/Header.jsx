import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { auth } from '../../firebase';
import { signOut } from 'firebase/auth';
import Button from '../ui/Button';

const Header = () => {
  const { userData } = useAuth();

  return (
    <header className="flex h-16 w-full items-center justify-between border-b border-border-color bg-card px-8">
      <h1 className="text-xl font-semibold text-text-primary">Welcome, {userData?.name || 'User'}</h1>
      <div className="flex items-center gap-4">
        <span className="text-sm text-text-secondary">Role: <span className="font-semibold capitalize text-primary">{userData?.role}</span></span>
        <Button onClick={() => signOut(auth)} variant="secondary">Logout</Button>
      </div>
    </header>
  );
};

export default Header;
