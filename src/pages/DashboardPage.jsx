import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import Card from '../components/ui/Card';
import Spinner from '../components/ui/Spinner';
import Button from '../components/ui/Button';
import {
    FiTrendingUp, FiPackage, FiTool, FiAlertCircle, FiPieChart, FiBarChart2,
    FiPlusCircle, FiCalendar, FiExternalLink, FiDollarSign, FiTrendingDown, FiFileText, FiBell
} from 'react-icons/fi';

// --- Chart.js Imports ---
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

// --- Register Chart.js components ---
ChartJS.register(
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement
);

const DashboardPage = () => {
  const { orders, ordersLoading, transactions, transactionsLoading } = useData();
  const navigate = useNavigate();

  // --- Calculations ---
  const dashboardData = useMemo(() => {
    // ... (Initial state and calculations remain the same as previous version) ...
    let initialState = {
      kpis: { /* ... kpi properties ... */
        todayRevenue: 0, todayOrders: 0, monthRevenue: 0, monthOrders: 0,
        yearRevenue: 0, yearOrders: 0, totalPending: 0, itemsInProgress: 0,
        readyForTrial: 0, overdueDeliveriesCount: 0, monthIncome: 0, monthExpense: 0,
      },
      orderStatusCounts: {}, recentOrders: [], upcomingDeliveries: [],
      overdueOrders: [], performanceChartData: { /* ... */
        labels: ['Today', 'This Month', 'This Year'],
        datasets: [
            { label: 'Revenue (₹)', data: [0, 0, 0], backgroundColor: 'rgba(68, 187, 164, 0.6)', borderColor: 'rgba(68, 187, 164, 1)', borderWidth: 1, yAxisID: 'yRevenue' },
            { label: 'Orders', data: [0, 0, 0], backgroundColor: 'rgba(57, 62, 65, 0.6)', borderColor: 'rgba(57, 62, 65, 1)', borderWidth: 1, yAxisID: 'yOrders' },
        ],
      }, statusChartData: { /* ... */
           labels: [], datasets: [{ data: [], backgroundColor: [], borderColor: [], borderWidth: 1 }]
       }
    };
    if (ordersLoading || transactionsLoading || !orders || !transactions) { return initialState; }
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const nextWeekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    let kpis = { ...initialState.kpis };
    const statusCounts = { 'Received': 0, 'Cutting': 0, 'Sewing': 0, 'Ready for Trial': 0, 'Delivered': 0 };
    let itemsInProgress = 0; let upcoming = []; let overdue = [];
    orders.forEach(order => { /* ... (Order processing logic remains the same) ... */
      const orderDate = order.orderDate?.toDate ? order.orderDate.toDate() : null;
      const deliveryDate = order.deliveryDate?.toDate ? order.deliveryDate.toDate() : null;
      const totalAmount = order.payment?.total || 0;
      kpis.totalPending += order.payment?.pending || 0;
      const isDelivered = order.people?.every(p => p.items?.every(i => i.status === 'Delivered'));
      if (orderDate) {
        if (orderDate >= todayStart) { kpis.todayRevenue += totalAmount; kpis.todayOrders += 1; }
        if (orderDate >= monthStart) { kpis.monthRevenue += totalAmount; kpis.monthOrders += 1; }
        if (orderDate >= yearStart) { kpis.yearRevenue += totalAmount; kpis.yearOrders += 1; }
      }
       if (deliveryDate && !isDelivered) { if (deliveryDate < todayStart) { overdue.push(order); } else if (deliveryDate <= nextWeekEnd) { upcoming.push(order); } }
      order.people?.forEach(person => { person.items?.forEach(item => { if (item?.status) { if (statusCounts.hasOwnProperty(item.status)) { statusCounts[item.status]++; } if (['Cutting', 'Sewing'].includes(item.status)) { itemsInProgress++; } if (item.status === 'Ready for Trial') { kpis.readyForTrial++; } } }); });
    });
     kpis.itemsInProgress = itemsInProgress; kpis.overdueDeliveriesCount = overdue.length;
    transactions.forEach(t => { /* ... (Transaction processing logic remains the same) ... */
        const tDate = t.date?.toDate ? t.date.toDate() : null;
        if (tDate && tDate >= monthStart) {
            const amount = Number(t.amount) || 0;
            if (t.type === 'Income') { kpis.monthIncome += amount; }
            else if (t.type === 'Expense') { kpis.monthExpense += amount; }
        }
    });
    const recent = orders.slice(0, 5);
    upcoming.sort((a, b) => (a.deliveryDate?.toDate() || 0) - (b.deliveryDate?.toDate() || 0));
    overdue.sort((a, b) => (a.deliveryDate?.toDate() || 0) - (b.deliveryDate?.toDate() || 0));
    const statusLabels = ['Received', 'Cutting', 'Sewing', 'Ready for Trial', 'Delivered'];
    const statusDataPoints = statusLabels.map(label => statusCounts[label]);
    const statusColors = [ 'rgba(59, 130, 246, 0.7)', 'rgba(249, 115, 22, 0.7)', 'rgba(234, 179, 8, 0.7)', 'rgba(168, 85, 247, 0.7)', 'rgba(34, 197, 94, 0.7)' ];
     const statusChartData = { labels: statusLabels, datasets: [{ data: statusDataPoints, backgroundColor: statusColors, borderColor: statusColors.map(c => c.replace('0.7', '1')), borderWidth: 1 }] };
     const performanceChartData = { /* ... (Performance chart data population remains the same) ... */
        labels: ['Today', 'This Month', 'This Year'],
        datasets: [
          { ...initialState.performanceChartData.datasets[0], data: [kpis.todayRevenue, kpis.monthRevenue, kpis.yearRevenue] },
          { ...initialState.performanceChartData.datasets[1], data: [kpis.todayOrders, kpis.monthOrders, kpis.yearOrders] },
        ],
     };
    return { kpis, orderStatusCounts: statusCounts, recentOrders: recent, upcomingDeliveries: upcoming.slice(0, 5), overdueOrders: overdue.slice(0, 5), performanceChartData, statusChartData };
  }, [orders, ordersLoading, transactions, transactionsLoading]);

   // Helper for currency formatting
   const formatCurrency = useMemo(() => (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0), []);

  // --- Chart Options ---
  const barChartOptions = useMemo(() => ({ /* ... (bar chart options remain the same) ... */
    responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' }, title: { display: false }, tooltip: { callbacks: { label: function(context) { let label = context.dataset.label || ''; if (label) { label += ': '; } if (context.parsed.y !== null) { if (context.dataset.label === 'Revenue (₹)') { label += formatCurrency(context.parsed.y); } else { label += context.parsed.y; } } return label; } } } }, scales: { x: { grid: { display: false } }, yRevenue: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Revenue (₹)' }, grid: { drawOnChartArea: true, color: '#e0e0e0' }, ticks: { callback: function(value) { return formatCurrency(value); } } }, yOrders: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Orders' }, grid: { drawOnChartArea: false }, ticks: { stepSize: 1, beginAtZero: true } }, }, interaction: { mode: 'index', intersect: false },
  }), [formatCurrency]);

   const doughnutChartOptions = useMemo(() => ({ /* ... (doughnut chart options remain the same) ... */
       responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { padding: 15 } }, title: { display: false }, tooltip: { callbacks: { label: function(context) { let label = context.label || ''; if (label) { label += ': '; } if (context.parsed !== null) { label += context.parsed; } return label; } } } }, cutout: '60%',
   }), []);

   // Format date helper
   const formatDate = (timestamp) => {
       if (timestamp && typeof timestamp.toDate === 'function') { return timestamp.toDate().toLocaleDateString('en-GB'); } return 'N/A';
   };

   // --- *** NEW: Function to navigate and request modal open *** ---
   const handleOpenOrderDetails = (orderId) => {
       if (!orderId) return;
       navigate('/orders', { state: { openOrderDetailsId: orderId } });
   };


  // --- Loading State ---
  if (ordersLoading || transactionsLoading) {
    return ( <div className="flex h-[calc(100vh-8rem)] w-full items-center justify-center"> <Spinner /> </div> );
  }

  // --- Dashboard Render ---
  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <div> <h1 className="text-2xl md:text-3xl font-bold text-[#393E41]">Dashboard</h1> <p className="mt-1 text-sm md:text-base text-[#6C757D]">Overview of business performance.</p> </div>
        <Button onClick={() => navigate('/orders/new')} variant="primary" className="flex items-center gap-2 w-full md:w-auto"> <FiPlusCircle className="w-4 h-4"/> New Order </Button>
      </div>

      {/* KPI Cards Grid - Clickable */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 md:gap-6">
        {/* Wrap cards in div with onClick */}
        <div onClick={() => navigate('/orders')} className="cursor-pointer"> <Card className="flex items-center gap-4 hover:shadow-md transition-shadow"> <div className="p-3 bg-green-100 rounded-full"> <FiTrendingUp className="w-6 h-6 text-green-600"/> </div> <div> <p className="text-sm font-medium text-[#6C757D]">Today's Revenue</p> <p className="mt-1 text-xl md:text-2xl font-semibold text-[#393E41]">{formatCurrency(dashboardData.kpis.todayRevenue)}</p> </div> </Card> </div>
        <div onClick={() => navigate('/orders')} className="cursor-pointer"> <Card className="flex items-center gap-4 hover:shadow-md transition-shadow"> <div className="p-3 bg-blue-100 rounded-full"> <FiPackage className="w-6 h-6 text-blue-600"/> </div> <div> <p className="text-sm font-medium text-[#6C757D]">Today's Orders</p> <p className="mt-1 text-xl md:text-2xl font-semibold text-[#393E41]">{dashboardData.kpis.todayOrders}</p> </div> </Card> </div>
        <div onClick={() => navigate('/orders')} className="cursor-pointer"> <Card className="flex items-center gap-4 hover:shadow-md transition-shadow"> <div className="p-3 bg-yellow-100 rounded-full"> <FiTool className="w-6 h-6 text-yellow-600"/> </div> <div> <p className="text-sm font-medium text-[#6C757D]">Items In Progress</p> <p className="mt-1 text-xl md:text-2xl font-semibold text-[#393E41]">{dashboardData.kpis.itemsInProgress}</p> </div> </Card> </div>
        <div onClick={() => navigate('/orders')} className="cursor-pointer"> <Card className="flex items-center gap-4 hover:shadow-md transition-shadow"> <div className="p-3 bg-orange-100 rounded-full"> <FiAlertCircle className="w-6 h-6 text-orange-600"/> </div> <div> <p className="text-sm font-medium text-[#6C757D]">Total Pending</p> <p className="mt-1 text-xl md:text-2xl font-semibold text-orange-600">{formatCurrency(dashboardData.kpis.totalPending)}</p> </div> </Card> </div>
      </div>

       {/* Financial Summary & Upcoming/Overdue Section */}
       <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 md:gap-6">
           {/* Financial Summary */}
           <Card className="lg:col-span-1">
                <h3 className="mb-4 text-lg font-semibold text-[#393E41] flex items-center gap-2"> <FiDollarSign /> This Month's Finances </h3>
                 <div className="space-y-3">
                    <div className="flex justify-between items-center"> <span className="text-sm text-green-600 font-medium flex items-center gap-1"><FiTrendingUp/> Income</span> <span className="font-semibold text-green-600">{formatCurrency(dashboardData.kpis.monthIncome)}</span> </div>
                    <div className="flex justify-between items-center"> <span className="text-sm text-orange-600 font-medium flex items-center gap-1"><FiTrendingDown/> Expense</span> <span className="font-semibold text-orange-600">{formatCurrency(dashboardData.kpis.monthExpense)}</span> </div>
                    <div className="flex justify-between items-center border-t pt-2"> <span className="text-sm text-[#393E41] font-semibold">Net</span> <span className={`font-bold text-lg ${dashboardData.kpis.monthIncome - dashboardData.kpis.monthExpense >= 0 ? 'text-green-700' : 'text-orange-700'}`}>{formatCurrency(dashboardData.kpis.monthIncome - dashboardData.kpis.monthExpense)}</span> </div>
                 </div>
                 <div className="mt-4 text-right"> <Button onClick={() => navigate('/ledger')} variant="secondary" size="sm" className="text-xs">Go to Ledger</Button> </div>
           </Card>

           {/* --- MODIFIED Upcoming Deliveries --- */}
           <Card className="lg:col-span-1">
                 <h3 className="mb-4 text-lg font-semibold text-[#393E41] flex items-center gap-2"> <FiCalendar /> Upcoming Deliveries (7 days) </h3>
                 {dashboardData.upcomingDeliveries.length > 0 ? (
                     <ul className="space-y-2 text-sm max-h-40 overflow-y-auto pr-2">
                         {dashboardData.upcomingDeliveries.map(order => (
                             <li key={order.id} className="flex justify-between items-center border-b pb-1 hover:bg-gray-50 -mx-2 px-2">
                                 {/* Use button/div with onClick instead of Link */}
                                 <button onClick={() => handleOpenOrderDetails(order.id)} className="text-left flex-grow mr-2 focus:outline-none">
                                     <span className="text-blue-600 hover:underline font-medium">{order.customer?.name || 'N/A'}</span>
                                     <span className="text-xs text-gray-500 ml-2">({order.billNumber})</span>
                                 </button>
                                 <span className="text-xs text-gray-600 whitespace-nowrap">{formatDate(order.deliveryDate)}</span>
                             </li>
                         ))}
                     </ul>
                 ) : ( <p className="text-sm text-center text-gray-500 py-4">No upcoming deliveries in the next 7 days.</p> )}
           </Card>

            {/* --- MODIFIED Overdue Orders --- */}
           <Card className="lg:col-span-1">
                 <h3 className="mb-4 text-lg font-semibold text-orange-600 flex items-center gap-2"> <FiAlertCircle /> Overdue Deliveries ({dashboardData.kpis.overdueDeliveriesCount}) </h3>
                 {dashboardData.overdueOrders.length > 0 ? (
                     <ul className="space-y-2 text-sm max-h-40 overflow-y-auto pr-2">
                         {dashboardData.overdueOrders.map(order => (
                             <li key={order.id} className="flex justify-between items-center border-b pb-1 hover:bg-gray-50 -mx-2 px-2">
                                 {/* Use button/div with onClick instead of Link */}
                                 <button onClick={() => handleOpenOrderDetails(order.id)} className="text-left flex-grow mr-2 focus:outline-none">
                                     <span className="text-blue-600 hover:underline font-medium">{order.customer?.name || 'N/A'}</span>
                                     <span className="text-xs text-gray-500 ml-2">({order.billNumber})</span>
                                 </button>
                                 <span className="text-xs text-orange-600 whitespace-nowrap font-semibold">{formatDate(order.deliveryDate)}</span>
                             </li>
                         ))}
                     </ul>
                 ) : ( <p className="text-sm text-center text-gray-500 py-4">No overdue orders.</p> )}
           </Card>
       </div>

      {/* Performance Chart & Status Chart Section */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        {/* Performance Bar Chart */}
        <Card className="lg:col-span-2">
            <h3 className="mb-4 text-lg font-semibold text-[#393E41] flex items-center gap-2"> <FiBarChart2 /> Performance Summary </h3>
            <div className="h-64 md:h-80 relative mb-4"> <Bar options={barChartOptions} data={dashboardData.performanceChartData} /> </div>
             <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center border-t pt-4">
                 <div> <p className="text-xs uppercase text-[#6C757D]">Today</p> <p className="text-md font-semibold text-[#44BBA4]">{formatCurrency(dashboardData.kpis.todayRevenue)}</p> <p className="text-xs text-[#6C757D]">{dashboardData.kpis.todayOrders} Orders</p> </div>
                 <div> <p className="text-xs uppercase text-[#6C757D]">This Month</p> <p className="text-md font-semibold text-[#44BBA4]">{formatCurrency(dashboardData.kpis.monthRevenue)}</p> <p className="text-xs text-[#6C757D]">{dashboardData.kpis.monthOrders} Orders</p> </div>
                 <div> <p className="text-xs uppercase text-[#6C757D]">This Year</p> <p className="text-md font-semibold text-[#44BBA4]">{formatCurrency(dashboardData.kpis.yearRevenue)}</p> <p className="text-xs text-[#6C757D]">{dashboardData.kpis.yearOrders} Orders</p> </div>
             </div>
        </Card>

        {/* Item Status Doughnut Chart */}
        <Card className="lg:col-span-1 flex flex-col">
          <h3 className="mb-4 text-lg font-semibold text-[#393E41] flex items-center gap-2"> <FiPieChart /> Live Item Status </h3>
           <div className="flex-grow flex items-center justify-center min-h-[200px] md:min-h-[250px] relative">
             {dashboardData.statusChartData.datasets[0].data.some(count => count > 0) ? ( <Doughnut data={dashboardData.statusChartData} options={doughnutChartOptions} /> ) : ( <p className="text-center text-[#6C757D]">No items found with status.</p> )}
           </div>
           {/* Link counts remain below chart */}
           <div className="mt-4 pt-4 border-t space-y-2 text-sm">
                <Link to="/orders" className="flex justify-between items-center text-blue-600 hover:underline"><span>Ready for Trial</span> <span className="font-semibold">{dashboardData.kpis.readyForTrial}</span></Link>
                {/* Overdue Count Link - No Red Text */}
                <Link to="/orders" className={`flex justify-between items-center ${dashboardData.kpis.overdueDeliveriesCount > 0 ? 'text-orange-600 hover:underline' : 'text-gray-500'}`}><span>Overdue Deliveries</span> <span className="font-semibold">{dashboardData.kpis.overdueDeliveriesCount}</span></Link>
           </div>
        </Card>
      </div>

       {/* Recent Orders Section - No Red Text */}
        <Card>
            <h3 className="mb-4 text-lg font-semibold text-[#393E41]">Recent Orders</h3>
             <div className="overflow-x-auto">
                 <table className="w-full min-w-[600px] text-left text-sm">
                     <thead className="border-b bg-gray-50 text-xs uppercase text-[#6C757D]">
                         <tr> <th className="px-4 py-2">Order ID</th> <th className="px-4 py-2">Customer</th> <th className="px-4 py-2"><FiCalendar className="inline mr-1"/>Order Date</th> <th className="px-4 py-2 text-right">Amount</th> <th className="px-4 py-2 text-right">Pending</th> </tr>
                     </thead>
                     <tbody className="divide-y">
                         {dashboardData.recentOrders.length > 0 ? dashboardData.recentOrders.map(order => (
                             <tr key={order.id} className="hover:bg-gray-50">
                                 <td className="px-4 py-2 font-mono text-[#393E41]"><Link to={`/orders/edit/${order.id}`} className="hover:underline">{order.billNumber}</Link></td>
                                 <td className="px-4 py-2 text-[#393E41]">{order.customer?.name}</td>
                                 <td className="px-4 py-2 text-[#6C757D] whitespace-nowrap">{formatDate(order.orderDate)}</td>
                                 <td className="px-4 py-2 text-right font-mono text-[#393E41]">{formatCurrency(order.payment?.total)}</td>
                                 <td className={`px-4 py-2 text-right font-mono font-semibold ${order.payment?.pending > 0 ? 'text-orange-600' : 'text-green-600'}`}>{formatCurrency(order.payment?.pending)}</td>
                             </tr>
                         )) : ( <tr><td colSpan="5" className="py-6 text-center text-[#6C757D]">No recent orders found.</td></tr> )}
                     </tbody>
                 </table>
             </div>
             <div className="mt-4 text-right"> <Link to="/orders" className="text-sm text-blue-600 hover:underline">View All Orders &rarr;</Link> </div>
        </Card>

    </div>
  );
};

export default DashboardPage;