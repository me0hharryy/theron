// src/pages/ledger/LedgerPage.jsx
import React, { useState, useMemo } from 'react';
import { db, getCollectionPath } from '../../firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { useData } from '../../context/DataContext';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import Select from '../../components/ui/Select';
// --- Icons ---
import { FiPlus, FiArrowUpRight, FiArrowDownLeft, FiDollarSign, FiFilter, FiX } from 'react-icons/fi'; // Using react-icons

const LedgerPage = () => {
  const { transactions, transactionsLoading } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTransaction, setNewTransaction] = useState({ description: '', amount: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState(''); // '', 'Income', 'Expense'
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Calculate balance using useMemo
  const balance = useMemo(() => {
    if (!transactions || transactions.length === 0) return 0;
    return transactions.reduce((acc, t) => {
        const amount = Number(t.amount) || 0;
        return acc + (t.type === 'Income' ? amount : -amount);
     }, 0);
  }, [transactions]);

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    const lowerSearchTerm = searchTerm.toLowerCase();
    const start = filterStartDate ? new Date(filterStartDate + 'T00:00:00') : null;
    const end = filterEndDate ? new Date(filterEndDate + 'T23:59:59') : null;

    return transactions.filter(t => {
      const matchesSearch = !lowerSearchTerm || t.description?.toLowerCase().includes(lowerSearchTerm);
      const matchesType = !filterType || t.type === filterType;
      const transactionDate = t.date?.toDate ? t.date.toDate() : null;
      const matchesDate = (!start || (transactionDate && transactionDate >= start)) && (!end || (transactionDate && transactionDate <= end));
      return matchesSearch && matchesType && matchesDate;
    }).sort((a, b) => (b.date?.toMillis() || 0) - (a.date?.toMillis() || 0)); // Sort newest first
  }, [transactions, searchTerm, filterType, filterStartDate, filterEndDate]);

  // Handle saving a new expense
  const handleSaveExpense = async (e) => {
    e.preventDefault();
    if (!newTransaction.description || !newTransaction.amount || Number(newTransaction.amount) <= 0) {
        alert("Please enter a valid description and positive amount.");
        return;
    }

    setIsSaving(true);
    try {
        const collectionPath = getCollectionPath('transactions');
        await addDoc(collection(db, collectionPath), {
            date: Timestamp.now(),
            type: 'Expense',
            description: newTransaction.description.trim(),
            amount: Number(newTransaction.amount)
        });
        setIsModalOpen(false);
        setNewTransaction({ description: '', amount: '' });
    } catch (error) {
        console.error("Error saving expense:", error);
        alert("Failed to save expense. Please check console for details.");
    } finally {
        setIsSaving(false);
    }
  };

  // Format currency helper
  const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);

  // Format date helper
  const formatDate = (timestamp) => {
      if (timestamp && typeof timestamp.toDate === 'function') {
          return timestamp.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); // e.g., 24 Oct 2025
      }
      return 'Invalid Date';
  };

  const resetFilters = () => {
    setSearchTerm('');
    setFilterType('');
    setFilterStartDate('');
    setFilterEndDate('');
  };


  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          
          <div>
              
              <h1 className="text-2xl md:text-3xl font-bold text-[#393E41]">Ledger</h1>
              <p className="mt-1 text-sm md:text-base text-[#6C757D]">Track all income and expenses.</p>
          </div>
          <Button onClick={() => setIsModalOpen(true)} variant="primary" className="flex items-center gap-2 w-full md:w-auto">
              <FiPlus /> Add Expense Entry
          </Button>
      </header>

      {/* Balance Card */}
      <Card className="bg-gradient-to-r from-[#44BBA4] to-[#3aa18e] text-white shadow-lg">
          <div className="flex items-center justify-between">
              <span className="text-sm font-medium opacity-80">Current Balance</span>
              <FiDollarSign className="w-6 h-6 opacity-70"/>
          </div>
          <p className={`mt-2 text-3xl md:text-4xl font-bold tracking-tight`}>
              {formatCurrency(balance)}
          </p>
      </Card>

      {/* Filter & Search Section */}
       <Card>
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
               <Input
                   label="Search Description"
                   id="search"
                   placeholder="e.g., Fabric purchase"
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   type="search"
               />
               <Select
                   label="Filter by Type"
                   id="filterType"
                   value={filterType}
                   onChange={(e) => setFilterType(e.target.value)}
               >
                   <option value="">All Types</option>
                   <option value="Income">Income</option>
                   <option value="Expense">Expense</option>
               </Select>
               <Input
                   label="Start Date"
                   id="filterStartDate"
                   type="date"
                   value={filterStartDate}
                   onChange={(e) => setFilterStartDate(e.target.value)}
               />
               <Input
                   label="End Date"
                   id="filterEndDate"
                   type="date"
                   value={filterEndDate}
                   onChange={(e) => setFilterEndDate(e.target.value)}
               />
           </div>
           <div className="mt-3 text-right">
               <Button onClick={resetFilters} variant="secondary" className="text-xs px-2 py-1 flex items-center gap-1 inline-flex">
                   <FiX /> Reset Filters
               </Button>
           </div>
       </Card>

      {/* Transaction History Card */}
      <Card>
        <h2 className="text-xl font-semibold mb-4 text-[#393E41]">Transaction History</h2>
        {transactionsLoading ? (
          <div className="py-16 flex justify-center"><Spinner /></div>
        ) : (
          <div className="overflow-x-auto">
             <div className="mb-2 text-sm text-gray-500">
               Showing {filteredTransactions.length} of {transactions?.length || 0} transactions
             </div>
            <table className="w-full min-w-[700px] text-left">
              <thead className="border-b-2 border-[#E0E0E0] bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-sm font-semibold uppercase text-[#6C757D] tracking-wider w-1/6">Date</th>
                  <th className="px-4 py-3 text-sm font-semibold uppercase text-[#6C757D] tracking-wider w-3/6">Description</th>
                  <th className="px-4 py-3 text-sm font-semibold uppercase text-[#6C757D] tracking-wider w-1/6">Type</th>
                  <th className="px-4 py-3 text-sm font-semibold uppercase text-[#6C757D] tracking-wider w-1/6 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E0E0]">
                {filteredTransactions && filteredTransactions.length > 0 ? filteredTransactions.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50 text-sm">
                    <td className="px-4 py-3 whitespace-nowrap text-[#6C757D]">{formatDate(t.date)}</td>
                    <td className="px-4 py-3 text-[#393E41]">{t.description || 'N/A'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full ${
                          t.type === 'Income'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                          {t.type === 'Income' ? <FiArrowUpRight/> : <FiArrowDownLeft/>}
                          {t.type || 'N/A'}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-medium font-mono ${
                        t.type === 'Income' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {t.type === 'Income' ? '+' : '-'} {formatCurrency(t.amount)}
                    </td>
                  </tr>
                )) : (
                   <tr><td colSpan="4" className="py-10 text-center text-[#6C757D]">No transactions found matching criteria.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add Expense Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Expense">
        <form onSubmit={handleSaveExpense} className="space-y-4">
          <Input label="Description" id="description" value={newTransaction.description} onChange={e => setNewTransaction({ ...newTransaction, description: e.target.value })} required autoFocus/>
          <Input label="Amount (₹)" id="amount" type="number" value={newTransaction.amount} onChange={e => setNewTransaction({ ...newTransaction, amount: e.target.value })} required min="0.01" step="0.01"/>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" onClick={() => setIsModalOpen(false)} variant="secondary" disabled={isSaving}>Cancel</Button>
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