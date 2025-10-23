import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Spinner from '../ui/Spinner';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation(); // Get current location to redirect back after login

  // Show spinner while checking auth status
  if (loading) {
     // DIRECTLY APPLIED THEME: Light off-white bg
    return (
        <div className="flex h-screen w-full items-center justify-center bg-[#F8F9FA]">
            <Spinner />
        </div>
    );
  }

  // If loading is finished and there's no user, redirect to login
  if (!user) {
    // Pass the current location so the user can be redirected back
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If loading is finished and user exists, render the child components
  return children;
};

export default PrivateRoute;