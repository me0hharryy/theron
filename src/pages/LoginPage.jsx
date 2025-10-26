import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
// We no longer need the generic Card component, as this is a custom layout
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import logo1 from '../assets/logo1.svg'; // Correct import from assets

const LoginPage = () => {
  // Demo credentials
  const [email, setEmail] = useState('owner@business.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Redirect is handled automatically
    } catch (err) {
      console.error("Login failed:", err.code, err.message);
      let message = 'Login failed. Please check credentials.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        message = 'Invalid email or password.';
      } else if (err.code === 'auth/invalid-email') {
         message = 'Please enter a valid email address.';
      } else if (err.code === 'auth/too-many-requests') {
          message = 'Access temporarily disabled due to too many failed attempts. Please try again later.';
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // --- NEW: Artwork Image ---
  const imageUrl = 'https://images.pexels.com/photos/4621910/pexels-photo-4621910.jpeg';

  return (
    // Full-screen container to center the card
    <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA] p-4">
      
      {/* Main Card: shadow, rounded, and overflow-hidden are key */}
      <div className="flex w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-md flex-col md:flex-row">
        
        {/* Column 1: Image (Left on desktop, Top on mobile) */}
        <div 
          className="h-64 w-full bg-cover bg-center md:h-auto md:w-5/12"
          style={{ backgroundImage: `url(${imageUrl})` }}
          role="img"
          aria-label="A flat lay of tailoring equipment"
        >
          {/* This div is purely for the background image */}
        </div>

        {/* Column 2: Form (Right on desktop, Bottom on mobile) */}
        <div className="w-full p-8 md:w-7/12 lg:p-12">
          
          {/* Logo */}
          <div className="mb-8 text-center">
            <img 
              src= {logo1} 
              alt="Logo" 
              className="mx-auto h-auto w-52" // Changed w-50 to w-52 (Tailwind class)
            />
          </div>
          
          {/* Form - Removed the negative margin `mt-{-30}` */}
          <form onSubmit={handleLogin} className="space-y-5">
            
            <Input
              id="email"
              type="email"
              label="Email Address"
              value={email}
              // --- FIX was here: e.targe.value -> e.target.value ---
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Input
              id="password"
              type="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            {error && <p className="text-sm text-center text-red-600">{error}</p>}
            <Button type="submit" variant="primary" className="w-full !mt-6" disabled={loading}>
              {loading ? 'Signing In...' : 'SignIn'}
            </Button>
          </form>
        </div>
        
      </div>
    </div>
  );
};
export default LoginPage;