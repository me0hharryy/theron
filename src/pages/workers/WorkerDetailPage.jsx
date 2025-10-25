// src/pages/workers/WorkerDetailPage.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { db, getCollectionPath } from '../../firebase';
import {
    collection, query, orderBy, onSnapshot, addDoc, Timestamp, doc, getDoc
} from 'firebase/firestore'; // Import necessary Firestore functions

import Card from '../../components/ui/Card';
import Spinner from '../../components/ui/Spinner';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal'; // Import Modal
import Input from '../../components/ui/Input'; // Import Input
import Select from '../../components/ui/Select'; // Import Select

// --- Icons ---
import {
    FiUser, FiPhone, FiTool, FiDollarSign, FiCalendar, FiFileText, FiList, FiArrowLeft, FiPlus, FiSave, FiCreditCard
} from 'react-icons/fi';

const WorkerDetailPage = () => {
    const { workerId } = useParams();
    const navigate = useNavigate();
    // Get base data from context
    const { orders, tailoringItems, ordersLoading, workersLoading: contextWorkersLoading } = useData();

    // Local state for worker details, payments, and modal
    const [worker, setWorker] = useState(null);
    const [workersLoading, setWorkersLoading] = useState(true); // Separate loading for worker doc
    const [paymentHistory, setPaymentHistory] = useState([]);
    const [paymentsLoading, setPaymentsLoading] = useState(true);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [newPayment, setNewPayment] = useState({ amount: '', method: 'Cash', notes: '' });
    const [isSavingPayment, setIsSavingPayment] = useState(false);

    // --- Fetch Worker Details ---
    useEffect(() => {
        if (!workerId) {
            navigate('/workers'); // Redirect if no ID
            return;
        }
        setWorkersLoading(true);
        const workerDocRef = doc(db, getCollectionPath('workers'), workerId);
        const unsubscribe = onSnapshot(workerDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setWorker({ id: docSnap.id, ...docSnap.data() });
            } else {
                console.error("Worker not found!");
                setWorker(null); // Set worker to null if not found
                // Optionally navigate back or show a "not found" message
                // navigate('/workers');
            }
            setWorkersLoading(false);
        }, (error) => {
            console.error("Error fetching worker details:", error);
            setWorker(null);
            setWorkersLoading(false);
        });

        return () => unsubscribe(); // Cleanup listener
    }, [workerId, navigate]);

    // --- Fetch Worker Payments Subcollection ---
    useEffect(() => {
        if (!workerId) return; // Don't fetch if no worker ID

        setPaymentsLoading(true);
        const paymentsPath = `${getCollectionPath('workers')}/${workerId}/payments`; // Path to subcollection
        const q = query(collection(db, paymentsPath), orderBy("date", "desc")); // Order by date descending

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const payments = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPaymentHistory(payments);
            setPaymentsLoading(false);
        }, (error) => {
            console.error("Error fetching worker payments:", error);
            setPaymentHistory([]); // Clear history on error
            setPaymentsLoading(false);
        });

        return () => unsubscribe(); // Cleanup listener
    }, [workerId]); // Re-run if workerId changes


    // --- Memoized Calculations (Assigned Items & Ledger) ---
    const { assignedItems, ledger } = useMemo(() => {
        // Return loading/empty state if essential data isn't ready
        if (ordersLoading || !worker || !orders || !tailoringItems || paymentsLoading) {
            return { worker: null, assignedItems: [], ledger: { totalEarned: 0, paid: 0, pending: 0 } };
        }

        const items = [];
        // Calculate total earnings from assigned items
        orders.forEach(order => {
          order.people?.forEach(person => {
            person.items?.forEach(item => {
              let role = null;
              let payRate = 0;
              const masterItem = tailoringItems.find(mi => mi.name === item.name);

              if (item.cutter === worker.name) {
                  role = 'Cutter';
                  payRate = masterItem?.cuttingRate || 0;
              } else if (item.sewer === worker.name) {
                  role = 'Sewer';
                  payRate = masterItem?.sewingRate || 0;
              }

              if (role) {
                items.push({
                  orderId: order.billNumber || order.id,
                  orderDate: order.orderDate,
                  customer: order.customer?.name || 'N/A',
                  itemName: item.name || 'N/A',
                  status: item.status || 'N/A',
                  role,
                  pay: Number(payRate) || 0
                });
              }
            });
          });
        });

        items.sort((a, b) => (b.orderDate?.toMillis() || 0) - (a.orderDate?.toMillis() || 0));

        // Calculate ledger totals using fetched payment history
        const totalEarned = items.reduce((acc, item) => acc + item.pay, 0);
        // *** Correctly calculate total paid from payment history ***
        const totalPaid = paymentHistory.reduce((acc, payment) => acc + (Number(payment.amount) || 0), 0);
        const pendingAmount = totalEarned - totalPaid;

        return {
          assignedItems: items,
          ledger: {
            totalEarned: totalEarned,
            paid: totalPaid, // Use calculated paid amount
            pending: pendingAmount
          }
        };
    // Ensure all dependencies are included
    }, [worker, orders, tailoringItems, paymentHistory, ordersLoading, paymentsLoading]);

    // --- Payment Modal Handlers ---
    const handleOpenPaymentModal = () => {
        setNewPayment({ amount: '', method: 'Cash', notes: '' }); // Reset form
        setIsPaymentModalOpen(true);
    };

    const handleClosePaymentModal = () => {
        setIsPaymentModalOpen(false);
        setIsSavingPayment(false); // Ensure saving state is reset
    };

    const handlePaymentInputChange = (e) => {
        const { name, value } = e.target;
        setNewPayment(prev => ({ ...prev, [name]: value }));
    };

    const handleSavePayment = async (e) => {
        e.preventDefault();
        const amount = Number(newPayment.amount);
        if (!amount || amount <= 0) {
            alert("Please enter a valid positive payment amount.");
            return;
        }
        // Optional: Check if payment exceeds pending amount
        // if (amount > ledger.pending) {
        //   if (!window.confirm(`Payment amount (${formatCurrency(amount)}) exceeds pending amount (${formatCurrency(ledger.pending)}). Proceed anyway?`)) {
        //     return;
        //   }
        // }

        setIsSavingPayment(true);
        try {
            const paymentsPath = `${getCollectionPath('workers')}/${workerId}/payments`;
            await addDoc(collection(db, paymentsPath), {
                amount: amount,
                date: Timestamp.now(),
                method: newPayment.method,
                notes: newPayment.notes.trim() || '',
            });
            handleClosePaymentModal(); // Close modal on success
        } catch (error) {
            console.error("Error saving payment:", error);
            alert("Failed to save payment. Please check console.");
        } finally {
            setIsSavingPayment(false);
        }
    };


    // --- Helper Functions ---
    const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);
    const formatDate = (timestamp) => {
        if (timestamp && typeof timestamp.toDate === 'function') {
            return timestamp.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); // e.g., 25 Oct 2025
        }
        return 'N/A';
    };
    const formatDateTime = (timestamp) => {
        if (timestamp && typeof timestamp.toDate === 'function') {
            return timestamp.toDate().toLocaleString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            }); // e.g., 25 Oct 2025, 14:30
        }
        return 'N/A';
    };


    // --- Loading States ---
    if (contextWorkersLoading || workersLoading) { // Check both context and local worker loading
       return <div className="py-16 flex justify-center"><Spinner /></div>;
    }

    // --- Worker Not Found State ---
    if (!worker) {
       return (
            <div className="p-6 text-center text-[#6C757D] space-y-4">
                <FiUser size={48} className="mx-auto text-gray-400" />
                <p className="text-lg font-medium">Worker Not Found</p>
                <p>Could not find details for worker ID '{workerId}'.</p>
                <Button onClick={() => navigate('/workers')} variant="secondary" className="mt-4 inline-flex items-center gap-2">
                   <FiArrowLeft /> Back to Workers List
                </Button>
            </div>
        );
    }

    // --- Render Worker Detail Page ---
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className='flex items-center gap-3'>
                     <div className='p-3 bg-gray-100 rounded-full'>
                        <FiUser className="w-6 h-6 text-[#44BBA4]" />
                     </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-[#393E41]">{worker.name}</h1>
                        <p className="text-sm md:text-base text-[#6C757D] flex items-center gap-1">
                           <FiTool size={14}/> {worker.specialization || 'No Specialization'}
                        </p>
                        {worker.contact && (
                            <p className="text-sm text-[#6C757D] flex items-center gap-1 mt-1">
                                <FiPhone size={14}/> {worker.contact}
                            </p>
                        )}
                    </div>
                </div>
                <Button onClick={() => navigate('/workers')} variant="secondary" className="w-full md:w-auto inline-flex items-center gap-2">
                    <FiArrowLeft/> Back to Workers List
                </Button>
            </div>

            {/* Ledger Card - Enhanced UI */}
            <Card className="shadow-md">
                <h3 className="text-lg font-semibold mb-4 text-[#393E41] flex items-center gap-2"><FiDollarSign/> Worker Ledger</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center divide-y sm:divide-y-0 sm:divide-x divide-gray-200">
                    <div className='py-4 sm:py-0'>
                        <p className="text-xs uppercase text-[#6C757D] font-medium tracking-wider">Total Earned</p>
                        <p className="mt-1 text-2xl md:text-3xl font-bold text-green-600">{formatCurrency(ledger.totalEarned)}</p>
                    </div>
                    <div className='py-4 sm:py-0 sm:pl-6'>
                        <p className="text-xs uppercase text-[#6C757D] font-medium tracking-wider">Total Paid</p>
                        <p className="mt-1 text-2xl md:text-3xl font-bold text-blue-600">{formatCurrency(ledger.paid)}</p>
                    </div>
                    <div className='py-4 sm:py-0 sm:pl-6'>
                        <p className="text-xs uppercase text-[#6C757D] font-medium tracking-wider">Pending Balance</p>
                        <p className={`mt-1 text-2xl md:text-3xl font-bold ${ledger.pending > 0 ? 'text-orange-600' : 'text-gray-700'}`}>
                            {formatCurrency(ledger.pending)}
                        </p>
                    </div>
                </div>
                <div className="mt-6 pt-4 border-t border-gray-200 text-right">
                    <Button
                        variant="primary"
                        onClick={handleOpenPaymentModal}
                        disabled={ledger.pending <= 0 && ledger.totalEarned <= 0} // Allow payment even if balance is 0 initially, but disable if truly 0 pending
                        className="inline-flex items-center gap-2"
                    >
                        <FiPlus /> Record Payment
                    </Button>
                </div>
            </Card>

            {/* Assigned Work Card */}
            <Card>
                <h3 className="text-lg font-semibold mb-4 text-[#393E41] flex items-center gap-2">
                    <FiList/> Assigned Work ({assignedItems.length} items)
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px] text-left text-sm">
                        <thead className="border-b-2 border-[#E0E0E0] bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 font-semibold uppercase text-[#6C757D] tracking-wider">Order ID</th>
                                <th className="px-4 py-2 font-semibold uppercase text-[#6C757D] tracking-wider"><FiCalendar className="inline mr-1"/> Date</th>
                                <th className="px-4 py-2 font-semibold uppercase text-[#6C757D] tracking-wider">Customer</th>
                                <th className="px-4 py-2 font-semibold uppercase text-[#6C757D] tracking-wider"><FiFileText className="inline mr-1"/> Item</th>
                                <th className="px-4 py-2 font-semibold uppercase text-[#6C757D] tracking-wider">Role</th>
                                <th className="px-4 py-2 font-semibold uppercase text-[#6C757D] tracking-wider">Status</th>
                                <th className="px-4 py-2 font-semibold uppercase text-[#6C757D] tracking-wider text-right">Pay (₹)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E0E0E0]">
                        {ordersLoading ? (
                            <tr><td colSpan="7" className="py-10 text-center"><Spinner/></td></tr>
                        ) : assignedItems.length > 0 ? assignedItems.map((item, idx) => (
                                <tr key={`${item.orderId}-${idx}`} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 font-mono text-[#393E41]">{item.orderId || 'N/A'}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-[#6C757D]">{formatDate(item.orderDate)}</td>
                                    <td className="px-4 py-2 text-[#6C757D]">{item.customer || 'N/A'}</td>
                                    <td className="px-4 py-2 font-medium text-[#393E41]">{item.itemName || 'N/A'}</td>
                                    <td className="px-4 py-2 text-[#6C757D]">{item.role || 'N/A'}</td>
                                    <td className="px-4 py-2 text-[#6C757D]">{item.status || 'N/A'}</td>
                                    <td className="px-4 py-2 text-right font-mono text-[#393E41]">{formatCurrency(item.pay)}</td>
                                </tr>
                            )) : (
                                <tr><td colSpan="7" className="py-10 text-center text-[#6C757D]">No work currently assigned.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

             {/* Payment History Card */}
            <Card>
                <h3 className="text-lg font-semibold mb-4 text-[#393E41] flex items-center gap-2">
                   <FiCreditCard/> Payment History ({paymentHistory.length} entries)
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px] text-left text-sm">
                        <thead className="border-b-2 border-[#E0E0E0] bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 font-semibold uppercase text-[#6C757D] tracking-wider"><FiCalendar className="inline mr-1"/> Payment Date</th>
                                <th className="px-4 py-2 font-semibold uppercase text-[#6C757D] tracking-wider">Method</th>
                                <th className="px-4 py-2 font-semibold uppercase text-[#6C757D] tracking-wider">Notes</th>
                                <th className="px-4 py-2 font-semibold uppercase text-[#6C757D] tracking-wider text-right">Amount (₹)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E0E0E0]">
                        {paymentsLoading ? (
                             <tr><td colSpan="4" className="py-10 text-center"><Spinner/></td></tr>
                        ) : paymentHistory.length > 0 ? paymentHistory.map((payment) => (
                                <tr key={payment.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 whitespace-nowrap text-[#6C757D]">{formatDateTime(payment.date)}</td>
                                    <td className="px-4 py-2 text-[#6C757D]">{payment.method || 'N/A'}</td>
                                    <td className="px-4 py-2 text-[#6C757D] italic">{payment.notes || '-'}</td>
                                    <td className="px-4 py-2 text-right font-mono text-blue-600 font-medium">{formatCurrency(payment.amount)}</td>
                                </tr>
                            )) : (
                                <tr><td colSpan="4" className="py-10 text-center text-[#6C757D]">No payment history recorded yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Record Payment Modal */}
            <Modal isOpen={isPaymentModalOpen} onClose={handleClosePaymentModal} title={`Record Payment for ${worker.name}`}>
                <form onSubmit={handleSavePayment} className="space-y-4">
                    <Input
                        id="amount"
                        name="amount" // Make sure name attribute is set
                        label="Amount Paid (₹)"
                        type="number"
                        value={newPayment.amount}
                        onChange={handlePaymentInputChange}
                        required
                        min="0.01"
                        step="0.01"
                        placeholder="Enter amount"
                        autoFocus
                    />
                     <Select
                        id="method"
                        name="method" // Make sure name attribute is set
                        label="Payment Method"
                        value={newPayment.method}
                        onChange={handlePaymentInputChange}
                    >
                        <option>Cash</option>
                        <option>Online</option>
                        <option>Bank Transfer</option>
                        <option>Other</option>
                    </Select>
                     <Input
                        id="notes"
                        name="notes" // Make sure name attribute is set
                        label="Notes (Optional)"
                        value={newPayment.notes}
                        onChange={handlePaymentInputChange}
                        placeholder="e.g., Diwali Bonus, Partial Payment"
                    />
                    <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                        <Button type="button" onClick={handleClosePaymentModal} variant="secondary" disabled={isSavingPayment}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="primary" disabled={isSavingPayment} className="inline-flex items-center gap-2">
                           <FiSave/> {isSavingPayment ? "Saving..." : "Save Payment"}
                        </Button>
                    </div>
                </form>
            </Modal>

        </div> // End main container
    );
};

export default WorkerDetailPage;