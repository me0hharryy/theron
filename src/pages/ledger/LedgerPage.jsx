import React, { useState, useMemo } from 'react';
import { db, getCollectionPath } from '../../firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { useData } from '../../context/DataContext';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';

const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;

const LedgerPage = () => {
  const { transactions, transactionsLoading } = useData(); // Corrected hook usage
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTransaction, setNewTransaction] = useState({ description: '', amount: '' });
  const [isSaving, setIsSaving] = useState(false);

  // Calculate balance using useMemo
  const balance = useMemo(() => {
    if (!transactions || transactions.length === 0) return 0;
    // Ensure amount is treated as a number
    return transactions.reduce((acc, t) => {
        const amount = Number(t.amount) || 0; // Convert to number, default to 0 if invalid
        return acc + (t.type === 'Income' ? amount : -amount);
     }, 0);
  }, [transactions]); // Recalculate only when transactions change

  // Handle saving a new expense
  const handleSaveExpense = async (e) => {
    e.preventDefault();
    // Basic validation
    if (!newTransaction.description || !newTransaction.amount || Number(newTransaction.amount) <= 0) {
        alert("Please enter a valid description and positive amount.");
        return;
    }

    setIsSaving(true);
    try {
        const collectionPath = getCollectionPath('transactions'); // Get path safely
        await addDoc(collection(db, collectionPath), {
            date: Timestamp.now(), // Use server timestamp
            type: 'Expense',
            description: newTransaction.description.trim(), // Trim whitespace
            amount: Number(newTransaction.amount) // Ensure amount is saved as number
        });
        setIsModalOpen(false); // Close modal on success
        setNewTransaction({ description: '', amount: '' }); // Reset form
    } catch (error) {
        console.error("Error saving expense:", error);
        alert("Failed to save expense. Please check console for details.");
    } finally {
        setIsSaving(false); // Stop saving indicator
    }
  };

  // Format currency helper
  const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);

  // Format date helper
  const formatDate = (timestamp) => {
      if (timestamp && typeof timestamp.toDate === 'function') {
          return timestamp.toDate().toLocaleDateString('en-GB'); // Format as DD/MM/YYYY
      }
      return 'Invalid Date';
  };


  return (
    // DIRECTLY APPLIED THEME: Using hex codes
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold text-[#393E41]">Ledger</h1> {/* Dark Gray */}
        <p className="mt-1 text-sm md:text-base text-[#6C757D]">Track all income and expenses.</p> {/* Medium Gray */}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
            <h3 className="text-sm font-medium text-[#6C757D]">Current Balance</h3> {/* Medium Gray */}
            <p className={`mt-2 text-2xl md:text-3xl font-semibold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}> {/* Default red/green */}
                {formatCurrency(balance)}
            </p>
        </Card>
        <div className="md:col-span-2 flex items-center justify-end">
            <Button onClick={() => setIsModalOpen(true)} variant="primary" className="flex items-center gap-2">
                <PlusIcon /> Add Expense Entry
            </Button>
        </div>
      </div>

      <Card>
        <h2 className="text-xl font-semibold mb-4 text-[#393E41]">Transaction History</h2>
        {transactionsLoading ? (
          <div className="py-16 flex justify-center"><Spinner /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left"> {/* Added min-width */}
              {/* DIRECTLY APPLIED THEME: Light border, medium gray header text */}
              <thead className="border-b-2 border-[#E0E0E0] bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-sm font-semibold uppercase text-[#6C757D] tracking-wider">Date</th>
                  <th className="px-4 py-3 text-sm font-semibold uppercase text-[#6C757D] tracking-wider">Description</th>
                  <th className="px-4 py-3 text-sm font-semibold uppercase text-[#6C757D] tracking-wider">Type</th>
                  <th className="px-4 py-3 text-sm font-semibold uppercase text-[#6C757D] tracking-wider text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E0E0]"> {/* Light border */}
                {transactions && transactions.length > 0 ? transactions.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50 text-sm"> {/* Reduced text size */}
                    <td className="px-4 py-3 whitespace-nowrap text-[#393E41]">{formatDate(t.date)}</td> {/* Dark Gray */}
                    <td className="px-4 py-3 text-[#393E41] max-w-xs truncate">{t.description || 'N/A'}</td> {/* Dark Gray, truncate long descriptions */}
                    <td className="px-4 py-3">
                      {/* Default status colors */}
                      <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full ${t.type === 'Income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {t.type || 'N/A'}
                      </span>
                    </td>
                    {/* Default red/green */}
                    <td className={`px-4 py-3 text-right font-mono ${t.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                      {t.type === 'Income' ? '+' : '-'} {formatCurrency(t.amount)}
                    </td>
                  </tr>
                )) : (
                   <tr><td colSpan="4" className="py-10 text-center text-[#6C757D]">No transactions recorded yet.</td></tr> // Medium Gray
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal uses theme colors via component */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Expense">
        <form onSubmit={handleSaveExpense} className="space-y-4">
          <Input label="Description" id="description" value={newTransaction.description} onChange={e => setNewTransaction({ ...newTransaction, description: e.target.value })} required/>
          <Input label="Amount (₹)" id="amount" type="number" value={newTransaction.amount} onChange={e => setNewTransaction({ ...newTransaction, amount: e.target.value })} required min="0.01" step="0.01"/>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" onClick={() => setIsModalOpen(false)} variant="secondary">Cancel</Button>
            <Button type="submit" variant="primary" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Expense'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default LedgerPage;