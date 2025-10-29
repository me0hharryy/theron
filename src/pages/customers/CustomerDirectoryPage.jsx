// src/pages/customers/CustomerDirectoryPage.jsx
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
// --- Corrected Import Paths ---
import { useData } from '../../context/DataContext';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';

// --- Icons ---
import {
    FiUsers, FiSearch, FiPhone, FiMail, FiShoppingBag, FiDollarSign, FiCalendar, FiList, FiArrowRight, FiPlus // Added FiPlus for potential future use
} from 'react-icons/fi';

// --- Helper Functions ---
const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount ?? 0);
const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
        let dateObj = null;
        if (typeof timestamp.toDate === 'function') { dateObj = timestamp.toDate(); }
        else if (timestamp.seconds) { dateObj = new Date(timestamp.seconds * 1000); }
        else if (timestamp instanceof Date && !isNaN(timestamp)) { dateObj = timestamp; }
        else if (typeof timestamp === 'string') {
            // Attempt to parse YYYY-MM-DD or similar formats robustly
            const parsed = new Date(timestamp.replace(/-/g, '/')); // Replace dashes for broader compatibility
            if (!isNaN(parsed)) dateObj = parsed;
        }
        if (!dateObj || isNaN(dateObj)) return 'N/A';
        return dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); // e.g., 29 Oct 2025
    } catch (error) { console.error('Date formatting failed:', error, timestamp); return 'N/A'; }
};

// Function to generate a unique key for a customer
const getCustomerKey = (customer) => {
    if (!customer) return null;
    const name = (customer.name || '').trim().toLowerCase();
    const number = (customer.number || '').trim().replace(/\s+/g, ''); // Normalize phone number
    if (!name && !number) return null; // Ignore if both are empty
    return `${name}-${number}`; // Combine normalized name and number
};


const CustomerDirectoryPage = () => {
    const { orders, ordersLoading } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState(null); // Customer object for modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const navigate = useNavigate();

    // --- Process Orders to Extract Unique Customers and Stats ---
    const customerData = useMemo(() => {
        if (ordersLoading || !orders) {
            return { list: [], map: new Map() };
        }

        const customerMap = new Map();

        orders.forEach(order => {
            if (!order.customer) return; // Skip if no customer data

            const key = getCustomerKey(order.customer);
            if (!key) return; // Skip if key couldn't be generated

            const orderDate = order.orderDate; // Keep as timestamp for comparison
            const orderTotal = order.payment?.total || 0;

            if (customerMap.has(key)) {
                // Update existing customer stats
                const existing = customerMap.get(key);
                existing.totalOrders += 1;
                existing.totalSpent += orderTotal;
                // Update last order date if this order is newer
                if (orderDate && (!existing.lastOrderDate || orderDate.toMillis() > existing.lastOrderDate.toMillis())) {
                    existing.lastOrderDate = orderDate;
                     // Keep original customer object if name/number case differs slightly but key matches
                     // Prefer the one from the latest order if dates are valid
                     if (orderDate && (!existing.lastOrderDate || orderDate.toMillis() >= existing.lastOrderDate.toMillis())) {
                          existing.customerInfo = { ...order.customer }; // Update with potentially newer info
                     }
                }
                 // Add order details to history
                existing.orderHistory.push({
                     id: order.id,
                     billNumber: order.billNumber,
                     orderDate: order.orderDate,
                     total: order.payment?.total || 0,
                     pending: order.payment?.pending || 0
                });

            } else {
                // Add new customer
                customerMap.set(key, {
                    id: key, // Use the generated key as a unique ID
                    customerInfo: { ...order.customer }, // Store the first instance of customer info
                    totalOrders: 1,
                    totalSpent: orderTotal,
                    lastOrderDate: orderDate,
                    orderHistory: [{
                       id: order.id,
                       billNumber: order.billNumber,
                       orderDate: order.orderDate,
                       total: order.payment?.total || 0,
                       pending: order.payment?.pending || 0
                    }]
                });
            }
        });

         // Sort order history within each customer object (newest first)
         customerMap.forEach(customer => {
             customer.orderHistory.sort((a, b) => (b.orderDate?.toMillis() || 0) - (a.orderDate?.toMillis() || 0));
         });

        // Convert map values to an array and sort by name
        const customerList = Array.from(customerMap.values()).sort((a, b) =>
            (a.customerInfo.name || '').localeCompare(b.customerInfo.name || '')
        );

        return { list: customerList, map: customerMap };

    }, [orders, ordersLoading]);

    // --- Filter Customers Based on Search Term ---
    const filteredCustomers = useMemo(() => {
        if (!customerData.list) return [];
        const lowerSearchTerm = searchTerm.toLowerCase();
        if (!lowerSearchTerm) return customerData.list;

        return customerData.list.filter(customer =>
            customer.customerInfo.name?.toLowerCase().includes(lowerSearchTerm) ||
            customer.customerInfo.number?.replace(/\s+/g, '').includes(lowerSearchTerm.replace(/\s+/g, '')) || // Search normalized phone number
            customer.customerInfo.email?.toLowerCase().includes(lowerSearchTerm)
        );
    }, [customerData.list, searchTerm]);

    // --- Modal Handlers ---
    const handleOpenModal = (customer) => {
        setSelectedCustomer(customer);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedCustomer(null);
    };

     // --- Navigate to Order Page with Details ---
     const handleViewOrder = (orderId) => {
        if (!orderId) return;
        setIsModalOpen(false); // Close the customer modal first
        // Navigate to the OrderListPage and pass the orderId in state
        // OrderListPage useEffect will handle opening the detail modal
        navigate('/orders', { state: { openOrderDetailsId: orderId } });
    };

    const handleStartNewOrder = (customerInfo) => {
        setIsModalOpen(false); // Close modal
        // Navigate to new order form, potentially passing customer info
        // (OrderFormPage needs to be adapted to receive and use this state if passed)
        navigate('/orders/new', { state: { prefillCustomer: customerInfo } });
    };


    // --- Render Logic ---
    if (ordersLoading) {
        return <div className="py-16 flex justify-center"><Spinner /></div>;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div className='flex items-center gap-3'>
                    {/* Optional: Add an icon for the header */}
                    {/* <div className='p-3 bg-gray-100 rounded-full'>
                        <FiBookOpen className="w-6 h-6 text-[#44BBA4]" />
                    </div> */}
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-[#393E41]">Customer Directory</h1>
                        <p className="mt-1 text-sm md:text-base text-[#6C757D]">View customer information and order history.</p>
                    </div>
                </div>
                {/* Add New Customer button (redirects to New Order) */}
                 <Button onClick={() => navigate('/orders/new')} variant="primary" className="inline-flex items-center gap-2 w-full md:w-auto">
                    <FiPlus /> Add Customer (via New Order)
                </Button>
            </header>

            <Card>
                {/* Search Bar */}
                <div className="mb-4">
                    <Input
                        id="customerSearch"
                        placeholder="Search by Name, Phone, or Email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        type="search"
                        // Icon removed as Input component might not support it directly without modification
                    />
                </div>

                {/* Customer Table */}
                <div className="overflow-x-auto">
                    <div className="mb-2 text-sm text-gray-500">
                        Showing {filteredCustomers.length} of {customerData.list?.length || 0} unique customers
                    </div>
                    <table className="w-full min-w-[768px] text-left text-sm">
                        <thead className="border-b-2 border-[#E0E0E0] bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 font-semibold uppercase text-[#6C757D] tracking-wider">Name</th>
                                <th className="px-4 py-3 font-semibold uppercase text-[#6C757D] tracking-wider"><FiPhone className="inline mr-1"/> Phone</th>
                                <th className="px-4 py-3 font-semibold uppercase text-[#6C757D] tracking-wider"><FiMail className="inline mr-1"/> Email</th>
                                <th className="px-4 py-3 font-semibold uppercase text-[#6C757D] tracking-wider text-center"><FiShoppingBag className="inline mr-1"/> Orders</th>
                                <th className="px-4 py-3 font-semibold uppercase text-[#6C757D] tracking-wider text-right"><FiDollarSign className="inline mr-1"/> Total Spent</th>
                                <th className="px-4 py-3 font-semibold uppercase text-[#6C757D] tracking-wider"><FiCalendar className="inline mr-1"/> Last Order</th>
                                <th className="px-4 py-3 font-semibold uppercase text-[#6C757D] tracking-wider text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E0E0E0]">
                            {filteredCustomers.length > 0 ? filteredCustomers.map(customer => (
                                <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 font-medium text-[#393E41]">{customer.customerInfo.name || 'N/A'}</td>
                                    <td className="px-4 py-3 text-[#6C757D] whitespace-nowrap">{customer.customerInfo.number || '-'}</td>
                                    <td className="px-4 py-3 text-[#6C757D]">{customer.customerInfo.email || '-'}</td>
                                    <td className="px-4 py-3 text-center text-[#393E41]">{customer.totalOrders}</td>
                                    <td className="px-4 py-3 text-right font-mono text-[#393E41]">{formatCurrency(customer.totalSpent)}</td>
                                    <td className="px-4 py-3 text-[#6C757D] whitespace-nowrap">{formatDate(customer.lastOrderDate)}</td>
                                    <td className="px-4 py-3 text-center">
                                        <Button
                                            onClick={() => handleOpenModal(customer)}
                                            variant="secondary"
                                            className="px-2 py-1 text-xs flex items-center gap-1 mx-auto" // Center button
                                            title={`View details for ${customer.customerInfo.name}`}
                                        >
                                            <FiList/> Details
                                        </Button>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan="7" className="py-10 text-center text-[#6C757D]">
                                    {searchTerm ? "No customers match your search." : "No customer data found."}
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Customer Detail Modal */}
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={`Customer Details: ${selectedCustomer?.customerInfo?.name || ''}`}>
                {selectedCustomer && (
                    <div className="space-y-5 max-h-[calc(100vh-14rem)] overflow-y-auto pr-3">
                         {/* Customer Info Section */}
                        <section>
                            <h3 className="text-lg font-semibold text-[#393E41] mb-2 border-b pb-1">Contact Information</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                <p><span className="text-[#6C757D]"><FiUsers className="inline mr-1 mb-0.5"/> Name:</span> <strong className="text-[#393E41]">{selectedCustomer.customerInfo.name || 'N/A'}</strong></p>
                                <p><span className="text-[#6C757D]"><FiPhone className="inline mr-1 mb-0.5"/> Phone:</span> <strong className="text-[#393E41]">{selectedCustomer.customerInfo.number || 'N/A'}</strong></p>
                                <p><span className="text-[#6C757D]"><FiMail className="inline mr-1 mb-0.5"/> Email:</span> <strong className="text-[#393E41]">{selectedCustomer.customerInfo.email || 'N/A'}</strong></p>
                            </div>
                        </section>

                        {/* Stats Section */}
                         <section>
                            <h3 className="text-lg font-semibold text-[#393E41] mb-2 border-b pb-1">Summary</h3>
                             <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1 text-sm">
                                <p><span className="text-[#6C757D]">Total Orders:</span> <strong className="text-[#393E41]">{selectedCustomer.totalOrders}</strong></p>
                                <p><span className="text-[#6C757D]">Total Spent:</span> <strong className="text-[#393E41]">{formatCurrency(selectedCustomer.totalSpent)}</strong></p>
                                <p><span className="text-[#6C757D]">Last Order:</span> <strong className="text-[#393E41]">{formatDate(selectedCustomer.lastOrderDate)}</strong></p>
                            </div>
                         </section>

                        {/* Order History Section */}
                        <section>
                            <h3 className="text-lg font-semibold text-[#393E41] mb-2 border-b pb-1">Order History ({selectedCustomer.orderHistory.length})</h3>
                            {selectedCustomer.orderHistory.length > 0 ? (
                                <div className="overflow-x-auto max-h-60"> {/* Max height and scroll */}
                                    <table className="w-full min-w-[500px] text-left text-xs">
                                        <thead className="bg-gray-50 sticky top-0 z-10"> {/* Added z-index */}
                                            <tr>
                                                <th className="px-3 py-2 font-medium">Order ID</th>
                                                <th className="px-3 py-2 font-medium">Date</th>
                                                <th className="px-3 py-2 font-medium text-right">Total</th>
                                                <th className="px-3 py-2 font-medium text-right">Pending</th>
                                                <th className="px-3 py-2 font-medium text-center">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {selectedCustomer.orderHistory.map(order => (
                                                <tr key={order.id} className="hover:bg-gray-50">
                                                    <td className="px-3 py-2 font-mono">{order.billNumber || 'N/A'}</td>
                                                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(order.orderDate)}</td>
                                                    <td className="px-3 py-2 text-right font-mono">{formatCurrency(order.total)}</td>
                                                    <td className={`px-3 py-2 text-right font-mono font-semibold ${order.pending > 0 ? 'text-orange-600' : 'text-green-600'}`}>{formatCurrency(order.pending)}</td>
                                                    <td className="px-3 py-2 text-center">
                                                        <Button
                                                            onClick={() => handleViewOrder(order.id)}
                                                            variant="secondary"
                                                            size="sm"
                                                            className="text-xs px-1.5 py-0.5" // Smaller button
                                                            title="View Order Details"
                                                        >
                                                            View
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-sm text-center text-[#6C757D] py-4">No order history found.</p>
                            )}
                        </section>

                         {/* Measurement History Placeholder - Future Feature */}
                        <section>
                            <h3 className="text-lg font-semibold text-[#393E41] mb-2 border-b pb-1">Measurement History</h3>
                            <p className="text-sm text-center text-[#6C757D] py-4 italic">(Feature coming soon: Display consolidated measurements here.)</p>
                         </section>

                         {/* Modal Actions */}
                         <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                            <Button type="button" onClick={() => handleStartNewOrder(selectedCustomer.customerInfo)} variant="primary" className="inline-flex items-center gap-1.5">
                                <FiPlus /> Start New Order
                            </Button>
                            <Button type="button" onClick={handleCloseModal} variant="secondary">
                                Close
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

        </div> // End main container div
    );
};

export default CustomerDirectoryPage;

