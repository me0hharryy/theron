import React, { useState } from 'react';
import { db, getCollectionPath } from '../../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { useData } from '../../context/DataContext';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';

// Reusable icons
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>;
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;

const MastersPage = () => {
  const { tailoringItems, itemsLoading } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [formState, setFormState] = useState({ name: '', customerPrice: '', sewingRate: '', cuttingRate: '' });
  const [isSaving, setIsSaving] = useState(false);

  const collectionRef = collection(db, getCollectionPath('tailoringItems'));

  const handleOpenModal = (item = null) => {
    if (item) {
      setCurrentItem(item);
      setFormState(item);
    } else {
      setCurrentItem(null);
      setFormState({ name: '', customerPrice: '', sewingRate: '', cuttingRate: '' });
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

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    const dataToSave = {
      name: formState.name,
      customerPrice: Number(formState.customerPrice),
      sewingRate: Number(formState.sewingRate),
      cuttingRate: Number(formState.cuttingRate),
    };

    try {
        if (currentItem) {
            await updateDoc(doc(db, getCollectionPath('tailoringItems'), currentItem.id), dataToSave);
        } else {
            await addDoc(collectionRef, dataToSave);
        }
        handleCloseModal();
    } catch (error) {
        console.error("Error saving item:", error);
        alert("Failed to save tailoring item.");
    } finally {
        setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this item? This action cannot be undone.")) {
      try {
        await deleteDoc(doc(db, getCollectionPath('tailoringItems'), id));
      } catch (error) {
        console.error("Error deleting item: ", error);
        alert("Failed to delete item.");
      }
    }
  };
  
  const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Manage Tailoring Items</h1>
        <Button onClick={() => handleOpenModal()} variant="primary" className="flex items-center gap-2">
          <PlusIcon /> Add New Item
        </Button>
      </div>
      <Card>
        {itemsLoading ? (
          <Spinner />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-border-color text-sm uppercase text-text-secondary">
                <tr>
                  <th className="p-3">Item Name</th>
                  <th className="p-3 text-right">Customer Price</th>
                  <th className="p-3 text-right">Sewing Rate</th>
                  <th className="p-3 text-right">Cutting Rate</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tailoringItems.map(item => (
                  <tr key={item.id} className="border-b border-stone-100 hover:bg-stone-50">
                    <td className="p-3 font-medium">{item.name}</td>
                    <td className="p-3 text-right font-mono">{formatCurrency(item.customerPrice)}</td>
                    <td className="p-3 text-right font-mono">{formatCurrency(item.sewingRate)}</td>
                    <td className="p-3 text-right font-mono">{formatCurrency(item.cuttingRate)}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <Button onClick={() => handleOpenModal(item)} variant="secondary" className="p-2">
                          <EditIcon />
                        </Button>
                        <Button onClick={() => handleDelete(item.id)} variant="danger" className="p-2">
                          <TrashIcon />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tailoringItems.length === 0 && <p className="p-4 text-center text-text-secondary">No tailoring items found. Add one to get started.</p>}
          </div>
        )}
      </Card>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={currentItem ? "Edit Item" : "Add New Item"}>
        <form onSubmit={handleSave} className="space-y-4">
          <Input id="name" label="Item Name" value={formState.name} onChange={handleChange} placeholder="e.g., Shirt" required />
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

