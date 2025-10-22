import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

const LoginPage = () => {
  const [email, setEmail] = useState('owner@theron.com');
  const [password, setPassword] = useState('password'); // Use a secure default or keep empty
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="mb-8 text-center">
        <h1 className="text-5xl font-bold tracking-wider text-primary">THERON</h1>
        <p className="mt-2 text-text-secondary">Tailoring Business Management, Perfected.</p>
      </div>
      <Card className="w-full max-w-sm">
        <form onSubmit={handleLogin} className="space-y-6">
          <h2 className="text-xl font-semibold text-center text-text-primary">Login</h2>
          <Input id="email" type="email" label="Username" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input id="password" type="password" label="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="text-sm text-center text-red-500">{error}</p>}
          <Button type="submit" variant="primary" className="w-full" disabled={loading}>{loading ? 'Signing In...' : 'Sign In'}</Button>
        </form>
      </Card>
    </div>
  );
};
export default LoginPage;
