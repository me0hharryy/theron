import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
const UserGroupIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mx-auto text-gray-300"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>;


const WorkersPage = () => {
  const { workers, workersLoading } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState(null); // Worker being edited/added
  const [formState, setFormState] = useState({ name: '', specialization: '', contact: '' });
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate(); // For navigation

  // Function to open the modal (for adding or editing)
  const handleOpenModal = (item = null) => {
    if (item) {
      setCurrentItem(item); // Set the worker to be edited
      setFormState({ // Populate form with existing data
          name: item.name || '',
          specialization: item.specialization || '',
          contact: item.contact || ''
      });
    } else {
      setCurrentItem(null); // Clear item for adding new
      setFormState({ name: '', specialization: '', contact: '' }); // Reset form
    }
    setIsModalOpen(true);
  };

  // Close the modal
  const handleCloseModal = () => {
      setIsModalOpen(false);
      setCurrentItem(null); // Clear editing state
      // Reset form state only if not saving (optional)
      // setFormState({ name: '', specialization: '', contact: '' });
   };


  // Update form state on input change
  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormState(prev => ({ ...prev, [id]: value }));
  };

  // Save or update worker data
  const handleSave = async (e) => {
    e.preventDefault();
    if (!formState.name || !formState.specialization) {
        alert("Worker Name and Specialization are required.");
        return;
    }
    setIsSaving(true);
    const dataToSave = {
        name: formState.name.trim(),
        specialization: formState.specialization.trim(),
        contact: formState.contact.trim() || '', // Save empty string if blank
    };

    try {
        const collectionPath = getCollectionPath('workers');
        if (currentItem) {
            // Update existing worker
            const workerDocRef = doc(db, collectionPath, currentItem.id);
            await updateDoc(workerDocRef, dataToSave);
        } else {
            // Add new worker
            await addDoc(collection(db, collectionPath), dataToSave);
        }
        handleCloseModal(); // Close modal on success
    } catch (error) {
        console.error("Error saving worker:", error);
        alert("Failed to save worker details.");
    } finally {
        setIsSaving(false);
    }
  };

  // Delete a worker
  const handleDelete = async (id, name) => { // Added name for confirmation message
    if (window.confirm(`Are you sure you want to delete worker "${name || 'this worker'}"? This action cannot be undone.`)) {
      try {
        const collectionPath = getCollectionPath('workers');
        await deleteDoc(doc(db, collectionPath, id));
        // Real-time listener will update the list automatically
      } catch (error) {
        console.error("Error deleting worker: ", error);
        alert("Failed to delete worker.");
      }
    }
  };

  return (
    // DIRECTLY APPLIED THEME: Using hex codes
    <div className="space-y-6">
       <header className="mb-4">
        <h1 className="text-2xl md:text-3xl font-bold text-[#393E41]">Manage Workers</h1> {/* Dark Gray */}
        <p className="mt-1 text-sm md:text-base text-[#6C757D]">Add, edit, and view details for your team.</p> {/* Medium Gray */}
      </header>

      <div className="text-right"> {/* Aligned button to the right */}
        <Button onClick={() => handleOpenModal()} variant="primary" className="inline-flex items-center gap-2"> {/* Use inline-flex */}
          <PlusIcon /> Add New Worker
        </Button>
      </div>

      <Card>
        {workersLoading ? (
          <div className="py-16 flex justify-center"><Spinner /></div>
        ) : workers && workers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm"> {/* Added min-width, text-sm */}
              {/* DIRECTLY APPLIED THEME: Light border, medium gray header */}
              <thead className="border-b-2 border-[#E0E0E0] bg-gray-50">
                <tr>
                  <th className="px-4 py-3 font-semibold uppercase text-[#6C757D] tracking-wider">Worker Name</th>
                  <th className="px-4 py-3 font-semibold uppercase text-[#6C757D] tracking-wider">Specialization</th>
                  <th className="px-4 py-3 font-semibold uppercase text-[#6C757D] tracking-wider">Contact</th>
                  <th className="px-4 py-3 font-semibold uppercase text-[#6C757D] tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E0E0]"> {/* Light border */}
                {workers.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-[#393E41]">{item.name}</td> {/* Dark Gray */}
                    <td className="px-4 py-3 text-[#393E41]">{item.specialization || '-'}</td> {/* Dark Gray */}
                    <td className="px-4 py-3 text-[#6C757D]">{item.contact || '-'}</td> {/* Medium Gray */}
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5"> {/* Reduced gap */}
                        <Button onClick={() => navigate(`/workers/${item.id}`)} variant="secondary" className="px-2.5 py-1 text-xs"> {/* Smaller button */}
                          Details
                        </Button>
                        <Button onClick={() => handleOpenModal(item)} variant="secondary" className="p-1.5" aria-label={`Edit ${item.name}`}> {/* Small icon button */}
                          <EditIcon />
                        </Button>
                        <Button onClick={() => handleDelete(item.id, item.name)} variant="danger" className="p-1.5" aria-label={`Delete ${item.name}`}> {/* Small icon button */}
                          <TrashIcon />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : ( // Empty state
             <div className="text-center py-16">
                 <UserGroupIcon /> {/* Changed Icon */}
                 {/* DIRECTLY APPLIED THEME: Dark and medium gray text */}
                <h3 className="mt-4 text-lg font-medium text-[#393E41]">No Workers Found</h3>
                <p className="mt-1 text-sm text-[#6C757D]">Get started by adding your first worker profile.</p>
                <div className="mt-6">
                    <Button onClick={() => handleOpenModal()} variant="primary" className="inline-flex items-center gap-2"> {/* Use inline-flex */}
                        <PlusIcon /> Add New Worker
                    </Button>
                </div>
            </div>
        )}
      </Card>

      {/* Modal uses theme colors via components */}
      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={currentItem ? "Edit Worker" : "Add New Worker"}>
        <form onSubmit={handleSave} className="space-y-4">
          <Input id="name" label="Worker Name" value={formState.name} onChange={handleChange} placeholder="e.g., Suresh Kumar" required autoFocus/> {/* Added autoFocus */}
          <Input id="specialization" label="Specialization" value={formState.specialization} onChange={handleChange} placeholder="e.g., Cutter, Sewer, Finisher" required/>
          <Input id="contact" label="Contact Number (Optional)" type="tel" value={formState.contact} onChange={handleChange} placeholder="e.g., 9876543210" />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" onClick={handleCloseModal} variant="secondary" disabled={isSaving}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Worker"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default WorkersPage;