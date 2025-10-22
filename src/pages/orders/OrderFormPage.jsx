import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { db, getCollectionPath } from '../../firebase';
import { doc, getDoc, addDoc, updateDoc, collection, writeBatch, Timestamp } from 'firebase/firestore';

import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Spinner from '../../components/ui/Spinner';

const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>;

const newOrderTemplate = {
  customer: { name: '', number: '', email: '' },
  deliveryDate: '',
  people: [{ name: '', items: [] }],
  payment: { total: 0, advance: 0, pending: 0, method: 'Cash' },
  status: 'Active',
  orderDate: Timestamp.now()
};

const OrderFormPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { tailoringItems, itemsLoading } = useData();
  
  const [order, setOrder] = useState(newOrderTemplate);
  const [isSaving, setIsSaving] = useState(false);
  const [formLoading, setFormLoading] = useState(!!orderId);

  const fetchOrder = useCallback(async (id) => {
    setFormLoading(true);
    try {
        const orderDoc = await getDoc(doc(db, getCollectionPath('orders'), id));
        if (orderDoc.exists()) {
            const data = orderDoc.data();
            data.deliveryDate = data.deliveryDate.toDate().toISOString().split('T')[0];
            setOrder(data);
        } else {
            console.error("No such order found!");
            navigate('/orders');
        }
    } catch (error) {
        console.error("Error fetching order:", error);
    } finally {
        setFormLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (orderId) {
      fetchOrder(orderId);
    } else {
      const billNumber = `TH-${Date.now()}`;
      setOrder({ ...newOrderTemplate, billNumber, deliveryDate: new Date().toISOString().split('T')[0]});
    }
  }, [orderId, fetchOrder]);

  useEffect(() => {
    const total = order.people.reduce((acc, person) => 
      acc + person.items.reduce((itemAcc, item) => itemAcc + (Number(item.price) || 0), 0), 0);
    
    setOrder(prev => {
      const advance = Number(prev.payment.advance) || 0;
      const newPayment = { ...prev.payment, total, advance };
      newPayment.pending = newPayment.total - advance;
      return { ...prev, payment: newPayment };
    });
  }, [order.people, order.payment.advance]);

  const handleCustomerChange = (e) => setOrder(p => ({ ...p, customer: { ...p.customer, [e.target.id]: e.target.value } }));
  const handlePaymentChange = (e) => setOrder(p => ({ ...p, payment: { ...p.payment, [e.target.id]: e.target.value } }));
  const handleAddPerson = () => setOrder(p => ({ ...p, people: [...p.people, { name: '', items: [] }] }));
  const handleRemovePerson = (pIdx) => setOrder(p => ({ ...p, people: p.people.filter((_, i) => i !== pIdx) }));
  
  const handlePersonNameChange = (pIdx, name) => {
    const newPeople = JSON.parse(JSON.stringify(order.people));
    newPeople[pIdx].name = name;
    setOrder(p => ({ ...p, people: newPeople }));
  };
  
  const handleAddItem = (pIdx) => {
    const newPeople = JSON.parse(JSON.stringify(order.people));
    const defaultItem = tailoringItems[0] || { name: '', customerPrice: 0 };
    newPeople[pIdx].items.push({ 
      id: crypto.randomUUID(), name: defaultItem.name, price: defaultItem.customerPrice,
      measurements: '', status: 'Received', cutter: '', sewer: '' 
    });
    setOrder(p => ({ ...p, people: newPeople }));
  };

  const handleRemoveItem = (pIdx, iIdx) => {
    const newPeople = JSON.parse(JSON.stringify(order.people));
    newPeople[pIdx].items.splice(iIdx, 1);
    setOrder(p => ({ ...p, people: newPeople }));
  };

  const handleItemChange = (pIdx, iIdx, field, value) => {
    const newPeople = JSON.parse(JSON.stringify(order.people));
    const item = newPeople[pIdx].items[iIdx];
    item[field] = value;
    
    if (field === 'name') {
      item.price = tailoringItems.find(ti => ti.name === value)?.customerPrice || 0;
    }
    setOrder(p => ({ ...p, people: newPeople }));
  };

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    const dataToSave = { ...order,
      deliveryDate: Timestamp.fromDate(new Date(order.deliveryDate)),
      updatedAt: Timestamp.now(),
      payment: {
        total: Number(order.payment.total), 
        advance: Number(order.payment.advance), 
        pending: Number(order.payment.pending),
        method: order.payment.method
      }
    };
    if(!orderId) dataToSave.orderDate = Timestamp.now();
    else dataToSave.orderDate = order.orderDate; // Keep original order date

    try {
      if (orderId) {
        await updateDoc(doc(db, getCollectionPath('orders'), orderId), dataToSave);
      } else {
        const batch = writeBatch(db);
        const orderRef = doc(collection(db, getCollectionPath('orders')));
        batch.set(orderRef, dataToSave);

        if (dataToSave.payment.advance > 0) {
          const ledgerRef = doc(collection(db, getCollectionPath('transactions')));
          batch.set(ledgerRef, {
            date: Timestamp.now(), type: 'Income',
            description: `Advance for Order ${dataToSave.billNumber}`, 
            amount: dataToSave.payment.advance
          });
        }
        await batch.commit();
      }
      navigate('/orders');
    } catch (error) {
      console.error("Error saving order: ", error);
      alert("Failed to save order.");
    } finally {
      setIsSaving(false);
    }
  };

  if (formLoading || itemsLoading) return <Spinner />;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">{orderId ? 'Edit Order' : 'Place New Order'}</h1>
        <Button onClick={() => navigate('/orders')} variant="secondary">Back to Orders</Button>
      </div>
      <form onSubmit={handleSubmitOrder} className="space-y-6">
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Customer &amp; Dates</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Input label="Customer Name" id="name" value={order.customer.name} onChange={handleCustomerChange} required />
            <Input label="Customer Number" type="tel" id="number" value={order.customer.number} onChange={handleCustomerChange} required/>
            <Input label="Delivery Date" type="date" value={order.deliveryDate} onChange={e => setOrder(p => ({ ...p, deliveryDate: e.target.value }))} required/>
          </div>
        </Card>

        {order.people.map((person, pIdx) => (
          <Card key={pIdx}>
            <div className="mb-4 flex items-center justify-between">
              <Input placeholder={`Person ${pIdx + 1} Name`} value={person.name} onChange={e => handlePersonNameChange(pIdx, e.target.value)} required />
              {order.people.length > 1 && <Button type="button" onClick={() => handleRemovePerson(pIdx)} variant="danger" className="ml-4">Remove</Button>}
            </div>
            {person.items.map((item, iIdx) => (
              <div key={item.id || iIdx} className="mt-4 space-y-4 rounded-md border border-border-color p-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Item {iIdx + 1}</h4>
                  <Button type="button" onClick={() => handleRemoveItem(pIdx, iIdx)} variant="secondary" className="p-1 h-8 w-8"><TrashIcon /></Button>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Select label="Item Name" value={item.name} onChange={e => handleItemChange(pIdx, iIdx, 'name', e.target.value)} required>
                    <option value="">Select Item</option>
                    {tailoringItems.map(ti => <option key={ti.id} value={ti.name}>{ti.name}</option>)}
                  </Select>
                  <Input label="Price (₹)" type="number" value={item.price} onChange={e => handleItemChange(pIdx, iIdx, 'price', e.target.value)} required />
                  <textarea placeholder="Measurements (e.g., Length: 30, Chest: 42)" value={item.measurements} onChange={e => handleItemChange(pIdx, iIdx, 'measurements', e.target.value)} className="w-full rounded-md border border-border-color bg-background p-2 text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary md:col-span-2 lg:col-span-3" rows="2"></textarea>
                </div>
              </div>
            ))}
            <Button type="button" onClick={() => handleAddItem(pIdx)} variant="secondary" className="mt-4 flex items-center gap-2"><PlusIcon /> Add Item</Button>
          </Card>
        ))}
        <Button type="button" onClick={handleAddPerson} variant="secondary" className="flex items-center gap-2"><PlusIcon /> Add Person</Button>

        <Card>
          <h2 className="mb-4 text-xl font-semibold">Payment Details</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Input label="Total Amount (₹)" type="number" id="total" value={order.payment.total} onChange={handlePaymentChange} readOnly className="bg-stone-100" />
            <Input label="Advance Paid (₹)" type="number" id="advance" value={order.payment.advance} onChange={handlePaymentChange} min="0" />
            <div>
              <label className="mb-2 block text-sm font-medium text-text-secondary">Pending Amount</label>
              <div className="w-full rounded-md border border-border-color bg-stone-100 px-3 py-2 text-text-primary">{order.payment.pending}</div>
            </div>
            <Select label="Payment Method" value={order.payment.method} onChange={e => setOrder(p => ({ ...p, payment: { ...p.payment, method: e.target.value } }))}>
              <option>Cash</option><option>Online</option>
            </Select>
          </div>
        </Card>
        
        <div className="flex justify-end gap-4 pt-4">
          <Button type="submit" variant="primary" disabled={isSaving}>{isSaving ? 'Saving...' : (orderId ? 'Update Order' : 'Save Order')}</Button>
        </div>
      </form>
    </div>
  );
};

export default OrderFormPage;

