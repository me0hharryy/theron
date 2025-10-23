import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import Card from '../../components/ui/Card';
import Spinner from '../../components/ui/Spinner';
import Button from '../../components/ui/Button';
import { Timestamp } from 'firebase/firestore'; // Import Timestamp if needed for date formatting

const WorkerDetailPage = () => {
  const { workerId } = useParams(); // Get worker ID from URL
  const navigate = useNavigate();
  const { workers, orders, tailoringItems, ordersLoading, workersLoading } = useData(); // Get all necessary data

  // Memoize calculations for worker details, assigned items, and ledger
  const { worker, assignedItems, ledger } = useMemo(() => {
    // Return empty state if data is still loading
    if (workersLoading || ordersLoading || !workers || !orders || !tailoringItems) {
        return { worker: null, assignedItems: [], ledger: { totalEarned: 0, paid: 0, pending: 0 } };
    }

    // Find the specific worker by ID
    const currentWorker = workers.find(w => w.id === workerId);
    if (!currentWorker) {
        return { worker: null, assignedItems: [], ledger: { totalEarned: 0, paid: 0, pending: 0 } }; // Worker not found
    }

    const items = [];
    // Iterate through all orders to find items assigned to this worker
    orders.forEach(order => {
      order.people?.forEach(person => { // Safely access people
        person.items?.forEach(item => { // Safely access items
          let role = null;
          let payRate = 0;
          const masterItem = tailoringItems.find(mi => mi.name === item.name); // Find matching master item for rates

          // Check if worker is assigned as cutter or sewer
          if (item.cutter === currentWorker.name) {
              role = 'Cutter';
              payRate = masterItem?.cuttingRate || 0; // Get cutting rate
          } else if (item.sewer === currentWorker.name) {
              role = 'Sewer';
              payRate = masterItem?.sewingRate || 0; // Get sewing rate
          }

          // If assigned, add item details to the list
          if (role) {
            items.push({
              orderId: order.billNumber || order.id, // Use billNumber if available
              orderDate: order.orderDate, // Keep timestamp for sorting
              customer: order.customer?.name || 'N/A',
              itemName: item.name || 'N/A',
              status: item.status || 'N/A',
              role,
              pay: Number(payRate) || 0 // Ensure pay is a number
            });
          }
        });
      });
    });

    // Sort assigned items, e.g., by order date descending
    items.sort((a, b) => (b.orderDate?.toMillis() || 0) - (a.orderDate?.toMillis() || 0));


    // Calculate ledger totals
    const totalPay = items.reduce((acc, item) => acc + item.pay, 0);
    // TODO: Implement actual payment tracking. Using placeholder 0 for now.
    const paidAmount = 0; // This needs to be fetched/calculated from a 'workerPayments' collection
    const pendingAmount = totalPay - paidAmount;

    return {
      worker: currentWorker,
      assignedItems: items,
      ledger: {
        totalEarned: totalPay,
        paid: paidAmount,
        pending: pendingAmount
      }
    };
  }, [workerId, workers, orders, tailoringItems, ordersLoading, workersLoading]); // Dependencies for useMemo

  // Format currency helper
  const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);
   // Format date helper
   const formatDate = (timestamp) => {
       if (timestamp && typeof timestamp.toDate === 'function') {
           return timestamp.toDate().toLocaleDateString('en-GB'); // DD/MM/YYYY
       }
       return 'N/A';
   };


  // Show spinner while dependent data is loading
  if (workersLoading || ordersLoading) {
       return <div className="py-16 flex justify-center"><Spinner /></div>;
   }

  // Handle case where worker is not found after loading finishes
  if (!worker) {
       return (
            <div className="p-6 text-center text-[#6C757D]">
                <p>Worker with ID '{workerId}' not found.</p>
                <Button onClick={() => navigate('/workers')} variant="secondary" className="mt-4">Back to Workers List</Button>
            </div>
        );
   }

  // --- Render Worker Detail Page ---
  return (
    // DIRECTLY APPLIED THEME: Using hex codes
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#393E41]">{worker.name}</h1> {/* Dark Gray */}
            <p className="text-sm md:text-base text-[#6C757D]">{worker.specialization || 'No Specialization'}</p> {/* Medium Gray */}
        </div>
        <Button onClick={() => navigate('/workers')} variant="secondary" className="w-full md:w-auto">Back to Workers List</Button>
      </div>

      {/* Contact & Ledger Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1"> {/* Contact Card */}
          <h3 className="text-lg font-semibold mb-3 text-[#393E41]">Contact Details</h3> {/* Dark Gray */}
          <p className="text-sm text-[#393E41]"><strong>Phone:</strong> {worker.contact || 'N/A'}</p> {/* Dark Gray */}
          {/* Add more details here if available (e.g., address) */}
        </Card>

        <Card className="md:col-span-2"> {/* Ledger Card */}
          <h3 className="text-lg font-semibold mb-3 text-[#393E41]">Worker Ledger</h3> {/* Dark Gray */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs uppercase text-[#6C757D]">Total Earned</p> {/* Medium Gray */}
              <p className="text-xl md:text-2xl font-bold text-green-600">{formatCurrency(ledger.totalEarned)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-[#6C757D]">Total Paid</p> {/* Medium Gray */}
              <p className="text-xl md:text-2xl font-bold text-red-600">{formatCurrency(ledger.paid)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-[#6C757D]">Pending Payment</p> {/* Medium Gray */}
              <p className="text-xl md:text-2xl font-bold text-[#393E41]">{formatCurrency(ledger.pending)}</p> {/* Dark Gray */}
            </div>
          </div>
          {/* TODO: Implement Make Payment Modal/Functionality */}
          <div className="mt-5 text-right">
            <Button variant="primary" onClick={() => alert('Make Payment feature needs implementation.')} disabled={ledger.pending <= 0}>
                Record Payment
            </Button>
          </div>
        </Card>
      </div>

      {/* Assigned Work Card */}
      <Card>
        <h3 className="text-lg font-semibold mb-4 text-[#393E41]">Assigned Work ({assignedItems.length} items)</h3> {/* Dark Gray */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm"> {/* Min width, smaller text */}
            {/* DIRECTLY APPLIED THEME: Light border, medium gray header */}
            <thead className="border-b-2 border-[#E0E0E0] bg-gray-50">
              <tr>
                <th className="px-4 py-2 font-semibold uppercase text-[#6C757D]">Order ID</th>
                <th className="px-4 py-2 font-semibold uppercase text-[#6C757D]">Date</th>
                <th className="px-4 py-2 font-semibold uppercase text-[#6C757D]">Customer</th>
                <th className="px-4 py-2 font-semibold uppercase text-[#6C757D]">Item</th>
                <th className="px-4 py-2 font-semibold uppercase text-[#6C757D]">Role</th>
                <th className="px-4 py-2 font-semibold uppercase text-[#6C757D]">Status</th>
                <th className="px-4 py-2 font-semibold uppercase text-[#6C757D] text-right">Pay (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E0E0E0]"> {/* Light border */}
              {assignedItems && assignedItems.length > 0 ? assignedItems.map((item, idx) => (
                <tr key={`${item.orderId}-${idx}`} className="hover:bg-gray-50"> {/* Improved key */}
                  <td className="px-4 py-2 font-mono text-[#393E41]">{item.orderId || 'N/A'}</td> {/* Dark Gray */}
                   <td className="px-4 py-2 whitespace-nowrap text-[#6C757D]">{formatDate(item.orderDate)}</td> {/* Medium Gray */}
                  <td className="px-4 py-2 text-[#6C757D]">{item.customer || 'N/A'}</td> {/* Medium Gray */}
                  <td className="px-4 py-2 font-medium text-[#393E41]">{item.itemName || 'N/A'}</td> {/* Dark Gray */}
                  <td className="px-4 py-2 text-[#6C757D]">{item.role || 'N/A'}</td> {/* Medium Gray */}
                  <td className="px-4 py-2 text-[#6C757D]">{item.status || 'N/A'}</td> {/* Medium Gray */}
                  <td className="px-4 py-2 text-right font-mono text-[#393E41]">{formatCurrency(item.pay)}</td> {/* Dark Gray */}
                </tr>
              )) : (
                 <tr><td colSpan="7" className="py-10 text-center text-[#6C757D]">No work currently assigned to this worker.</td></tr> // Medium Gray
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default WorkerDetailPage;