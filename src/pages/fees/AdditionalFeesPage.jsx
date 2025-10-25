// src/pages/fees/AdditionalFeesPage.jsx
import React, { useState, useMemo } from 'react';
import { db, getCollectionPath } from '../../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { useData } from '../../context/DataContext'; // Assuming DataContext will fetch fees
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';

// --- Icons ---
import { FiEdit, FiTrash2, FiPlus, FiTag, FiDollarSign, FiSearch } from 'react-icons/fi';

const AdditionalFeesPage = () => {
  // Assume 'additionalFees' and 'feesLoading' will be added to useData() context
  const { additionalFees, feesLoading } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState(null); // Fee being edited/added
  const [formState, setFormState] = useState({ description: '', defaultAmount: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Open the modal for adding or editing
  const handleOpenModal = (item = null) => {
    if (item) {
      setCurrentItem(item);
      setFormState({
          description: item.description || '',
          defaultAmount: item.defaultAmount || '' // Use defaultAmount
      });
    } else {
      setCurrentItem(null);
      setFormState({ description: '', defaultAmount: '' });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
      setIsModalOpen(false);
      setCurrentItem(null);
   };

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormState(prev => ({ ...prev, [id]: value }));
  };

  // Save or update fee data
  const handleSave = async (e) => {
    e.preventDefault();
    if (!formState.description) {
        alert("Fee Description is required.");
        return;
    }
    setIsSaving(true);
    const dataToSave = {
        description: formState.description.trim(),
        defaultAmount: Number(formState.defaultAmount) || 0, // Ensure it's a number
    };

    try {
        const collectionPath = getCollectionPath('additionalFees'); // New collection name
        if (currentItem) {
            const feeDocRef = doc(db, collectionPath, currentItem.id);
            await updateDoc(feeDocRef, dataToSave);
        } else {
            await addDoc(collection(db, collectionPath), dataToSave);
        }
        handleCloseModal();
    } catch (error) {
        console.error("Error saving fee:", error);
        alert("Failed to save fee details.");
    } finally {
        setIsSaving(false);
    }
  };

  // Delete a fee
  const handleDelete = async (id, description) => {
    const confirmMsg = `Are you sure you want to delete the fee "${description || 'this fee'}"? This cannot be undone.`;
    if (window.confirm(confirmMsg)) {
      try {
        const collectionPath = getCollectionPath('additionalFees');
        await deleteDoc(doc(db, collectionPath, id));
      } catch (error) {
        console.error("Error deleting fee: ", error);
        alert("Failed to delete fee.");
      }
    }
  };

  // Filter fees based on search term
  const filteredFees = useMemo(() => {
    if (!additionalFees) return [];
    const lowerSearchTerm = searchTerm.toLowerCase();
    if (!lowerSearchTerm) return additionalFees;

    return additionalFees.filter(fee =>
        fee.description?.toLowerCase().includes(lowerSearchTerm)
    );
  }, [additionalFees, searchTerm]);

  const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);

  return (
    <div className="space-y-6">
       {/* Header */}
       <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div className='flex items-center gap-3'>
             
            <div>
                <h1 className="text-2xl md:text-3xl font-bold text-[#393E41]">Manage Additional Fees/Items</h1>
                <p className="mt-1 text-sm md:text-base text-[#6C757D]">Define reusable fees or extra items for orders.</p>
            </div>
        </div>
        <Button onClick={() => handleOpenModal()} variant="primary" className="inline-flex items-center gap-2 w-full md:w-auto">
          <FiPlus /> Add New Fee/Item
        </Button>
      </header>

      <Card>
        {/* Search Bar */}
        <div className="mb-4">
             <Input
                id="feeSearch"
                placeholder="Search by Description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                type="search"
                icon={<FiSearch />} // Optional: Add search icon if Input component supports it
             />
        </div>

        {/* Fees Table */}
        {feesLoading ? ( // Use feesLoading
          <div className="py-16 flex justify-center"><Spinner /></div>
        ) : filteredFees && filteredFees.length > 0 ? (
          <div className="overflow-x-auto">
            <div className="mb-2 text-sm text-gray-500">
                Showing {filteredFees.length} of {additionalFees?.length || 0} fees
            </div>
            <table className="w-full min-w-[500px] text-left text-sm">
              <thead className="border-b-2 border-[#E0E0E0] bg-gray-50">
                <tr>
                  <th className="px-4 py-3 font-semibold uppercase text-[#6C757D] tracking-wider"><FiTag className="inline mr-1.5 mb-0.5"/>Description</th>
                  <th className="px-4 py-3 font-semibold uppercase text-[#6C757D] tracking-wider text-right"><FiDollarSign className="inline mr-1.5 mb-0.5"/>Default Amount (₹)</th>
                  <th className="px-4 py-3 font-semibold uppercase text-[#6C757D] tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E0E0]">
                {filteredFees.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-4 py-3 font-medium text-[#393E41]">{item.description}</td>
                    <td className="px-4 py-3 text-right font-mono text-[#393E41]">{formatCurrency(item.defaultAmount)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end items-center gap-2">
                        <Button
                            onClick={() => handleOpenModal(item)}
                            variant="secondary"
                            className="p-1.5 text-blue-600 hover:text-blue-800"
                            aria-label={`Edit ${item.description}`}
                            title={`Edit ${item.description}`}
                         >
                          <FiEdit size={16}/>
                        </Button>
                        <Button
                            onClick={() => handleDelete(item.id, item.description)}
                            variant="danger"
                            className="p-1.5 text-red-600 hover:text-red-800"
                            aria-label={`Delete ${item.description}`}
                            title={`Delete ${item.description}`}
                        >
                          <FiTrash2 size={16}/>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : ( // Empty State
             <div className="text-center py-16 px-6">
                 <FiTag size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-[#393E41]">
                    {searchTerm ? "No Fees Match Search" : "No Fees Found"}
                </h3>
                <p className="mt-1 text-sm text-[#6C757D]">
                    {searchTerm ? `Try adjusting your search for "${searchTerm}".` : "Get started by adding your first reusable fee or item."}
                </p>
                {!searchTerm && (
                    <div className="mt-6">
                        <Button onClick={() => handleOpenModal()} variant="primary" className="inline-flex items-center gap-2">
                            <FiPlus /> Add New Fee/Item
                        </Button>
                    </div>
                )}
            </div>
        )}
      </Card>

      {/* Add/Edit Fee Modal */}
      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={currentItem ? "Edit Fee/Item" : "Add New Fee/Item"}>
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            id="description"
            name="description"
            label="Description"
            value={formState.description}
            onChange={handleChange}
            placeholder="e.g., Alteration Charge, Extra Button"
            required
            autoFocus
          />
          <Input
            id="defaultAmount"
            name="defaultAmount"
            label="Default Amount (₹) (Optional)"
            type="number"
            value={formState.defaultAmount}
            onChange={handleChange}
            placeholder="e.g., 50"
            min="0"
            step="any"
          />
          <div className="flex justify-end gap-3 pt-4 border-t mt-4">
            <Button type="button" onClick={handleCloseModal} variant="secondary" disabled={isSaving}>
                Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSaving} className="inline-flex items-center gap-1.5">
               {isSaving ? "Saving..." : (currentItem ? "Update Fee" : "Save Fee")}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AdditionalFeesPage;