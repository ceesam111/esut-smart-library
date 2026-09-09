import { Link } from 'react-router-dom';
import { institutionConfig } from '@config/institution.config';

interface Category {
  name: string;
  slug: string;
  icon: string;
  count: number;
}

const CATEGORIES: Category[] = [
  { name: 'Law', slug: 'law', icon: '⚖️', count: 1243 },
  { name: 'Sciences', slug: 'sciences', icon: '🔬', count: 3456 },
  { name: 'Arts', slug: 'arts', icon: '🎨', count: 2134 },
  { name: 'Medicine', slug: 'medicine', icon: '⚕️', count: 1890 },
  { name: 'Engineering', slug: 'engineering', icon: '⚙️', count: 2567 },
  { name: 'Education', slug: 'education', icon: '📚', count: 1654 },
  { name: 'Management', slug: 'management', icon: '💼', count: 1432 },
  { name: 'Social Sciences', slug: 'social-sciences', icon: '👥', count: 2198 },
  { name: 'Agriculture', slug: 'agriculture', icon: '🌾', count: 876 },
  { name: 'Technology', slug: 'technology', icon: '💻', count: 2945 },
];

export default function Categories() {
  return (
    <div>
      <div className="page-header">
        <div className="section">
          <h1 className="text-4xl font-bold" style={{ color: 'var(--color-primary)' }}>
            Subject Categories
          </h1>
          <p className="text-gray-600 mt-2">
            Browse {institutionConfig.name} resources by subject area
          </p>
        </div>
      </div>

      <div className="section">
        <div className="mb-8">
          <p className="text-gray-700 text-lg mb-6">
            Explore our comprehensive collection organized by academic disciplines
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {CATEGORIES.map(category => (
            <Link
              key={category.slug}
              to={`/catalogue?subject=${category.slug}`}
              className="card hover:shadow-lg transition group"
            >
              <div className="flex flex-col items-center text-center h-full">
                <div className="text-5xl mb-4 group-hover:scale-110 transition">
                  {category.icon}
                </div>
                <h3 className="font-bold text-lg mb-2 text-gray-900">
                  {category.name}
                </h3>
                <div className="mt-auto">
                  <p className="text-sm text-gray-500 mb-3">
                    {category.count.toLocaleString()} items
                  </p>
                  <div className="inline-block px-3 py-1 rounded-full text-xs font-semibold"
                    style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
                    Browse
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-12 p-6 rounded-lg" style={{ backgroundColor: '#F0F5FA' }}>
          <h3 className="text-xl font-bold mb-3" style={{ color: 'var(--color-primary)' }}>
            Can't find what you're looking for?
          </h3>
          <p className="text-gray-700 mb-4">
            Use our advanced search to find resources across all categories, or ask our librarian for help.
          </p>
          <div className="flex gap-4">
            <Link to="/search" className="btn-primary">
              Advanced Search
            </Link>
            <a href={`mailto:${institutionConfig.librarianName}`} className="btn-outline">
              Ask a Librarian
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
