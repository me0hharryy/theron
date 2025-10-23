import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { db, getCollectionPath } from '../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import Select from '../../components/ui/Select';

// Icons remain the same
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>;


const OrderListPage = () => {
  const { orders, ordersLoading, workers } = useData(); // Corrected hook usage
  const [searchTerm, setSearchTerm] = useState('');
  const [detailModalOrder, setDetailModalOrder] = useState(null); // State for the order shown in the modal
  const navigate = useNavigate();

  // Memoized filtering of orders based on search term
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    const lowerSearchTerm = searchTerm.toLowerCase();
    if (!lowerSearchTerm) return orders; // Return all if search is empty

    return orders.filter(order =>
      order.customer?.name?.toLowerCase().includes(lowerSearchTerm) ||
      order.customer?.number?.includes(lowerSearchTerm) ||
      order.billNumber?.toLowerCase().includes(lowerSearchTerm)
    );
  }, [searchTerm, orders]); // Recalculate only when search or orders change

  // Get available workers for assignment dropdowns, memoized
   const workerOptions = useMemo(() => {
       if (!workers) return { cutters: [], sewers: [] };
       const cutters = workers
           .filter(w => w.specialization?.toLowerCase().includes('cut'))
           .map(w => ({ value: w.name, label: w.name }));
       const sewers = workers
           .filter(w => w.specialization?.toLowerCase().includes('sew')) // Assuming 'sew' or 'sewer'
           .map(w => ({ value: w.name, label: w.name }));
       return { cutters, sewers };
   }, [workers]);


  // Update item status within the modal's state and Firestore
  const handleStatusChange = async (personIndex, itemIndex, newStatus) => {
    if (!detailModalOrder) return;

    // Create a deep copy to avoid direct state mutation
    const orderToUpdate = JSON.parse(JSON.stringify(detailModalOrder));
    let itemUpdated = false;

    // Safely access and update the item status
    if (orderToUpdate.people?.[personIndex]?.items?.[itemIndex]) {
        if (orderToUpdate.people[personIndex].items[itemIndex].status !== newStatus) {
            orderToUpdate.people[personIndex].items[itemIndex].status = newStatus;
            itemUpdated = true;
        }
    } else {
        console.error("Could not find item to update status:", personIndex, itemIndex);
        return;
    }


    if (itemUpdated) {
        // Update the local modal state immediately for responsiveness
        setDetailModalOrder(orderToUpdate);

        // Persist the change to Firestore
        try {
            const orderPath = getCollectionPath('orders');
            const orderDocRef = doc(db, orderPath, detailModalOrder.id);
            // Update only the 'people' array in Firestore
            await updateDoc(orderDocRef, { people: orderToUpdate.people });
            // Optionally: Add a success notification here
        } catch (error) {
            console.error("Error updating item status in Firestore:", error);
            alert("Failed to update status. Please try again.");
            // Optionally: Revert local state if Firestore update fails
            // setDetailModalOrder(JSON.parse(JSON.stringify(detailModalOrder))); // Revert
        }
    }
  };

  // Assign worker (cutter or sewer) to an item
  const handleWorkerAssign = async (personIndex, itemIndex, workerType, workerName) => {
     if (!detailModalOrder || (workerType !== 'cutter' && workerType !== 'sewer')) return;

     const orderToUpdate = JSON.parse(JSON.stringify(detailModalOrder));
     let workerAssigned = false;

     if (orderToUpdate.people?.[personIndex]?.items?.[itemIndex]) {
        if (orderToUpdate.people[personIndex].items[itemIndex][workerType] !== workerName) {
            orderToUpdate.people[personIndex].items[itemIndex][workerType] = workerName; // Assign or unassign (if workerName is "")
            workerAssigned = true;
        }
    } else {
        console.error("Could not find item to assign worker:", personIndex, itemIndex);
        return;
    }

     if (workerAssigned) {
         setDetailModalOrder(orderToUpdate); // Update local state

         try {
             const orderPath = getCollectionPath('orders');
             const orderDocRef = doc(db, orderPath, detailModalOrder.id);
             await updateDoc(orderDocRef, { people: orderToUpdate.people });
         } catch (error) {
             console.error(`Error assigning ${workerType}:`, error);
             alert(`Failed to assign ${workerType}. Please try again.`);
             // Optionally revert local state on failure
         }
     }
  };

  // Simulate sending a notification (replace with actual backend/Firebase Function call)
  const handleNotify = (customer, item) => {
    if (!customer?.number) {
      alert("Customer phone number is not available for notification.");
      return;
    }
    const message = `Hi ${customer.name || 'Customer'}, update on your order ${detailModalOrder?.billNumber}: Item '${item.name || 'Unknown'}' is now '${item.status || 'Updated'}'. - Theron Tailors`;

    console.log("Simulating Notification ---");
    console.log("To:", customer.number);
    console.log("Message:", message);
    console.log("--- End Simulation ---");

    alert(`Notification simulated for ${customer.name}.\nMessage: ${message}`);
    // In a real app:
    // try {
    //   const sendNotification = httpsCallable(functions, 'sendOrderUpdateNotification');
    //   await sendNotification({ orderId: detailModalOrder.id, itemId: item.id, customerNumber: customer.number, status: item.status });
    //   alert("Notification sent successfully!");
    // } catch (error) {
    //   console.error("Failed to send notification:", error);
    //   alert("Failed to send notification.");
    // }
  };

  // Format currency helper
  const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);
   // Format date helper
   const formatDate = (timestamp) => {
       if (timestamp && typeof timestamp.toDate === 'function') {
           return timestamp.toDate().toLocaleDateString('en-GB'); // DD/MM/YYYY
       }
       return 'N/A';
   };


  return (
    // DIRECTLY APPLIED THEME: Using hex codes
    <div className="space-y-6">
        <header>
            <h1 className="text-2xl md:text-3xl font-bold text-[#393E41]">Orders</h1> {/* Dark Gray */}
            <p className="mt-1 text-sm md:text-base text-[#6C757D]">View, manage, and track all customer orders.</p> {/* Medium Gray */}
        </header>

        <Card>
            {/* Search and Add Button */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-4">
                <div className="w-full md:max-w-xs lg:max-w-sm"> {/* Responsive max width */}
                    <Input
                        id="orderSearch"
                        placeholder="Search ID, Name, Number..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        type="search" // Use search type
                    />
                </div>
                <Button onClick={() => navigate('/orders/new')} variant="primary" className="flex items-center gap-2 w-full md:w-auto flex-shrink-0"> {/* Prevent button shrinking */}
                    <PlusIcon /> Place New Order
                </Button>
            </div>

            {/* Orders Table */}
            {ordersLoading ? (
                 <div className="py-16 flex justify-center"><Spinner /></div>
             ) : (
            <div className="overflow-x-auto">
                <table className="w-full min-w-[768px] text-left text-sm"> {/* Min width for better layout */}
                 {/* DIRECTLY APPLIED THEME: Light border, medium gray header */}
                <thead className="border-b-2 border-[#E0E0E0] bg-gray-50">
                    <tr>
                        <th className="px-4 py-3 font-semibold uppercase text-[#6C757D] tracking-wider">Order ID</th>
                        <th className="px-4 py-3 font-semibold uppercase text-[#6C757D] tracking-wider">Customer</th>
                        <th className="px-4 py-3 font-semibold uppercase text-[#6C757D] tracking-wider">Delivery Date</th>
                        <th className="px-4 py-3 font-semibold uppercase text-[#6C757D] tracking-wider text-right">Total (₹)</th>
                        <th className="px-4 py-3 font-semibold uppercase text-[#6C757D] tracking-wider text-right">Pending (₹)</th>
                        <th className="px-4 py-3 font-semibold uppercase text-[#6C757D] tracking-wider text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-[#E0E0E0]"> {/* Light border */}
                    {filteredOrders && filteredOrders.length > 0 ? filteredOrders.map(order => (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-[#393E41]">{order.billNumber || 'N/A'}</td> {/* Dark Gray */}
                        <td className="px-4 py-3 font-medium text-[#393E41]"> {/* Dark Gray */}
                            {order.customer?.name || 'N/A'} <br/>
                            <span className="text-[#6C757D] text-xs">{order.customer?.number || ''}</span> {/* Medium Gray */}
                        </td>
                        <td className="px-4 py-3 text-[#393E41]">{formatDate(order.deliveryDate)}</td> {/* Dark Gray */}
                        <td className="px-4 py-3 text-right font-mono text-[#393E41]">{formatCurrency(order.payment?.total)}</td> {/* Dark Gray */}
                        <td className={`px-4 py-3 text-right font-mono font-semibold ${(order.payment?.pending || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(order.payment?.pending)}</td> {/* Default Red/Green */}
                        <td className="px-4 py-3">
                            <div className="flex justify-end gap-1.5"> {/* Reduced gap */}
                                <Button onClick={() => setDetailModalOrder(order)} variant="secondary" className="px-2.5 py-1 text-xs">Details</Button> {/* Smaller button */}
                                <Button onClick={() => navigate(`/orders/edit/${order.id}`)} variant="secondary" className="p-1.5" aria-label={`Edit order ${order.billNumber}`}> {/* Small icon button */}
                                    <EditIcon />
                                </Button>
                            </div>
                        </td>
                    </tr>
                    )) : (
                        <tr><td colSpan="6" className="py-10 text-center text-[#6C757D]">No orders found matching your search.</td></tr> // Medium Gray
                    )}
                </tbody>
                </table>
            </div>
            )}
        </Card>

      {/* Order Detail & Status Update Modal */}
      <Modal isOpen={!!detailModalOrder} onClose={() => setDetailModalOrder(null)} title={`Order Details: ${detailModalOrder?.billNumber || ''}`}>
        {/* Modal uses theme colors */}
        <div className="space-y-4"> {/* Removed max-h/overflow from here, added to modal body */}
          {detailModalOrder?.people?.map((person, pIdx) => (
             // DIRECTLY APPLIED THEME
            <div key={`modal-person-${pIdx}`} className="rounded-md border border-[#E0E0E0] p-4 bg-gray-50/50"> {/* Light border, subtle bg */}
              <h4 className="text-lg font-semibold text-[#393E41] mb-2">{person.name || `Person ${pIdx + 1}`}</h4> {/* Dark Gray */}
              {person.items?.map((item, iIdx) => (
                 // DIRECTLY APPLIED THEME
                <div key={item.id || `modal-item-${iIdx}`} className="mt-3 border-t border-[#E0E0E0] pt-3"> {/* Light border */}
                  <p className="font-semibold text-[#44BBA4]">{item.name || 'N/A'} - {formatCurrency(item.price)}</p> {/* Teal */}
                  {item.measurements && <p className="text-xs text-[#6C757D] mt-1 whitespace-pre-wrap">{item.measurements}</p>} {/* Medium Gray */}
                   {item.notes && <p className="text-xs text-[#393E41] mt-1 italic">Notes: {item.notes}</p>} {/* Dark Gray */}
                   {item.designPhoto && <p className="text-xs mt-1"><a href={item.designPhoto} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">View Design</a></p>}

                  <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-3"> {/* Adjusted gap */}
                    <Select
                        label="Status"
                        id={`status-${pIdx}-${iIdx}`}
                        value={item.status || 'Received'}
                        onChange={(e) => handleStatusChange(pIdx, iIdx, e.target.value)}
                    >
                      <option>Received</option>
                      <option>Cutting</option>
                      <option>Sewing</option>
                      <option>Ready for Trial</option>
                      <option>Delivered</option>
                    </Select>
                    <Select
                        label="Assign Cutter"
                        id={`cutter-${pIdx}-${iIdx}`}
                        value={item.cutter || ''}
                        onChange={e => handleWorkerAssign(pIdx, iIdx, 'cutter', e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {workerOptions.cutters.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                    </Select>
                    <Select
                        label="Assign Sewer"
                        id={`sewer-${pIdx}-${iIdx}`}
                        value={item.sewer || ''}
                        onChange={e => handleWorkerAssign(pIdx, iIdx, 'sewer', e.target.value)}
                    >
                      <option value="">Unassigned</option>
                       {workerOptions.sewers.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                    </Select>
                  </div>
                  <div className="mt-3 text-right"> {/* Adjusted margin */}
                    <Button
                      variant="secondary"
                      onClick={() => handleNotify(detailModalOrder.customer, item)}
                      disabled={!detailModalOrder.customer?.number}
                      className="px-2.5 py-1 text-xs" // Smaller button
                    >
                      Notify Customer
                    </Button>
                  </div>
                </div>
              ))}
               {!person.items || person.items.length === 0 && <p className="text-sm text-[#6C757D]">No items for this person.</p>}
            </div>
          ))}
           {(!detailModalOrder?.people || detailModalOrder.people.length === 0) && <p className="text-center text-[#6C757D]">No people or items found in this order's details.</p>}
        </div>
      </Modal>
    </div>
  );
};

export default OrderListPage;