// src/pages/orders/OrderFormPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '../../context/DataContext'; // DataContext now includes additionalFees
import { db, storage, getCollectionPath } from '../../firebase';
import { doc, getDoc, addDoc, updateDoc, collection, writeBatch, Timestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, uploadBytes } from "firebase/storage"; // <-- Added uploadBytes
import PropTypes from 'prop-types';

import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Spinner from '../../components/ui/Spinner';

// --- Icons ---
import { FiPlus, FiTrash2, FiUpload, FiTag, FiPlusSquare, FiArrowLeft, FiSave } from 'react-icons/fi';

// --- NEW PDF Imports ---
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// --- Constants & Templates ---
const MAX_STEPS = 3;

const newOrderItemTemplate = () => ({
  id: crypto.randomUUID(), name: '', price: 0,
  measurements: {}, // Start with an empty object
  dynamicMeasurementFields: [], // Array to hold required fields for this item
  notes: '', designPhoto: '', status: 'Received', cutter: '', sewer: ''
});
const newPersonTemplate = () => ({ name: '', items: [newOrderItemTemplate()] });
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
      additionalFees: [], total: 0,
      advance: 0, // Keep 'advance' to store the TOTAL amount paid so far
      pending: 0, method: 'Cash',
      paymentHistory: [], // <--- Add this array
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

// --- New Order Notification Function (Updated) ---
const sendNewOrderNotification = (orderData, invoiceUrl = null) => {
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

    // --- NEW: Add the invoice URL to the message if it exists ---
    const invoiceLink = invoiceUrl 
        ? `\n\n\u{1F4CE} Download your invoice:\n${invoiceUrl}` // 📎 emoji
        : '';

    const message = `Namaste${customerName},\nYour order with Theron Tailors (ID: ${orderId}) has been received! \u{1F389}\nPromised Delivery Date: ${deliveryDate}${itemsSummary}\n${invoiceSummary}${invoiceLink}\n\nWe'll keep you updated on the progress. Thank you!`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;

    console.log("Attempting to open WhatsApp for new order notification:", whatsappUrl);
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
};


// --- NEW: PDF Generation and Upload Function (More Robust) ---
const generateAndUploadInvoicePdf = (orderData) => {
    // Use a Promise to return the URL
    return new Promise(async (resolve, reject) => {
        if (!orderData) {
            return reject(new Error("No order data provided to generate PDF."));
        }

        // --- 1. Get HTML and Styles (FIX: Removed @import for reliability) ---
        const orderDateFormatted = formatDateForDisplay(orderData.orderDate);
        const deliveryDateFormatted = formatDateForDisplay(orderData.deliveryDate);
        // Using 'Helvetica' (a built-in PDF font) is much safer than @import
        const printStyles = `body{font-family:'Helvetica',sans-serif;margin:20px;line-height:1.5;color:#333;font-size:10pt}h2,h3,h4,h5{margin:0 0 .5em 0;padding:0;line-height:1.3;color:#393E41}p{margin:0 0 .3em 0}table{width:100%;border-collapse:collapse;margin-bottom:1em}th,td{border-bottom:1px solid #eee;padding:.4em .5em;text-align:left;vertical-align:top}th{background-color:#f8f9fa;font-weight:600;font-size:.9em;text-transform:uppercase;color:#6C757D}td:last-child,th:last-child{text-align:right}strong{font-weight:600}.invoice-header{text-align:center;margin-bottom:1.5em;border-bottom:2px solid #eee;padding-bottom:1em}.invoice-header h2{font-size:1.8em;font-weight:700;color:#44BBA4;margin-bottom:.1em}.invoice-header p{font-size:.85em;color:#555}.details-grid{display:grid;grid-template-columns:1fr 1fr;gap:1.5em;margin-bottom:1.5em;padding-bottom:1em;border-bottom:1px dashed #ccc}.details-grid h5{font-size:1em;font-weight:600;color:#44BBA4;margin-bottom:.5em;border-bottom:1px solid #eee;padding-bottom:.3em}.details-grid p{font-size:.9em;color:#555}.items-section h3{font-size:1.1em;font-weight:600;margin-bottom:.5em}.item-notes{font-size:.8em;color:#666;font-style:italic;padding-left:1em;margin-top:.2em}.totals-section{display:flex;justify-content:flex-end;margin-top:1.5em;padding-top:1em;border-top:2px solid #eee}.totals-box{width:100%;max-width:280px;font-size:.9em}.totals-box div{display:flex;justify-content:space-between;margin-bottom:.3em}.totals-box span:first-child{color:#555;padding-right:1em}.totals-box span:last-child{font-weight:600;color:#333;min-width:80px;text-align:right;font-family:monospace}.totals-box .grand-total span{font-weight:700;font-size:1.1em;color:#393E41}.totals-box .due span:last-child{color:#D97706}.footer{margin-top:2em;text-align:center;font-size:.8em;color:#888;border-top:1px dashed #ccc;padding-top:.8em}.no-print,.no-print-invoice,.measurement-section-for-print{display:none!important}`;
        
        const validPeopleForPrint = orderData.people?.filter(p => p.name && p.items?.some(i => i.name)) || [];
        const additionalFees = orderData.payment?.additionalFees || [];
        const paymentHistory = orderData.payment?.paymentHistory || [];
        const invoiceHTML = `<div class="invoice-header"><h2>THERON Tailors</h2><p>Order Slip / Invoice</p><p>Order ID: <strong>${orderData.billNumber || 'N/A'}</strong></p></div><div class="details-grid"><div><h5>Customer Details:</h5><p>Name: ${orderData.customer?.name || 'N/A'}</p><p>Phone: ${orderData.customer?.number || 'N/A'}</p></div><div><h5>Order Dates:</h5><p>Order Date: ${orderDateFormatted}</p><p>Delivery Date: ${deliveryDateFormatted}</p></div></div><div class="items-section"><h3>Order Items</h3><table><thead><tr><th>#</th><th>Person</th><th>Item</th><th>Price</th></tr></thead><tbody>${validPeopleForPrint.flatMap((person, pIdx) => person.items.map((item, iIdx) => `<tr><td>${pIdx * (person.items?.length || 0) + iIdx + 1}</td><td>${person.name || `Person ${pIdx + 1}`}</td><td> ${item.name || 'N/A'} ${item.notes ? `<div class="item-notes">Notes: ${item.notes}</div>` : ''} </td><td>${formatCurrency(item.price)}</td></tr>`)).join('')}</tbody></table></div><div class="totals-section"><div class="totals-box"><div><span>Subtotal:</span> <span>${formatCurrency(orderData.payment?.subtotal)}</span></div> ${additionalFees.map(fee => `<div><span>${fee.description || 'Additional Fee'}:</span> <span>${formatCurrency(fee.amount)}</span></div>`).join('')} ${orderData.payment?.calculatedDiscount > 0 ? `<div><span>Discount (${orderData.payment?.discountType === 'percent' ? `${orderData.payment?.discountValue}%` : 'Fixed'}):</span> <span>-${formatCurrency(orderData.payment?.calculatedDiscount)}</span></div>` : ''} <div class="grand-total" style="border-top: 1px solid #ccc; padding-top: 0.3em; margin-top: 0.3em;"><span>Grand Total:</span> <span>${formatCurrency(orderData.payment?.total)}</span></div><div><span>Total Paid:</span> <span>${formatCurrency(orderData.payment?.advance)}</span></div><div class="due"><span>Amount Due:</span> <span>${formatCurrency(orderData.payment?.pending)}</span></div></div></div> ${paymentHistory.length > 0 ? `<div style="margin-top: 1.5em; border-top: 1px dashed #ccc; padding-top: 1em;"><h5 style="font-size: 1em; margin-bottom: 0.3em;">Payment History:</h5><ul style="font-size:0.85em; padding-left: 1em; list-style:none;">${paymentHistory.map(p => `<li>${formatDateForDisplay(p.date?.toDate ? p.date.toDate() : p.date)} - ${formatCurrency(p.amount)} (${p.method})${p.notes && p.notes !== 'Initial Advance Payment' ? ` - ${p.notes}` : ''}</li>`).join('')}</ul></div>` : ''} ${orderData.notes ? `<div style="margin-top: 1.5em; border-top: 1px dashed #ccc; padding-top: 1em;"><h5 style="font-size: 1em; margin-bottom: 0.3em;">Order Notes:</h5><p style="font-size: 0.85em; white-space: pre-wrap;">${orderData.notes}</p></div>` : ''} <div class="footer">Thank you!</div>`;

        // --- 2. Create an invisible iframe ---
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.left = '-9999px';
        iframe.style.width = '800px';

        // --- 3. Use iframe.onload for reliability (replaces setTimeout) ---
        iframe.onload = async () => {
            try {
                const doc = iframe.contentDocument || iframe.contentWindow.document;

                // --- 4. Use html2canvas to "screenshot" the rendered HTML ---
                const canvas = await html2canvas(doc.body, {
                    useCORS: true,
                    scale: 2
                });

                // --- 5. Create jsPDF and add the canvas image ---
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                
                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                const pdfBlob = pdf.output('blob');

                // --- 6. Upload Blob to Firebase Storage ---
                const storageRef = ref(storage, `invoices/${orderData.billNumber}.pdf`);
                const snapshot = await uploadBytes(storageRef, pdfBlob);
                
                // --- 7. Get and return the Download URL ---
                const downloadURL = await getDownloadURL(snapshot.ref);
                
                // --- 8. Clean up iframe and resolve the promise ---
                document.body.removeChild(iframe);
                resolve(downloadURL);

            } catch (error) {
                console.error("Error during PDF generation (iframe.onload):", error);
                document.body.removeChild(iframe); // Ensure cleanup on error
                reject(error);
            }
        };
        
        // --- 9. Set the iframe content using srcdoc and append to trigger onload ---
        iframe.srcdoc = `<html><head><style>${printStyles}</style></head><body>${invoiceHTML}</body></html>`;
        document.body.appendChild(iframe);
    });
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

  const feeOptions = useMemo(() => {
    if (!additionalFees) return [];
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
                    ...baseTemplate.payment,
                    ...(data.payment || {}),
                    // Ensure paymentHistory is an array and fees have flags
                    paymentHistory: Array.isArray(data.payment?.paymentHistory) ? data.payment.paymentHistory : [],
                    additionalFees: (Array.isArray(data.payment?.additionalFees) ? data.payment.additionalFees : [])
                                      .map(fee => ({...newAdditionalFeeTemplate(), ...fee}))
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
  }, [navigate, tailoringItems]); // Added tailoringItems dependency

  useEffect(() => {
      // Ensure tailoringItems and additionalFees are loaded before fetching/initializing
      if (!itemsLoading && !feesLoading) {
          if (orderId) {
             fetchOrder(orderId);
           } else {
             setOrder(newOrderTemplate());
             setFormLoading(false);
           }
      }
  }, [orderId, fetchOrder, itemsLoading, feesLoading]); // Add dependencies


  // --- State Update Handlers ---
  const handleCustomerChange = (e) => {
      const { id, value } = e.target;
      if (id === 'name' || id === 'number' || id === 'email') {
          setOrder(prev => {
              const newState = { ...prev, customer: { ...prev.customer, [id]: value } };
              const person1Name = newState.people?.[0]?.name;
               if (id === 'name') {
                   if (value === '' || (newState.people?.[0] && value === person1Name)) {
                       setPerson1NameManuallyEdited(false); // Reset flag if name matches or is cleared
                   }
               }
              // Auto-fill person 1 name only if not manually edited
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
                // Only allow positive numbers for advance and discountValue
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
                        // User selected manual entry
                        newFee.description = ''; // Clear description, user will type it
                        newFee.isManualDescription = true;
                        // Keep current amount if user switches TO manual, otherwise default? Let's reset to 0 for clarity.
                        newFee.amount = 0; // Reset amount when switching to manual
                    } else if (selectedFeeOption) {
                        // User selected a predefined fee
                        newFee.description = selectedFeeOption.value;
                        newFee.amount = selectedFeeOption.defaultAmount; // Auto-fill amount
                        newFee.isManualDescription = false;
                    } else {
                        // Handle case where selection is cleared (e.g., "-- Select --")
                        newFee.description = '';
                        newFee.isManualDescription = true; // Default back to manual if cleared
                        newFee.amount = 0;
                    }
                } else if (field === 'manualDescription') {
                    // Only update if currently in manual mode
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
    // Only run if it's a new order, person 1 name hasn't been manually edited, and people array exists
    if (!orderId && !person1NameManuallyEdited && order.people?.length > 0) {
        // Check if person 1 name is different from customer name
        if (order.people[0].name !== order.customer.name) {
            setOrder(prevOrder => ({
                ...prevOrder,
                people: prevOrder.people.map((person, index) =>
                    index === 0 ? { ...person, name: prevOrder.customer.name } : person
                )
            }));
        }
    }
  }, [order.customer.name, orderId, person1NameManuallyEdited, order.people]); // Dependencies


  // Person/Item Add/Remove/NameChange Handlers
  const handleAddPerson = () => setOrder(prev => ({ ...prev, people: [...(prev.people || []), newPersonTemplate()] }));
  const handleRemovePerson = (personIndex) => { if (order.people?.length > 1) { setOrder(prev => ({ ...prev, people: prev.people.filter((_, i) => i !== personIndex) })); } };
  const handlePersonNameChange = (personIndex, name) => {
      // Check if editing Person 1
      if (personIndex === 0) {
          // If the new name is different from the customer name, set the flag
          if (name !== order.customer.name) {
              setPerson1NameManuallyEdited(true);
          } else {
              // If it's changed back to match the customer name, clear the flag
              setPerson1NameManuallyEdited(false);
          }
      }
      // Update the state
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
      // Allow removing the last item for a person
      setOrder(prev => ({
            ...prev,
            people: prev.people.map((p, i) =>
                i === personIndex
                 ? { ...p, items: p.items.filter((_, j) => j !== itemIndex) }
                 : p
            )
        }));
   };

  // Update item field handler (Handles dynamic measurements)
  const handleItemChange = (personIndex, itemIndex, field, value) => {
    setOrder(prev => {
        // Deep copy only the people array to avoid mutation issues
        const newPeople = JSON.parse(JSON.stringify(prev.people));
        const person = newPeople[personIndex];
        if (!person || !person.items || !person.items[itemIndex]) {
            console.error("Invalid person or item index");
            return prev; // Return previous state if indices are invalid
        }
        const item = person.items[itemIndex];

        // Ensure measurements and dynamic fields exist
        item.measurements = item.measurements || {};
        item.dynamicMeasurementFields = item.dynamicMeasurementFields || [];

        // Check if the field is one of the dynamic measurement fields
        if (item.dynamicMeasurementFields.includes(field)) {
            item.measurements[field] = value;
        } else {
            // Otherwise, update the direct property of the item
            item[field] = value;
        }

        // Special handling when item name changes
        if (field === 'name') {
            const masterItem = tailoringItems?.find(ti => ti.name === value);
            item.price = masterItem?.customerPrice || 0; // Update price
            // Update dynamic measurement fields based on the selected master item
            const requiredFields = masterItem?.requiredMeasurements?.split(',')
                                        .map(f => f.trim())
                                        .filter(f => f) || [];
            item.dynamicMeasurementFields = requiredFields;
            // Reset measurements, keeping existing values if the field is still required
            const newMeasurements = {};
            requiredFields.forEach(reqField => {
                newMeasurements[reqField] = item.measurements[reqField] || ''; // Preserve existing value if field persists
            });
            item.measurements = newMeasurements; // Assign the potentially pruned/updated measurements
        }

        // Ensure price is stored as a number
        if (field === 'price') {
            item.price = Number(value) || 0;
        }

        // Return the updated state
        return { ...prev, people: newPeople };
    });
  };


  // Image Upload Handler
  const handleImageUpload = (personIndex, itemIndex, file) => {
       if (!file) { /* alert("No file selected."); */ return; } // Don't alert if no file
       if (file.size > 5 * 1024 * 1024) { alert("File is too large (max 5MB)."); return; }
       const itemId = order.people?.[personIndex]?.items?.[itemIndex]?.id;
       if (!itemId) { console.error("Item ID missing for upload."); return; }
       const uniqueFileName = `${itemId}-${Date.now()}-${file.name}`;
       const orderIdentifier = orderId || order.billNumber || 'newOrder'; // Use existing ID or bill number
       const storagePath = `orderDesigns/${orderIdentifier}/${uniqueFileName}`;
       const storageRef = ref(storage, storagePath);
       const uploadTask = uploadBytesResumable(storageRef, file);

       // Update progress state for this specific item ID
       setUploadProgress(prev => ({ ...prev, [itemId]: 0 }));

       uploadTask.on('state_changed',
           (snapshot) => { // Progress
               const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
               setUploadProgress(prev => ({ ...prev, [itemId]: progress }));
           },
           (error) => { // Error
               console.error("Upload failed:", error);
               alert(`Upload failed: ${error.code}`);
               setUploadProgress(prev => ({ ...prev, [itemId]: -1 })); // Indicate error
           },
           () => { // Complete
               getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
                   handleItemChange(personIndex, itemIndex, 'designPhoto', downloadURL);
                   setUploadProgress(prev => ({ ...prev, [itemId]: 100 })); // Indicate success
               }).catch((error) => {
                   console.error("Error getting download URL:", error);
                   alert(`Failed to get image URL after upload: ${error.code}`);
                   setUploadProgress(prev => ({ ...prev, [itemId]: -1 })); // Indicate error getting URL
               });
           }
       );
  };


  // --- Recalculate Totals Effect ---
  useEffect(() => {
     // Calculate subtotal from valid items
     const subtotal = order.people?.reduce((acc, person) =>
         acc + (person.items?.reduce((itemAcc, item) => itemAcc + (Number(item.price) || 0), 0) || 0),
     0) || 0;

     // Calculate total from valid additional fees
     const feesTotal = order.payment?.additionalFees?.reduce((acc, fee) => acc + (Number(fee.amount) || 0), 0) || 0;

     // Calculate discount
     let calculatedDiscount = 0;
     const discountVal = Number(order.payment?.discountValue) || 0;
     const preDiscountTotal = subtotal + feesTotal; // Base for percentage calculation

     if (order.payment?.discountType === 'percent' && discountVal > 0) {
         calculatedDiscount = preDiscountTotal * (discountVal / 100);
     } else if (order.payment?.discountType === 'fixed' && discountVal > 0) {
         calculatedDiscount = discountVal;
     }

     // Ensure discount doesn't exceed the pre-discount total
     calculatedDiscount = Math.min(calculatedDiscount, preDiscountTotal);

     // Calculate final total and pending amount
     const total = preDiscountTotal - calculatedDiscount;
     const advance = Number(order.payment?.advance) || 0; // Use current advance (total paid)
     const pending = total - advance; // Pending is total minus total paid

     // Only update state if calculated values differ to prevent infinite loops
     if (
        order.payment?.subtotal !== subtotal ||
        order.payment?.calculatedDiscount !== calculatedDiscount ||
        order.payment?.total !== total ||
        order.payment?.pending !== pending
     ) {
        setOrder(prev => ({
            ...prev,
            payment: {
                ...prev.payment,
                subtotal: parseFloat(subtotal.toFixed(2)),
                calculatedDiscount: parseFloat(calculatedDiscount.toFixed(2)),
                total: parseFloat(total.toFixed(2)),
                pending: parseFloat(pending.toFixed(2)) // This will be updated by payment history later
            }
        }));
     }
     // Dependencies: Recalculate whenever items, fees, discount, or advance changes
  }, [order.people, order.payment.additionalFees, order.payment.discountType, order.payment.discountValue, order.payment.advance, order.payment]);


  // --- PRINT INVOICE FUNCTION (Internal) ---
  const printInvoice = (orderData) => {
        if (!orderData) { console.error("No order data for printInvoice."); return; }
        const printWindow = window.open('', '_blank', 'height=800,width=800');
        if (!printWindow) { alert("Please allow popups to print."); return; }
        // Styles remain the same...
        const printStyles = `body{font-family:'Helvetica',sans-serif;margin:20px;line-height:1.5;color:#333;font-size:10pt}h2,h3,h4,h5{margin:0 0 .5em 0;padding:0;line-height:1.3;color:#393E41}p{margin:0 0 .3em 0}table{width:100%;border-collapse:collapse;margin-bottom:1em}th,td{border-bottom:1px solid #eee;padding:.4em .5em;text-align:left;vertical-align:top}th{background-color:#f8f9fa;font-weight:600;font-size:.9em;text-transform:uppercase;color:#6C757D}td:last-child,th:last-child{text-align:right}strong{font-weight:600}.invoice-header{text-align:center;margin-bottom:1.5em;border-bottom:2px solid #eee;padding-bottom:1em}.invoice-header h2{font-size:1.8em;font-weight:700;color:#44BBA4;margin-bottom:.1em}.invoice-header p{font-size:.85em;color:#555}.details-grid{display:grid;grid-template-columns:1fr 1fr;gap:1.5em;margin-bottom:1.5em;padding-bottom:1em;border-bottom:1px dashed #ccc}.details-grid h5{font-size:1em;font-weight:600;color:#44BBA4;margin-bottom:.5em;border-bottom:1px solid #eee;padding-bottom:.3em}.details-grid p{font-size:.9em;color:#555}.items-section h3{font-size:1.1em;font-weight:600;margin-bottom:.5em}.item-notes{font-size:.8em;color:#666;font-style:italic;padding-left:1em;margin-top:.2em}.totals-section{display:flex;justify-content:flex-end;margin-top:1.5em;padding-top:1em;border-top:2px solid #eee}.totals-box{width:100%;max-width:280px;font-size:.9em}.totals-box div{display:flex;justify-content:space-between;margin-bottom:.3em}.totals-box span:first-child{color:#555;padding-right:1em}.totals-box span:last-child{font-weight:600;color:#333;min-width:80px;text-align:right;font-family:monospace}.totals-box .grand-total span{font-weight:700;font-size:1.1em;color:#393E41}.totals-box .due span:last-child{color:#D97706}.footer{margin-top:2em;text-align:center;font-size:.8em;color:#888;border-top:1px dashed #ccc;padding-top:.8em}.no-print,.no-print-invoice,.measurement-section-for-print{display:none!important}`;
        const validPeopleForPrint = orderData.people?.filter(p => p.name && p.items?.some(i => i.name)) || [];
        const additionalFees = orderData.payment?.additionalFees || [];
        const paymentHistory = orderData.payment?.paymentHistory || [];
        // Generate Invoice HTML
        // Modify payment summary section in invoiceHTML
        const invoiceHTML = `<div class="invoice-header"><h2>THERON Tailors</h2><p>Order Slip / Invoice</p><p>Order ID: <strong>${orderData.billNumber || 'N/A'}</strong></p></div><div class="details-grid"><div><h5>Customer Details:</h5><p>Name: ${orderData.customer?.name || 'N/A'}</p><p>Phone: ${orderData.customer?.number || 'N/A'}</p></div><div><h5>Order Dates:</h5><p>Order Date: ${formatDateForDisplay(orderData.orderDate)}</p><p>Delivery Date: ${formatDateForDisplay(orderData.deliveryDate)}</p></div></div><div class="items-section"><h3>Order Items</h3><table><thead><tr><th>#</th><th>Person</th><th>Item</th><th>Price</th></tr></thead><tbody>${validPeopleForPrint.flatMap((person, pIdx) => person.items.map((item, iIdx) => `<tr><td>${pIdx * (person.items?.length || 0) + iIdx + 1}</td><td>${person.name || `Person ${pIdx + 1}`}</td><td> ${item.name || 'N/A'} ${item.notes ? `<div class="item-notes">Notes: ${item.notes}</div>` : ''} </td><td>${formatCurrency(item.price)}</td></tr>`)).join('')}</tbody></table></div><div class="totals-section"><div class="totals-box"><div><span>Subtotal:</span> <span>${formatCurrency(orderData.payment?.subtotal)}</span></div> ${additionalFees.map(fee => `<div><span>${fee.description || 'Additional Fee'}:</span> <span>${formatCurrency(fee.amount)}</span></div>`).join('')} ${orderData.payment?.calculatedDiscount > 0 ? `<div><span>Discount (${orderData.payment?.discountType === 'percent' ? `${orderData.payment?.discountValue}%` : 'Fixed'}):</span> <span>-${formatCurrency(orderData.payment?.calculatedDiscount)}</span></div>` : ''} <div class="grand-total" style="border-top: 1px solid #ccc; padding-top: 0.3em; margin-top: 0.3em;"><span>Grand Total:</span> <span>${formatCurrency(orderData.payment?.total)}</span></div><div><span>Total Paid:</span> <span>${formatCurrency(orderData.payment?.advance)}</span></div><div class="due"><span>Amount Due:</span> <span>${formatCurrency(orderData.payment?.pending)}</span></div></div></div> ${paymentHistory.length > 0 ? `<div style="margin-top: 1.5em; border-top: 1px dashed #ccc; padding-top: 1em;"><h5 style="font-size: 1em; margin-bottom: 0.3em;">Payment History:</h5><ul style="font-size:0.85em; padding-left: 1em; list-style:none;">${paymentHistory.map(p => `<li>${formatDateForDisplay(p.date?.toDate ? p.date.toDate() : p.date)} - ${formatCurrency(p.amount)} (${p.method})${p.notes && p.notes !== 'Initial Advance Payment' ? ` - ${p.notes}` : ''}</li>`).join('')}</ul></div>` : ''} ${orderData.notes ? `<div style="margin-top: 1.5em; border-top: 1px dashed #ccc; padding-top: 1em;"><h5 style="font-size: 1em; margin-bottom: 0.3em;">Order Notes:</h5><p style="font-size: 0.85em; white-space: pre-wrap;">${orderData.notes}</p></div>` : ''} <div class="footer">Crafted with care, tailored for you.</div>`;
        printWindow.document.write(`<html><head><title>Invoice: ${orderData.billNumber || 'Order'}</title><style>${printStyles}</style></head><body>${invoiceHTML}</body></html>`);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  };


  // --- Form Submission (Updated) ---
  const handleSubmitOrder = async (e) => {
      e.preventDefault();
      setIsSaving(true);

      // --- Validation ---
      if (!order.customer.name || !order.customer.number) { alert("Customer Name and Number required."); setIsSaving(false); setCurrentStep(1); return; }
      if (!order.deliveryDate) { alert("Delivery Date required."); setIsSaving(false); setCurrentStep(1); return; }
      // Filter people with a name and at least one item *with a name*
      const validPeople = order.people?.map(person => ({
          ...person,
          name: person.name.trim(), // Trim person name
          items: person.items?.filter(item => item.name && item.name.trim()) || [] // Filter items with names
      })).filter(person => person.name && person.items.length > 0) || []; // Filter people with names and valid items

      if (validPeople.length === 0) { alert("Order must have at least one person with a name and one item with a name selected."); setIsSaving(false); setCurrentStep(2); return; }
      // Check if any added person is missing a name
      if (order.people.some(person => !person.name?.trim())) { alert("Please enter a name for every person added."); setIsSaving(false); setCurrentStep(2); return; }
      // --- End Validation ---

      // Prepare delivery date timestamp
      let deliveryTimestamp;
      try {
          // Ensure time part is handled correctly (set to start of day UTC for consistency)
          deliveryTimestamp = Timestamp.fromDate(new Date(order.deliveryDate + 'T00:00:00Z'));
      } catch (dateError) {
          console.error("Error converting delivery date:", dateError);
          alert("Invalid Delivery Date format. Please check the date.");
          setIsSaving(false);
          return;
      }

      // --- Prepare Initial Payment Record ---
      const initialAdvanceAmount = Number(order.payment.advance) || 0;
      const initialPaymentMethod = order.payment.method || 'Cash';
      const initialPaymentHistory = [];
      if (!orderId && initialAdvanceAmount > 0) { // Only add initial advance record for NEW orders
           initialPaymentHistory.push({
                date: Timestamp.now(), // Use current time for the initial record
                amount: initialAdvanceAmount,
                method: initialPaymentMethod,
                notes: 'Initial Advance Payment'
            });
       }
       // --- End Initial Payment Record Prep ---


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
            advance: initialAdvanceAmount, // Save initial advance here (represents total paid initially)
            pending: order.payment.pending || 0, // Pending calculation should already be correct based on initial advance
            method: initialPaymentMethod, // Store the method of the *initial* advance
            paymentHistory: initialPaymentHistory // <--- Save the initial history (empty if updating)
        },
        people: validPeople.map(person => ({
            ...person,
            items: person.items.map(item => ({
                id: item.id || crypto.randomUUID(), // Ensure ID exists
                name: item.name.trim(), // Trim item name
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
        // Only set orderDate on creation, preserve existing on update
        ...( !orderId && { orderDate: order.orderDate instanceof Timestamp ? order.orderDate : Timestamp.now() } ),
        ...( orderId && order.orderDate instanceof Timestamp && { orderDate: order.orderDate }), // Keep original orderDate if editing
        billNumber: order.billNumber || `TH-${Date.now()}`, // Keep existing or generate new
        status: order.status || 'Active', // Maintain or default status
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
            const existingOrderDoc = await getDoc(doc(db, orderCollectionPath, orderId));
            if (!existingOrderDoc.exists()) throw new Error("Order not found for update.");
            const existingData = existingOrderDoc.data();
            const existingPaymentHistory = existingData?.payment?.paymentHistory || [];

            // --- Update Handling for Advance/History ---
            // Keep existing history. Subsequent payments are handled in OrderList page.
            // Recalculate total paid based on the *existing* history.
            const totalPaidFromHistory = existingPaymentHistory.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
            dataToSave.payment.advance = totalPaidFromHistory; // 'advance' now means total paid from history
            dataToSave.payment.pending = dataToSave.payment.total - totalPaidFromHistory;
            dataToSave.payment.paymentHistory = existingPaymentHistory; // Preserve existing history on update via form
            // NOTE: The initial advance amount/method might be edited here, but it doesn't add a *new* history entry via the form.
            // Consider if editing the *first* history entry is needed, but that adds complexity. Let's keep it simple for now.

            await updateDoc(doc(db, orderCollectionPath, orderId), dataToSave);
            savedDataForNotification = {
                id: orderId, ...dataToSave,
                deliveryDate: dataToSave.deliveryDate.toDate(),
                orderDate: dataToSave.orderDate?.toDate ? dataToSave.orderDate.toDate() : existingData.orderDate?.toDate ? existingData.orderDate.toDate() : null // Use existing if needed
             };

        } else { // CREATE
            isNewOrder = true;
            const batch = writeBatch(db);
            const newOrderRef = doc(collection(db, orderCollectionPath));
            currentOrderId = newOrderRef.id;
            // Use the potentially updated bill number from state
            const finalBillNumber = dataToSave.billNumber || `TH-${Date.now()}`;
            const finalDataToSave = { ...dataToSave, id: currentOrderId, billNumber: finalBillNumber };
            currentBillNumber = finalBillNumber; // Update for notification/confirmation
            batch.set(newOrderRef, finalDataToSave); // Save the complete data including initial payment history

            // Add transaction ONLY for the initial advance during CREATION
            if (finalDataToSave.payment.advance > 0 && finalDataToSave.payment.paymentHistory.length > 0) {
                 const newTransactionRef = doc(collection(db, transactionCollectionPath));
                 batch.set(newTransactionRef, {
                    date: finalDataToSave.payment.paymentHistory[0].date, // Use date from history
                    type: 'Income',
                    description: `Advance for Order ${finalBillNumber}`,
                    amount: finalDataToSave.payment.advance, // Amount of initial advance
                    orderRef: currentOrderId, // Link transaction to order
                    paymentMethod: finalDataToSave.payment.method // Store initial method
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

        // --- NEW: PDF Generation & Notification Logic ---
        let invoiceUrl = null;
        if (isNewOrder && savedDataForNotification) {
             try {
                // Let user know the PDF is generating
                console.log("Generating & uploading PDF invoice...");
                // This will generate, upload, and return the public URL
                invoiceUrl = await generateAndUploadInvoicePdf(savedDataForNotification);
                console.log("PDF successfully uploaded:", invoiceUrl);
             } catch (pdfError) {
                console.error("Failed to generate or upload PDF invoice:", pdfError);
                alert("Order was saved, but the PDF invoice failed to generate or upload. You can print it manually.");
                // We don't stop; the notification will just send without the link.
             }
             
             // Send notification, now with the invoiceUrl (which is null if PDF failed)
             sendNewOrderNotification(savedDataForNotification, invoiceUrl);
        }
        // --- END NEW LOGIC ---

        // Ask for print confirmation
        if (window.confirm(`Order ${isNewOrder ? 'placed' : 'updated'} successfully! (ID: ${currentBillNumber})\n\nPrint invoice manually?`)) {
            printInvoice(savedDataForNotification);
        }

        navigate('/orders'); // Navigate back to list

      } catch (error) { console.error("Error saving order: ", error); alert(`Failed to save order: ${error.message}`); }
      finally { setIsSaving(false); }
  };


  // Step Navigation
   const nextStep = () => {
       // Validation before proceeding
       if (currentStep === 1 && (!order.customer.name || !order.customer.number || !order.deliveryDate)) {
           alert("Customer Name, Number, and Delivery Date are required.");
           return;
       }
       if (currentStep === 2) {
           // Ensure at least one person exists, each person has a name, and each person has at least one item with a name
           const isValidStep2 = order.people?.length > 0 &&
                                order.people.every(p => p.name?.trim()) &&
                                order.people.every(p => p.items?.some(i => i.name && i.name.trim()));
           if (!isValidStep2) {
               alert("Each person must have a name, and at least one item with a name must be selected for each person.");
               return;
           }
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
        <h1 className="text-2xl md:text-3xl font-bold text-[#393E41]">{orderId ? `Edit Order (${order.billNumber})` : 'Place New Order'}</h1>
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
                    {/* <Input label="Customer Email (Optional)" id="email" name="email" type="email" value={order.customer.email || ''} onChange={handleCustomerChange} /> */}
                    <Input label="Delivery Date" id="deliveryDate" name="deliveryDate" type="date" value={order.deliveryDate || ''} onChange={handleCustomerChange} required min={new Date().toISOString().split('T')[0]}/> {/* Prevent past dates */}
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
                              {/* Conditionally show remove button only if there's more than one item OR more than one person */}
                              {(person.items.length > 1 || order.people.length > 1) && (
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
                                 ) : null // Don't show anything if no item is selected
                                }
                             </div>

                             <div className="mt-4">
                                <label htmlFor={`itemNotes-${personIndex}-${itemIndex}`} className="mb-1 block text-sm font-medium text-[#6C757D]">Item Notes / Details</label>
                                <textarea id={`itemNotes-${personIndex}-${itemIndex}`} name={`itemNotes-${personIndex}-${itemIndex}`} placeholder="Specific instructions for this item..." value={item.notes || ''} onChange={e => handleItemChange(personIndex, itemIndex, 'notes', e.target.value)} className={commonInputStyles} rows="2"></textarea>
                             </div>
                           </div>
                         ))}
                         {/* Show add button only if the person has a name */}
                         {person.name?.trim() && (
                            <Button type="button" onClick={() => handleAddItem(personIndex)} variant="secondary" className="mt-4 flex items-center gap-2 text-sm"><FiPlusSquare /> Add Item for {person.name || `Person ${personIndex + 1}`}</Button>
                         )}
                     </div>
                   </Card>
                 ))}
                 <Button type="button" onClick={handleAddPerson} variant="secondary" className="flex items-center gap-2"><FiPlus /> Add Another Person</Button>
             </div>
        )}

        {/* Step 3: Payment & Review */}
        {currentStep === 3 && (
             <Card>
                 <h2 className="mb-4 text-xl font-semibold text-[#393E41]">Payment Details & Review</h2>
                  {/* Review Section */}
                  <div className="mb-6 border-b border-[#E0E0E0] pb-4 space-y-3">
                      <h3 className="text-lg font-medium text-[#393E41] mb-2">Order Summary</h3>
                       <p className="text-sm text-[#6C757D]">Customer: <span className="font-medium text-[#393E41]">{order.customer?.name || 'N/A'}</span> ({order.customer?.number || 'N/A'})</p>
                      <p className="text-sm text-[#6C757D]">Delivery Date: <span className="font-medium text-[#393E41]">{formatDateForDisplay(order.deliveryDate)}</span></p>
                      <div className="text-sm text-[#6C757D]"> Items:
                          <ul className="list-disc pl-5 mt-1">
                              {order.people?.map((p, pIdx) => (
                                  p.items?.filter(i => i.name).length > 0 && (
                                     <li key={pIdx} className="text-[#393E41] font-medium">
                                         {p.name || `Person ${pIdx + 1}`}:
                                         <span className="font-normal text-[#6C757D] ml-2">
                                             {p.items.filter(i => i.name).map(i => `${i.name} (${formatCurrency(i.price)})`).join(', ') || 'No items'}
                                         </span>
                                     </li>
                                  )
                              ))}
                          </ul>
                      </div>
                  </div>

                  {/* Payment Calculation Sections */}
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
                                            required // Make manual description required if selected
                                        />
                                    )}
                                </div>
                                <Input
                                    id={`feeAmount-${index}`}
                                    name={`feeAmount-${index}`}
                                    label="Amount (₹)"
                                    type="number"
                                    placeholder="Amount"
                                    value={fee.amount || ''}
                                    onChange={(e) => handleFeeChange(fee.id, 'amount', e.target.value)}
                                    min="0" // Allow 0 amount
                                    step="any"
                                    required // Amount is always required
                                />
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

                    {/* Discount Section */}
                    <div className="mb-4 border-t pt-4">
                        <h3 className="text-lg font-medium text-[#393E41] mb-2 flex items-center gap-1"><FiTag /> Discount</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <Select label="Discount Type" id="discountType" name="discountType" value={order.payment?.discountType || 'fixed'} onChange={handlePaymentChange}> <option value="fixed">Fixed Amount (₹)</option> <option value="percent">Percentage (%)</option> </Select>
                            <Input label="Discount Value" id="discountValue" name="discountValue" type="number" value={order.payment?.discountValue || 0} onChange={handlePaymentChange} min="0" step={order.payment?.discountType === 'percent' ? "0.1" : "any"} placeholder={order.payment?.discountType === 'percent' ? "%" : "₹"} />
                            <div> <label className="mb-2 block text-sm font-medium text-[#6C757D]">Discount Applied</label> <div className="w-full rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-[#393E41]"> -{formatCurrency(order.payment?.calculatedDiscount)} </div> </div>
                        </div>
                    </div>

                    {/* Final Payment Section */}
                    <div className="border-t pt-4">
                         <h3 className="text-lg font-medium text-[#393E41] mb-3">Final Payment</h3>
                         <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                            <div> <label className="mb-2 block text-sm font-medium text-[#6C757D]">Grand Total</label> <div className="w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-xl font-bold text-[#393E41]">{formatCurrency(order.payment?.total)}</div> </div>
                            {/* Input for Initial Advance (disabled if editing) */}
                           <Input
                                label="Initial Advance (₹)"
                                id="advance"
                                name="advance"
                                type="number"
                                value={order.payment?.advance || 0}
                                onChange={handlePaymentChange}
                                min="0"
                                step="any"
                                disabled={!!orderId} // Disable if editing (subsequent payments via list)
                                title={orderId ? "Subsequent payments are recorded from the Order List." : ""}
                            />
                           <div> <label className="mb-2 block text-sm font-medium text-[#6C757D]">Pending Amount</label> <div className={`w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-xl font-bold ${order.payment?.pending > 0 ? 'text-orange-600' : 'text-green-600'}`}>{formatCurrency(order.payment?.pending)}</div> </div>
                           {/* Payment Method for Initial Advance (disabled if editing) */}
                           <Select
                                label="Payment Method"
                                id="method"
                                name="method"
                                value={order.payment?.method || 'Cash'}
                                onChange={handlePaymentChange}
                                disabled={!!orderId} // Disable if editing
                                title={orderId ? "Payment method for initial advance." : ""}
                            >
                                <option>Cash</option> <option>Online</option> <option>Bank Transfer</option> <option>Other</option>
                           </Select>
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

OrderFormPage.propTypes = {}; // Keep PropTypes empty or define if needed

export default OrderFormPage;