// src/pages/ReportsPage.jsx
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
// Make sure this path is correct based on your project structure
import { convertToCSV, downloadCSV } from '../utils/csvHelper';

// --- Chart.js Imports ---
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';

// --- Register Chart.js components ---
ChartJS.register( CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler );

// --- Icons ---
import {
    FiBarChart2, FiDollarSign, FiTrendingUp, FiTrendingDown, FiFileText, FiCalendar, FiDownload, FiStar, FiUserCheck, FiPackage, FiAlertCircle, FiRefreshCw
} from 'react-icons/fi';

// --- Helper Functions ---
const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount ?? 0);
const formatDate = (timestamp, format = 'dd/mm/yyyy') => {
    let dateObj = null;
    if (timestamp && typeof timestamp.toDate === 'function') { dateObj = timestamp.toDate(); }
    else if (timestamp instanceof Date && !isNaN(timestamp)) { dateObj = timestamp; }
    if (!dateObj) return 'N/A';

    if (format === 'yyyy-mm') {
       const year = dateObj.getFullYear();
       const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
       return `${year}-${month}`;
    }
    // Default: DD/MM/YYYY
    return dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const getStartOfMonthDate = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), 1);
const getEndOfDayDate = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
const dateToYyyyMmDd = (date) => date.toISOString().split('T')[0];

// --- Chart Options ---
const lineChartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'top' }, title: { display: true, text: 'Income vs. Expenses Trend (Monthly)' } },
    scales: { y: { beginAtZero: true, ticks: { callback: value => formatCurrency(value) } } },
};
const doughnutChartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels:{ padding: 15 } }, title: { display: true, text: 'Item Status Distribution (in Period)' } },
    cutout: '60%',
};
const STATUS_COLORS = { 'Received': '#3B82F6', 'Cutting': '#F97316', 'Sewing': '#EAB308', 'Ready for Trial': '#A855F7', 'Delivered': '#22C55E', 'Other': '#6B7280' };


// --- Main Component ---
const ReportsPage = () => {
    const { orders, transactions, ordersLoading, transactionsLoading, tailoringItems } = useData();
    const navigate = useNavigate();

    const [startDate, setStartDate] = useState(dateToYyyyMmDd(getStartOfMonthDate()));
    const [endDate, setEndDate] = useState(dateToYyyyMmDd(getEndOfDayDate()));

    // --- All-Time Calculations ---
    const allTimeData = useMemo(() => {
        // ... (calculation remains the same) ...
        if (ordersLoading || transactionsLoading || !orders || !transactions) {
             return { revenue: 0, expenses: 0, profit: 0, orderCount: 0 };
        }
        const revenue = orders.reduce((sum, o) => sum + (o.payment?.total || 0), 0);
        const expenses = transactions.filter(t => t.type === 'Expense').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        const income = transactions.filter(t => t.type === 'Income').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        const profit = income - expenses;
        const orderCount = orders.length;
        return { revenue, expenses, profit, orderCount };
    }, [orders, transactions, ordersLoading, transactionsLoading]);


    // --- Period-Specific Calculations ---
    const reportData = useMemo(() => {
        const start = startDate ? new Date(startDate + 'T00:00:00') : null;
        let end = null;
        if (endDate) {
            end = new Date(endDate + 'T00:00:00');
            end.setDate(end.getDate() + 1);
            end.setMilliseconds(end.getMilliseconds() - 1);
        }

        const defaultResult = {
            filteredOrders: [], filteredTransactions: [], totalRevenue: 0, totalExpenses: 0,
            totalProfit: 0, orderCount: 0, averageOrderValue: 0, totalPending: 0,
            // Changed to arrays
            topItems: [],
            topCustomers: [],
            trendChartData: { labels: [], datasets: [] }, statusChartData: { labels: [], datasets: [] }
        };

        if (ordersLoading || transactionsLoading || !orders || !transactions || !start || !end) {
            return defaultResult;
        }

        const filteredOrders = orders.filter(o => { /* ... date filtering ... */
            const orderDate = o.orderDate?.toDate ? o.orderDate.toDate() : null;
            return orderDate instanceof Date && !isNaN(orderDate) && orderDate >= start && orderDate <= end;
        });
        const filteredTransactions = transactions.filter(t => { /* ... date filtering ... */
             const tDate = t.date?.toDate ? t.date.toDate() : null;
            return tDate instanceof Date && !isNaN(tDate) && tDate >= start && tDate <= end;
        });

        // Calculate KPIs
        let totalRevenue = 0, totalPending = 0, orderCount = filteredOrders.length;
        const itemCounts = {};
        const customerTotals = {};

        filteredOrders.forEach(order => {
            totalRevenue += order.payment?.total || 0;
            totalPending += order.payment?.pending || 0;
            const custName = order.customer?.name || 'Unknown Customer';
            customerTotals[custName] = (customerTotals[custName] || 0) + (order.payment?.total || 0);
            order.people?.forEach(p => p.items?.forEach(i => {
                if (i.name) itemCounts[i.name] = (itemCounts[i.name] || 0) + 1;
            }));
        });

        const totalExpenses = filteredTransactions.filter(t => t.type === 'Expense').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        const totalIncomeTransactions = filteredTransactions.filter(t => t.type === 'Income').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        const totalProfit = totalIncomeTransactions - totalExpenses;
        const averageOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

        // --- Get Top 3 Items & Customers ---
        const topItems = Object.entries(itemCounts)
            .sort(([, a], [, b]) => b - a) // Sort descending by count
            .slice(0, 3) // Take the top 3
            .map(([name, count]) => ({ name, count })); // Format as objects

        const topCustomers = Object.entries(customerTotals)
            .sort(([, a], [, b]) => b - a) // Sort descending by value
            .slice(0, 3) // Take the top 3
            .map(([name, value]) => ({ name, value })); // Format as objects
        // --- End Top 3 Logic ---

        // Prepare Trend Chart Data
        const monthlyData = {};
        filteredTransactions.forEach(t => { /* ... monthly aggregation ... */
             const dateObj = t.date?.toDate ? t.date.toDate() : null;
            if (dateObj instanceof Date && !isNaN(dateObj)) {
                const month = formatDate(dateObj, 'yyyy-mm'); // Use helper
                if (!monthlyData[month]) monthlyData[month] = { income: 0, expense: 0 };
                if (t.type === 'Income') monthlyData[month].income += (Number(t.amount) || 0);
                else if (t.type === 'Expense') monthlyData[month].expense += (Number(t.amount) || 0);
            }
        });
        const sortedMonths = Object.keys(monthlyData).sort();
        const trendChartData = { /* ... chart data setup ... */
             labels: sortedMonths,
            datasets: [
                { label: 'Income', data: sortedMonths.map(m => monthlyData[m].income), borderColor: '#22C55E', backgroundColor: 'rgba(34, 197, 94, 0.1)', fill: true, tension: 0.1 },
                { label: 'Expenses', data: sortedMonths.map(m => monthlyData[m].expense), borderColor: '#F97316', backgroundColor: 'rgba(249, 115, 22, 0.1)', fill: true, tension: 0.1 }
            ]
        };

        // Prepare Status Chart Data
        const statusCounts = { /* ... initial counts ... */ 'Received': 0, 'Cutting': 0, 'Sewing': 0, 'Ready for Trial': 0, 'Delivered': 0, 'Other': 0 };
        filteredOrders.forEach(order => order.people?.forEach(p => p.items?.forEach(i => { /* ... counting logic ... */
             const status = i.status || 'Other';
             if (statusCounts.hasOwnProperty(status)) statusCounts[status]++;
             else statusCounts['Other']++;
         })));
         const statusLabels = Object.keys(statusCounts).filter(s => statusCounts[s] > 0);
         const statusChartData = { /* ... chart data setup ... */
              labels: statusLabels,
             datasets: [{
                 data: statusLabels.map(s => statusCounts[s]),
                 backgroundColor: statusLabels.map(s => STATUS_COLORS[s] || STATUS_COLORS['Other']),
                 borderColor: '#FFFFFF', borderWidth: 1
             }]
         };

        return {
            filteredOrders: filteredOrders.sort((a, b) => (b.orderDate?.toMillis() || 0) - (a.orderDate?.toMillis() || 0)),
            filteredTransactions, totalRevenue, totalExpenses, totalProfit, orderCount,
            averageOrderValue, totalPending,
            // Assign arrays
            topItems,
            topCustomers,
            trendChartData, statusChartData
        };

    }, [orders, transactions, startDate, endDate, ordersLoading, transactionsLoading, tailoringItems]);

    // --- Download Handlers ---
    const handleDownloadOrders = () => { /* ... (remains the same) ... */
        const headers = {
            'billNumber': 'Order ID',
            'orderDateFormatted': 'Order Date', // Use formatted date field
            'customer.name': 'Customer Name',
            'customer.number': 'Customer Phone',
            'payment.total': 'Total Amount (₹)',
            'payment.advance': 'Advance Paid (₹)',
            'payment.pending': 'Pending Amount (₹)',
            'deliveryDateFormatted': 'Delivery Date', // Use formatted date field
            'notes': 'Order Notes',
        };
        const dataToExport = reportData.filteredOrders.map(order => ({
            ...order,
            // Add formatted dates directly to the objects being exported
            orderDateFormatted: formatDate(order.orderDate?.toDate()),
            deliveryDateFormatted: formatDate(order.deliveryDate?.toDate()),
        }));
        const csvString = convertToCSV(dataToExport, headers);
        downloadCSV(csvString, `Theron_Orders_${startDate}_to_${endDate}.csv`);
    };
    const handleDownloadExpenses = () => { /* ... (remains the same) ... */
        const headers = {
            'dateFormatted': 'Date', // Use formatted date field
            'description': 'Description',
            'amount': 'Amount (₹)'
         };
         const expensesToExport = reportData.filteredTransactions
            .filter(t => t.type === 'Expense')
            .map(t => ({
                ...t,
                dateFormatted: formatDate(t.date?.toDate()), // Add formatted date
            }));
         const csvString = convertToCSV(expensesToExport, headers);
         downloadCSV(csvString, `Theron_Expenses_${startDate}_to_${endDate}.csv`);
    };
    const handleDownloadIncome = () => { /* ... (remains the same) ... */
        const headers = {
            'dateFormatted': 'Date', // Use formatted date field
            'description': 'Description',
            'amount': 'Amount (₹)'
         };
         const incomeToExport = reportData.filteredTransactions
            .filter(t => t.type === 'Income')
            .map(t => ({
                 ...t,
                 dateFormatted: formatDate(t.date?.toDate()), // Add formatted date
             }));
         const csvString = convertToCSV(incomeToExport, headers);
         downloadCSV(csvString, `Theron_Income_${startDate}_to_${endDate}.csv`);
    };
    // --- End Download Handlers ---

    const isLoading = ordersLoading || transactionsLoading;
    const resetDateRange = () => { /* ... (remains the same) ... */
         setStartDate(dateToYyyyMmDd(getStartOfMonthDate()));
        setEndDate(dateToYyyyMmDd(getEndOfDayDate()));
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4">
                {/* ... Header content ... */}
                <div className='flex items-center gap-3'>
                    
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-[#393E41]">Reports Dashboard</h1>
                        <p className="mt-1 text-sm md:text-base text-[#6C757D]">Business performance overview and downloads.</p>
                    </div>
                </div>
            </header>

            {/* Overall Business Summary */}
             <Card>
                <h3 className="text-lg font-semibold mb-4 text-[#393E41]">All-Time Business Summary</h3>
                 <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 text-center">
                     {/* ... All-time KPI cards ... */}
                      <div className="p-3 bg-gray-50 rounded-lg">
                         <p className="text-xs uppercase text-[#6C757D] font-medium">Total Orders</p>
                         <p className="mt-1 text-xl font-bold text-[#393E41]">{isLoading ? '...' : allTimeData.orderCount}</p>
                     </div>
                     <div className="p-3 bg-gray-50 rounded-lg">
                         <p className="text-xs uppercase text-[#6C757D] font-medium">Total Revenue</p>
                         <p className="mt-1 text-xl font-bold text-green-600">{isLoading ? '...' : formatCurrency(allTimeData.revenue)}</p>
                     </div>
                     <div className="p-3 bg-gray-50 rounded-lg">
                         <p className="text-xs uppercase text-[#6C757D] font-medium">Total Expenses</p>
                         <p className="mt-1 text-xl font-bold text-orange-600">{isLoading ? '...' : formatCurrency(allTimeData.expenses)}</p>
                     </div>
                     <div className="p-3 bg-gray-50 rounded-lg">
                         <p className="text-xs uppercase text-[#6C757D] font-medium">Net Profit</p>
                         <p className={`mt-1 text-xl font-bold ${allTimeData.profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                             {isLoading ? '...' : formatCurrency(allTimeData.profit)}
                         </p>
                     </div>
                 </div>
             </Card>

            {/* Period Selection */}
            <Card>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3">
                    <h3 className="text-lg font-semibold text-[#393E41] flex items-center gap-2 mb-2 sm:mb-0"><FiCalendar/> Report Period</h3>
                    <Button onClick={resetDateRange} variant="secondary" size="sm" className="text-xs flex items-center gap-1">
                        <FiRefreshCw size={14}/> Reset to Default (This Month)
                    </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                    <Input label="Start Date" id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} max={endDate || ''} />
                    <Input label="End Date" id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate || ''} />
                </div>
            </Card>

            {/* Period Specific Data */}
            {isLoading ? (
                <div className="py-16 flex justify-center"><Spinner /></div>
            ) : (
                <>
                    {/* Period Key Metrics */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
                        {/* ... Period KPI Cards ... */}
                         <Card className="text-center transition hover:shadow-lg">
                            <p className="text-sm font-medium text-[#6C757D] flex items-center justify-center gap-1"><FiTrendingUp/> Revenue</p>
                            <p className="mt-1 text-2xl font-semibold text-green-600">{formatCurrency(reportData.totalRevenue)}</p>
                            <p className="text-xs text-[#6C757D]">{reportData.orderCount} Orders</p>
                        </Card>
                         <Card className="text-center transition hover:shadow-lg">
                            <p className="text-sm font-medium text-[#6C757D] flex items-center justify-center gap-1"><FiTrendingDown/> Expenses</p>
                            <p className="mt-1 text-2xl font-semibold text-orange-600">{formatCurrency(reportData.totalExpenses)}</p>
                             <p className="text-xs text-[#6C757D]">{reportData.filteredTransactions.filter(t=>t.type==='Expense').length} Entries</p>
                        </Card>
                         <Card className="text-center transition hover:shadow-lg">
                            <p className="text-sm font-medium text-[#6C757D] flex items-center justify-center gap-1"><FiDollarSign/> Net Profit</p>
                            <p className={`mt-1 text-2xl font-semibold ${reportData.totalProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                {formatCurrency(reportData.totalProfit)}
                            </p>
                             <p className="text-xs text-[#6C757D]">(Ledger Based)</p>
                        </Card>
                         <Card className="text-center transition hover:shadow-lg">
                             <p className="text-sm font-medium text-[#6C757D] flex items-center justify-center gap-1"><FiDollarSign/> Avg. Order Value</p>
                            <p className="mt-1 text-2xl font-semibold text-[#393E41]">{formatCurrency(reportData.averageOrderValue)}</p>
                             <p className="text-xs text-[#6C757D]">&nbsp;</p>
                         </Card>
                          <Card className="text-center transition hover:shadow-lg">
                             <p className="text-sm font-medium text-[#6C757D] flex items-center justify-center gap-1"><FiAlertCircle/> Total Pending</p>
                            <p className="mt-1 text-2xl font-semibold text-orange-500">{formatCurrency(reportData.totalPending)}</p>
                             <p className="text-xs text-[#6C757D]">(From Orders in Period)</p>
                         </Card>
                    </div>

                    {/* --- UPDATED Top Performers (Shows Top 3) --- */}
                     <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <Card>
                             <h3 className="text-lg font-semibold mb-3 text-[#393E41] flex items-center gap-2"><FiStar/> Top Items (by Quantity)</h3>
                             {reportData.topItems.length > 0 ? (
                                <ol className="list-decimal list-inside space-y-2">
                                    {reportData.topItems.map((item, index) => (
                                        <li key={index} className="flex items-center gap-3 text-sm">
                                            <span className="font-semibold text-[#393E41]">{item.name}</span>
                                            <span className="ml-auto text-[#6C757D]">{item.count} units</span>
                                        </li>
                                    ))}
                                </ol>
                             ) : (
                                <p className="text-sm text-[#6C757D] text-center py-4">No item data available for this period.</p>
                             )}
                        </Card>
                        <Card>
                             <h3 className="text-lg font-semibold mb-3 text-[#393E41] flex items-center gap-2"><FiUserCheck/> Top Customers (by Value)</h3>
                              {reportData.topCustomers.length > 0 ? (
                                <ol className="list-decimal list-inside space-y-2">
                                    {reportData.topCustomers.map((customer, index) => (
                                         <li key={index} className="flex items-center gap-3 text-sm">
                                            <span className="font-semibold text-[#393E41]">{customer.name}</span>
                                            <span className="ml-auto text-[#6C757D] font-mono">{formatCurrency(customer.value)}</span>
                                        </li>
                                    ))}
                                </ol>
                             ) : (
                                <p className="text-sm text-[#6C757D] text-center py-4">No customer data available for this period.</p>
                             )}
                        </Card>
                     </div>
                     {/* --- End Top Performers Update --- */}

                    {/* Charts */}
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                         {/* Trend Chart */}
                         <Card className="lg:col-span-2">
                              {reportData.trendChartData?.labels?.length > 1 ? (
                                <div className="h-72 relative">
                                    <Line options={lineChartOptions} data={reportData.trendChartData} />
                                </div>
                               ) : (
                                <div className="h-72 flex items-center justify-center text-center text-[#6C757D]">
                                    <p>Insufficient monthly data points for trend chart in this period.</p>
                                </div>
                               )}
                         </Card>
                         {/* Status Chart */}
                          <Card className="lg:col-span-1">
                               {reportData.statusChartData?.labels?.length > 0 ? (
                                <div className="h-72 relative flex items-center justify-center">
                                    <Doughnut options={doughnutChartOptions} data={reportData.statusChartData} />
                                </div>
                                ) : (
                                 <div className="h-72 flex items-center justify-center text-center text-[#6C757D]">
                                    <p>No item status data available for orders in this period.</p>
                                 </div>
                                )}
                          </Card>
                    </div>

                    {/* Download Buttons */}
                    <Card>
                         <h3 className="text-lg font-semibold mb-3 text-[#393E41] flex items-center gap-2"><FiDownload/> Download Detailed Reports</h3>
                         <div className="flex flex-wrap gap-3">
                             <Button onClick={handleDownloadOrders} variant="secondary" className="flex items-center gap-1.5 text-sm" disabled={reportData.filteredOrders.length === 0}> <FiFileText size={16}/> Orders (CSV) </Button>
                             <Button onClick={handleDownloadExpenses} variant="secondary" className="flex items-center gap-1.5 text-sm" disabled={reportData.filteredTransactions.filter(t=> t.type === 'Expense').length === 0}> <FiTrendingDown size={16}/> Expenses (CSV) </Button>
                             <Button onClick={handleDownloadIncome} variant="secondary" className="flex items-center gap-1.5 text-sm" disabled={reportData.filteredTransactions.filter(t=> t.type === 'Income').length === 0}> <FiTrendingUp size={16}/> Income (CSV) </Button>
                         </div>
                    </Card>

                    {/* Orders Table */}
                    <Card>
                        <h3 className="text-lg font-semibold mb-4 text-[#393E41]">Orders within Period ({reportData.filteredOrders.length})</h3>
                        <div className="overflow-x-auto max-h-96">
                            <table className="w-full min-w-[700px] text-left text-sm">
                                <thead className="border-b-2 border-[#E0E0E0] bg-gray-50 sticky top-0 z-10">
                                     <tr>
                                        <th className="px-3 py-2 font-semibold uppercase text-[#6C757D]">Order ID</th>
                                        <th className="px-3 py-2 font-semibold uppercase text-[#6C757D]">Order Date</th>
                                        <th className="px-3 py-2 font-semibold uppercase text-[#6C757D]">Customer</th>
                                        <th className="px-3 py-2 font-semibold uppercase text-[#6C757D] text-right">Total (₹)</th>
                                        <th className="px-3 py-2 font-semibold uppercase text-[#6C757D] text-right">Pending (₹)</th>
                                        <th className="px-3 py-2 font-semibold uppercase text-[#6C757D]">Delivery Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#E0E0E0]">
                                     {reportData.filteredOrders.length > 0 ? reportData.filteredOrders.map(order => (
                                        <tr key={order.id} className="hover:bg-gray-50">
                                            <td className="px-3 py-2 font-mono text-blue-600 hover:underline cursor-pointer" onClick={() => navigate(`/orders/edit/${order.id}`)} title="Edit Order">{order.billNumber}</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-[#6C757D]">{formatDate(order.orderDate?.toDate())}</td>
                                            <td className="px-3 py-2 text-[#393E41]">{order.customer?.name || 'N/A'}</td>
                                            <td className="px-3 py-2 text-right font-mono text-[#393E41]">{formatCurrency(order.payment?.total)}</td>
                                            <td className={`px-3 py-2 text-right font-mono font-semibold ${(order.payment?.pending || 0) > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                                                {formatCurrency(order.payment?.pending)}
                                            </td>
                                             <td className="px-3 py-2 whitespace-nowrap text-[#6C757D]">{formatDate(order.deliveryDate?.toDate())}</td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan="6" className="py-10 text-center text-[#6C757D]">No orders found in this date range.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </>
            )}
        </div>
    );
};

export default ReportsPage;