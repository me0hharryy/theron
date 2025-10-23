import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'; // Added useRef
import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { db, storage, getCollectionPath } from '../../firebase';
import { doc, getDoc, addDoc, updateDoc, collection, writeBatch, Timestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import PropTypes from 'prop-types';
import { useReactToPrint } from 'react-to-print'; // Import useReactToPrint

import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Spinner from '../../components/ui/Spinner';
import InvoicePrint from './InvoicePrint'; // Import InvoicePrint component

// --- Icons ---
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>;
const UploadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-1"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>;
const PrintIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>;


// --- Constants & Templates ---
const MAX_STEPS = 3; // Define number of steps
const MEASUREMENT_FIELDS = ["Length", "Chest", "Waist", "Sleeve", "Shoulder", "Hips", "Neck", "Other"];

const newOrderItemTemplate = () => ({
  id: crypto.randomUUID(), name: '', price: 0,
  measurements: MEASUREMENT_FIELDS.reduce((acc, field) => ({ ...acc, [field]: '' }), {}),
  notes: '', designPhoto: '', status: 'Received', cutter: '', sewer: ''
});
const newPersonTemplate = () => ({ name: '', items: [newOrderItemTemplate()] });
const newOrderTemplate = () => ({
  id: null, // Add id field to store fetched or new id
  customer: { name: '', number: '', email: '' },
  deliveryDate: new Date().toISOString().split('T')[0], notes: '', people: [newPersonTemplate()],
  payment: { total: 0, advance: 0, pending: 0, method: 'Cash' }, status: 'Active',
  orderDate: Timestamp.now(), billNumber: `TH-${Date.now()}`
});

// --- Component ---
const OrderFormPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { tailoringItems, itemsLoading } = useData();

  const [order, setOrder] = useState(newOrderTemplate());
  const [isSaving, setIsSaving] = useState(false);
  const [formLoading, setFormLoading] = useState(!!orderId);
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadProgress, setUploadProgress] = useState({});
  const [person1NameManuallyEdited, setPerson1NameManuallyEdited] = useState(false);
  const [savedOrderData, setSavedOrderData] = useState(null); // Store saved order data for printing

  // Ref for printing
  const invoicePrintRef = useRef();

  // Setup react-to-print hook
  const handlePrintInvoice = useReactToPrint({
    content: () => invoicePrintRef.current,
    documentTitle: `Invoice-${savedOrderData?.billNumber || order?.billNumber || 'Order'}`,
  });

  // --- Helper ---
  const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);

  // --- Dropdown Options ---
  const itemOptions = useMemo(() => {
       if (!tailoringItems) return [];
       return tailoringItems.map(item => ({ value: item.name, label: item.name }));
   }, [tailoringItems]);


  // --- Data Fetching (for editing) ---
  const fetchOrder = useCallback(async (id) => {
    setFormLoading(true);
    try {
        const orderPath = getCollectionPath('orders');
        const orderDocRef = doc(db, orderPath, id);
        const orderDoc = await getDoc(orderDocRef);

        if (orderDoc.exists()) {
            const data = orderDoc.data();
            const deliveryDate = data.deliveryDate?.toDate ? data.deliveryDate.toDate().toISOString().split('T')[0] : '';
            const loadedOrder = {
                ...newOrderTemplate(), // Start with template defaults
                ...data, // Spread fetched data
                id: orderDoc.id, // Store the document ID
                deliveryDate, // Overwrite with formatted date
                customer: data.customer || { name: '', number: '', email: '' }, // Ensure objects exist
                payment: data.payment || { total: 0, advance: 0, pending: 0, method: 'Cash' },
                people: data.people?.map(p => ({
                    name: p.name || '',
                    items: p.items?.map(i => ({
                         ...newOrderItemTemplate(), // Start with item template
                         ...i, // Spread fetched item data
                         // Ensure measurements object exists and merges correctly
                         measurements: {
                            ...MEASUREMENT_FIELDS.reduce((acc, field) => ({ ...acc, [field]: '' }), {}), // Start with all fields empty
                            ...(typeof i.measurements === 'object' && i.measurements !== null ? i.measurements : {}) // Merge fetched measurements
                         }
                    })) || [newOrderItemTemplate()] // Fallback if no items
                })) || [newPersonTemplate()], // Fallback if no people
            };
            setOrder(loadedOrder);
             // If editing, assume person 1 name was intentional
            if (loadedOrder.people?.[0]?.name !== loadedOrder.customer?.name) {
                setPerson1NameManuallyEdited(true);
            }
        } else { console.error("Order not found:", id); alert("Order not found."); navigate('/orders'); }
    } catch (error) { console.error("Error fetching order:", error); alert("Error loading order details."); }
    finally { setFormLoading(false); }
  }, [navigate]);

  useEffect(() => { if (orderId) fetchOrder(orderId); else { setOrder(newOrderTemplate()); setFormLoading(false); } }, [orderId, fetchOrder]);


  // --- State Update Handlers ---
  const handleCustomerChange = (e) => {
      const { id, value } = e.target;
      if (id === 'name' || id === 'number' || id === 'email') {
          setOrder(prev => ({ ...prev, customer: { ...prev.customer, [id]: value } }));
          if (id === 'name') {
              // Reset manual edit flag only if name is cleared OR if it matches person 1 again
              const person1Name = order.people?.[0]?.name;
              if (value === '' || value === person1Name) {
                 setPerson1NameManuallyEdited(false);
              }
          }
      }
      else if (id === 'deliveryDate' || id === 'notes') { setOrder(prev => ({ ...prev, [id]: value })); }
  };
  const handlePaymentChange = (e) => {
       const { id, value } = e.target; const newValue = id === 'advance' ? Number(value) || 0 : value;
       setOrder(prev => ({ ...prev, payment: { ...prev.payment, [id]: newValue } }));
   };

  // Auto-fill Person 1 Name from Customer Name
  useEffect(() => {
    if (!orderId && !person1NameManuallyEdited && order.people?.length > 0) {
        // Only update if the names are different to avoid unnecessary re-renders
        if (order.people[0].name !== order.customer.name) {
            setOrder(prevOrder => ({
                ...prevOrder,
                people: prevOrder.people.map((person, index) =>
                    index === 0 ? { ...person, name: prevOrder.customer.name } : person
                )
            }));
        }
    }
  }, [order.customer.name, orderId, person1NameManuallyEdited, order.people]); // order.people is okay here


  const handleAddPerson = () => setOrder(prev => ({ ...prev, people: [...prev.people, newPersonTemplate()] }));
  const handleRemovePerson = (personIndex) => { if (order.people.length <= 1) return; setOrder(prev => ({ ...prev, people: prev.people.filter((_, i) => i !== personIndex) })); };

  const handlePersonNameChange = (personIndex, name) => {
      if (personIndex === 0) {
          // If user changes person 1's name to something different than customer name, set flag
          if (name !== order.customer.name) {
             setPerson1NameManuallyEdited(true);
          } else {
             // If they change it back to match, potentially reset flag (optional, allows re-enabling autofill)
             setPerson1NameManuallyEdited(false);
          }
      }
      setOrder(prev => ({ ...prev, people: prev.people.map((p, i) => i === personIndex ? { ...p, name } : p) }));
  };

  const handleAddItem = (personIndex) => { setOrder(prev => ({ ...prev, people: prev.people.map((p, i) => i === personIndex ? { ...p, items: [...p.items, newOrderItemTemplate()] } : p) })); };
  const handleRemoveItem = (personIndex, itemIndex) => { if (order.people[personIndex]?.items.length <= 1) return; setOrder(prev => ({ ...prev, people: prev.people.map((p, i) => i === personIndex ? { ...p, items: p.items.filter((_, j) => j !== itemIndex) } : p) })); };

  // Update item (including specific measurement field)
  const handleItemChange = (personIndex, itemIndex, field, value) => {
    setOrder(prev => ({
        ...prev,
        people: prev.people.map((person, i) => {
            if (i === personIndex) {
                return {
                    ...person,
                    items: person.items.map((item, j) => {
                        if (j === itemIndex) {
                            let updatedItem = { ...item };
                            if (MEASUREMENT_FIELDS.includes(field)) { updatedItem.measurements = { ...updatedItem.measurements, [field]: value }; }
                            else { updatedItem[field] = value; }
                            if (field === 'name') { const masterItem = tailoringItems.find(ti => ti.name === value); updatedItem.price = masterItem?.customerPrice || 0; }
                            if (field === 'price') { updatedItem.price = Number(value) || 0; }
                            return updatedItem;
                        } return item;
                    })
                };
            } return person;
        })
    }));
  };

  // --- File Upload Handler ---
  const handleImageUpload = (personIndex, itemIndex, file) => {
       if (!file) return;
       if (file.size > 5 * 1024 * 1024) { alert("File is too large (Max 5MB)."); return; }
       const itemId = order.people[personIndex]?.items[itemIndex]?.id;
       if (!itemId) { console.error("Item ID missing for upload."); return; }
       const uniqueFileName = `${itemId}-${Date.now()}-${file.name}`;
       // Use orderId if editing, otherwise use billNumber (which includes timestamp)
       const orderIdentifier = orderId || order.billNumber || 'newOrder';
       const storagePath = `orderDesigns/${orderIdentifier}/${uniqueFileName}`;
       const storageRef = ref(storage, storagePath);
       const uploadTask = uploadBytesResumable(storageRef, file);
       setUploadProgress(prev => ({ ...prev, [itemId]: 0 }));
       uploadTask.on('state_changed',
           (snapshot) => { setUploadProgress(prev => ({ ...prev, [itemId]: (snapshot.bytesTransferred / snapshot.totalBytes) * 100 })); },
           (error) => { console.error("Upload failed:", error); alert(`Upload failed: ${error.code}`); setUploadProgress(prev => ({ ...prev, [itemId]: -1 })); },
           () => { getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => { handleItemChange(personIndex, itemIndex, 'designPhoto', downloadURL); setUploadProgress(prev => ({ ...prev, [itemId]: 100 })); }).catch((error) => { console.error("Error getting download URL:", error); alert(`Failed to get URL: ${error.code}`); setUploadProgress(prev => ({ ...prev, [itemId]: -1 })); }); }
       );
  };


  // --- Recalculate Totals ---
  useEffect(() => {
     const total = order.people.reduce((acc, person) => acc + person.items.reduce((itemAcc, item) => itemAcc + (Number(item.price) || 0), 0), 0);
     const advance = Number(order.payment.advance) || 0;
     const pending = total - advance;
     if (order.payment.total !== total || order.payment.pending !== pending) { setOrder(prev => ({ ...prev, payment: { ...prev.payment, total, pending } })); }
  }, [order.people, order.payment.advance, order.payment.total, order.payment.pending]);


  // --- Form Submission ---
  const handleSubmitOrder = async (e) => {
      if (e) e.preventDefault();
      setIsSaving(true);
      setSavedOrderData(null); // Clear previous save data

      // --- Validation (with step change) ---
      if (!order.customer.name || !order.customer.number) { alert("Customer Name and Number are required."); setIsSaving(false); setCurrentStep(1); return; }
      if (!order.deliveryDate) { alert("Delivery Date is required."); setIsSaving(false); setCurrentStep(1); return; }
      const validPeople = order.people
          .map(person => ({ ...person, name: person.name.trim(), items: person.items.filter(item => item.name) })) // Trim name here
          .filter(person => person.name && person.items.length > 0);
      if (validPeople.length === 0) { alert("Order must contain at least one person with a name and at least one selected item."); setIsSaving(false); setCurrentStep(2); return; }
      // Ensure all people added have names
      if (order.people.some(person => !person.name.trim())) { alert("Please enter a name for every person added."); setIsSaving(false); setCurrentStep(2); return; }


      // Prepare data
      const dataToSave = {
        // Exclude the transient 'id' field from the top level order state
        customer: { name: order.customer.name.trim(), number: order.customer.number.trim(), email: order.customer.email?.trim() || '' },
        deliveryDate: Timestamp.fromDate(new Date(order.deliveryDate)),
        notes: order.notes?.trim() || '',
        payment: { total: Number(order.payment.total) || 0, advance: Number(order.payment.advance) || 0, pending: Number(order.payment.pending) || 0, method: order.payment.method || 'Cash' },
        people: validPeople.map(person => ({
             ...person, // Includes trimmed name
             items: person.items.map(item => ({
                 // Keep the random UUID generated earlier for items
                 id: item.id,
                 name: item.name,
                 price: Number(item.price) || 0,
                 notes: item.notes?.trim() || '',
                 designPhoto: item.designPhoto?.trim() || '',
                 status: item.status || 'Received',
                 cutter: item.cutter || '',
                 sewer: item.sewer || '',
                 // Clean up measurements: remove empty strings
                 measurements: Object.entries(item.measurements || {})
                     .filter(([, value]) => value && String(value).trim() !== '')
                     .reduce((obj, [key, value]) => {
                         obj[key] = String(value).trim(); // Ensure it's a string and trim
                         return obj;
                     }, {}),
                }))
        })),
        updatedAt: Timestamp.now(),
        // Conditionally set orderDate only if it's a new order
        ...( !orderId && { orderDate: order.orderDate || Timestamp.now() } ), // Preserve original date if editing
        billNumber: order.billNumber || `TH-${Date.now()}`, // Use existing or generate new
        status: order.status || 'Active',
      };
      // If editing, ensure original orderDate is preserved if it exists
      if (orderId && order.orderDate) {
          dataToSave.orderDate = order.orderDate;
      }


      // --- Firestore Logic ---
      try {
        const orderCollectionPath = getCollectionPath('orders');
        const transactionCollectionPath = getCollectionPath('transactions');
        let finalOrderId = orderId; // Use existing ID if editing

        if (orderId) {
            // Update existing order
            await updateDoc(doc(db, orderCollectionPath, orderId), dataToSave);
             // After successful update, fetch the latest data to show in print preview
            const updatedDoc = await getDoc(doc(db, orderCollectionPath, orderId));
            if (updatedDoc.exists()) {
                setSavedOrderData({ id: updatedDoc.id, ...updatedDoc.data() });
            } else {
                 // Fallback if fetch fails, use dataToSave (less ideal as Timestamps aren't resolved)
                 setSavedOrderData({ id: orderId, ...dataToSave });
            }
            // Don't navigate automatically on update, allow user to print or go back
        } else {
            // Add new order and potentially advance transaction
            const batch = writeBatch(db);
            const newOrderRef = doc(collection(db, orderCollectionPath));
            finalOrderId = newOrderRef.id; // Get the new ID
            batch.set(newOrderRef, dataToSave);

            if (dataToSave.payment.advance > 0) {
                const newTransactionRef = doc(collection(db, transactionCollectionPath));
                batch.set(newTransactionRef, {
                    date: Timestamp.now(),
                    type: 'Income',
                    description: `Advance for Order ${dataToSave.billNumber}`,
                    amount: dataToSave.payment.advance,
                    orderRef: finalOrderId // Link transaction to the new order ID
                });
            }
            await batch.commit();
            console.log("New order saved with ID:", finalOrderId);
            // Store the newly saved data (including the new ID) for printing
            setSavedOrderData({ id: finalOrderId, ...dataToSave });
             // Don't navigate automatically, show success/print options
            // navigate('/orders'); // OLD: Removed automatic navigation
        }

      } catch (error) { console.error("Error saving order: ", error); alert(`Failed to save order: ${error.message}`); setSavedOrderData(null); /* Clear save data on error */ }
      finally { setIsSaving(false); }
  };


  // --- Step Navigation ---
  const nextStep = () => {
       // Add basic validation before proceeding
       if (currentStep === 1) {
           if (!order.customer.name || !order.customer.number) { alert("Customer Name and Number are required."); return; }
           if (!order.deliveryDate) { alert("Delivery Date is required."); return; }
       }
       if (currentStep === 2) {
            const validPeople = order.people
             .map(person => ({ ...person, name: person.name.trim(), items: person.items.filter(item => item.name) }))
             .filter(person => person.name && person.items.length > 0);
           if (validPeople.length === 0) { alert("Order must contain at least one person with a name and at least one selected item."); return; }
            if (order.people.some(person => !person.name.trim())) { alert("Please enter a name for every person added."); return; }
       }
       setCurrentStep(prev => Math.min(prev + 1, MAX_STEPS));
  }
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  // --- Render Logic ---
  const commonInputStyles = "w-full rounded-md border border-[#E0E0E0] bg-[#FFFFFF] px-3 py-2 text-[#393E41] placeholder-gray-400 focus:border-[#44BBA4] focus:outline-none focus:ring-1 focus:ring-[#44BBA4]"; // Light border, white bg, dark text, teal focus

  if (formLoading || itemsLoading) { return <div className="py-16 flex justify-center"><Spinner /></div>; }

  // --- Post-Save Success Message ---
  if (savedOrderData) {
      return (
          <div className="pb-10 max-w-lg mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <Card>
                  <h2 className="text-2xl font-semibold text-green-600 mb-4">Order {orderId ? 'Updated' : 'Placed'} Successfully!</h2>
                  <p className="text-[#393E41] mb-2">Order ID: {savedOrderData.billNumber}</p>
                  <p className="text-[#6C757D] mb-6">You can now print the invoice or return to the order list.</p>
                  <div className="flex flex-col sm:flex-row justify-center gap-4">
                      <Button onClick={handlePrintInvoice} variant="primary" className="flex items-center justify-center gap-1.5">
                          <PrintIcon /> Print Invoice
                      </Button>
                      <Button onClick={() => navigate('/orders')} variant="secondary">
                          Go to Order List
                      </Button>
                  </div>
              </Card>
              {/* Hidden Div for Printing */}
              <div style={{ display: "none" }}>
                  <InvoicePrint ref={invoicePrintRef} order={savedOrderData} />
              </div>
          </div>
      );
  }

  // --- Default Form Rendering ---
  return (
    <div className="pb-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-bold text-[#393E41]">{orderId ? 'Edit Order' : 'Place New Order'}</h1>
         <Button type="button" onClick={() => navigate('/orders')} variant="secondary" className="w-full md:w-auto text-sm"> Back to Order List </Button>
      </div>

      {/* Progress Indicator */}
      <div className="mb-8 relative pt-1">
           <div className="flex mb-2 items-center justify-between">
               <div> <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-[#44BBA4] bg-[#E9E8E5]"> Step {currentStep} / {MAX_STEPS} </span> </div>
               <div className="text-right"> <span className="text-xs font-semibold inline-block text-[#44BBA4]"> {Math.round((currentStep / MAX_STEPS) * 100)}% </span> </div>
           </div>
           <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-[#E9E8E5]">
               <div style={{ width: `${(currentStep / MAX_STEPS) * 100}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-[#44BBA4] transition-all duration-300"></div>
           </div>
      </div>


      {/* **** FORM TAG **** */}
      {/* No onSubmit here, handled by the final button's click */}
      <div className="space-y-6">

        {/* --- Step 1: Customer Details --- */}
        {currentStep === 1 && (
          <Card>
             <h2 className="mb-4 text-xl font-semibold text-[#393E41]">Customer & Dates</h2>
             <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
               <Input label="Customer Name" id="name" value={order.customer.name} onChange={handleCustomerChange} required autoFocus/>
               <Input label="Customer Number" id="number" type="tel" value={order.customer.number} onChange={handleCustomerChange} required/>
               <Input label="Delivery Date" id="deliveryDate" type="date" value={order.deliveryDate instanceof Date ? order.deliveryDate.toISOString().split('T')[0] : order.deliveryDate} onChange={handleCustomerChange} required />
             </div>
             <div className="mt-4">
               <label htmlFor="notes" className="mb-2 block text-sm font-medium text-[#6C757D]">Order Notes (Optional)</label>
               <textarea id="notes" placeholder="Any special instructions..." value={order.notes} onChange={handleCustomerChange} className={commonInputStyles} rows="3"></textarea>
             </div>
          </Card>
        )}

        {/* --- Step 2: Items & Measurements --- */}
        {currentStep === 2 && (
          <div className="space-y-6">
             <h2 className="text-xl font-semibold text-[#393E41] mb-2">People & Items</h2>
             {order.people.map((person, personIndex) => (
               <Card key={`person-${personIndex}`}>
                 {/* Person Header */}
                 <div className="mb-4 flex items-center justify-between gap-4 border-b border-[#E0E0E0] pb-3">
                    <div className="flex-grow"> <Input id={`personName-${personIndex}`} label={`Person ${personIndex + 1} Name`} placeholder="Enter name..." value={person.name} onChange={e => handlePersonNameChange(personIndex, e.target.value)} required /> </div>
                   {order.people.length > 1 && ( <Button type="button" onClick={() => handleRemovePerson(personIndex)} variant="danger" className="p-1.5 self-end mb-2" aria-label={`Remove Person ${personIndex + 1}`}> <TrashIcon /> </Button> )}
                 </div>
                 {/* Items */}
                 <div className="space-y-5">
                     {person.items.map((item, itemIndex) => (
                       <div key={item.id || `item-${itemIndex}`} className="rounded-md border border-[#E0E0E0] p-4 bg-gray-50/50 relative">
                          {person.items.length > 1 && ( <button type="button" onClick={() => handleRemoveItem(personIndex, itemIndex)} className="absolute top-2 right-2 p-1 text-red-500 hover:text-red-700 focus:outline-none focus:ring-1 focus:ring-red-300 rounded-full" aria-label={`Remove Item ${itemIndex + 1}`}> <TrashIcon /> </button> )}
                         <h4 className="font-medium text-[#393E41] mb-3">Item {itemIndex + 1}</h4>
                         <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                           <Select label="Item Name" id={`itemName-${personIndex}-${itemIndex}`} value={item.name} onChange={e => handleItemChange(personIndex, itemIndex, 'name', e.target.value)} required > <option value="">-- Select Item --</option> {itemOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)} </Select>
                           <Input label="Price (₹)" id={`itemPrice-${personIndex}-${itemIndex}`} type="number" value={item.price} onChange={e => handleItemChange(personIndex, itemIndex, 'price', e.target.value)} required min="0" step="any" />
                           <div> {/* File Upload */}
                               <label className="mb-2 block text-sm font-medium text-[#6C757D]">Design Photo</label>
                               {item.designPhoto && (<div className="mb-1 text-xs"><a href={item.designPhoto} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">View Current Design</a></div>)}
                               <label htmlFor={`itemPhotoFile-${personIndex}-${itemIndex}`} className={`flex items-center justify-center w-full px-3 py-1.5 text-sm border border-dashed border-[#D3D0CB] rounded-md cursor-pointer hover:bg-[#E9E8E5] text-[#6C757D]`}> <UploadIcon /> <span>{uploadProgress[item.id] !== undefined && uploadProgress[item.id] >= 0 && uploadProgress[item.id] < 100 ? `Uploading...${Math.round(uploadProgress[item.id])}%` : (item.designPhoto ? 'Change Photo' : 'Upload Photo')}</span> <input id={`itemPhotoFile-${personIndex}-${itemIndex}`} type="file" accept="image/*" onChange={(e) => handleImageUpload(personIndex, itemIndex, e.target.files ? e.target.files[0] : null)} className="sr-only" /> </label>
                                {uploadProgress[item.id] === 100 && <p className="text-xs text-green-600 mt-1">✓ Uploaded</p>} {uploadProgress[item.id] === -1 && <p className="text-xs text-red-600 mt-1">✗ Failed</p>}
                           </div>
                         </div>

                         {/* --- MODIFIED: Vertical Measurements (2 columns on sm screens) --- */}
                         <div className="mt-4">
                             <label className="mb-1 block text-sm font-medium text-[#6C757D]">Measurements</label>
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 border border-[#E0E0E0] rounded-md p-3 bg-white">
                                {MEASUREMENT_FIELDS.map(field => (
                                    <Input
                                        key={field}
                                        id={`measurement-${personIndex}-${itemIndex}-${field}`}
                                        label={field}
                                        value={item.measurements[field] || ''}
                                        onChange={(e) => handleItemChange(personIndex, itemIndex, field, e.target.value)}
                                        className="text-sm py-1.5" // Adjusted padding/size
                                        placeholder="-"
                                    />
                                ))}
                             </div>
                         </div>
                         {/* --- End Modification --- */}

                         <div className="mt-4"> {/* Item Notes */}
                            <label htmlFor={`itemNotes-${personIndex}-${itemIndex}`} className="mb-1 block text-sm font-medium text-[#6C757D]">Item Notes / Details</label>
                           <textarea id={`itemNotes-${personIndex}-${itemIndex}`} placeholder="Specific instructions..." value={item.notes} onChange={e => handleItemChange(personIndex, itemIndex, 'notes', e.target.value)} className={commonInputStyles} rows="2"></textarea>
                       </div>
                       </div> // End Item Box
                     ))}
                 </div>
                 <Button type="button" onClick={() => handleAddItem(personIndex)} variant="secondary" className="mt-4 flex items-center gap-2 text-sm"><PlusIcon /> Add Item for {person.name || `Person ${personIndex + 1}`}</Button>
               </Card> // End Person Card
             ))}
             <Button type="button" onClick={handleAddPerson} variant="secondary" className="flex items-center gap-2"><PlusIcon /> Add Another Person</Button>
          </div>
        )}

        {/* --- Step 3: Payment --- */}
        {currentStep === 3 && (
          <Card>
             <h2 className="mb-4 text-xl font-semibold text-[#393E41]">Payment Details & Review</h2>
              {/* Review Section */}
              <div className="mb-6 border-b border-[#E0E0E0] pb-4 space-y-3">
                  <h3 className="text-lg font-medium text-[#393E41] mb-2">Order Summary</h3>
                   <p className="text-sm text-[#6C757D]">Customer: <span className="font-medium text-[#393E41]">{order.customer.name}</span> ({order.customer.number})</p>
                  <p className="text-sm text-[#6C757D]">Delivery Date: <span className="font-medium text-[#393E41]">{order.deliveryDate}</span></p>
                  <div className="text-sm text-[#6C757D]">
                      Items:
                      <ul className="list-disc pl-5 mt-1">
                          {order.people.map((person, pIdx) => (
                              <li key={pIdx} className="text-[#393E41] font-medium">
                                  {person.name}:
                                  <span className="font-normal text-[#6C757D] ml-2">
                                      {person.items.filter(i => i.name).map(i => i.name).join(', ') || 'No items'}
                                  </span>
                              </li>
                          ))}
                      </ul>
                  </div>
              </div>

              {/* Payment Section */}
             <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
               <Input label="Total Amount (₹)" id="total" type="number" value={order.payment.total || 0} readOnly disabled className="bg-gray-100 !border-gray-200" />
               <Input label="Advance Paid (₹)" id="advance" type="number" value={order.payment.advance || 0} onChange={handlePaymentChange} min="0" step="any"/>
               <div>
                   <label className="mb-2 block text-sm font-medium text-[#6C757D]">Pending Amount</label>
                   <div className={`w-full rounded-md border border-[#E0E0E0] bg-gray-100 px-3 py-2 text-lg font-semibold ${order.payment.pending > 0 ? 'text-red-600' : 'text-green-600'}`}>
                       {formatCurrency(order.payment.pending)}
                   </div>
               </div>
               <Select label="Payment Method" id="method" value={order.payment.method || 'Cash'} onChange={handlePaymentChange}> <option>Cash</option> <option>Online</option> </Select>
             </div>
          </Card>
        )}

        {/* --- Step Navigation & Submit --- */}
        <div className="flex justify-between items-center pt-6 border-t border-[#E0E0E0] mt-8">
            <Button type="button" onClick={prevStep} variant="secondary" disabled={currentStep === 1 || isSaving}>
              Previous Step
            </Button>

            {currentStep < MAX_STEPS ? (
              <Button type="button" onClick={nextStep} variant="primary" disabled={isSaving}>
                Next Step
              </Button>
            ) : (
               // Final step button triggers the submit handler
              <Button type="button" onClick={handleSubmitOrder} variant="primary" disabled={isSaving}>
                {isSaving ? 'Saving Order...' : (orderId ? 'Update Order' : 'Place Order')}
              </Button>
            )}
        </div>
      </div> {/* **** End of Form Content **** */}

       {/* Hidden Div for Printing - Stays outside conditional rendering, relies on savedOrderData */}
       <div style={{ display: "none" }}>
            {savedOrderData && <InvoicePrint ref={invoicePrintRef} order={savedOrderData} />}
       </div>

    </div> // End Main Container
  );
};

OrderFormPage.propTypes = {
    // No props passed directly, uses router params and context
};


export default OrderFormPage;