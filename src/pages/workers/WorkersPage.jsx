// src/pages/workers/WorkersPage.jsx
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, getCollectionPath } from '../../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { useData } from '../../context/DataContext';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import Select from '../../components/ui/Select'; // Import Select

// --- Icons --- (Using react-icons/fi)
import { FiEdit, FiTrash2, FiPlus, FiUsers, FiUser, FiTool, FiPhone, FiList, FiSearch, FiTag,  } from 'react-icons/fi';

// Define categories - adjust as needed
const WORKER_CATEGORIES = ['Cutter', 'Sewer', 'Finisher', 'Helper', 'Manager', 'Other'];

const WorkersPage = () => {
  const { workers, workersLoading } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState(null); // Worker being edited/added
  // Updated form state with category
  const [formState, setFormState] = useState({ name: '', category: '', specialization: '', contact: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState(''); // State for search term
  const navigate = useNavigate();

  // Open the modal for adding or editing
  const handleOpenModal = (item = null) => {
    if (item) {
      setCurrentItem(item);
      setFormState({ // Populate form with existing data, ensure defaults
          name: item.name || '',
          category: item.category || '', // Add category
          specialization: item.specialization || '',
          contact: item.contact || ''
      });
    } else {
      setCurrentItem(null);
      // Reset form including category
      setFormState({ name: '', category: WORKER_CATEGORIES[0] || '', specialization: '', contact: '' }); // Default category
    }
    setIsModalOpen(true);
  };

  // Close the modal
  const handleCloseModal = () => {
      setIsModalOpen(false);
      setCurrentItem(null);
   };

  // Update form state on input change
  const handleChange = (e) => {
    const { id, name, value } = e.target;
    // Use 'name' attribute if 'id' is not specific enough (like for Select)
    const fieldName = name || id;
    setFormState(prev => ({ ...prev, [fieldName]: value }));
  };

  // Save or update worker data (including category)
  const handleSave = async (e) => {
    e.preventDefault();
    // Added category validation
    if (!formState.name || !formState.category) {
        alert("Worker Name and Category are required.");
        return;
    }
    setIsSaving(true);
    const dataToSave = {
        name: formState.name.trim(),
        category: formState.category.trim(), // Save category
        specialization: formState.specialization.trim() || '', // Specialization is optional text
        contact: formState.contact.trim() || '',
    };

    try {
        const collectionPath = getCollectionPath('workers');
        if (currentItem) {
            const workerDocRef = doc(db, collectionPath, currentItem.id);
            await updateDoc(workerDocRef, dataToSave);
        } else {
            await addDoc(collection(db, collectionPath), dataToSave);
        }
        handleCloseModal();
    } catch (error) {
        console.error("Error saving worker:", error);
        alert("Failed to save worker details.");
    } finally {
        setIsSaving(false);
    }
  };

  // Delete a worker
  const handleDelete = async (id, name) => {
    const confirmMsg = `Are you sure you want to delete worker "${name || 'this worker'}"? Associated payment history will remain, but future assignments might be affected. This action cannot be undone.`;
    if (window.confirm(confirmMsg)) {
      try {
        const collectionPath = getCollectionPath('workers');
        await deleteDoc(doc(db, collectionPath, id));
      } catch (error) {
        console.error("Error deleting worker: ", error);
        alert("Failed to delete worker.");
      }
    }
  };

  // Filter workers based on search term (name, category, specialization)
  const filteredWorkers = useMemo(() => {
    if (!workers) return [];
    const lowerSearchTerm = searchTerm.toLowerCase();
    if (!lowerSearchTerm) return workers; // Return all if search is empty

    return workers.filter(worker =>
        worker.name?.toLowerCase().includes(lowerSearchTerm) ||
        worker.category?.toLowerCase().includes(lowerSearchTerm) ||
        worker.specialization?.toLowerCase().includes(lowerSearchTerm)
    );
  }, [workers, searchTerm]);


  return (
    <div className="space-y-6">
       {/* Header */}
       <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div className='flex items-center gap-3'>
             
            <div>
                <h1 className="text-2xl md:text-3xl font-bold text-[#393E41]">Manage Workers</h1>
                <p className="mt-1 text-sm md:text-base text-[#6C757D]">Add, edit, and view details for your team.</p>
            </div>
        </div>
        <Button onClick={() => handleOpenModal()} variant="primary" className="inline-flex items-center gap-2 w-full md:w-auto">
          <FiPlus /> Add New Worker
        </Button>
      </header>


      <Card>
        {/* Search Bar */}
        <div className="mb-4">
             <Input
                id="workerSearch"
                placeholder="Search by Name, Category, or Specialization..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                type="search"
                // Optional: Add a search icon inside the input if desired
             />
        </div>

        {/* Workers Table */}
        {workersLoading ? (
          <div className="py-16 flex justify-center"><Spinner /></div>
        ) : filteredWorkers && filteredWorkers.length > 0 ? ( // Use filteredWorkers here
          <div className="overflow-x-auto">
            <div className="mb-2 text-sm text-gray-500">
                Showing {filteredWorkers.length} of {workers?.length || 0} workers
            </div>
            <table className="w-full min-w-[700px] text-left text-sm"> {/* Increased min-width */}
              <thead className="border-b-2 border-[#E0E0E0] bg-gray-50">
                <tr>
                  <th className="px-4 py-3 font-semibold uppercase text-[#6C757D] tracking-wider"><FiUser className="inline mr-1.5 mb-0.5"/>Name</th>
                  <th className="px-4 py-3 font-semibold uppercase text-[#6C757D] tracking-wider"><FiTag className="inline mr-1.5 mb-0.5"/>Category</th>
                  <th className="px-4 py-3 font-semibold uppercase text-[#6C757D] tracking-wider"><FiTool className="inline mr-1.5 mb-0.5"/>Specialization(s)</th>
                  <th className="px-4 py-3 font-semibold uppercase text-[#6C757D] tracking-wider"><FiPhone className="inline mr-1.5 mb-0.5"/>Contact</th>
                  <th className="px-4 py-3 font-semibold uppercase text-[#6C757D] tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E0E0]">
                {filteredWorkers.map(item => ( // Iterate over filteredWorkers
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-4 py-3 font-medium text-[#393E41]">{item.name}</td>
                    <td className="px-4 py-3 text-[#393E41]">{item.category || '-'}</td> {/* Show Category */}
                    <td className="px-4 py-3 text-[#6C757D]">{item.specialization || '-'}</td> {/* Show Specialization */}
                    <td className="px-4 py-3 text-[#6C757D]">{item.contact || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end items-center gap-2">
                        <Button
                            onClick={() => navigate(`/workers/${item.id}`)}
                            variant="secondary"
                            className="px-2.5 py-1 text-xs inline-flex items-center gap-1"
                            title={`View details for ${item.name}`}
                        >
                          <FiList size={14}/> Details
                        </Button>
                        <Button
                            onClick={() => handleOpenModal(item)}
                            variant="secondary"
                            className="p-1.5 text-blue-600 hover:text-blue-800"
                            aria-label={`Edit ${item.name}`}
                            title={`Edit ${item.name}`}
                         >
                          <FiEdit size={16}/>
                        </Button>
                        <Button
                            onClick={() => handleDelete(item.id, item.name)}
                            variant="danger"
                            className="p-1.5 text-red-600 hover:text-red-800"
                            aria-label={`Delete ${item.name}`}
                            title={`Delete ${item.name}`}
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
        ) : ( // Empty State (handles both no workers at all or no search results)
             <div className="text-center py-16 px-6">
                 <FiUsers size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-[#393E41]">
                    {searchTerm ? "No Workers Match Search" : "No Workers Found"}
                </h3>
                <p className="mt-1 text-sm text-[#6C757D]">
                    {searchTerm ? `Try adjusting your search for "${searchTerm}".` : "Get started by adding your first worker profile."}
                </p>
                {!searchTerm && ( // Show Add button only if not searching
                    <div className="mt-6">
                        <Button onClick={() => handleOpenModal()} variant="primary" className="inline-flex items-center gap-2">
                            <FiPlus /> Add New Worker
                        </Button>
                    </div>
                )}
            </div>
        )}
      </Card>

      {/* Add/Edit Worker Modal (Updated Form) */}
      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={currentItem ? "Edit Worker" : "Add New Worker"}>
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            id="name"
            name="name" // Ensure name prop
            label="Worker Name"
            value={formState.name}
            onChange={handleChange}
            placeholder="e.g., Suresh Kumar"
            required
            autoFocus
          />
          {/* Category Select */}
          <Select
            id="category"
            name="category" // Ensure name prop
            label="Category"
            value={formState.category}
            onChange={handleChange}
            required
          >
             <option value="" disabled>-- Select Category --</option>
             {WORKER_CATEGORIES.map(cat => (
                 <option key={cat} value={cat}>{cat}</option>
             ))}
          </Select>

          <Input
            id="specialization"
            name="specialization" // Ensure name prop
            label="Specialization(s) (Optional)"
            value={formState.specialization}
            onChange={handleChange}
            placeholder="e.g., Shirts, Pants, Blouses" // Updated placeholder
          />
          <Input
            id="contact"
            name="contact" // Ensure name prop
            label="Contact Number (Optional)"
            type="tel"
            value={formState.contact}
            onChange={handleChange}
            placeholder="e.g., 9876543210"
            pattern="[0-9]{10}"
            title="Please enter a 10-digit phone number (optional)"
          />
          <div className="flex justify-end gap-3 pt-4 border-t mt-4">
            <Button type="button" onClick={handleCloseModal} variant="secondary" disabled={isSaving}>
                Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSaving} className="inline-flex items-center gap-1.5">
               {isSaving ? (
                  // Simple loading text, replace with small spinner if needed
                  "Saving..."
                 ) : (
                    <>
                        <FiUser size={16}/> {currentItem ? "Update Worker" : "Save Worker"}
                    </>
                 )}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default WorkersPage;