import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface CMSBlock {
  id: string;
  type: 'heading' | 'paragraph' | 'image' | 'button' | 'divider' | 'quote' | 'two-column';
  content: string;
  order: number;
}

interface CMSPage {
  id: string;
  title: string;
  slug: string;
  blocks: CMSBlock[];
}

export default function CMS() {
  const [pages, setPages] = useState<CMSPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingPage, setCreatingPage] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState('');

  useEffect(() => {
    fetchPages();
  }, []);

  const fetchPages = async () => {
    try {
      const { data, error } = await supabase
        .from('cms_pages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPages(data || []);
      if (data && data.length > 0 && !selectedPageId) {
        setSelectedPageId(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching CMS pages:', error);
    } finally {
      setLoading(false);
    }
  };

  const createNewPage = async () => {
    if (!newPageTitle.trim()) return;

    try {
      const slug = newPageTitle
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');

      const { data, error } = await supabase
        .from('cms_pages')
        .insert([
          {
            title: newPageTitle,
            slug,
            blocks: [],
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setNewPageTitle('');
      setCreatingPage(false);
      fetchPages();
      setSelectedPageId(data.id);
    } catch (error) {
      console.error('Error creating page:', error);
    }
  };

  const selectedPage = pages.find((p) => p.id === selectedPageId);
  const [editBlocks, setEditBlocks] = useState<CMSBlock[]>(selectedPage?.blocks || []);

  const addBlock = (type: CMSBlock['type']) => {
    const newBlock: CMSBlock = {
      id: Math.random().toString(),
      type,
      content: '',
      order: (editBlocks.length || 0) + 1,
    };
    setEditBlocks([...editBlocks, newBlock]);
  };

  const updateBlock = (id: string, content: string) => {
    setEditBlocks(
      editBlocks.map((block) => (block.id === id ? { ...block, content } : block))
    );
  };

  const removeBlock = (id: string) => {
    setEditBlocks(editBlocks.filter((block) => block.id !== id));
  };

  const moveBlock = (id: string, direction: 'up' | 'down') => {
    const index = editBlocks.findIndex((b) => b.id === id);
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === editBlocks.length - 1)) {
      return;
    }

    const newBlocks = [...editBlocks];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newBlocks[index], newBlocks[swapIndex]] = [newBlocks[swapIndex], newBlocks[index]];

    setEditBlocks(newBlocks);
  };

  const savePage = async () => {
    if (!selectedPage) return;

    try {
      const { error } = await supabase
        .from('cms_pages')
        .update({ blocks: editBlocks })
        .eq('id', selectedPage.id);

      if (error) throw error;
      fetchPages();
    } catch (error) {
      console.error('Error saving page:', error);
    }
  };

  const renderBlockPreview = (block: CMSBlock) => {
    switch (block.type) {
      case 'heading':
        return <h2 className="text-2xl font-bold">{block.content || 'Heading'}</h2>;
      case 'paragraph':
        return <p className="text-gray-700">{block.content || 'Paragraph text'}</p>;
      case 'image':
        return (
          <img
            src={block.content || 'https://via.placeholder.com/600x400'}
            alt="Block"
            className="w-full max-h-96 object-cover rounded"
          />
        );
      case 'button':
        return (
          <button className="btn-primary">
            {block.content || 'Click me'}
          </button>
        );
      case 'divider':
        return <hr className="my-4" />;
      case 'quote':
        return (
          <blockquote className="border-l-4 border-primary-700 pl-4 italic text-gray-700">
            {block.content || 'Quote text'}
          </blockquote>
        );
      case 'two-column':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-100 p-4 rounded">{block.content || 'Column 1'}</div>
            <div className="bg-gray-100 p-4 rounded">Column 2</div>
          </div>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return <div className="p-8">Loading CMS...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">CMS Page Builder</h1>
        <p className="text-gray-600 mt-2">Create and edit page content with drag-drop blocks</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[600px]">
        <div className="card overflow-y-auto">
          <h2 className="text-lg font-semibold mb-4">Pages</h2>

          <div className="space-y-2 mb-4">
            {pages.map((page) => (
              <button
                key={page.id}
                onClick={() => setSelectedPageId(page.id)}
                className={`w-full text-left px-3 py-2 rounded transition ${
                  selectedPageId === page.id
                    ? 'bg-primary-700 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                <p className="font-medium">{page.title}</p>
                <p className="text-xs opacity-75">/{page.slug}</p>
              </button>
            ))}
          </div>

          {!creatingPage ? (
            <button
              onClick={() => setCreatingPage(true)}
              className="btn-outline w-full text-sm py-2"
            >
              New Page
            </button>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Page title"
                className="input w-full text-sm"
                value={newPageTitle}
                onChange={(e) => setNewPageTitle(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setCreatingPage(false)}
                  className="btn-ghost flex-1 text-xs py-1"
                >
                  Cancel
                </button>
                <button
                  onClick={createNewPage}
                  className="btn-primary flex-1 text-xs py-1"
                >
                  Create
                </button>
              </div>
            </div>
          )}
        </div>

        {selectedPage && (
          <>
            <div className="card overflow-y-auto">
              <h2 className="text-lg font-semibold mb-4">Blocks</h2>

              <div className="space-y-2 mb-4">
                {editBlocks.map((block, idx) => (
                  <div
                    key={block.id}
                    className="p-3 bg-gray-50 border rounded space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{block.type}</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => moveBlock(block.id, 'up')}
                          disabled={idx === 0}
                          className="text-xs px-2 py-1 bg-gray-200 rounded disabled:opacity-50"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moveBlock(block.id, 'down')}
                          disabled={idx === editBlocks.length - 1}
                          className="text-xs px-2 py-1 bg-gray-200 rounded disabled:opacity-50"
                        >
                          ↓
                        </button>
                      </div>
                    </div>

                    {block.type !== 'divider' && (
                      <input
                        type="text"
                        className="input w-full text-xs"
                        value={block.content}
                        onChange={(e) => updateBlock(block.id, e.target.value)}
                        placeholder="Content"
                      />
                    )}

                    <button
                      onClick={() => removeBlock(block.id)}
                      className="text-red-600 text-xs w-full py-1 hover:bg-red-50 rounded"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-600 mb-2">Add Block</p>
                {['heading', 'paragraph', 'image', 'button', 'divider', 'quote', 'two-column'].map(
                  (type) => (
                    <button
                      key={type}
                      onClick={() => addBlock(type as CMSBlock['type'])}
                      className="btn-outline w-full text-xs py-1"
                    >
                      + {type}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="card overflow-y-auto">
              <h2 className="text-lg font-semibold mb-4">Preview</h2>

              <div className="space-y-6 mb-6">
                <div>
                  <label className="label text-sm">Title</label>
                  <p className="text-xl font-bold">{selectedPage.title}</p>
                </div>

                <div>
                  <label className="label text-sm">Slug</label>
                  <p className="text-gray-600">/{selectedPage.slug}</p>
                </div>
              </div>

              <div className="border-t pt-6 space-y-6">
                {editBlocks.length > 0 ? (
                  editBlocks.map((block) => (
                    <div key={block.id}>{renderBlockPreview(block)}</div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm">No blocks added yet</p>
                )}
              </div>

              <button onClick={savePage} className="btn-primary w-full mt-6">
                Save Page
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

