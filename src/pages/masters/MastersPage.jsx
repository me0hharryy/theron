import React, { useState } from 'react';
import { db, getCollectionPath } from '../../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { useData } from '../../context/DataContext';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';

// Icons remain the same
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>;
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;

const MastersPage = () => {
  const { tailoringItems, itemsLoading } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState(null); // null for new, object for edit
  const [formState, setFormState] = useState({ name: '', customerPrice: '', sewingRate: '', cuttingRate: '', requiredMeasurements: '' });
  const [isSaving, setIsSaving] = useState(false);

  // Memoize collection ref (optional, minor optimization)
  // const collectionRef = useMemo(() => collection(db, getCollectionPath('tailoringItems')), []); // Might need user dependency if path changes

  const handleOpenModal = (item = null) => {
    if (item) {
      setCurrentItem(item); // Set item being edited
      // Populate form with existing item data, ensure defaults for missing fields
      setFormState({
          name: item.name || '',
          customerPrice: item.customerPrice || '',
          sewingRate: item.sewingRate || '',
          cuttingRate: item.cuttingRate || '',
          requiredMeasurements: item.requiredMeasurements || ''
      });
    } else {
      setCurrentItem(null); // Clear item for adding new
      // Reset form to default empty state
      setFormState({ name: '', customerPrice: '', sewingRate: '', cuttingRate: '', requiredMeasurements: '' });
    }
    setIsModalOpen(true); // Open the modal
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentItem(null); // Clear current item on close
    // Optionally reset form state here if needed, but handleOpenModal does it too
    // setFormState({ name: '', customerPrice: '', sewingRate: '', cuttingRate: '', requiredMeasurements: '' });
  };

  // Generic handler for form input changes
  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormState(prev => ({ ...prev, [id]: value }));
  };

  // Handle form submission (Save/Update)
  const handleSave = async (e) => {
    e.preventDefault(); // Prevent default form submission
    setIsSaving(true); // Show saving indicator

    // Prepare data, ensuring numbers are saved correctly
    const dataToSave = {
      name: formState.name.trim(), // Trim whitespace
      customerPrice: Number(formState.customerPrice) || 0, // Convert to number, default 0
      sewingRate: Number(formState.sewingRate) || 0,
      cuttingRate: Number(formState.cuttingRate) || 0,
      requiredMeasurements: formState.requiredMeasurements.trim() || '', // Trim or empty string
    };

    // Basic validation
     if (!dataToSave.name) {
         alert("Item Name is required.");
         setIsSaving(false);
         return;
     }

    try {
        const collectionPath = getCollectionPath('tailoringItems');
        if (currentItem) {
            // Update existing document
            const itemDocRef = doc(db, collectionPath, currentItem.id);
            await updateDoc(itemDocRef, dataToSave);
        } else {
            // Add new document
            await addDoc(collection(db, collectionPath), dataToSave);
        }
        handleCloseModal(); // Close modal on success
    } catch (error) {
        console.error("Error saving tailoring item:", error);
        alert("Failed to save item. Please check console for details.");
    } finally {
        setIsSaving(false); // Hide saving indicator
    }
  };

  // Handle item deletion
  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this item? This cannot be undone.")) {
      try {
        const collectionPath = getCollectionPath('tailoringItems');
        await deleteDoc(doc(db, collectionPath, id));
        // Data will update automatically via the real-time listener
      } catch (error) {
        console.error("Error deleting item: ", error);
        alert("Failed to delete item. Please check console for details.");
      }
    }
  };

  // Format currency helper
  const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);

  return (
    // DIRECTLY APPLIED THEME: Using hex codes
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#393E41]">Manage Tailoring Items</h1> {/* Dark Gray */}
            <p className="mt-1 text-sm md:text-base text-[#6C757D]">Define items, prices, and required measurements.</p> {/* Medium Gray */}
        </div>
        <Button onClick={() => handleOpenModal()} variant="primary" className="flex items-center gap-2 w-full md:w-auto">
          <PlusIcon /> Add New Item
        </Button>
      </div>
      <Card>
        {itemsLoading ? (
          <div className="py-16 flex justify-center"><Spinner /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left"> {/* Added min-width */}
              {/* DIRECTLY APPLIED THEME: Light border, medium gray header text */}
              <thead className="border-b border-[#E0E0E0] text-sm uppercase text-[#6C757D] bg-gray-50">
                <tr>
                  <th className="p-3">Item Name</th>
                  <th className="p-3">Measurements Required</th>
                  <th className="p-3 text-right">Customer Price</th>
                  <th className="p-3 text-right">Sewing Rate</th>
                  <th className="p-3 text-right">Cutting Rate</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E0E0]"> {/* Light border */}
                {tailoringItems && tailoringItems.length > 0 ? tailoringItems.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50 text-sm"> {/* Reduced text size */}
                    <td className="p-3 font-medium text-[#393E41]">{item.name}</td> {/* Dark Gray */}
                    <td className="p-3 text-[#6C757D] max-w-xs truncate">{item.requiredMeasurements || '-'}</td> {/* Medium Gray, truncate */}
                    <td className="p-3 text-right font-mono text-[#393E41]">{formatCurrency(item.customerPrice)}</td> {/* Dark Gray */}
                    <td className="p-3 text-right font-mono text-[#393E41]">{formatCurrency(item.sewingRate)}</td> {/* Dark Gray */}
                    <td className="p-3 text-right font-mono text-[#393E41]">{formatCurrency(item.cuttingRate)}</td> {/* Dark Gray */}
                    <td className="p-3">
                      <div className="flex justify-end gap-1.5"> {/* Reduced gap */}
                        <Button onClick={() => handleOpenModal(item)} variant="secondary" className="p-1.5" aria-label={`Edit ${item.name}`}> {/* Reduced padding */}
                          <EditIcon />
                        </Button>
                        <Button onClick={() => handleDelete(item.id)} variant="danger" className="p-1.5" aria-label={`Delete ${item.name}`}> {/* Reduced padding */}
                          <TrashIcon />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )) : (
                     <tr><td colSpan="6" className="py-10 text-center text-[#6C757D]">No tailoring items found. Add one to get started.</td></tr> // Medium Gray
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal uses theme colors via components */}
      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={currentItem ? "Edit Item" : "Add New Item"}>
        <form onSubmit={handleSave} className="space-y-4">
          <Input id="name" label="Item Name" value={formState.name} onChange={handleChange} placeholder="e.g., Shirt" required />
          <Input id="requiredMeasurements" label="Required Measurements (comma-separated)" value={formState.requiredMeasurements} onChange={handleChange} placeholder="e.g., Length, Chest, Waist" />
          <Input id="customerPrice" label="Customer Price (₹)" type="number" value={formState.customerPrice} onChange={handleChange} placeholder="e.g., 800" required min="0"/>
          <Input id="sewingRate" label="Sewing Rate (₹)" type="number" value={formState.sewingRate} onChange={handleChange} placeholder="e.g., 250" required min="0"/>
          <Input id="cuttingRate" label="Cutting Rate (₹)" type="number" value={formState.cuttingRate} onChange={handleChange} placeholder="e.g., 50" required min="0"/>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" onClick={handleCloseModal} variant="secondary">Cancel</Button>
            <Button type="submit" variant="primary" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Item"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default MastersPage;