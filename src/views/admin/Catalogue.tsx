import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface CatalogueItem {
  id: string;
  title: string;
  authors: string;
  format: string;
  year: number;
  faculty: string;
  available_copies: number;
  total_copies: number;
  status: string;
}

export default function Catalogue() {
  const [items, setItems] = useState<CatalogueItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<CatalogueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFormat, setFilterFormat] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    fetchItems();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [items, searchTerm, filterFormat, filterStatus]);

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('catalogue_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching catalogue:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = items;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.title.toLowerCase().includes(term) ||
          item.authors.toLowerCase().includes(term)
      );
    }

    if (filterFormat) {
      filtered = filtered.filter((item) => item.format === filterFormat);
    }

    if (filterStatus) {
      filtered = filtered.filter((item) => item.status === filterStatus);
    }

    setFilteredItems(filtered);
    setCurrentPage(1);
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      const { error } = await supabase
        .from('catalogue_items')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      fetchItems();
    } catch (error) {
      console.error('Error updating item status:', error);
    }
  };

  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const totalPages = Math.ceil(filteredItems.length / pageSize);

  if (loading) {
    return <div className="p-8">Loading catalogue...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Catalogue Management</h1>
          <p className="text-gray-600 mt-2">Manage library catalogue items</p>
        </div>
        <div className="flex gap-2">
          <a href="/admin/catalogue/scan" className="btn-outline">
            📱 Scan Items
          </a>
          <a href="/admin/catalogue/new" className="btn-primary">
            Add New Item
          </a>
        </div>
      </div>

      <div className="card space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="label">Search</label>
            <input
              type="text"
              placeholder="Search by title or author..."
              className="input w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-full md:w-40">
            <label className="label">Format</label>
            <select
              className="input w-full"
              value={filterFormat}
              onChange={(e) => setFilterFormat(e.target.value)}
            >
              <option value="">All Formats</option>
              <option value="book">Book</option>
              <option value="journal">Journal</option>
              <option value="ebook">E-book</option>
              <option value="media">Media</option>
              <option value="thesis">Thesis</option>
            </select>
          </div>
          <div className="w-full md:w-40">
            <label className="label">Status</label>
            <select
              className="input w-full"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b">
            <tr>
              <th className="text-left p-3 font-semibold">Title</th>
              <th className="text-left p-3 font-semibold">Authors</th>
              <th className="text-left p-3 font-semibold">Format</th>
              <th className="text-left p-3 font-semibold">Year</th>
              <th className="text-left p-3 font-semibold">Faculty</th>
              <th className="text-left p-3 font-semibold">Copies</th>
              <th className="text-left p-3 font-semibold">Status</th>
              <th className="text-left p-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((item) => (
              <tr key={item.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-medium">{item.title}</td>
                <td className="p-3 text-gray-600">{item.authors}</td>
                <td className="p-3">
                  <span className="badge badge-secondary">{item.format}</span>
                </td>
                <td className="p-3">{item.year}</td>
                <td className="p-3">{item.faculty}</td>
                <td className="p-3">
                  <span className="font-semibold">
                    {item.available_copies}/{item.total_copies}
                  </span>
                </td>
                <td className="p-3">
                  <span
                    className={`badge ${
                      item.status === 'active' ? 'badge-success' : 'badge-error'
                    }`}
                  >
                    {item.status}
                  </span>
                </td>
                <td className="p-3 space-y-1">
                  <a
                    href={`/admin/catalogue/${item.id}`}
                    className="btn-outline text-xs py-1 px-2 block text-center"
                  >
                    Edit
                  </a>
                  <button
                    onClick={() => toggleStatus(item.id, item.status)}
                    className="btn-outline text-xs py-1 px-2 w-full"
                  >
                    {item.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between p-4 bg-gray-50 rounded">
        <div className="text-sm text-gray-600">
          Showing {paginatedItems.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
          {Math.min(currentPage * pageSize, filteredItems.length)} of {filteredItems.length} items
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="btn-outline disabled:opacity-50"
          >
            Previous
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
              const page = Math.max(1, currentPage - 2) + i;
              if (page > totalPages) return null;
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1 rounded ${
                    page === currentPage ? 'btn-primary' : 'btn-ghost'
                  }`}
                >
                  {page}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="btn-outline disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
