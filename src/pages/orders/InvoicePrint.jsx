import React from 'react';
import PropTypes from 'prop-types';

// Helper to format currency
const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);

// Helper to format date
const formatDate = (timestamp) => {
    if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toLocaleDateString('en-GB'); // DD/MM/YYYY
    }
    // Handle cases where date might already be a string (e.g., from form state before saving)
    if (typeof timestamp === 'string' && timestamp.match(/^\d{4}-\d{2}-\d{2}$/)) {
        try {
            return new Date(timestamp + 'T00:00:00Z').toLocaleDateString('en-GB'); // Treat as UTC date string
        } catch (e) {
             return 'Invalid Date';
        }
    }
    return 'N/A';
};

// Use React.forwardRef to allow the parent component to get a ref to the DOM node
const InvoicePrint = React.forwardRef(({ order }, ref) => {
  if (!order) return null;

  // Use savedOrderData.orderDate if available (Timestamp), else use order.orderDate (might be Timestamp or string)
  const orderDateToFormat = order.orderDate;
  const deliveryDateToFormat = order.deliveryDate;


  return (
    <div ref={ref} className="p-8 font-sans text-sm print:p-4"> {/* Reduce padding for print */}
      <h1 className="text-2xl font-bold text-center mb-4 print:text-xl">Invoice</h1>
      {/* Business Details (Replace with your actual details) */}
      <div className="mb-6 text-center print:mb-4">
        <h2 className="text-lg font-semibold print:text-base">Theron Tailors</h2>
        <p className="print:text-xs">123 Fabric Lane, Garment City, PIN 123456</p>
        <p className="print:text-xs">Contact: 98765 43210 | Email: contact@therontailors.com</p>
        {/* <p className="print:text-xs">GSTIN: YOUR_GSTIN_HERE</p> */}
      </div>

      {/* Order & Customer Details */}
      <div className="grid grid-cols-2 gap-4 mb-6 border-b pb-4 print:mb-4 print:text-xs">
        <div>
          <h3 className="font-semibold mb-1">Billed To:</h3>
          <p>{order.customer?.name || 'N/A'}</p>
          <p>{order.customer?.number || 'N/A'}</p>
          {order.customer?.email && <p>{order.customer.email}</p>}
        </div>
        <div className="text-right">
          <p><strong>Invoice #:</strong> {order.billNumber || 'N/A'}</p>
          <p><strong>Order Date:</strong> {formatDate(orderDateToFormat)}</p>
          <p><strong>Delivery Date:</strong> {formatDate(deliveryDateToFormat)}</p>
        </div>
      </div>

      {/* Items Table */}
      <h3 className="font-semibold mb-2 print:text-sm">Order Items:</h3>
      <table className="w-full text-left border-collapse mb-6 print:mb-4 print:text-xs">
        <thead>
          <tr className="border-b">
            <th className="py-1 pr-1 print:py-0.5">#</th>
            <th className="py-1 px-1 print:py-0.5">Person</th>
            <th className="py-1 px-1 print:py-0.5">Item</th>
            <th className="py-1 pl-1 text-right print:py-0.5">Price</th>
          </tr>
        </thead>
        <tbody>
          {order.people?.flatMap((person, pIdx) =>
            person.items?.filter(item => item.name) // Ensure item has a name
             .map((item, iIdx) => (
              <tr key={`${pIdx}-${iIdx}-${item.id}`} className="border-b"> {/* Use item ID if available */}
                <td className="py-1 pr-1 print:py-0.5">{pIdx * person.items.length + iIdx + 1}</td>
                <td className="py-1 px-1 print:py-0.5">{person.name || `Person ${pIdx + 1}`}</td>
                <td className="py-1 px-1 print:py-0.5">{item.name || 'N/A'}</td>
                <td className="py-1 pl-1 text-right print:py-0.5">{formatCurrency(item.price)}</td>
              </tr>
            ))
          ) ?? (
            <tr><td colSpan="4" className="py-2 text-center print:py-1">No items found</td></tr>
          )}
        </tbody>
      </table>

      {/* Totals Section */}
      <div className="flex justify-end mb-6 print:mb-4 print:text-xs">
        <div className="w-full max-w-xs space-y-1">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>{formatCurrency(order.payment?.total)}</span>
          </div>
          {/* Add Tax/Discount rows if needed */}
          <div className="flex justify-between font-bold border-t pt-1">
            <span>Total Amount:</span>
            <span>{formatCurrency(order.payment?.total)}</span>
          </div>
          <div className="flex justify-between">
            <span>Advance Paid ({order.payment?.method || 'N/A'}):</span>
            <span>{formatCurrency(order.payment?.advance)}</span>
          </div>
          <div className="flex justify-between font-semibold text-base border-t pt-1 print:text-sm">
            <span>Amount Due:</span>
            <span>{formatCurrency(order.payment?.pending)}</span>
          </div>
        </div>
      </div>

       {/* Notes & Terms */}
       {order.notes && (
         <div className="mb-6 border-t pt-4 print:mb-4 print:pt-2">
           <h4 className="font-semibold mb-1 print:text-sm">Order Notes:</h4>
           <p className="text-xs whitespace-pre-wrap">{order.notes}</p>
         </div>
       )}

      <div className="border-t pt-4 text-xs text-gray-600 text-center print:pt-2">
        <p>Thank you for your business!</p>
        {/* <p>Terms: Payment due upon delivery. Goods once sold will not be taken back.</p> */}
      </div>
    </div>
  );
});

InvoicePrint.displayName = 'InvoicePrint';

InvoicePrint.propTypes = {
  order: PropTypes.object,
};

export default InvoicePrint;