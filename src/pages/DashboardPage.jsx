import React, { useMemo } from 'react';
import { useData } from '../context/DataContext';
import Card from '../components/ui/Card';
import Spinner from '../components/ui/Spinner';

const DashboardPage = () => {
  const { orders, ordersLoading } = useData();

  const { summary, orderStatus } = useMemo(() => {
    if (ordersLoading || !orders) {
      return { summary: { daily: { revenue: 0, orders: 0 }, monthly: { revenue: 0, orders: 0 }, yearly: { revenue: 0, orders: 0 } }, orderStatus: [] };
    }
      
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const newSummary = {
      daily: { revenue: 0, orders: 0 },
      monthly: { revenue: 0, orders: 0 },
      yearly: { revenue: 0, orders: 0 }
    };

    const statusCounts = { 'Received': 0, 'Cutting': 0, 'Sewing': 0, 'Ready for Trial': 0, 'Delivered': 0 };

    orders.forEach(order => {
      const orderDate = order.orderDate.toDate();
      if (orderDate >= todayStart) {
        newSummary.daily.revenue += order.payment.total || 0;
        newSummary.daily.orders += 1;
      }
      if (orderDate >= monthStart) {
        newSummary.monthly.revenue += order.payment.total || 0;
        newSummary.monthly.orders += 1;
      }
      if (orderDate >= yearStart) {
        newSummary.yearly.revenue += order.payment.total || 0;
        newSummary.yearly.orders += 1;
      }

      order.people.forEach(person => {
        person.items.forEach(item => {
          if (statusCounts.hasOwnProperty(item.status)) {
            statusCounts[item.status]++;
          }
        });
      });
    });

    const statusList = [
      { status: 'Received', count: statusCounts['Received'], color: 'bg-blue-100 text-blue-800' },
      { status: 'Cutting', count: statusCounts['Cutting'], color: 'bg-orange-100 text-orange-800' },
      { status: 'Sewing', count: statusCounts['Sewing'], color: 'bg-yellow-100 text-yellow-800' },
      { status: 'Ready for Trial', count: statusCounts['Ready for Trial'], color: 'bg-purple-100 text-purple-800' },
      { status: 'Delivered', count: statusCounts['Delivered'], color: 'bg-green-100 text-green-800' },
    ];
    
    return { summary: newSummary, orderStatus: statusList };

  }, [orders, ordersLoading]);

  const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);

  if (ordersLoading) {
    return <div className="p-16"><Spinner /></div>;
  }

  return (
    <div className="space-y-8">
       <header>
        <h1 className="text-3xl font-bold text-text-primary">Dashboard</h1>
        <p className="mt-1 text-text-secondary">A quick overview of your business performance.</p>
      </header>
      
      {/* Business Summary Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card>
          <h3 className="text-sm font-medium text-text-secondary">Today's Revenue</h3>
          <p className="mt-2 text-3xl font-semibold text-primary">{formatCurrency(summary.daily.revenue)}</p>
          <p className="mt-1 text-sm text-text-secondary">{summary.daily.orders} Orders</p>
        </Card>
        <Card>
          <h3 className="text-sm font-medium text-text-secondary">This Month's Revenue</h3>
          <p className="mt-2 text-3xl font-semibold text-primary">{formatCurrency(summary.monthly.revenue)}</p>
          <p className="mt-1 text-sm text-text-secondary">{summary.monthly.orders} Orders</p>
        </Card>
        <Card>
          <h3 className="text-sm font-medium text-text-secondary">This Year's Revenue</h3>
          <p className="mt-2 text-3xl font-semibold text-primary">{formatCurrency(summary.yearly.revenue)}</p>
          <p className="mt-1 text-sm text-text-secondary">{summary.yearly.orders} Orders</p>
        </Card>
      </div>

      {/* Order Status and Other Info */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 font-semibold text-text-primary">Live Item Status</h3>
          <div className="space-y-3">
            {orderStatus.map(item => (
              <div key={item.status} className="flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary">{item.status}</span>
                <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${item.color}`}>{item.count}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h3 className="mb-4 font-semibold text-text-primary">Upcoming Deliveries</h3>
          <div className="flex h-40 items-center justify-center text-center">
            <p className="text-text-secondary">Feature coming soon.</p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;