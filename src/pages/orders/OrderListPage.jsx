// src/pages/orders/OrderListPage.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { db, getCollectionPath } from '../../firebase';
import { doc, updateDoc, deleteDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore'; // Ensure all needed functions are imported
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import Select from '../../components/ui/Select';

// --- Icons --- (Using react-icons for consistency)
import {
    FiPlus, FiEdit, FiPrinter, FiTrash2, FiFilter, FiX, FiMaximize, // Replaced FiRuler with FiMaximize
    FiSend, FiList, FiAlertCircle, FiCalendar, FiScissors, FiPocket
} from 'react-icons/fi';

const ITEM_STATUS_OPTIONS = ['Received', 'Cutting', 'Sewing', 'Ready for Trial', 'Delivered'];

// --- Helper Components ---

// Filter Section Component
const FilterSection = ({ filters, onFilterChange, onResetFilters, itemStatusOptions, isVisible }) => {
    if (!isVisible) return null;

    return (
        <div className="bg-gray-50 p-4 rounded-md border mb-6 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <Select
                    label="Item Status"
                    name="status"
                    value={filters.status}
                    onChange={onFilterChange}
                >
                    <option value="">All Statuses</option>
                    {itemStatusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </Select>
                <Input
                    label="Order Date From"
                    name="startDate"
                    type="date"
                    value={filters.startDate}
                    onChange={onFilterChange}
                    className="bg-white"
                />
                <Input
                    label="Order Date To"
                    name="endDate"
                    type="date"
                    value={filters.endDate}
                    onChange={onFilterChange}
                    className="bg-white"
                />
                <div className="flex flex-col sm:flex-row sm:items-end gap-2 lg:col-span-1">
                    <div className="flex items-center h-10 mt-auto mb-1 flex-grow">
                        <input
                            id="pendingPayment"
                            name="pendingPayment"
                            type="checkbox"
                            checked={filters.pendingPayment}
                            onChange={onFilterChange}
                            className="h-4 w-4 rounded border-gray-300 text-[#44BBA4] focus:ring-[#44BBA4]"
                        />
                        <label htmlFor="pendingPayment" className="ml-2 block text-sm font-medium text-[#6C757D]">
                            Has Pending Payment
                        </label>
                    </div>
                    <Button
                        onClick={onResetFilters}
                        variant="secondary"
                        className="flex items-center gap-1 text-xs px-2 py-1.5 mt-auto"
                        title="Reset Filters"
                    >
                        <FiX /> Reset
                    </Button>
                </div>
            </div>
             {/* Animation Style */}
             <style>{`
               @keyframes fadeIn {
                 from { opacity: 0; transform: translateY(-10px); }
                 to { opacity: 1; transform: translateY(0); }
               }
               .animate-fade-in {
                 animation: fadeIn 0.3s ease-out forwards;
               }
             `}</style>
        </div>
    );
};


// --- Main Component ---
const OrderListPage = () => {
    const { orders, ordersLoading, workers } = useData(); // Get workers data
    const [searchTerm, setSearchTerm] = useState('');
    const [detailModalOrder, setDetailModalOrder] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();
    const [isDeleting, setIsDeleting] = useState(false);

    // Filter State
    const initialFilterState = { status: '', pendingPayment: false, startDate: '', endDate: '' };
    const [filters, setFilters] = useState(initialFilterState);
    const [showFilters, setShowFilters] = useState(false);

    // Memoized worker options based on category
    const workerOptions = useMemo(() => {
        if (!workers || !Array.isArray(workers) || workers.length === 0) {
             return { cutters: [], sewers: [] };
        }
        const cutters = [];
        const sewers = [];
        workers.forEach(w => {
            const categoryLower = (typeof w.category === 'string') ? w.category.trim().toLowerCase() : null;
            if (categoryLower === 'cutter') {
                cutters.push({ value: w.name, label: w.name });
            } else if (categoryLower === 'sewer') {
                sewers.push({ value: w.name, label: w.name });
            }
        });
        return { cutters, sewers };
    }, [workers]);

    // Combined Search and Filter Logic
    const filteredOrders = useMemo(() => {
        if (!orders) return [];
        const lowerSearchTerm = searchTerm.toLowerCase();
        const { status, pendingPayment, startDate, endDate } = filters;

        const start = startDate ? new Date(startDate + 'T00:00:00') : null;
        let end = null;
        if (endDate) {
          end = new Date(endDate + 'T00:00:00');
          end.setDate(end.getDate() + 1); // Move to start of next day
          end.setMilliseconds(end.getMilliseconds() - 1); // Go back 1ms to end of endDate
        }

        return orders.filter(order => {
            const matchesSearch = !lowerSearchTerm ||
                                  order.customer?.name?.toLowerCase().includes(lowerSearchTerm) ||
                                  order.customer?.number?.includes(lowerSearchTerm) ||
                                  order.billNumber?.toLowerCase().includes(lowerSearchTerm);

            const matchesPending = !pendingPayment || (order.payment?.pending || 0) > 0;

            const orderDate = order.orderDate?.toDate ? order.orderDate.toDate() : null;
            const matchesDate = orderDate instanceof Date && !isNaN(orderDate) &&
                                (!start || orderDate >= start) &&
                                (!end || orderDate <= end);

            const matchesStatus = !status || order.people?.some(person =>
                person.items?.some(item => item.status === status)
            );

            return matchesSearch && matchesPending && matchesDate && matchesStatus;
        }).sort((a, b) => (b.orderDate?.toMillis() || 0) - (a.orderDate?.toMillis() || 0)); // Sort newest first
    }, [searchTerm, orders, filters]);

    // Effect to Open Modal Based on Navigation State
    useEffect(() => {
        if (!ordersLoading && orders?.length > 0 && location.state?.openOrderDetailsId) {
            const orderIdToOpen = location.state.openOrderDetailsId;
            const orderToOpen = orders.find(order => order.id === orderIdToOpen);
            if (orderToOpen) {
                setDetailModalOrder(JSON.parse(JSON.stringify(orderToOpen)));
            } else {
                console.warn(`Order with ID ${orderIdToOpen} not found.`);
            }
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, orders, ordersLoading, navigate, location.pathname]);


    // Filter Handlers
    const handleFilterChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFilters(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };
    const resetFilters = () => { setFilters(initialFilterState); setSearchTerm(''); };


    // Status Change Handler
    const handleStatusChange = async (personIndex, itemIndex, newStatus) => {
        if (!detailModalOrder) return;
        const originalOrderState = JSON.parse(JSON.stringify(detailModalOrder));
        const orderToUpdate = JSON.parse(JSON.stringify(detailModalOrder));

        try {
            const itemToUpdate = orderToUpdate.people?.[personIndex]?.items?.[itemIndex];
            if (itemToUpdate) {
                if(itemToUpdate.status === newStatus) return;
                itemToUpdate.status = newStatus;
                setDetailModalOrder(orderToUpdate);
                await updateDoc(doc(db, getCollectionPath('orders'), detailModalOrder.id), {
                    people: orderToUpdate.people
                });
            } else { throw new Error("Invalid item path for status update"); }
        } catch (error) { console.error("Error updating status:", error); alert("Failed to update status."); setDetailModalOrder(originalOrderState); }
    };

    // Worker Assign Handler
    const handleWorkerAssign = async (personIndex, itemIndex, workerType, workerName) => {
        if (!detailModalOrder || (workerType !== 'cutter' && workerType !== 'sewer')) return;
        const originalOrderState = JSON.parse(JSON.stringify(detailModalOrder));
        const orderToUpdate = JSON.parse(JSON.stringify(detailModalOrder));
        try {
            const itemToUpdate = orderToUpdate.people?.[personIndex]?.items?.[itemIndex];
            if (itemToUpdate) {
                if (itemToUpdate[workerType] === workerName) return;
                itemToUpdate[workerType] = workerName;
                setDetailModalOrder(orderToUpdate);
                await updateDoc(doc(db, getCollectionPath('orders'), detailModalOrder.id), { people: orderToUpdate.people });
            } else { throw new Error("Invalid item path for worker assignment"); }
        } catch (error) { console.error(`Error assigning ${workerType}:`, error); alert(`Failed to assign ${workerType}.`); setDetailModalOrder(originalOrderState); }
    };

    // Notify Handler
    const handleNotify = (customer, item) => {
        if (!customer?.number) { alert("Customer phone number not available."); return; }
        const message = `Hi ${customer.name || 'Customer'}, update on order ${detailModalOrder?.billNumber}: Item '${item.name || 'Unknown'}' is now '${item.status || 'Updated'}'. - Theron Tailors`;
        alert(`Notification simulated for ${customer.name}.\nMessage: ${message}`);
    };

    // Delete Order Handler (Includes Transaction Deletion)
    const handleDeleteOrder = async (orderId, orderBillNumber) => {
        const confirmMsg = `Delete order "${orderBillNumber || orderId}"? This also removes related advance payments from the ledger. Cannot be undone.`;
        if (window.confirm(confirmMsg)) {
            setIsDeleting(true);
            try {
                const orderPath = getCollectionPath('orders');
                const transPath = getCollectionPath('transactions');
                // Query transactions linked to this orderRef where type is Income (advance)
                const transQuery = query(collection(db, transPath), where("orderRef", "==", orderId), where("type", "==", "Income"));
                const querySnapshot = await getDocs(transQuery);
                const transDocsToDelete = querySnapshot.docs.map(doc => doc.ref);

                const batch = writeBatch(db);
                batch.delete(doc(db, orderPath, orderId)); // Delete order
                transDocsToDelete.forEach(docRef => batch.delete(docRef)); // Delete linked transactions

                await batch.commit(); // Execute batch
                console.log(`Order ${orderId} and ${transDocsToDelete.length} related transaction(s) deleted.`);
                if (detailModalOrder?.id === orderId) setDetailModalOrder(null); // Close modal if open
            } catch (error) { console.error("Error deleting order:", error); alert("Failed to delete order."); }
            finally { setIsDeleting(false); }
        }
    };

    // --- HELPER FUNCTIONS ---
    const getOrderField = (obj, keys) => {
      for (const key of keys) {
        const value = key.split('.').reduce((acc, k) => acc?.[k], obj);
        if (value) return value;
      }
      return null;
    };
    const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);
    const formatDate = (timestamp) => {
        if (!timestamp) return 'N/A';
        try {
            let dateObj = null;
            if (typeof timestamp.toDate === 'function') { dateObj = timestamp.toDate(); }
            else if (timestamp.seconds) { dateObj = new Date(timestamp.seconds * 1000); }
            else if (timestamp._seconds) { dateObj = new Date(timestamp._seconds * 1000); }
            else if (typeof timestamp === 'string') { const parsed = new Date(timestamp.replace(/-/g, '/')); if (!isNaN(parsed)) dateObj = parsed; }
            else if (timestamp instanceof Date) { dateObj = timestamp; }
            if (!dateObj || isNaN(dateObj)) return 'N/A';
            return dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch (error) { console.error('Date formatting failed:', error, timestamp); return 'N/A'; }
    };

    // --- PRINT INVOICE HANDLER ---
    const handlePrintInvoice = () => {
        const invoiceContentElement = document.getElementById('printable-invoice'); if (!invoiceContentElement) return;
        const printWindow = window.open('', '_blank', 'height=800,width=800'); if (!printWindow) { alert("Please allow popups."); return; }
        const orderDateFormatted = formatDate(detailModalOrder?.orderDate);
        const deliveryDateFormatted = formatDate(detailModalOrder?.deliveryDate);
        const printStyles = ` @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap'); body { font-family: 'Inter', sans-serif; margin: 20px; line-height: 1.5; color: #333; background-color: #fff; font-size: 10pt; } h2, h3, h4, h5 { margin: 0 0 0.5em 0; padding: 0; line-height: 1.3; color: #393E41; } p { margin: 0 0 0.3em 0; } table { width: 100%; border-collapse: collapse; margin-bottom: 1em; } th, td { border-bottom: 1px solid #eee; padding: 0.4em 0.5em; text-align: left; vertical-align: top; } th { background-color: #f8f9fa; font-weight: 600; font-size: 0.9em; text-transform: uppercase; color: #6C757D; } td:last-child, th:last-child { text-align: right; } strong { font-weight: 600; } .invoice-header { text-align: center; margin-bottom: 1.5em; border-bottom: 2px solid #eee; padding-bottom: 1em; } .invoice-header h2 { font-size: 1.8em; font-weight: 700; color: #44BBA4; margin-bottom: 0.1em; } .invoice-header p { font-size: 0.85em; color: #555; } .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5em; margin-bottom: 1.5em; padding-bottom: 1em; border-bottom: 1px dashed #ccc; } .details-grid h5 { font-size: 1em; font-weight: 600; color: #44BBA4; margin-bottom: 0.5em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; } .details-grid p { font-size: 0.9em; color: #555; } .items-section h3 { font-size: 1.1em; font-weight: 600; margin-bottom: 0.5em; } .item-notes { font-size: 0.8em; color: #666; font-style: italic; padding-left: 1em; margin-top: 0.2em;} .totals-section { display: flex; justify-content: flex-end; margin-top: 1.5em; padding-top: 1em; border-top: 2px solid #eee; } .totals-box { width: 100%; max-width: 280px; font-size: 0.9em; } .totals-box div { display: flex; justify-content: space-between; margin-bottom: 0.3em; } .totals-box span:first-child { color: #555; padding-right: 1em; } .totals-box span:last-child { font-weight: 600; color: #333; min-width: 80px; text-align: right; font-family: monospace;} .totals-box .grand-total span { font-weight: 700; font-size: 1.1em; color: #393E41;} .totals-box .due span:last-child { color: #D97706; } .footer { margin-top: 2em; text-align: center; font-size: 0.8em; color: #888; border-top: 1px dashed #ccc; padding-top: 0.8em; } .no-print, .no-print-invoice { display: none !important; } `;
        const orderData = detailModalOrder;
        const validPeopleForPrint = orderData.people?.filter(p => p.name && p.items?.some(i => i.name)) || [];
        const additionalFees = orderData.payment?.additionalFees || [];
        const invoiceHTML = ` <div class="invoice-header"> <h2>THERON Tailors</h2> <p>Order Slip / Invoice</p> <p>Order ID: <strong>${orderData.billNumber || 'N/A'}</strong></p> </div> <div class="details-grid"> <div> <h5>Customer Details:</h5> <p>Name: ${orderData.customer?.name || 'N/A'}</p> <p>Phone: ${orderData.customer?.number || 'N/A'}</p> </div> <div> <h5>Order Dates:</h5> <p>Order Date: ${orderDateFormatted}</p> <p>Delivery Date: ${deliveryDateFormatted}</p> </div> </div> <div class="items-section"> <h3>Order Items</h3> <table> <thead><tr><th>#</th><th>Person</th><th>Item</th><th>Price</th></tr></thead> <tbody> ${validPeopleForPrint.flatMap((person, pIdx) => person.items.map((item, iIdx) => ` <tr> <td>${pIdx * (person.items?.length || 0) + iIdx + 1}</td> <td>${person.name || `Person ${pIdx + 1}`}</td> <td> ${item.name || 'N/A'} ${item.notes ? `<div class="item-notes">Notes: ${item.notes}</div>` : ''} </td> <td>${formatCurrency(item.price)}</td> </tr> `) ).join('')} </tbody> </table> </div> <div class="totals-section"> <div class="totals-box"> <div><span>Subtotal:</span> <span>${formatCurrency(orderData.payment?.subtotal)}</span></div> ${additionalFees.map(fee => `<div><span>${fee.description || 'Additional Fee'}:</span> <span>${formatCurrency(fee.amount)}</span></div>`).join('')} ${orderData.payment?.calculatedDiscount > 0 ? `<div><span>Discount (${orderData.payment?.discountType === 'percent' ? `${orderData.payment?.discountValue}%` : 'Fixed'}):</span> <span>-${formatCurrency(orderData.payment?.calculatedDiscount)}</span></div>` : ''} <div class="grand-total" style="border-top: 1px solid #ccc; padding-top: 0.3em; margin-top: 0.3em;"><span>Grand Total:</span> <span>${formatCurrency(orderData.payment?.total)}</span></div> <div><span>Advance Paid (${orderData.payment?.method || 'N/A'}):</span> <span>${formatCurrency(orderData.payment?.advance)}</span></div> <div class="due"><span>Amount Due:</span> <span>${formatCurrency(orderData.payment?.pending)}</span></div> </div> </div> ${orderData.notes ? `<div style="margin-top: 1.5em; border-top: 1px dashed #ccc; padding-top: 1em;"><h5 style="font-size: 1em; margin-bottom: 0.3em;">Order Notes:</h5><p style="font-size: 0.85em; white-space: pre-wrap;">${orderData.notes}</p></div>` : ''} <div class="footer">Thank you!</div> `;
        printWindow.document.write(`<html><head><title>Invoice: ${orderData.billNumber || 'Order'}</title><style>${printStyles}</style></head><body>${invoiceHTML}</body></html>`);
        printWindow.document.close(); printWindow.focus();
        setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
    };

    // Print Measurements Handler
    const handlePrintMeasurements = (personName, item) => {
        if (!item || !item.measurements || typeof item.measurements !== 'object') { alert('No measurements available.'); return; } const measurementEntries = Object.entries(item.measurements).filter(([, value]) => value); if (measurementEntries.length === 0) { alert('No measurements recorded.'); return; } const printWindow = window.open('', '_blank', 'height=500,width=400'); if (!printWindow) { alert("Please allow popups."); return; } const measurementStyles = ` body { font-family: monospace; margin: 5px; font-size: 12px; line-height: 1.4; max-width: 280px; word-wrap: break-word; } h3 { font-size: 14px; font-weight: bold; margin: 10px 0 5px 0; text-transform: uppercase; border-top: 1px dashed #000; padding-top: 5px;} p { font-size: 11px; margin: 0 0 8px 0; } strong { font-weight: bold; } ul { list-style: none; padding: 0; margin: 0 0 10px 0; } li { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 2px; border-bottom: 1px dotted #ccc; padding-bottom: 2px; } li span:first-child { padding-right: 10px; flex-shrink: 0; } li span:last-child { font-weight: bold; text-align: right; } .header-info { margin-bottom: 10px; } .divider { border-top: 1px dashed #000; margin: 8px 0; } `; const measurementHTML = ` <h3>${item.name || 'Item'} Measurements</h3> <div class="header-info"> <p><strong>Order:</strong> ${detailModalOrder?.billNumber || 'N/A'}</p> <p><strong>Cust:</strong> ${detailModalOrder?.customer?.name || 'N/A'}</p> <p><strong>Person:</strong> ${personName || 'N/A'}</p> </div> <div class="divider"></div> <ul> ${measurementEntries.map(([key, value]) => `<li><span>${key}:</span> <span>${value}</span></li>`).join('')} </ul> `; printWindow.document.write(`<html><head><title>Meas: ${item.name}</title><style>${measurementStyles}</style></head><body>${measurementHTML}</body></html>`); printWindow.document.close(); printWindow.focus(); setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
    };


    // --- RENDER ---
    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl md:text-3xl font-bold text-[#393E41]">Orders</h1>
                <p className="mt-1 text-sm md:text-base text-[#6C757D]">View, manage, and track customer orders.</p>
            </header>

            <Card>
                {/* Search, Filter Toggle, Add Button Row */}
                <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-4">
                    <div className="w-full md:max-w-xs lg:max-w-sm">
                        <Input
                            id="orderSearch"
                            placeholder="Search ID, Name, Number..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            type="search"
                         />
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <Button
                            onClick={() => setShowFilters(!showFilters)}
                            variant="secondary"
                            className="flex items-center gap-1.5 flex-grow md:flex-grow-0"
                            aria-expanded={showFilters}
                        >
                            <FiFilter /> {showFilters ? 'Hide Filters' : 'Show Filters'}
                        </Button>
                        <Button
                            onClick={() => navigate('/orders/new')}
                            variant="primary"
                            className="flex items-center gap-2 flex-grow md:flex-grow-0"
                        >
                            <FiPlus /> New Order
                        </Button>
                    </div>
                </div>

                {/* Filter Section Component */}
                <FilterSection
                    filters={filters}
                    onFilterChange={handleFilterChange}
                    onResetFilters={resetFilters}
                    itemStatusOptions={ITEM_STATUS_OPTIONS}
                    isVisible={showFilters}
                />

                {/* Orders Table */}
                {ordersLoading ? (
                    <div className="py-16 flex justify-center"><Spinner /></div>
                ) : (
                    <div className="overflow-x-auto">
                        <div className="mb-2 text-sm text-gray-500">
                            Showing {filteredOrders.length} of {orders?.length || 0} orders
                        </div>
                        <table className="w-full min-w-[768px] text-left text-sm">
                            <thead className="border-b-2 border-[#E0E0E0] bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 font-semibold uppercase text-[#6C757D] tracking-wider">Order ID</th>
                                    <th className="px-4 py-3 font-semibold uppercase text-[#6C757D] tracking-wider">Customer</th>
                                    <th className="px-4 py-3 font-semibold uppercase text-[#6C757D] tracking-wider"><FiCalendar className="inline mr-1"/> Delivery</th>
                                    <th className="px-4 py-3 font-semibold uppercase text-[#6C757D] tracking-wider text-right">Total (₹)</th>
                                    <th className="px-4 py-3 font-semibold uppercase text-[#6C757D] tracking-wider text-right"><FiAlertCircle className="inline mr-1"/> Pending (₹)</th>
                                    <th className="px-4 py-3 font-semibold uppercase text-[#6C757D] tracking-wider text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E0E0E0]">
                                {filteredOrders.length > 0 ? filteredOrders.map(order => (
                                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3 font-mono text-[#393E41]">{order.billNumber || 'N/A'}</td>
                                        <td className="px-4 py-3 font-medium text-[#393E41]">
                                            {order.customer?.name || 'N/A'}
                                            <br/>
                                            <span className="text-[#6C757D] text-xs">{order.customer?.number || ''}</span>
                                        </td>
                                        <td className="px-4 py-3 text-[#393E41] whitespace-nowrap">{formatDate(order.deliveryDate)}</td>
                                        <td className="px-4 py-3 text-right font-mono text-[#393E41]">{formatCurrency(order.payment?.total)}</td>
                                        <td className={`px-4 py-3 text-right font-mono font-semibold ${(order.payment?.pending || 0) > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                                            {formatCurrency(order.payment?.pending)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex justify-center items-center gap-1.5">
                                                <Button
                                                    onClick={() => setDetailModalOrder(JSON.parse(JSON.stringify(order)))}
                                                    variant="secondary"
                                                    className="px-2 py-1 text-xs flex items-center gap-1"
                                                    title="View Details"
                                                >
                                                     <FiList/> Details
                                                </Button>
                                                <Button
                                                    onClick={() => navigate(`/orders/edit/${order.id}`)}
                                                    variant="secondary"
                                                    className="p-1.5"
                                                    aria-label={`Edit order ${order.billNumber}`}
                                                    title="Edit Order"
                                                >
                                                    <FiEdit />
                                                </Button>
                                                <Button
                                                    onClick={() => handleDeleteOrder(order.id, order.billNumber)}
                                                    variant="danger"
                                                    className="p-1.5"
                                                    aria-label={`Delete order ${order.billNumber}`}
                                                    disabled={isDeleting}
                                                    title="Delete Order"
                                                >
                                                    <FiTrash2 />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan="6" className="py-10 text-center text-[#6C757D]">No orders found matching criteria.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* Order Detail Modal */}
            <Modal isOpen={!!detailModalOrder} onClose={() => setDetailModalOrder(null)} title={`Order Details: ${detailModalOrder?.billNumber || ''}`}>
                <div className="max-h-[calc(100vh-14rem)] overflow-y-auto pr-3">
                    <div id="printable-invoice">
                        {/* Details Grid */}
                        <div className="grid grid-cols-2 gap-4 mb-4 border-b pb-4 details-grid">
                            <div> <h5 className="font-semibold text-[#393E41]">Customer:</h5> <p>{detailModalOrder?.customer?.name}</p> <p>{detailModalOrder?.customer?.number}</p> </div>
                            <div> <h5 className="font-semibold text-[#393E41]">Dates:</h5>
                                <p>Order: {formatDate(getOrderField(detailModalOrder, ['orderDate']))}</p>
                                <p>Delivery: {formatDate(getOrderField(detailModalOrder, ['deliveryDate']))}</p>
                            </div>
                        </div>
                        {/* Items List Section */}
                        <div className="space-y-4 items-section">
                             <h4 className="text-lg font-semibold text-[#393E41] mb-2">Items & Status</h4>
                            {detailModalOrder?.people?.map((person, pIdx) => (
                                <div key={`modal-person-${pIdx}`} className="rounded-md border border-[#E0E0E0] p-4 bg-gray-50/50 item-card">
                                    <h5 className="text-md font-semibold text-[#393E41] mb-2">{person.name || `Person ${pIdx + 1}`}</h5>
                                    {person.items?.map((item, iIdx) => (
                                        <div key={item.id || `modal-item-${iIdx}`} className="mt-3 border-t border-[#E0E0E0] pt-3">
                                            {/* Item Header & Print Measurements */}
                                            <div className="flex justify-between items-start item-card-header mb-1">
                                                <div className="flex-grow mr-2">
                                                    <span className="font-semibold text-[#44BBA4] item-name block break-words">{item.name || 'N/A'}</span>
                                                    <span className="font-semibold text-sm text-gray-700 item-price block">{formatCurrency(item.price)}</span>
                                                </div>
                                                <div className="flex-shrink-0 no-print mt-1 no-print-invoice">
                                                    <Button
                                                        onClick={() => handlePrintMeasurements(person.name, item)}
                                                        variant="secondary"
                                                        className="px-2 py-1 text-xs flex items-center gap-1"
                                                        disabled={!item.measurements || Object.values(item.measurements).every(v => !v)}
                                                        aria-label={`Print measurements for ${item.name}`}
                                                    >
                                                        <FiMaximize size={14}/> Print Meas. {/* Using FiMaximize */}
                                                    </Button>
                                                </div>
                                            </div>
                                            {/* Measurement Section */}
                                            <div className="measurement-section-for-print text-xs text-[#6C757D] mt-2">
                                                {item.measurements && typeof item.measurements === 'object' && Object.values(item.measurements).some(v => v) ? (
                                                    <>
                                                    <strong className="text-[#393E41] font-medium block mb-1">Measurements:</strong>
                                                    <ul className="list-disc list-inside grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 measurements-list">
                                                        {Object.entries(item.measurements).filter(([, value]) => value).map(([key, value]) => ( <li key={key}>{key}: <strong>{value}</strong></li> ))}
                                                    </ul>
                                                    </>
                                                ) : null}
                                            </div>
                                            {/* Notes & Design */}
                                            {item.notes && <p className="text-xs text-[#393E41] mt-2 italic item-notes">Notes: {item.notes}</p>}
                                            {item.designPhoto && <p className="text-xs mt-1 no-print no-print-invoice"><a href={item.designPhoto} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">View Design</a></p>}

                                            {/* Status & Assignment Controls */}
                                            <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-3 no-print no-print-invoice">
                                                <Select
                                                    label="Status"
                                                    id={`status-${pIdx}-${iIdx}`}
                                                    value={item.status || 'Received'}
                                                    onChange={(e) => handleStatusChange(pIdx, iIdx, e.target.value)}
                                                >
                                                    {ITEM_STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                                                </Select>
                                                {/* Assign Cutter Dropdown */}
                                                <Select
                                                    label={<span className="flex items-center gap-1"><FiScissors size={14}/> Cutter</span>}
                                                    id={`cutter-${pIdx}-${iIdx}`}
                                                    value={item.cutter || ''}
                                                    onChange={e => handleWorkerAssign(pIdx, iIdx, 'cutter', e.target.value)}
                                                >
                                                    <option value="">Unassigned</option>
                                                    {/* Map over filtered cutters */}
                                                    {workerOptions.cutters.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                                                </Select>
                                                {/* Assign Sewer Dropdown */}
                                                <Select
                                                    label={<span className="flex items-center gap-1"><FiPocket size={14}/> Sewer</span>}
                                                    id={`sewer-${pIdx}-${iIdx}`}
                                                    value={item.sewer || ''}
                                                    onChange={e => handleWorkerAssign(pIdx, iIdx, 'sewer', e.target.value)}
                                                >
                                                    <option value="">Unassigned</option>
                                                     {/* Map over filtered sewers */}
                                                    {workerOptions.sewers.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                                                </Select>
                                            </div>
                                            {/* Notify Button */}
                                            <div className="mt-3 text-right no-print no-print-invoice">
                                                <Button variant="secondary" onClick={() => handleNotify(detailModalOrder.customer, item)} disabled={!detailModalOrder.customer?.number} className="px-2.5 py-1 text-xs flex items-center gap-1"> <FiSend/> Notify </Button>
                                            </div>
                                        </div>
                                    ))}
                                    {!person.items?.length && <p className="text-sm text-[#6C757D]">No items for this person.</p>}
                                </div>
                            ))}
                            {!detailModalOrder?.people?.length && <p className="text-center text-[#6C757D]">No people or items found.</p>}
                        </div>
                        {/* Payment Summary */}
                        <div className="mt-6 border-t pt-4 payment-summary">
                            <h5 className="text-lg font-semibold text-[#393E41]">Payment Summary</h5>
                            <div className="flex justify-end mt-2 text-sm">
                                <div className="w-full max-w-xs space-y-1">
                                    <div className="flex justify-between"> <span className="text-[#6C757D]">Subtotal:</span> <span className="font-mono text-[#393E41]">{formatCurrency(detailModalOrder?.payment?.subtotal)}</span> </div>
                                    {(detailModalOrder?.payment?.additionalFees || []).map((fee, idx) => ( <div key={idx} className="flex justify-between"> <span className="text-[#6C757D]">{fee.description || 'Fee'}:</span> <span className="font-mono text-[#393E41]">{formatCurrency(fee.amount)}</span> </div> ))}
                                    {detailModalOrder?.payment?.calculatedDiscount > 0 && ( <div className="flex justify-between"> <span className="text-[#6C757D]">Discount:</span> <span className="font-mono text-green-600">-{formatCurrency(detailModalOrder?.payment?.calculatedDiscount)}</span> </div> )}
                                    <div className="flex justify-between font-bold border-t pt-1 mt-1 grand-total"> <span className="text-[#393E41]">Total:</span> <span className="font-mono text-[#393E41]">{formatCurrency(detailModalOrder?.payment?.total)}</span> </div>
                                    <div className="flex justify-between"> <span className="text-[#6C757D]">Advance ({detailModalOrder?.payment?.method || 'N/A'}):</span> <span className="font-mono text-[#393E41]">{formatCurrency(detailModalOrder?.payment?.advance)}</span> </div>
                                    <div className="flex justify-between font-semibold text-base border-t pt-1 mt-1 due"> <span className="text-[#393E41]">Due:</span> <span className={`font-mono ${detailModalOrder?.payment?.pending > 0 ? 'text-orange-600' : 'text-green-600'}`}>{formatCurrency(detailModalOrder?.payment?.pending)}</span> </div>
                                </div>
                            </div>
                        </div>
                    </div> {/* End #printable-invoice */}
                </div> {/* End Scrollable Wrapper */}

                {/* Modal Footer */}
                <div className="flex justify-end gap-3 pt-4 border-t mt-4 no-print">
                     <Button type="button" onClick={handlePrintInvoice} variant="secondary" className="flex items-center gap-2"> <FiPrinter /> Print Invoice </Button>
                     <Button type="button" onClick={() => setDetailModalOrder(null)} variant="primary"> Close </Button>
                 </div>
            </Modal>
        </div>
    );
};

export default OrderListPage;