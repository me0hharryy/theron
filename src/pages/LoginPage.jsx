import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

const LoginPage = () => {
  // Demo credentials - CHANGE FOR PRODUCTION or remove defaults
  const [email, setEmail] = useState('owner@business.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); // Clear previous errors
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Redirect is handled automatically by PrivateRoute/PublicRoute via AuthContext state change
    } catch (err) {
      console.error("Login failed:", err.code, err.message);
      // Provide more user-friendly error messages based on Firebase error codes
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
      setLoading(false); // Ensure loading stops whether success or fail
    }
  };

  return (
    // DIRECTLY APPLIED THEME: Light off-white bg, Teal logo, Medium Gray text
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8F9FA] p-4">
      <div className="mb-8 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-wider text-[#44BBA4]">THERON</h1>
        <p className="mt-2 text-[#6C757D]">Tailoring Business Management</p>
      </div>
      <Card className="w-full max-w-sm">
        <form onSubmit={handleLogin} className="space-y-5"> {/* Slightly increased spacing */}
          <h2 className="text-xl font-semibold text-center text-[#393E41]">Login</h2> {/* Dark Gray */}
          <Input
            id="email"
            type="email"
            label="Email Address" // Changed label
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email" // Added autocomplete hint
           />
          <Input
            id="password"
            type="password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password" // Added autocomplete hint
          />
          {error && <p className="text-sm text-center text-red-600">{error}</p>} {/* Default red */}
          <Button type="submit" variant="primary" className="w-full !mt-6" disabled={loading}> {/* Increased top margin */}
            {loading ? 'Signing In...' : 'Sign In'}
          </Button>
        </form>
      </Card>
       {/* Demo login info */}
       <p className="mt-6 text-sm text-[#6C757D]"></p>
    </div>
  );
};
export default LoginPage;