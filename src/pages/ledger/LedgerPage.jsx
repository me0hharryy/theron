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
  const { transactions, transactionsLoading } = useData("date");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTransaction, setNewTransaction] = useState({ description: '', amount: '' });
  const [isSaving, setIsSaving] = useState(false);
  
  const balance = useMemo(() => {
    if (!transactions) return 0;
    return transactions.reduce((acc, t) => acc + (t.type === 'Income' ? t.amount : -t.amount), 0);
  }, [transactions]);

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
        await addDoc(collection(db, getCollectionPath('transactions')), {
            date: Timestamp.now(),
            type: 'Expense',
            description: newTransaction.description,
            amount: Number(newTransaction.amount)
        });
        setIsModalOpen(false);
        setNewTransaction({ description: '', amount: '' });
    } catch (error) {
        console.error("Error saving expense:", error);
        alert("Failed to save expense.");
    } finally {
        setIsSaving(false);
    }
  };

  const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-text-primary">Ledger</h1>
        <p className="mt-1 text-text-secondary">Track all your income and expenses in one place.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
            <h3 className="text-sm font-medium text-text-secondary">Total Balance</h3>
            <p className={`mt-2 text-3xl font-semibold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(balance)}
            </p>
        </Card>
        <div className="md:col-span-2 flex items-center justify-end">
            <Button onClick={() => setIsModalOpen(true)} variant="primary" className="flex items-center gap-2">
                <PlusIcon /> Add Expense
            </Button>
        </div>
      </div>

      <Card>
        {transactionsLoading ? (
          <div className="p-16"><Spinner /></div>
        ) : (
          <table className="w-full text-left">
            <thead className="border-b-2 border-border-color bg-stone-50">
              <tr>
                <th className="px-4 py-3 text-sm font-semibold uppercase text-text-secondary tracking-wider">Date</th>
                <th className="px-4 py-3 text-sm font-semibold uppercase text-text-secondary tracking-wider">Description</th>
                <th className="px-4 py-3 text-sm font-semibold uppercase text-text-secondary tracking-wider">Type</th>
                <th className="px-4 py-3 text-sm font-semibold uppercase text-text-secondary tracking-wider text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {transactions.map(t => (
                <tr key={t.id}>
                  <td className="px-4 py-3 whitespace-nowrap">{t.date.toDate().toLocaleDateString('en-GB')}</td>
                  <td className="px-4 py-3">{t.description}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${t.type === 'Income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {t.type}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right font-mono ${t.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                    {t.type === 'Income' ? '+' : '-'} {formatCurrency(t.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!transactionsLoading && transactions.length === 0 && <p className="p-8 text-center text-text-secondary">No transactions recorded yet.</p>}
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Expense">
        <form onSubmit={handleSaveExpense} className="space-y-4">
          <Input label="Description" value={newTransaction.description} onChange={e => setNewTransaction({ ...newTransaction, description: e.target.value })} required/>
          <Input label="Amount (₹)" type="number" value={newTransaction.amount} onChange={e => setNewTransaction({ ...newTransaction, amount: e.target.value })} required min="0.01" step="0.01"/>
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