import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Spinner from '../ui/Spinner';

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Show spinner while checking auth status
  if (loading) {
    // DIRECTLY APPLIED THEME: Light off-white bg
    return (
        <div className="flex h-screen w-full items-center justify-center bg-[#F8F9FA]">
            <Spinner />
        </div>
     );
  }

  // If loading is finished and user IS logged in, redirect away from public route (e.g., login)
  if (user) {
    // Redirect to the page they came from, or default to dashboard
    const from = location.state?.from?.pathname || '/dashboard';
    return <Navigate to={from} replace />;
  }

  // If loading is finished and no user, render the public child component (e.g., Login page)
  return children;
};

export default PublicRoute;