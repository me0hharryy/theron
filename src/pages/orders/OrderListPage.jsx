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

// Icons
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>;


const OrderListPage = () => {
  const { orders, ordersLoading, workers } = useData("orderDate");
  const [searchTerm, setSearchTerm] = useState('');
  const [detailModalOrder, setDetailModalOrder] = useState(null);
  const navigate = useNavigate();

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter(order =>
      order.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer.number.includes(searchTerm) ||
      (order.billNumber && order.billNumber.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [searchTerm, orders]);

  const handleStatusChange = async (pIdx, iIdx, newStatus) => {
    const orderToUpdate = JSON.parse(JSON.stringify(detailModalOrder));
    orderToUpdate.people[pIdx].items[iIdx].status = newStatus;
    
    try {
        await updateDoc(doc(db, getCollectionPath('orders'), orderToUpdate.id), {
            people: orderToUpdate.people
        });
        setDetailModalOrder(orderToUpdate);
    } catch (error) {
        console.error("Error updating status:", error);
        alert("Failed to update status.");
    }
  };

  const handleWorkerAssign = async (pIdx, iIdx, workerType, workerName) => {
    const orderToUpdate = JSON.parse(JSON.stringify(detailModalOrder));
    orderToUpdate.people[pIdx].items[iIdx][workerType] = workerName;

    try {
        await updateDoc(doc(db, getCollectionPath('orders'), orderToUpdate.id), {
            people: orderToUpdate.people
        });
        setDetailModalOrder(orderToUpdate);
    } catch (error) {
        console.error("Error assigning worker:", error);
        alert("Failed to assign worker.");
    }
  };

  const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);

  return (
    <div className="space-y-6">
        <header>
            <h1 className="text-3xl font-bold text-text-primary">Orders</h1>
            <p className="mt-1 text-text-secondary">View, manage, and track all customer orders.</p>
        </header>

        <Card>
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-4">
                <div className="w-full md:max-w-md">
                    <Input 
                        placeholder="Search by Order ID, Customer Name, or Number..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                    />
                </div>
                <Button onClick={() => navigate('/orders/new')} variant="primary" className="flex items-center gap-2 w-full md:w-auto">
                    <PlusIcon /> Place New Order
                </Button>
            </div>

            {ordersLoading ? <div className="p-16"><Spinner /></div> : (
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                <thead className="border-b-2 border-border-color bg-stone-50">
                    <tr>
                        <th className="px-4 py-3 text-sm font-semibold uppercase text-text-secondary tracking-wider">Order ID</th>
                        <th className="px-4 py-3 text-sm font-semibold uppercase text-text-secondary tracking-wider">Customer</th>
                        <th className="px-4 py-3 text-sm font-semibold uppercase text-text-secondary tracking-wider">Delivery Date</th>
                        <th className="px-4 py-3 text-sm font-semibold uppercase text-text-secondary tracking-wider text-right">Total</th>
                        <th className="px-4 py-3 text-sm font-semibold uppercase text-text-secondary tracking-wider text-right">Pending</th>
                        <th className="px-4 py-3 text-sm font-semibold uppercase text-text-secondary tracking-wider text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                    {filteredOrders.map(order => (
                    <tr key={order.id} className="hover:bg-stone-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-sm">{order.billNumber}</td>
                        <td className="px-4 py-3 font-medium">{order.customer.name} <br/> <span className="text-text-secondary text-sm">{order.customer.number}</span></td>
                        <td className="px-4 py-3">{order.deliveryDate?.toDate().toLocaleDateString('en-GB')}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatCurrency(order.payment.total)}</td>
                        <td className={`px-4 py-3 text-right font-mono font-semibold ${order.payment.pending > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(order.payment.pending)}</td>
                        <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                                <Button onClick={() => setDetailModalOrder(order)} variant="secondary">Details</Button>
                                <Button onClick={() => navigate(`/orders/edit/${order.id}`)} variant="secondary" className="p-2">
                                    <EditIcon />
                                </Button>
                            </div>
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
                 {filteredOrders.length === 0 && (
                    <div className="text-center py-16">
                        <svg className="mx-auto h-12 w-12 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                        </svg>
                        <h3 className="mt-4 text-lg font-medium text-text-primary">No Orders Found</h3>
                        <p className="mt-1 text-sm text-text-secondary">Get started by placing your first order.</p>
                        <div className="mt-6">
                            <Button onClick={() => navigate('/orders/new')} variant="primary" className="flex items-center gap-2 mx-auto">
                                <PlusIcon /> Place New Order
                            </Button>
                        </div>
                    </div>
                 )}
            </div>
            )}
        </Card>

      {/* Order Detail & Status Update Modal */}
      <Modal isOpen={!!detailModalOrder} onClose={() => setDetailModalOrder(null)} title={`Order Details: ${detailModalOrder?.billNumber}`}>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-1">
          {detailModalOrder?.people.map((person, pIdx) => (
            <div key={pIdx} className="rounded-md border border-border-color p-4 bg-stone-50">
              <h4 className="text-lg font-semibold text-text-primary">{person.name}</h4>
              {person.items.map((item, iIdx) => (
                <div key={item.id || iIdx} className="mt-3 border-t border-stone-200 pt-3">
                  <p className="font-semibold text-primary">{item.name} - {formatCurrency(item.price)}</p>
                  {item.measurements && <p className="text-sm text-text-secondary mt-1 whitespace-pre-wrap">{item.measurements}</p>}
                  <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Select label="Status" value={item.status} onChange={(e) => handleStatusChange(pIdx, iIdx, e.target.value)}>
                      <option>Received</option><option>Cutting</option><option>Sewing</option><option>Ready for Trial</option><option>Delivered</option>
                    </Select>
                    <Select label="Assign Cutter" value={item.cutter || ''} onChange={e => handleWorkerAssign(pIdx, iIdx, 'cutter', e.target.value)}>
                      <option value="">Unassigned</option>
                      {workers.filter(w => w.specialization.toLowerCase().includes('cut')).map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
                    </Select>
                    <Select label="Assign Sewer" value={item.sewer || ''} onChange={e => handleWorkerAssign(pIdx, iIdx, 'sewer', e.target.value)}>
                      <option value="">Unassigned</option>
                      {workers.filter(w => w.specialization.toLowerCase().includes('sew')).map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};

export default OrderListPage;