// src/pages/orders/OrderFormPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '../../context/DataContext'; // DataContext now includes additionalFees
import { db, storage, getCollectionPath } from '../../firebase';
import { doc, getDoc, addDoc, updateDoc, collection, writeBatch, Timestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import PropTypes from 'prop-types';

import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Spinner from '../../components/ui/Spinner';

// --- Icons ---
import { FiPlus, FiTrash2, FiUpload, FiTag, FiPlusSquare, FiArrowLeft, FiSave } from 'react-icons/fi';

// --- Constants & Templates ---
const MAX_STEPS = 3;
// Removed the global MEASUREMENT_FIELDS constant, it will now be dynamic per item

const newOrderItemTemplate = () => ({
  id: crypto.randomUUID(), name: '', price: 0,
  measurements: {}, // Start with an empty object
  dynamicMeasurementFields: [], // Array to hold required fields for this item
  notes: '', designPhoto: '', status: 'Received', cutter: '', sewer: ''
});
const newPersonTemplate = () => ({ name: '', items: [newOrderItemTemplate()] });
// Modified fee template to track selection and manual entry
const newAdditionalFeeTemplate = () => ({
    id: crypto.randomUUID(),
    description: '', // This might hold the selected value or manual input
    amount: 0,
    isManualDescription: true // Flag to track if description is manual
});

const newOrderTemplate = () => ({
  id: null,
  customer: { name: '', number: '', email: '' },
  deliveryDate: new Date().toISOString().split('T')[0], notes: '', people: [newPersonTemplate()],
  payment: {
      subtotal: 0, discountType: 'fixed', discountValue: 0, calculatedDiscount: 0,
      additionalFees: [], total: 0, advance: 0, pending: 0, method: 'Cash'
  },
  status: 'Active',
  orderDate: Timestamp.now(), billNumber: `TH-${Date.now()}` // Generate initial bill number
});

// --- Helper Functions outside component ---
const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount ?? 0);
const formatDateForInput = (dateValue) => {
    if (!dateValue) return new Date().toISOString().split('T')[0];
    let date;
    if (dateValue instanceof Timestamp) { date = dateValue.toDate(); }
    else if (dateValue instanceof Date) { date = dateValue; }
    else { try { date = new Date(dateValue.replace(/-/g, '/')); } catch (e) { date = new Date(); } } // Help parsing
    if (isNaN(date)) date = new Date();
    return date.toISOString().split('T')[0]; // Format as YYYY-MM-DD
};
const formatDateForDisplay = (dateValue) => {
    if (!dateValue) return 'N/A';
    let date;
    if (dateValue instanceof Timestamp) { date = dateValue.toDate(); }
    else if (dateValue instanceof Date) { date = dateValue; }
    else { try { date = new Date(dateValue.replace(/-/g, '/')); } catch (e) { return 'Invalid Date'; } } // Help parsing
    if (isNaN(date)) return 'Invalid Date';
    return date.toLocaleDateString('en-GB'); // DD/MM/YYYY
};

// --- New Order Notification Function ---
const sendNewOrderNotification = (orderData) => {
    const customer = orderData.customer;
    if (!customer?.number) {
        console.warn("Cannot send new order notification: Customer phone number missing.");
        return; // Don't proceed if number is missing
    }
    let phoneNumber = customer.number.replace(/[\s\-]+/g, '');
    // Basic India country code logic (adjust if needed)
    if (phoneNumber.length === 10 && !phoneNumber.startsWith('91')) {
        phoneNumber = `91${phoneNumber}`;
    }
    phoneNumber = phoneNumber.replace(/^\+|^00/, ''); // Remove leading +/00 for wa.me

    const customerName = customer.name ? `, ${customer.name}` : '';
    const orderId = orderData.billNumber || 'N/A';
    const deliveryDate = formatDateForDisplay(orderData.deliveryDate); // Expects JS Date

    // Create a concise summary of items
    let itemsSummary = '';
    orderData.people?.forEach(person => {
        const personItems = person.items?.map(item => item.name).filter(Boolean).join(', ');
        if (personItems) {
            itemsSummary += `\n- ${person.name || 'Items'}: ${personItems}`;
        }
    });
    if (!itemsSummary) itemsSummary = "\n- Items details as discussed."; // Fallback

    // Create invoice summary
    const payment = orderData.payment || {};
    const invoiceSummary = `
---------------------
Order Summary:
Items Subtotal: ${formatCurrency(payment.subtotal)}
${(payment.additionalFees || []).map(fee => `${fee.description || 'Fee'}: ${formatCurrency(fee.amount)}`).join('\n')}${payment.calculatedDiscount > 0 ? `\nDiscount: -${formatCurrency(payment.calculatedDiscount)}` : ''}
*Total Amount: ${formatCurrency(payment.total)}*
Advance Paid: ${formatCurrency(payment.advance)} (${payment.method || 'N/A'})
*Pending Amount: ${formatCurrency(payment.pending)}*
---------------------`;

    const message = `Namaste${customerName},\nYour order with Theron Tailors (ID: ${orderId}) has been received! 🎉\nPromised Delivery Date: ${deliveryDate}${itemsSummary}\n${invoiceSummary}\n\nWe'll keep you updated on the progress. Thank you!`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;

    console.log("Attempting to open WhatsApp for new order notification:", whatsappUrl);
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
};


// --- Component ---
const OrderFormPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { tailoringItems, itemsLoading, additionalFees, feesLoading } = useData();

  const [order, setOrder] = useState(newOrderTemplate());
  const [isSaving, setIsSaving] = useState(false);
  const [formLoading, setFormLoading] = useState(!!orderId);
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadProgress, setUploadProgress] = useState({});
  const [person1NameManuallyEdited, setPerson1NameManuallyEdited] = useState(false);

  // --- Dropdown Options ---
  const itemOptions = useMemo(() => {
    if (!tailoringItems) return [];
    return tailoringItems.map(item => ({ value: item.name, label: item.name }));
  }, [tailoringItems]);

  // --- MODIFIED: Fee Options (Removed amount from label) ---
  const feeOptions = useMemo(() => {
    if (!additionalFees) return [];
    // Sort alphabetically by description before mapping
    const sortedFees = [...additionalFees].sort((a, b) =>
        (a.description || '').localeCompare(b.description || '')
    );
    return sortedFees.map(fee => ({
        value: fee.description,
        label: fee.description, // Display only the description
        defaultAmount: fee.defaultAmount || 0
    }));
  }, [additionalFees]);


  // --- Data Fetching (for editing) ---
  const fetchOrder = useCallback(async (id) => {
    setFormLoading(true);
    try {
        const orderPath = getCollectionPath('orders');
        const orderDocRef = doc(db, orderPath, id);
        const orderDoc = await getDoc(orderDocRef);
        if (orderDoc.exists()) {
            const data = orderDoc.data();
            const deliveryDate = formatDateForInput(data.deliveryDate);
            const baseTemplate = newOrderTemplate();
            const loadedOrder = {
                ...baseTemplate, ...data, id: orderDoc.id, deliveryDate,
                customer: { ...baseTemplate.customer, ...(data.customer || {}) },
                payment: {
                    ...baseTemplate.payment, ...(data.payment || {}),
                    additionalFees: (Array.isArray(data.payment?.additionalFees) ? data.payment.additionalFees : [])
                                      .map(fee => ({...newAdditionalFeeTemplate(), ...fee})) // Ensure flags exist
                 },
                people: data.people?.map(p => ({
                    name: p.name || '',
                    items: p.items?.map(i => {
                        const masterItem = tailoringItems?.find(ti => ti.name === i.name);
                        const requiredFields = masterItem?.requiredMeasurements?.split(',')
                                                    .map(f => f.trim())
                                                    .filter(f => f) || [];
                        return {
                            ...newOrderItemTemplate(), ...i,
                            dynamicMeasurementFields: requiredFields,
                            measurements: {
                                ...(requiredFields.reduce((acc, field) => ({ ...acc, [field]: '' }), {})),
                                ...(typeof i.measurements === 'object' && i.measurements !== null ? i.measurements : {})
                            }
                        };
                    }) || [newOrderItemTemplate()]
                })) || [newPersonTemplate()],
                 orderDate: data.orderDate || Timestamp.now()
            };
            setOrder(loadedOrder);
            if (loadedOrder.people?.[0]?.name && loadedOrder.people[0].name !== loadedOrder.customer?.name) {
                setPerson1NameManuallyEdited(true);
            }
        } else { console.error("Order not found:", id); alert("Order not found."); navigate('/orders'); }
    } catch (error) { console.error("Error fetching order:", error); alert("Error loading order details."); }
    finally { setFormLoading(false); }
  }, [navigate, tailoringItems]);

  useEffect(() => {
      if (!itemsLoading && !feesLoading) {
          if (orderId) {
             fetchOrder(orderId);
           } else {
             setOrder(newOrderTemplate());
             setFormLoading(false);
           }
      }
  }, [orderId, fetchOrder, itemsLoading, feesLoading]);


  // --- State Update Handlers ---
  const handleCustomerChange = (e) => {
      const { id, value } = e.target;
      if (id === 'name' || id === 'number' || id === 'email') {
          setOrder(prev => {
              const newState = { ...prev, customer: { ...prev.customer, [id]: value } };
              const person1Name = newState.people?.[0]?.name;
               if (id === 'name') {
                   if (value === '' || (newState.people?.[0] && value === person1Name)) {
                       setPerson1NameManuallyEdited(false);
                   }
               }
              if (id === 'name' && !person1NameManuallyEdited && newState.people?.[0]) {
                  newState.people = newState.people.map((p, idx) => idx === 0 ? { ...p, name: value } : p);
              }
              return newState;
          });
      } else if (id === 'deliveryDate' || id === 'notes') {
          setOrder(prev => ({ ...prev, [id]: value }));
      }
  };

  const handlePaymentChange = (e) => {
       const { id, value } = e.target;
       const numValue = Number(value) || 0;
       setOrder(prev => ({
            ...prev,
            payment: {
                ...prev.payment,
                [id]: ['advance', 'discountValue'].includes(id) ? Math.max(0, numValue) : value
            }
        }));
   };

    // Fees Handlers
  const handleAddFee = () => {
      setOrder(prev => ({
          ...prev,
          payment: {
              ...prev.payment,
              additionalFees: [...(prev.payment.additionalFees || []), newAdditionalFeeTemplate()]
          }
      }));
  };
  const handleRemoveFee = (feeId) => { setOrder(prev => ({ ...prev, payment: { ...prev.payment, additionalFees: (prev.payment.additionalFees || []).filter(fee => fee.id !== feeId) } })); };

  // Handle change for fee select/input
  const handleFeeChange = (feeId, field, value) => {
    setOrder(prev => {
        const updatedFees = (prev.payment.additionalFees || []).map(fee => {
            if (fee.id === feeId) {
                let newFee = { ...fee };
                if (field === 'descriptionSelect') {
                    const selectedFeeOption = feeOptions.find(opt => opt.value === value);
                    if (value === '_manual_') {
                        newFee.description = '';
                        newFee.isManualDescription = true;
                        // Keep current amount if user switches TO manual, otherwise default
                        newFee.amount = fee.amount || 0;
                    } else if (selectedFeeOption) {
                        newFee.description = selectedFeeOption.value;
                        newFee.amount = selectedFeeOption.defaultAmount; // Auto-fill amount
                        newFee.isManualDescription = false;
                    } else {
                        newFee.description = '';
                        newFee.isManualDescription = true;
                        newFee.amount = 0;
                    }
                } else if (field === 'manualDescription') {
                    if (newFee.isManualDescription) {
                        newFee.description = value;
                    }
                } else if (field === 'amount') {
                    newFee.amount = Number(value) || 0;
                }
                return newFee;
            }
            return fee;
        });
        return { ...prev, payment: { ...prev.payment, additionalFees: updatedFees } };
    });
  };

  // Auto-fill Person 1 Name Effect
  useEffect(() => {
    if (!orderId && !person1NameManuallyEdited && order.people?.length > 0) {
        if (order.people[0].name !== order.customer.name) {
            setOrder(prevOrder => ({
                ...prevOrder,
                people: prevOrder.people.map((person, index) =>
                    index === 0 ? { ...person, name: prevOrder.customer.name } : person
                )
            }));
        }
    }
  }, [order.customer.name, orderId, person1NameManuallyEdited, order.people]);

  // Person/Item Add/Remove/NameChange Handlers
  const handleAddPerson = () => setOrder(prev => ({ ...prev, people: [...(prev.people || []), newPersonTemplate()] }));
  const handleRemovePerson = (personIndex) => { if (order.people?.length > 1) { setOrder(prev => ({ ...prev, people: prev.people.filter((_, i) => i !== personIndex) })); } };
  const handlePersonNameChange = (personIndex, name) => {
      if (personIndex === 0) {
          setPerson1NameManuallyEdited(true);
          if (name === order.customer.name) {
              setPerson1NameManuallyEdited(false);
          }
      }
      setOrder(prev => ({
            ...prev,
            people: prev.people.map((p, i) => i === personIndex ? { ...p, name } : p)
       }));
  };
  const handleAddItem = (personIndex) => {
      setOrder(prev => ({
            ...prev,
            people: prev.people.map((p, i) =>
                i === personIndex ? { ...p, items: [...(p.items || []), newOrderItemTemplate()] } : p
            )
        }));
   };
  const handleRemoveItem = (personIndex, itemIndex) => {
      if (order.people?.[personIndex]?.items?.length > 1) {
          setOrder(prev => ({
                ...prev,
                people: prev.people.map((p, i) =>
                    i === personIndex
                     ? { ...p, items: p.items.filter((_, j) => j !== itemIndex) }
                     : p
                )
            }));
       }
   };

  // Update item field handler (Handles dynamic measurements)
  const handleItemChange = (personIndex, itemIndex, field, value) => {
    setOrder(prev => {
        const newPeople = JSON.parse(JSON.stringify(prev.people));
        const person = newPeople[personIndex];
        if (!person || !person.items || !person.items[itemIndex]) { return prev; }
        const item = person.items[itemIndex];
        item.measurements = item.measurements || {};
        item.dynamicMeasurementFields = item.dynamicMeasurementFields || [];

        if (item.dynamicMeasurementFields.includes(field)) {
            item.measurements[field] = value;
        } else {
            item[field] = value;
        }

        if (field === 'name') {
            const masterItem = tailoringItems?.find(ti => ti.name === value);
            item.price = masterItem?.customerPrice || 0;
            const requiredFields = masterItem?.requiredMeasurements?.split(',').map(f => f.trim()).filter(f => f) || [];
            item.dynamicMeasurementFields = requiredFields;
            const newMeasurements = {};
            requiredFields.forEach(reqField => {
                newMeasurements[reqField] = item.measurements[reqField] || '';
            });
            item.measurements = newMeasurements;
        }

        if (field === 'price') {
            item.price = Number(value) || 0;
        }
        return { ...prev, people: newPeople };
    });
  };

  // Image Upload Handler
  const handleImageUpload = (personIndex, itemIndex, file) => {
       if (!file) { alert("No file selected."); return; }
       if (file.size > 5 * 1024 * 1024) { alert("File is too large (max 5MB)."); return; }
       const itemId = order.people?.[personIndex]?.items?.[itemIndex]?.id;
       if (!itemId) { console.error("Item ID missing for upload."); return; }
       const uniqueFileName = `${itemId}-${Date.now()}-${file.name}`;
       const orderIdentifier = orderId || order.billNumber || 'newOrder';
       const storagePath = `orderDesigns/${orderIdentifier}/${uniqueFileName}`;
       const storageRef = ref(storage, storagePath);
       const uploadTask = uploadBytesResumable(storageRef, file);
       setUploadProgress(prev => ({ ...prev, [itemId]: 0 }));
       uploadTask.on('state_changed', (snapshot) => {
           const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
           setUploadProgress(prev => ({ ...prev, [itemId]: progress }));
       }, (error) => {
           console.error("Upload failed:", error); alert(`Upload failed: ${error.code}`);
           setUploadProgress(prev => ({ ...prev, [itemId]: -1 }));
       }, () => {
           getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
               handleItemChange(personIndex, itemIndex, 'designPhoto', downloadURL);
               setUploadProgress(prev => ({ ...prev, [itemId]: 100 }));
           }).catch((error) => {
               console.error("Error getting download URL:", error); alert(`Failed to get image URL after upload: ${error.code}`);
               setUploadProgress(prev => ({ ...prev, [itemId]: -1 }));
           });
       });
  };


  // --- Recalculate Totals Effect ---
  useEffect(() => {
     const subtotal = order.people?.reduce((acc, person) =>
         acc + (person.items?.reduce((itemAcc, item) => itemAcc + (Number(item.price) || 0), 0) || 0), 0) || 0;
     const feesTotal = order.payment?.additionalFees?.reduce((acc, fee) => acc + (Number(fee.amount) || 0), 0) || 0;
     let calculatedDiscount = 0;
     const discountVal = Number(order.payment?.discountValue) || 0;
     if (order.payment?.discountType === 'percent' && discountVal > 0) { calculatedDiscount = (subtotal + feesTotal) * (discountVal / 100); }
     else if (order.payment?.discountType === 'fixed' && discountVal > 0) { calculatedDiscount = discountVal; }
     calculatedDiscount = Math.min(calculatedDiscount, subtotal + feesTotal);
     const total = subtotal + feesTotal - calculatedDiscount;
     const advance = Number(order.payment?.advance) || 0;
     const pending = total - advance;
     if ( order.payment?.subtotal !== subtotal || order.payment?.calculatedDiscount !== calculatedDiscount || order.payment?.total !== total || order.payment?.pending !== pending ) {
        setOrder(prev => ({ ...prev, payment: { ...prev.payment, subtotal: parseFloat(subtotal.toFixed(2)), calculatedDiscount: parseFloat(calculatedDiscount.toFixed(2)), total: parseFloat(total.toFixed(2)), pending: parseFloat(pending.toFixed(2)) } }));
     }
  }, [order.people, order.payment.additionalFees, order.payment.discountType, order.payment.discountValue, order.payment.advance, order.payment.subtotal, order.payment.calculatedDiscount, order.payment.total, order.payment.pending]);


  // --- PRINT INVOICE FUNCTION (Internal) ---
  const printInvoice = (orderData) => {
        if (!orderData) { console.error("No order data for printInvoice."); return; }
        const printWindow = window.open('', '_blank', 'height=800,width=800');
        if (!printWindow) { alert("Please allow popups to print."); return; }
        const printStyles = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');body{font-family:'Inter',sans-serif;margin:20px;line-height:1.5;color:#333;font-size:10pt}h2,h3,h4,h5{margin:0 0 .5em 0;padding:0;line-height:1.3;color:#393E41}p{margin:0 0 .3em 0}table{width:100%;border-collapse:collapse;margin-bottom:1em}th,td{border-bottom:1px solid #eee;padding:.4em .5em;text-align:left;vertical-align:top}th{background-color:#f8f9fa;font-weight:600;font-size:.9em;text-transform:uppercase;color:#6C757D}td:last-child,th:last-child{text-align:right}strong{font-weight:600}.invoice-header{text-align:center;margin-bottom:1.5em;border-bottom:2px solid #eee;padding-bottom:1em}.invoice-header h2{font-size:1.8em;font-weight:700;color:#44BBA4;margin-bottom:.1em}.invoice-header p{font-size:.85em;color:#555}.details-grid{display:grid;grid-template-columns:1fr 1fr;gap:1.5em;margin-bottom:1.5em;padding-bottom:1em;border-bottom:1px dashed #ccc}.details-grid h5{font-size:1em;font-weight:600;color:#44BBA4;margin-bottom:.5em;border-bottom:1px solid #eee;padding-bottom:.3em}.details-grid p{font-size:.9em;color:#555}.items-section h3{font-size:1.1em;font-weight:600;margin-bottom:.5em}.item-notes{font-size:.8em;color:#666;font-style:italic;padding-left:1em;margin-top:.2em}.totals-section{display:flex;justify-content:flex-end;margin-top:1.5em;padding-top:1em;border-top:2px solid #eee}.totals-box{width:100%;max-width:280px;font-size:.9em}.totals-box div{display:flex;justify-content:space-between;margin-bottom:.3em}.totals-box span:first-child{color:#555;padding-right:1em}.totals-box span:last-child{font-weight:600;color:#333;min-width:80px;text-align:right;font-family:monospace}.totals-box .grand-total span{font-weight:700;font-size:1.1em;color:#393E41}.totals-box .due span:last-child{color:#D97706}.footer{margin-top:2em;text-align:center;font-size:.8em;color:#888;border-top:1px dashed #ccc;padding-top:.8em}.no-print,.no-print-invoice,.measurement-section-for-print{display:none!important}`;
        const validPeopleForPrint = orderData.people?.filter(p => p.name && p.items?.some(i => i.name)) || [];
        const additionalFees = orderData.payment?.additionalFees || [];
        const invoiceHTML = `<div class="invoice-header"><h2>THERON Tailors</h2><p>Order Slip / Invoice</p><p>Order ID: <strong>${orderData.billNumber || 'N/A'}</strong></p></div><div class="details-grid"><div><h5>Customer Details:</h5><p>Name: ${orderData.customer?.name || 'N/A'}</p><p>Phone: ${orderData.customer?.number || 'N/A'}</p></div><div><h5>Order Dates:</h5><p>Order Date: ${formatDateForDisplay(orderData.orderDate)}</p><p>Delivery Date: ${formatDateForDisplay(orderData.deliveryDate)}</p></div></div><div class="items-section"><h3>Order Items</h3><table><thead><tr><th>#</th><th>Person</th><th>Item</th><th>Price</th></tr></thead><tbody>${validPeopleForPrint.flatMap((person, pIdx) => person.items.map((item, iIdx) => `<tr><td>${pIdx * (person.items?.length || 0) + iIdx + 1}</td><td>${person.name || `Person ${pIdx + 1}`}</td><td> ${item.name || 'N/A'} ${item.notes ? `<div class="item-notes">Notes: ${item.notes}</div>` : ''} </td><td>${formatCurrency(item.price)}</td></tr>`)).join('')}</tbody></table></div><div class="totals-section"><div class="totals-box"><div><span>Subtotal:</span> <span>${formatCurrency(orderData.payment?.subtotal)}</span></div> ${additionalFees.map(fee => `<div><span>${fee.description || 'Additional Fee'}:</span> <span>${formatCurrency(fee.amount)}</span></div>`).join('')} ${orderData.payment?.calculatedDiscount > 0 ? `<div><span>Discount (${orderData.payment?.discountType === 'percent' ? `${orderData.payment?.discountValue}%` : 'Fixed'}):</span> <span>-${formatCurrency(orderData.payment?.calculatedDiscount)}</span></div>` : ''} <div class="grand-total" style="border-top: 1px solid #ccc; padding-top: 0.3em; margin-top: 0.3em;"><span>Grand Total:</span> <span>${formatCurrency(orderData.payment?.total)}</span></div><div><span>Advance Paid (${orderData.payment?.method || 'N/A'}):</span> <span>${formatCurrency(orderData.payment?.advance)}</span></div><div class="due"><span>Amount Due:</span> <span>${formatCurrency(orderData.payment?.pending)}</span></div></div></div> ${orderData.notes ? `<div style="margin-top: 1.5em; border-top: 1px dashed #ccc; padding-top: 1em;"><h5 style="font-size: 1em; margin-bottom: 0.3em;">Order Notes:</h5><p style="font-size: 0.85em; white-space: pre-wrap;">${orderData.notes}</p></div>` : ''} <div class="footer">Thank you!</div>`;
        printWindow.document.write(`<html><head><title>Invoice: ${orderData.billNumber || 'Order'}</title><style>${printStyles}</style></head><body>${invoiceHTML}</body></html>`);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  };


  // --- Form Submission ---
  const handleSubmitOrder = async (e) => {
      e.preventDefault();
      setIsSaving(true);

      // Validation...
      if (!order.customer.name || !order.customer.number) { alert("Customer Name and Number required."); setIsSaving(false); setCurrentStep(1); return; }
      if (!order.deliveryDate) { alert("Delivery Date required."); setIsSaving(false); setCurrentStep(1); return; }
      const validPeople = order.people?.map(person => ({ ...person, name: person.name.trim(), items: person.items?.filter(item => item.name) || [] })).filter(person => person.name && person.items.length > 0) || [];
      if (validPeople.length === 0) { alert("Order must have at least one person with a name and one item."); setIsSaving(false); setCurrentStep(2); return; }
      if (order.people.some(person => !person.name.trim())) { alert("Please enter a name for every person added."); setIsSaving(false); setCurrentStep(2); return; }

      // Prepare data
      let deliveryTimestamp;
      try {
          deliveryTimestamp = Timestamp.fromDate(new Date(order.deliveryDate + 'T00:00:00'));
      } catch (dateError) {
          console.error("Error converting delivery date:", dateError);
          alert("Invalid Delivery Date format. Please check the date.");
          setIsSaving(false);
          return;
      }

      const dataToSave = {
        customer: { name: order.customer.name.trim(), number: order.customer.number.trim(), email: order.customer.email?.trim() || '' },
        deliveryDate: deliveryTimestamp,
        notes: order.notes?.trim() || '',
        payment: {
            subtotal: order.payment.subtotal || 0,
            discountType: order.payment.discountType || 'fixed',
            discountValue: order.payment.discountValue || 0,
            calculatedDiscount: order.payment.calculatedDiscount || 0,
            additionalFees: (order.payment.additionalFees || [])
                .filter(fee => fee.description && fee.description.trim() !== '' && fee.amount >= 0)
                .map(fee => ({ description: fee.description.trim(), amount: fee.amount })), // Save only desc and amount
            total: order.payment.total || 0,
            advance: order.payment.advance || 0,
            pending: order.payment.pending || 0,
            method: order.payment.method || 'Cash'
        },
        people: validPeople.map(person => ({
            ...person,
            items: person.items.map(item => ({
                id: item.id,
                name: item.name,
                price: Number(item.price) || 0,
                measurements: Object.entries(item.measurements || {}).filter(([, value]) => value && String(value).trim() !== '').reduce((obj, [key, value]) => { obj[key] = String(value).trim(); return obj; }, {}),
                notes: item.notes?.trim() || '',
                designPhoto: item.designPhoto?.trim() || '',
                status: item.status || 'Received',
                cutter: item.cutter || '',
                sewer: item.sewer || ''
            }))
        })),
        updatedAt: Timestamp.now(),
        ...( !orderId && { orderDate: order.orderDate instanceof Timestamp ? order.orderDate : Timestamp.now() } ),
        ...( orderId && order.orderDate instanceof Timestamp && { orderDate: order.orderDate }),
        billNumber: order.billNumber || `TH-${Date.now()}`,
        status: order.status || 'Active',
      };

      // Firestore Logic
      try {
        const orderCollectionPath = getCollectionPath('orders');
        const transactionCollectionPath = getCollectionPath('transactions');
        let savedDataForNotification = null;
        let currentOrderId = orderId;
        let currentBillNumber = dataToSave.billNumber;
        let isNewOrder = false;

        if (orderId) { // UPDATE
            await updateDoc(doc(db, orderCollectionPath, orderId), dataToSave);
            savedDataForNotification = {
                id: orderId,
                ...dataToSave,
                deliveryDate: dataToSave.deliveryDate.toDate(),
                orderDate: dataToSave.orderDate?.toDate ? dataToSave.orderDate.toDate() : order.orderDate?.toDate ? order.orderDate.toDate() : null
             };
        } else { // CREATE
            isNewOrder = true;
            const batch = writeBatch(db);
            const newOrderRef = doc(collection(db, orderCollectionPath));
            currentOrderId = newOrderRef.id;
            const finalBillNumber = dataToSave.billNumber;
            const finalDataToSave = { ...dataToSave, id: currentOrderId, billNumber: finalBillNumber };
            currentBillNumber = finalBillNumber;
            batch.set(newOrderRef, finalDataToSave);
            if (finalDataToSave.payment.advance > 0) {
                 const newTransactionRef = doc(collection(db, transactionCollectionPath));
                 batch.set(newTransactionRef, {
                    date: Timestamp.now(), type: 'Income',
                    description: `Advance for Order ${finalBillNumber}`,
                    amount: finalDataToSave.payment.advance,
                    orderRef: currentOrderId
                 });
            }
            await batch.commit();
            console.log("New order saved with ID:", currentOrderId);
             savedDataForNotification = {
                ...finalDataToSave,
                deliveryDate: finalDataToSave.deliveryDate.toDate(),
                orderDate: finalDataToSave.orderDate.toDate()
            };
        }

        if (isNewOrder && savedDataForNotification) {
             sendNewOrderNotification(savedDataForNotification);
        }

        if (window.confirm(`Order ${isNewOrder ? 'placed' : 'updated'} successfully! (ID: ${currentBillNumber})\n\nPrint invoice?`)) {
            printInvoice(savedDataForNotification);
        }

        navigate('/orders');

      } catch (error) { console.error("Error saving order: ", error); alert(`Failed to save order: ${error.message}`); }
      finally { setIsSaving(false); }
  };


  // Step Navigation
   const nextStep = () => {
       if (currentStep === 1 && (!order.customer.name || !order.customer.number || !order.deliveryDate)) { alert("Customer Name, Number, and Delivery Date are required."); return; }
       if (currentStep === 2) {
            const validPeople = order.people?.filter(p => p.name?.trim() && p.items?.some(i => i.name)) || [];
            if (validPeople.length === 0 || order.people.some(p => !p.name?.trim())) { alert("Each person must have a name and at least one item selected."); return; }
       }
       setCurrentStep(prev => Math.min(prev + 1, MAX_STEPS));
   };
   const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  // Render Logic
  const commonInputStyles = "w-full rounded-md border border-[#E0E0E0] bg-[#FFFFFF] px-3 py-2 text-[#393E41] placeholder-gray-400 focus:border-[#44BBA4] focus:outline-none focus:ring-1 focus:ring-[#44BBA4]";

  if (formLoading || itemsLoading || feesLoading) { return <div className="py-16 flex justify-center"><Spinner /></div>; }

  return (
    <div className="pb-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
       <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-bold text-[#393E41]">{orderId ? 'Edit Order' : 'Place New Order'}</h1>
         <Button type="button" onClick={() => navigate('/orders')} variant="secondary" className="w-full md:w-auto text-sm inline-flex items-center gap-1">
             <FiArrowLeft size={16}/> Back to Order List
         </Button>
      </div>
      {/* Progress Indicator */}
       <div className="mb-8 relative pt-1">
           <div className="flex mb-2 items-center justify-between"> <div><span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-[#44BBA4] bg-[#E9E8E5]"> Step {currentStep} / {MAX_STEPS} </span></div> <div className="text-right"><span className="text-xs font-semibold inline-block text-[#44BBA4]"> {Math.round((currentStep / MAX_STEPS) * 100)}% </span></div> </div>
           <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-[#E9E8E5]"> <div style={{ width: `${(currentStep / MAX_STEPS) * 100}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-[#44BBA4] transition-all duration-300"></div> </div>
      </div>

      {/* Form Content Area */}
      <div className="space-y-6">
        {/* Step 1: Customer & Dates */}
        {currentStep === 1 && (
            <Card>
                <h2 className="mb-4 text-xl font-semibold text-[#393E41]">Customer & Dates</h2>
                 <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                    <Input label="Customer Name" id="name" name="name" value={order.customer.name || ''} onChange={handleCustomerChange} required autoFocus/>
                    <Input label="Customer Number" id="number" name="number" type="tel" value={order.customer.number || ''} onChange={handleCustomerChange} required/>
                    <Input label="Delivery Date" id="deliveryDate" name="deliveryDate" type="date" value={order.deliveryDate || ''} onChange={handleCustomerChange} required />
                </div>
                 <div className="mt-4">
                    <label htmlFor="notes" className="mb-2 block text-sm font-medium text-[#6C757D]">Order Notes (Optional)</label>
                    <textarea id="notes" name="notes" placeholder="Any special instructions..." value={order.notes || ''} onChange={handleCustomerChange} className={commonInputStyles} rows="3"></textarea>
                 </div>
            </Card>
        )}

        {/* Step 2: People & Items */}
        {currentStep === 2 && (
             <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-[#393E41] mb-2">People & Items</h2>
                 {order.people?.map((person, personIndex) => (
                   <Card key={`person-${personIndex}`}>
                     <div className="mb-4 flex items-center justify-between gap-4 border-b border-[#E0E0E0] pb-3">
                        <div className="flex-grow">
                            <Input
                                id={`personName-${personIndex}`}
                                name={`personName-${personIndex}`}
                                label={`Person ${personIndex + 1} Name`}
                                placeholder="Enter name..."
                                value={person.name || ''}
                                onChange={e => handlePersonNameChange(personIndex, e.target.value)}
                                required
                            />
                        </div>
                        {order.people.length > 1 && (
                            <Button type="button" onClick={() => handleRemovePerson(personIndex)} variant="danger" className="p-1.5 self-end mb-2 " aria-label={`Remove Person ${personIndex + 1}`}>
                                <FiTrash2 />
                            </Button>
                        )}
                     </div>
                     <div className="space-y-5">
                         {person.items?.map((item, itemIndex) => (
                           <div key={item.id} className="rounded-md border border-[#E0E0E0] p-4 bg-gray-50/50 relative">
                              {person.items.length > 1 && (
                                <button type="button" onClick={() => handleRemoveItem(personIndex, itemIndex)} className="absolute top-2 right-2 p-1 text-red-500 hover:text-red-700 focus:outline-none focus:ring-1 focus:ring-red-300 rounded-full" aria-label={`Remove Item ${itemIndex + 1}`}>
                                    <FiTrash2 />
                                </button>
                               )}
                             <h4 className="font-medium text-[#393E41] mb-3">Item {itemIndex + 1}</h4>
                             <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                <Select label="Item Name" id={`itemName-${personIndex}-${itemIndex}`} name={`itemName-${personIndex}-${itemIndex}`} value={item.name || ''} onChange={e => handleItemChange(personIndex, itemIndex, 'name', e.target.value)} required >
                                    <option value="">-- Select Item --</option>
                                    {itemOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </Select>
                                <Input label="Price (₹)" id={`itemPrice-${personIndex}-${itemIndex}`} name={`itemPrice-${personIndex}-${itemIndex}`} type="number" value={item.price || ''} onChange={e => handleItemChange(personIndex, itemIndex, 'price', e.target.value)} required min="0" step="any" />
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-[#6C757D]">Design Photo</label>
                                    {item.designPhoto && (<div className="mb-1 text-xs"><a href={item.designPhoto} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">View Current Design</a></div>)}
                                    <label htmlFor={`itemPhotoFile-${personIndex}-${itemIndex}`} className={`flex items-center justify-center w-full px-3 py-1.5 text-sm border border-dashed border-[#D3D0CB] rounded-md cursor-pointer hover:bg-[#E9E8E5] text-[#6C757D]`}>
                                        <FiUpload /> <span>{uploadProgress[item.id] > 0 && uploadProgress[item.id] < 100 ? `Uploading...${Math.round(uploadProgress[item.id])}%` : (item.designPhoto ? 'Change Photo' : 'Upload Photo')}</span>
                                        <input id={`itemPhotoFile-${personIndex}-${itemIndex}`} type="file" accept="image/*" onChange={(e) => handleImageUpload(personIndex, itemIndex, e.target.files?.[0])} className="sr-only" />
                                     </label>
                                    {uploadProgress[item.id] === 100 && <p className="text-xs text-green-600 mt-1">✓ Uploaded</p>}
                                    {uploadProgress[item.id] === -1 && <p className="text-xs text-red-600 mt-1">✗ Upload Failed</p>}
                                 </div>
                             </div>

                             {/* Measurements Section */}
                             <div className="mt-4">
                                {item.dynamicMeasurementFields && item.dynamicMeasurementFields.length > 0 ? (
                                    <>
                                        <label className="mb-1 block text-sm font-medium text-[#6C757D]">Measurements</label>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-3 border border-[#E0E0E0] rounded-md p-3 bg-white">
                                            {item.dynamicMeasurementFields.map(field => (
                                                <Input
                                                    key={field}
                                                    id={`measurement-${personIndex}-${itemIndex}-${field}`}
                                                    name={`measurement-${personIndex}-${itemIndex}-${field}`}
                                                    label={field}
                                                    value={item.measurements?.[field] || ''}
                                                    onChange={(e) => handleItemChange(personIndex, itemIndex, field, e.target.value)}
                                                    className="text-sm py-1.5"
                                                    placeholder="-"
                                                />
                                            ))}
                                        </div>
                                    </>
                                 ) : item.name ? (
                                     <p className="text-sm text-gray-500 mt-2 italic">No specific measurements required for {item.name}.</p>
                                 ) : null
                                }
                             </div>

                             <div className="mt-4">
                                <label htmlFor={`itemNotes-${personIndex}-${itemIndex}`} className="mb-1 block text-sm font-medium text-[#6C757D]">Item Notes / Details</label>
                                <textarea id={`itemNotes-${personIndex}-${itemIndex}`} name={`itemNotes-${personIndex}-${itemIndex}`} placeholder="Specific instructions for this item..." value={item.notes || ''} onChange={e => handleItemChange(personIndex, itemIndex, 'notes', e.target.value)} className={commonInputStyles} rows="2"></textarea>
                             </div>
                           </div>
                         ))}
                     </div>
                     <Button type="button" onClick={() => handleAddItem(personIndex)} variant="secondary" className="mt-4 flex items-center gap-2 text-sm"><FiPlusSquare /> Add Item for {person.name || `Person ${personIndex + 1}`}</Button>
                   </Card>
                 ))}
                 <Button type="button" onClick={handleAddPerson} variant="secondary" className="flex items-center gap-2"><FiPlus /> Add Another Person</Button>
             </div>
        )}

        {/* Step 3: Payment & Review */}
        {currentStep === 3 && (
             <Card>
                 <h2 className="mb-4 text-xl font-semibold text-[#393E41]">Payment Details & Review</h2>
                  <div className="mb-6 border-b border-[#E0E0E0] pb-4 space-y-3">
                      <h3 className="text-lg font-medium text-[#393E41] mb-2">Order Summary</h3>
                       <p className="text-sm text-[#6C757D]">Customer: <span className="font-medium text-[#393E41]">{order.customer?.name || 'N/A'}</span> ({order.customer?.number || 'N/A'})</p>
                      <p className="text-sm text-[#6C757D]">Delivery Date: <span className="font-medium text-[#393E41]">{formatDateForDisplay(order.deliveryDate)}</span></p>
                      <div className="text-sm text-[#6C757D]"> Items:
                          <ul className="list-disc pl-5 mt-1">
                              {order.people?.map((p, pIdx) => ( p.items?.filter(i => i.name).length > 0 && ( <li key={pIdx} className="text-[#393E41] font-medium"> {p.name || `Person ${pIdx + 1}`}: <span className="font-normal text-[#6C757D] ml-2"> {p.items.filter(i => i.name).map(i => `${i.name} (${formatCurrency(i.price)})`).join(', ') || 'No items'} </span> </li> )))}
                          </ul>
                      </div>
                  </div>

                  <div className="mb-4"> <label className="mb-1 block text-sm font-medium text-[#6C757D]">Items Subtotal</label> <div className="w-full rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-[#393E41] font-semibold">{formatCurrency(order.payment?.subtotal)}</div> </div>

                  {/* Additional Fees Section */}
                  <div className="mb-4 border-t pt-4">
                        <h3 className="text-lg font-medium text-[#393E41] mb-2">Additional Fees/Items</h3>
                        {(order.payment?.additionalFees || []).map((fee, index) => (
                            <div key={fee.id} className="grid grid-cols-1 md:grid-cols-[2fr,1fr,auto] gap-2 mb-2 items-end">
                                <div className="flex-grow">
                                    <Select
                                        id={`feeDescSelect-${index}`}
                                        label="Fee/Item"
                                        value={fee.isManualDescription ? '_manual_' : fee.description}
                                        onChange={(e) => handleFeeChange(fee.id, 'descriptionSelect', e.target.value)}
                                    >
                                        <option value="">-- Select or Add Manually --</option>
                                        {feeOptions.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                        <option value="_manual_">-- Enter Manually --</option>
                                    </Select>
                                    {fee.isManualDescription && (
                                         <Input
                                            id={`feeManualDesc-${index}`}
                                            name={`feeManualDesc-${index}`}
                                            placeholder="Enter Description"
                                            value={fee.description}
                                            onChange={(e) => handleFeeChange(fee.id, 'manualDescription', e.target.value)}
                                            className="mt-1"
                                        />
                                    )}
                                </div>
                                {/* --- MODIFIED: Removed disabled prop --- */}
                                <Input
                                    id={`feeAmount-${index}`}
                                    name={`feeAmount-${index}`}
                                    label="Amount (₹)"
                                    type="number"
                                    placeholder="Amount"
                                    value={fee.amount || ''}
                                    onChange={(e) => handleFeeChange(fee.id, 'amount', e.target.value)}
                                    min="0"
                                    step="any"
                                    // disabled={!fee.isManualDescription && fee.description !== ''} // Removed this line
                                />
                                {/* --- MODIFIED: Adjusted button alignment --- */}
                                <Button
                                    type="button"
                                    onClick={() => handleRemoveFee(fee.id)}
                                    variant="danger"
                                    className="p-2.5 self-center mb-1 flex items-center justify-center rounded-md"
                                    aria-label="Remove Fee"
                                >
                                    <FiTrash2 size={16} />
                                </Button>
                             </div>
                        ))}
                        <Button type="button" onClick={handleAddFee} variant="secondary" className="text-xs px-2 py-1 flex items-center gap-1 mt-2">
                            <FiPlusSquare /> Add Fee/Item
                        </Button>
                    </div>

                    <div className="mb-4 border-t pt-4">
                        <h3 className="text-lg font-medium text-[#393E41] mb-2 flex items-center gap-1"><FiTag /> Discount</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <Select label="Discount Type" id="discountType" name="discountType" value={order.payment?.discountType || 'fixed'} onChange={handlePaymentChange}> <option value="fixed">Fixed Amount (₹)</option> <option value="percent">Percentage (%)</option> </Select>
                            <Input label="Discount Value" id="discountValue" name="discountValue" type="number" value={order.payment?.discountValue || 0} onChange={handlePaymentChange} min="0" step={order.payment?.discountType === 'percent' ? "0.1" : "any"} placeholder={order.payment?.discountType === 'percent' ? "%" : "₹"} />
                            <div> <label className="mb-2 block text-sm font-medium text-[#6C757D]">Discount Applied</label> <div className="w-full rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-[#393E41]"> -{formatCurrency(order.payment?.calculatedDiscount)} </div> </div>
                        </div>
                    </div>

                    <div className="border-t pt-4">
                         <h3 className="text-lg font-medium text-[#393E41] mb-3">Final Payment</h3>
                         <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                            <div> <label className="mb-2 block text-sm font-medium text-[#6C757D]">Grand Total</label> <div className="w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-xl font-bold text-[#393E41]">{formatCurrency(order.payment?.total)}</div> </div>
                           <Input label="Advance Paid (₹)" id="advance" name="advance" type="number" value={order.payment?.advance || 0} onChange={handlePaymentChange} min="0" step="any"/>
                           <div> <label className="mb-2 block text-sm font-medium text-[#6C757D]">Pending Amount</label> <div className={`w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-xl font-bold ${order.payment?.pending > 0 ? 'text-orange-600' : 'text-green-600'}`}>{formatCurrency(order.payment?.pending)}</div> </div>
                           <Select label="Payment Method" id="method" name="method" value={order.payment?.method || 'Cash'} onChange={handlePaymentChange}> <option>Cash</option> <option>Online</option> <option>Bank Transfer</option> </Select>
                         </div>
                     </div>
             </Card>
        )}

        {/* Step Navigation & Submit */}
        <div className="flex justify-between items-center pt-6 border-t border-[#E0E0E0] mt-8">
            <Button type="button" onClick={prevStep} variant="secondary" disabled={currentStep === 1 || isSaving}> Previous Step </Button>
            {currentStep < MAX_STEPS ? (
              <Button type="button" onClick={nextStep} variant="primary" disabled={isSaving}> Next Step </Button>
            ) : (
              <Button type="submit" variant="primary" disabled={isSaving} className="inline-flex items-center gap-1.5" onClick={handleSubmitOrder}>
                    <FiSave size={16}/> {isSaving ? 'Saving...' : (orderId ? 'Update Order' : 'Place Order')}
              </Button>
            )}
        </div>
      </div> {/* End Form Content */}

    </div> // End Main Container
  );
};

OrderFormPage.propTypes = {};

export default OrderFormPage;