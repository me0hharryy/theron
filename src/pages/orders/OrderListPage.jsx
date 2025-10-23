import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { db, getCollectionPath } from '../../firebase';
// Import deleteDoc
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import Select from '../../components/ui/Select';

// Icons
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>;
const PrintIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>;
const RulerIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6.75a4.5 4.5 0 1 1-9 0a4.5 4.5 0 0 1 9 0zM18.75 10.5h.008v.008h-.008V10.5zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0zm-1.5.375a.375.375 0 1 0 0-.75.375.375 0 0 0 0 .75zm-.375.375h.008v.008h-.008V11.25zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0zm-1.5.375a.375.375 0 1 0 0-.75.375.375 0 0 0 0 .75zm-.375.375h.008v.008h-.008V12zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0zm-1.5.375a.375.375 0 1 0 0-.75.375.375 0 0 0 0 .75zm-.375.375h.008v.008h-.008V12.75zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0zm-1.5.375a.375.375 0 1 0 0-.75.375.375 0 0 0 0 .75zm-.375.375h.008v.008h-.008V13.5zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0zm-1.5.375a.375.375 0 1 0 0-.75.375.375 0 0 0 0 .75z M4.5 19.5l15-15" /></svg>
// Added Trash Icon
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>;


const OrderListPage = () => {
    const { orders, ordersLoading, workers } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [detailModalOrder, setDetailModalOrder] = useState(null);
    const navigate = useNavigate();

    // Memoized filtering
    const filteredOrders = useMemo(() => {
        if (!orders) return [];
        const lowerSearchTerm = searchTerm.toLowerCase();
        if (!lowerSearchTerm) return orders;
        return orders.filter(order =>
            order.customer?.name?.toLowerCase().includes(lowerSearchTerm) ||
            order.customer?.number?.includes(lowerSearchTerm) ||
            order.billNumber?.toLowerCase().includes(lowerSearchTerm)
        );
    }, [searchTerm, orders]);

    // Memoized worker options
    const workerOptions = useMemo(() => {
        if (!workers) return { cutters: [], sewers: [] };
        const cutters = workers.filter(w => w.specialization?.toLowerCase().includes('cut')).map(w => ({ value: w.name, label: w.name }));
        const sewers = workers.filter(w => w.specialization?.toLowerCase().includes('sew')).map(w => ({ value: w.name, label: w.name }));
        return { cutters, sewers };
    }, [workers]);

    // Update item status
    const handleStatusChange = async (personIndex, itemIndex, newStatus) => {
        // ... (no changes needed)
        if (!detailModalOrder) return;
        const orderToUpdate = JSON.parse(JSON.stringify(detailModalOrder));
        if (orderToUpdate.people?.[personIndex]?.items?.[itemIndex]) {
            if (orderToUpdate.people[personIndex].items[itemIndex].status !== newStatus) {
                orderToUpdate.people[personIndex].items[itemIndex].status = newStatus;
                setDetailModalOrder(orderToUpdate);
                try {
                    const orderPath = getCollectionPath('orders');
                    const orderDocRef = doc(db, orderPath, detailModalOrder.id);
                    await updateDoc(orderDocRef, { people: orderToUpdate.people });
                } catch (error) { console.error("Error updating item status:", error); alert("Failed to update status."); setDetailModalOrder(JSON.parse(JSON.stringify(detailModalOrder))); }
            }
        } else { console.error("Could not find item to update status."); }
    };

    // Assign worker
    const handleWorkerAssign = async (personIndex, itemIndex, workerType, workerName) => {
        // ... (no changes needed)
        if (!detailModalOrder || (workerType !== 'cutter' && workerType !== 'sewer')) return;
        const orderToUpdate = JSON.parse(JSON.stringify(detailModalOrder));
        if (orderToUpdate.people?.[personIndex]?.items?.[itemIndex]) {
            if (orderToUpdate.people[personIndex].items[itemIndex][workerType] !== workerName) {
                orderToUpdate.people[personIndex].items[itemIndex][workerType] = workerName;
                setDetailModalOrder(orderToUpdate);
                try {
                    const orderPath = getCollectionPath('orders');
                    const orderDocRef = doc(db, orderPath, detailModalOrder.id);
                    await updateDoc(orderDocRef, { people: orderToUpdate.people });
                } catch (error) { console.error(`Error assigning ${workerType}:`, error); alert(`Failed to assign ${workerType}.`); setDetailModalOrder(JSON.parse(JSON.stringify(detailModalOrder))); }
            }
        } else { console.error("Could not find item to assign worker."); }
    };

    // Notify customer
    const handleNotify = (customer, item) => {
        // ... (no changes needed)
        if (!customer?.number) { alert("Customer phone number is not available."); return; }
        const message = `Hi ${customer.name || 'Customer'}, update on your order ${detailModalOrder?.billNumber}: Item '${item.name || 'Unknown'}' is now '${item.status || 'Updated'}'. - Theron Tailors`;
        alert(`Notification simulated for ${customer.name}.\nMessage: ${message}`);
    };

    // --- HELPER FUNCTIONS ---
    const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);
    const formatDate = (timestamp) => {
        if (timestamp && typeof timestamp.toDate === 'function') { return timestamp.toDate().toLocaleDateString('en-GB'); } return 'N/A';
    };

    // --- *** NEW DELETE ORDER HANDLER *** ---
    const handleDeleteOrder = async (orderId, orderBillNumber) => {
        const confirmationMessage = `Are you sure you want to delete order "${orderBillNumber || orderId}"? This action cannot be undone.`;
        if (window.confirm(confirmationMessage)) {
            try {
                const orderPath = getCollectionPath('orders');
                const orderDocRef = doc(db, orderPath, orderId);
                await deleteDoc(orderDocRef);
                // Optionally: Close modal if the deleted order was open
                if (detailModalOrder && detailModalOrder.id === orderId) {
                    setDetailModalOrder(null);
                }
                // Data will refresh automatically due to the listener in DataContext
            } catch (error) {
                console.error("Error deleting order:", error);
                alert("Failed to delete the order. Please try again.");
            }
        }
    };

    // --- PRINT INVOICE HANDLER (Beautified, Excludes Measurements) ---
    const handlePrintInvoice = () => {
        const invoiceContentElement = document.getElementById('printable-invoice');
        if (!invoiceContentElement) return;
        const invoiceContentClone = invoiceContentElement.cloneNode(true);
        const measurementSections = invoiceContentClone.querySelectorAll('.measurement-section-for-print');
        measurementSections.forEach(section => section.remove());

        const printWindow = window.open('', '_blank', 'height=800,width=800'); // Slightly larger window
        if (!printWindow) { alert("Please allow popups to print."); return; }

        // --- BEAUTIFIED INVOICE STYLES ---
        const printStyles = `
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
            body { 
                font-family: 'Inter', sans-serif; 
                margin: 20px; 
                line-height: 1.5; 
                color: #333;
                background-color: #fff; /* Ensure white background */
            }
            .no-print { display: none !important; }
            .invoice-header { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #eee; padding-bottom: 15px; }
            .invoice-header h2 { font-size: 1.8em; font-weight: 700; color: #44BBA4; margin: 0 0 5px 0; }
            .invoice-header p { font-size: 0.9em; color: #555; margin: 0; }
            .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 1px dashed #ccc; }
            .details-grid h5 { font-size: 1.1em; font-weight: 600; color: #44BBA4; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
            .details-grid p { font-size: 0.9em; color: #555; margin: 0 0 4px 0; }
            .items-section h4 { font-size: 1.2em; font-weight: 600; color: #333; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
            .item-card { 
                border: 1px solid #eee; 
                border-radius: 6px; 
                padding: 15px; 
                margin-bottom: 15px; 
                break-inside: avoid; 
                background-color: #f9f9f9; /* Light background for items */
            }
            .item-card-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
            .item-card-header .item-name { font-size: 1.1em; font-weight: 600; color: #44BBA4; }
            .item-card-header .item-price { font-size: 1em; font-weight: 600; color: #333; font-family: monospace; }
            .item-card .item-notes { font-size: 0.85em; color: #666; font-style: italic; margin-top: 8px; }
            .payment-summary { margin-top: 30px; border-top: 2px solid #eee; padding-top: 15px; }
            .payment-summary h5 { font-size: 1.15em; font-weight: 600; color: #333; margin-bottom: 10px; }
            .payment-grid { display: flex; justify-content: flex-end; margin-top: 5px; }
            .payment-grid div { text-align: right; font-size: 0.95em; }
            .payment-grid div:first-child { padding-right: 25px; color: #555; }
            .payment-grid div:last-child { font-weight: 600; color: #333; min-width: 100px; font-family: monospace; }
            .payment-grid .pending strong { color: #DC2626; } /* Red */
            .footer { margin-top: 30px; text-align: center; font-size: 0.8em; color: #888; border-top: 1px dashed #ccc; padding-top: 10px; }
        `;

        printWindow.document.write(`
            <html><head><title>Invoice: ${detailModalOrder?.billNumber || 'Order'}</title><style>${printStyles}</style></head>
            <body>
                <div class="invoice-header">
                    <h2>THERON Tailors</h2>
                    <p>Order Slip / Invoice</p>
                    <p>Order ID: <strong>${detailModalOrder?.billNumber || 'N/A'}</strong></p>
                </div>
                ${invoiceContentClone.innerHTML}
                <div class="footer">Thank you for your business!</div>
            </body></html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); printWindow.close(); }, 300); // Slightly longer timeout
    };

    // --- PRINT MEASUREMENTS HANDLER (Thermal Printer Optimized) ---
    const handlePrintMeasurements = (personName, item) => {
        if (!item || !item.measurements || typeof item.measurements !== 'object') { alert('No measurements available.'); return; }
        const measurementEntries = Object.entries(item.measurements).filter(([_key, value]) => value);
        if (measurementEntries.length === 0) { alert('No measurements recorded.'); return; }

        const printWindow = window.open('', '_blank', 'height=500,width=400'); // Narrower window
        if (!printWindow) { alert("Please allow popups to print."); return; }

        // --- THERMAL PRINTER STYLES ---
        const measurementStyles = `
            body { 
                font-family: monospace; /* Common thermal printer font */
                margin: 5px; /* Minimal margin */
                font-size: 12px; /* Adjust as needed for your printer */
                line-height: 1.4;
                max-width: 280px; /* Adjust based on paper width (e.g., 80mm ~ 300px) */
                word-wrap: break-word; /* Wrap long lines */
            }
            h3 { font-size: 14px; font-weight: bold; margin: 10px 0 5px 0; text-transform: uppercase; border-top: 1px dashed #000; padding-top: 5px;}
            p { font-size: 11px; margin: 0 0 8px 0; }
            strong { font-weight: bold; }
            ul { list-style: none; padding: 0; margin: 0 0 10px 0; }
            li { 
                display: flex; /* Use flexbox for alignment */
                justify-content: space-between; /* Space out key and value */
                font-size: 13px; /* Slightly larger for measurements */
                margin-bottom: 2px;
                border-bottom: 1px dotted #ccc; 
                padding-bottom: 2px;
            }
            li span:first-child { /* Measurement name */
                padding-right: 10px;
                flex-shrink: 0; /* Prevent name from shrinking too much */
            }
             li span:last-child { /* Measurement value */
                font-weight: bold;
                text-align: right;
            }
            .header-info { margin-bottom: 10px; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
        `;

        const measurementHTML = `
            <h3>${item.name || 'Item'} Measurements</h3>
            <div class="header-info">
                <p><strong>Order:</strong> ${detailModalOrder?.billNumber || 'N/A'}</p>
                <p><strong>Cust:</strong> ${detailModalOrder?.customer?.name || 'N/A'}</p>
                <p><strong>Person:</strong> ${personName || 'N/A'}</p>
            </div>
            <div class="divider"></div>
            <ul>
                ${measurementEntries.map(([key, value]) => `<li><span>${key}:</span> <span>${value}</span></li>`).join('')}
            </ul>
        `;

        printWindow.document.write(`
            <html><head><title>Meas: ${item.name}</title><style>${measurementStyles}</style></head>
            <body>${measurementHTML}</body></html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
    };


    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl md:text-3xl font-bold text-[#393E41]">Orders</h1>
                <p className="mt-1 text-sm md:text-base text-[#6C757D]">View, manage, and track all customer orders.</p>
            </header>

            <Card>
                {/* Search and Add Button */}
                <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-4">
                    <div className="w-full md:max-w-xs lg:max-w-sm">
                        <Input id="orderSearch" placeholder="Search ID, Name, Number..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} type="search"/>
                    </div>
                    <Button onClick={() => navigate('/orders/new')} variant="primary" className="flex items-center gap-2 w-full md:w-auto flex-shrink-0"><PlusIcon /> Place New Order</Button>
                </div>

                {/* Orders Table */}
                {ordersLoading ? ( <div className="py-16 flex justify-center"><Spinner /></div> ) : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[768px] text-left text-sm">
                        <thead className="border-b-2 border-[#E0E0E0] bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 font-semibold uppercase text-[#6C757D] tracking-wider">Order ID</th>
                                <th className="px-4 py-3 font-semibold uppercase text-[#6C757D] tracking-wider">Customer</th>
                                <th className="px-4 py-3 font-semibold uppercase text-[#6C757D] tracking-wider">Delivery Date</th>
                                <th className="px-4 py-3 font-semibold uppercase text-[#6C757D] tracking-wider text-right">Total (₹)</th>
                                <th className="px-4 py-3 font-semibold uppercase text-[#6C757D] tracking-wider text-right">Pending (₹)</th>
                                <th className="px-4 py-3 font-semibold uppercase text-[#6C757D] tracking-wider text-center">Actions</th> {/* Centered Actions */}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E0E0E0]">
                            {filteredOrders && filteredOrders.length > 0 ? filteredOrders.map(order => (
                                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 font-mono text-[#393E41]">{order.billNumber || 'N/A'}</td>
                                    <td className="px-4 py-3 font-medium text-[#393E41]">{order.customer?.name || 'N/A'} <br/><span className="text-[#6C757D] text-xs">{order.customer?.number || ''}</span></td>
                                    <td className="px-4 py-3 text-[#393E41]">{formatDate(order.deliveryDate)}</td>
                                    <td className="px-4 py-3 text-right font-mono text-[#393E41]">{formatCurrency(order.payment?.total)}</td>
                                    <td className={`px-4 py-3 text-right font-mono font-semibold ${(order.payment?.pending || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(order.payment?.pending)}</td>
                                    <td className="px-4 py-3">
                                        {/* --- UPDATED ACTIONS: Added Delete Button --- */}
                                        <div className="flex justify-center items-center gap-1.5"> {/* Centered Buttons */}
                                            <Button onClick={() => setDetailModalOrder(order)} variant="secondary" className="px-2 py-1 text-xs">Details</Button>
                                            <Button onClick={() => navigate(`/orders/edit/${order.id}`)} variant="secondary" className="p-1.5" aria-label={`Edit order ${order.billNumber}`}><EditIcon /></Button>
                                            <Button 
                                                onClick={() => handleDeleteOrder(order.id, order.billNumber)} 
                                                variant="danger" 
                                                className="p-1.5" 
                                                aria-label={`Delete order ${order.billNumber}`}
                                            >
                                                <TrashIcon />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            )) : ( <tr><td colSpan="6" className="py-10 text-center text-[#6C757D]">No orders found matching your search.</td></tr> )}
                        </tbody>
                    </table>
                </div>
                )}
            </Card>

            {/* Order Detail Modal */}
            <Modal isOpen={!!detailModalOrder} onClose={() => setDetailModalOrder(null)} title={`Order Details: ${detailModalOrder?.billNumber || ''}`}>
                
                {/* Printable Invoice Area (Measurements hidden via class removal in print handler) */}
                <div id="printable-invoice">
                    {/* Invoice Header (will be replaced by styles in print) */}
                    <div className="mb-4 no-print"> <h2 className="text-2xl font-bold text-[#393E41]">Invoice / Order Slip</h2> <p className="text-sm text-[#6C757D]">Order ID: {detailModalOrder?.billNumber}</p> </div>
                    <div className="grid grid-cols-2 gap-4 mb-4 border-b pb-4 details-grid">
                        <div> <h5 className="font-semibold text-[#393E41]">Customer Details:</h5> <p>Name: {detailModalOrder?.customer?.name}</p> <p>Phone: {detailModalOrder?.customer?.number}</p> </div>
                        <div> <h5 className="font-semibold text-[#393E41]">Order Dates:</h5> <p>Order Date: {formatDate(detailModalOrder?.orderDate)}</p> <p>Delivery Date: {formatDate(detailModalOrder?.deliveryDate)}</p> </div>
                    </div>

                    {/* Items List */}
                    <div className="space-y-4 items-section">
                        {detailModalOrder?.people?.map((person, pIdx) => (
                            <div key={`modal-person-${pIdx}`} className="rounded-md border border-[#E0E0E0] p-4 bg-gray-50/50 item-card">
                                <h4 className="text-lg font-semibold text-[#393E41] mb-2">{person.name || `Person ${pIdx + 1}`}</h4>
                                {person.items?.map((item, iIdx) => (
                                    <div key={item.id || `modal-item-${iIdx}`} className="mt-3 border-t border-[#E0E0E0] pt-3">
                                        <div className="flex justify-between items-start item-card-header">
                                            <span className="font-semibold text-[#44BBA4] item-name">{item.name || 'N/A'}</span>
                                            <span className="font-semibold text-right item-price">{formatCurrency(item.price)}</span>
                                        </div>
                                         {/* --- PRINT MEASUREMENTS BUTTON (per item) --- */}
                                         <div className="text-right -mt-2 mb-2 no-print"> {/* Adjusted positioning */}
                                            <Button
                                                onClick={() => handlePrintMeasurements(person.name, item)}
                                                variant="secondary"
                                                className="px-2 py-1 text-xs flex items-center gap-1 ml-auto" // Float right effectively
                                                disabled={!item.measurements || Object.values(item.measurements).every(v => !v)}
                                                aria-label={`Print measurements for ${item.name}`}
                                            >
                                                <RulerIcon /> Print Meas.
                                            </Button>
                                        </div>

                                        {/* --- Measurement Section (Hidden on INVOICE print via class removal) --- */}
                                        <div className="measurement-section-for-print">
                                            {item.measurements && typeof item.measurements === 'object' && Object.values(item.measurements).some(v => v) ? (
                                                <div className="text-xs text-[#6C757D] mt-2">
                                                    <strong className="text-[#393E41] font-medium block mb-1">Measurements:</strong>
                                                    <ul className="list-disc list-inside grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 measurements-list">
                                                        {Object.entries(item.measurements).filter(([, value]) => value).map(([key, value]) => (
                                                            <li key={key}>{key}: <strong>{value}</strong></li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ) : null}
                                        </div>
                                        {/* --- End Measurement Section --- */}


                                        {item.notes && <p className="text-xs text-[#393E41] mt-2 italic item-notes">Notes: {item.notes}</p>}
                                        {item.designPhoto && <p className="text-xs mt-1 no-print"><a href={item.designPhoto} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">View Design</a></p>}

                                        {/* --- UI Controls (Hidden on Print) --- */}
                                        <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-3 no-print">
                                            <Select label="Status" id={`status-${pIdx}-${iIdx}`} value={item.status || 'Received'} onChange={(e) => handleStatusChange(pIdx, iIdx, e.target.value)}>
                                                <option>Received</option> <option>Cutting</option> <option>Sewing</option> <option>Ready for Trial</option> <option>Delivered</option>
                                            </Select>
                                            <Select label="Assign Cutter" id={`cutter-${pIdx}-${iIdx}`} value={item.cutter || ''} onChange={e => handleWorkerAssign(pIdx, iIdx, 'cutter', e.target.value)}>
                                                <option value="">Unassigned</option> {workerOptions.cutters.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                                            </Select>
                                            <Select label="Assign Sewer" id={`sewer-${pIdx}-${iIdx}`} value={item.sewer || ''} onChange={e => handleWorkerAssign(pIdx, iIdx, 'sewer', e.target.value)}>
                                                <option value="">Unassigned</option> {workerOptions.sewers.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                                            </Select>
                                        </div>
                                        <div className="mt-3 text-right no-print">
                                            <Button variant="secondary" onClick={() => handleNotify(detailModalOrder.customer, item)} disabled={!detailModalOrder.customer?.number} className="px-2.5 py-1 text-xs"> Notify Customer </Button>
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
                        <div className="flex justify-end space-x-8 mt-2 text-sm payment-grid">
                            <div className="text-right"> <p>Total Amount:</p> <p>Advance Paid:</p> <p className="font-bold">Pending Amount:</p> </div>
                            <div className="text-right font-mono"> <p>{formatCurrency(detailModalOrder?.payment?.total)}</p> <p>{formatCurrency(detailModalOrder?.payment?.advance)}</p> <p className="font-bold text-red-600 pending">{formatCurrency(detailModalOrder?.payment?.pending)}</p> </div>
                        </div>
                    </div>

                </div> {/* --- End of #printable-invoice --- */}

                {/* --- Modal Button Footer (Hidden on Print) --- */}
                <div className="flex justify-end gap-3 pt-4 border-t mt-4 no-print">
                    <Button type="button" onClick={handlePrintInvoice} variant="secondary" className="flex items-center gap-2">
                        <PrintIcon /> Print Invoice
                    </Button>
                    <Button type="button" onClick={() => setDetailModalOrder(null)} variant="primary">
                        Close
                    </Button>
                </div>
            </Modal>
        </div>
    );
};

export default OrderListPage;