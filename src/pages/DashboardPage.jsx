import React, { useMemo } from 'react';
import { useData } from '../context/DataContext';
import Card from '../components/ui/Card';
import Spinner from '../components/ui/Spinner';

const DashboardPage = () => {
  const { orders, ordersLoading } = useData();

  // Use useMemo for calculations to avoid re-computing on every render
  const { summary, orderStatus } = useMemo(() => {
    // Initial state for summary and status counts
    let initialState = {
        summary: { daily: { revenue: 0, orders: 0 }, monthly: { revenue: 0, orders: 0 }, yearly: { revenue: 0, orders: 0 } },
        orderStatus: []
    };
    // Return initial state if data is loading or not available
    if (ordersLoading || !orders || orders.length === 0) {
      return initialState;
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const newSummary = { daily: { revenue: 0, orders: 0 }, monthly: { revenue: 0, orders: 0 }, yearly: { revenue: 0, orders: 0 } };
    const statusCounts = { 'Received': 0, 'Cutting': 0, 'Sewing': 0, 'Ready for Trial': 0, 'Delivered': 0 };

    orders.forEach(order => {
      // Validate order structure and date before processing
      const orderDate = order.orderDate?.toDate ? order.orderDate.toDate() : null; // Safely convert Timestamp
      const totalAmount = order.payment?.total || 0; // Safely access total

      if (orderDate) { // Only process if date is valid
        if (orderDate >= todayStart) {
          newSummary.daily.revenue += totalAmount;
          newSummary.daily.orders += 1;
        }
        if (orderDate >= monthStart) {
          newSummary.monthly.revenue += totalAmount;
          newSummary.monthly.orders += 1;
        }
        if (orderDate >= yearStart) {
          newSummary.yearly.revenue += totalAmount;
          newSummary.yearly.orders += 1;
        }
      }

      // Safely iterate through people and items
      order.people?.forEach(person => {
        person.items?.forEach(item => {
          if (item?.status && statusCounts.hasOwnProperty(item.status)) {
            statusCounts[item.status]++;
          }
        });
      });
    });

    // Define status list with colors (using default Tailwind for simplicity here)
    const statusList = [
      { status: 'Received', count: statusCounts['Received'], color: 'bg-blue-100 text-blue-800' },
      { status: 'Cutting', count: statusCounts['Cutting'], color: 'bg-orange-100 text-orange-800' },
      { status: 'Sewing', count: statusCounts['Sewing'], color: 'bg-yellow-100 text-yellow-800' },
      { status: 'Ready for Trial', count: statusCounts['Ready for Trial'], color: 'bg-purple-100 text-purple-800' },
      { status: 'Delivered', count: statusCounts['Delivered'], color: 'bg-green-100 text-green-800' },
    ];

    return { summary: newSummary, orderStatus: statusList };

  }, [orders, ordersLoading]); // Recalculate only when orders or loading state change

  // Helper function for currency formatting
  const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);

  // Show spinner while data is loading
  if (ordersLoading) {
    return <div className="p-16 flex justify-center"><Spinner /></div>;
  }

  return (
    // DIRECTLY APPLIED THEME: Using hex codes
    <div className="space-y-6 md:space-y-8">
       <header className="mb-4"> {/* Added margin bottom */}
        <h1 className="text-2xl md:text-3xl font-bold text-[#393E41]">Dashboard</h1> {/* Dark Gray */}
        <p className="mt-1 text-sm md:text-base text-[#6C757D]">A quick overview of your business performance.</p> {/* Medium Gray */}
      </header>

      {/* Business Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
        <Card>
          <h3 className="text-sm font-medium text-[#6C757D]">Today's Revenue</h3> {/* Medium Gray */}
          <p className="mt-2 text-2xl md:text-3xl font-semibold text-[#44BBA4]">{formatCurrency(summary.daily.revenue)}</p> {/* Teal */}
          <p className="mt-1 text-xs md:text-sm text-[#6C757D]">{summary.daily.orders} Orders</p> {/* Medium Gray */}
        </Card>
        <Card>
          <h3 className="text-sm font-medium text-[#6C757D]">This Month's Revenue</h3> {/* Medium Gray */}
          <p className="mt-2 text-2xl md:text-3xl font-semibold text-[#44BBA4]">{formatCurrency(summary.monthly.revenue)}</p> {/* Teal */}
          <p className="mt-1 text-xs md:text-sm text-[#6C757D]">{summary.monthly.orders} Orders</p> {/* Medium Gray */}
        </Card>
        <Card>
          <h3 className="text-sm font-medium text-[#6C757D]">This Year's Revenue</h3> {/* Medium Gray */}
          <p className="mt-2 text-2xl md:text-3xl font-semibold text-[#44BBA4]">{formatCurrency(summary.yearly.revenue)}</p> {/* Teal */}
          <p className="mt-1 text-xs md:text-sm text-[#6C757D]">{summary.yearly.orders} Orders</p> {/* Medium Gray */}
        </Card>
      </div>

      {/* Order Status and Other Info */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <Card>
          <h3 className="mb-4 text-lg font-semibold text-[#393E41]">Live Item Status</h3> {/* Dark Gray */}
          {orderStatus.length > 0 ? (
            <div className="space-y-3">
              {orderStatus.map(item => (
                <div key={item.status} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[#393E41]">{item.status}</span> {/* Dark Gray */}
                  {/* Status colors remain default Tailwind */}
                  <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${item.color}`}>{item.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-[#6C757D] py-8">No order items found to display status.</p> // Message when no items
          )}
        </Card>
        <Card>
          <h3 className="mb-4 text-lg font-semibold text-[#393E41]">Upcoming Deliveries</h3> {/* Dark Gray */}
          {/* Placeholder - Replace with actual data fetching and display logic */}
          <div className="flex h-40 items-center justify-center text-center">
            <p className="text-[#6C757D]">Feature under development.</p> {/* Medium Gray */}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;