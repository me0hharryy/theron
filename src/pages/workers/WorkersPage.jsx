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

const WorkersPage = () => {
  const { workers, workersLoading } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [formState, setFormState] = useState({ name: '', specialization: '', contact: '' });
  const [isSaving, setIsSaving] = useState(false);

  const collectionRef = collection(db, getCollectionPath('workers'));

  const handleOpenModal = (item = null) => {
    if (item) {
      setCurrentItem(item);
      setFormState(item);
    } else {
      setCurrentItem(null);
      setFormState({ name: '', specialization: '', contact: '' });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => setIsModalOpen(false);

  const handleChange = (e) => {
    setFormState(prev => ({ ...prev, [e.target.id]: e.target.value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (currentItem) {
        await updateDoc(doc(db, getCollectionPath('workers'), currentItem.id), formState);
      } else {
        await addDoc(collectionRef, formState);
      }
      handleCloseModal();
    } catch (error) {
      console.error("Error saving worker: ", error);
      alert("Failed to save worker.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this worker?")) {
      await deleteDoc(doc(db, getCollectionPath('workers'), id));
    }
  };

  return (
    <div className="space-y-6">
       <header>
        <h1 className="text-3xl font-bold text-text-primary">Manage Workers</h1>
        <p className="mt-1 text-text-secondary">Add, edit, and manage your team of cutters and sewers.</p>
      </header>

      <div className="flex justify-end">
        <Button onClick={() => handleOpenModal()} variant="primary" className="flex items-center gap-2">
          <PlusIcon /> Add New Worker
        </Button>
      </div>

      <Card>
        {workersLoading ? (
          <div className="p-16"><Spinner /></div>
        ) : workers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b-2 border-border-color bg-stone-50">
                <tr>
                  <th className="px-4 py-3 text-sm font-semibold uppercase text-text-secondary tracking-wider">Worker Name</th>
                  <th className="px-4 py-3 text-sm font-semibold uppercase text-text-secondary tracking-wider">Specialization</th>
                  <th className="px-4 py-3 text-sm font-semibold uppercase text-text-secondary tracking-wider">Contact</th>
                  <th className="px-4 py-3 text-sm font-semibold uppercase text-text-secondary tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {workers.map(item => (
                  <tr key={item.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3">{item.specialization}</td>
                    <td className="px-4 py-3">{item.contact}</td>
                    <td className="px-4 py-3">
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
          </div>
        ) : (
             <div className="text-center py-16">
                <svg className="mx-auto h-12 w-12 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-text-primary">No Workers Found</h3>
                <p className="mt-1 text-sm text-text-secondary">Get started by adding your first worker.</p>
                <div className="mt-6">
                    <Button onClick={() => handleOpenModal()} variant="primary" className="flex items-center gap-2 mx-auto">
                        <PlusIcon /> Add New Worker
                    </Button>
                </div>
            </div>
        )}
      </Card>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={currentItem ? "Edit Worker" : "Add New Worker"}>
        <form onSubmit={handleSave} className="space-y-4">
          <Input id="name" label="Worker Name" value={formState.name} onChange={handleChange} placeholder="e.g., Suresh Kumar" required/>
          <Input id="specialization" label="Specialization" value={formState.specialization} onChange={handleChange} placeholder="e.g., Cutter, Sewer" required/>
          <Input id="contact" label="Contact Number" type="tel" value={formState.contact} onChange={handleChange} placeholder="e.g., 9876543210" required/>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" onClick={handleCloseModal} variant="secondary">Cancel</Button>
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