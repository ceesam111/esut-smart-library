import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';

interface AITool {
  name: string;
  category: string;
  description: string;
  url: string;
  access: 'Free' | 'Freemium' | 'Free tier';
  features: string[];
}

const AI_TOOLS: AITool[] = [
  // Research & Discovery
  { name: 'Consensus', category: 'Research & Discovery', url: 'https://consensus.app', access: 'Free tier',
    description: 'AI search engine that extracts evidence-based answers directly from peer-reviewed research papers.',
    features: ['Evidence-based answers', 'Consensus meter', 'Study snapshots'] },
  { name: 'Elicit', category: 'Research & Discovery', url: 'https://elicit.com', access: 'Free tier',
    description: 'AI research assistant that finds, summarises and extracts data from academic papers.',
    features: ['Literature reviews', 'Data extraction', 'Paper summaries'] },
  { name: 'Semantic Scholar', category: 'Research & Discovery', url: 'https://www.semanticscholar.org', access: 'Free',
    description: 'Free AI-powered search across 200M+ scholarly papers with TLDR summaries and citation analysis.',
    features: ['TLDR summaries', 'Citation graph', 'Paper alerts'] },
  { name: 'Perplexity', category: 'Research & Discovery', url: 'https://www.perplexity.ai', access: 'Freemium',
    description: 'Conversational answer engine that cites real-time web and academic sources.',
    features: ['Cited answers', 'Follow-up questions', 'Focus modes'] },
  { name: 'Scite', category: 'Research & Discovery', url: 'https://scite.ai', access: 'Freemium',
    description: 'Smart citations showing whether papers support, contrast or mention a claim.',
    features: ['Smart citations', 'Reliability signals', 'Claim checking'] },
  { name: 'Research Rabbit', category: 'Research & Discovery', url: 'https://www.researchrabbit.ai', access: 'Free',
    description: 'Visual literature mapping tool to discover connected papers and track new work.',
    features: ['Citation networks', 'Paper discovery', 'Collaboration'] },
  { name: 'Connected Papers', category: 'Research & Discovery', url: 'https://www.connectedpapers.com', access: 'Free tier',
    description: 'Generates a visual graph of papers related to any seed work to map a research field.',
    features: ['Visual graphs', 'Prior & derivative works', 'Field overview'] },

  // Writing & Editing
  { name: 'Grammarly', category: 'Writing & Editing', url: 'https://www.grammarly.com', access: 'Free tier',
    description: 'AI writing assistant for grammar, spelling, clarity and tone across academic writing.',
    features: ['Grammar checks', 'Clarity suggestions', 'Tone detection'] },
  { name: 'QuillBot', category: 'Writing & Editing', url: 'https://quillbot.com', access: 'Free tier',
    description: 'Paraphrasing and summarising tool to rewrite and refine academic text.',
    features: ['Paraphraser', 'Summariser', 'Grammar checker'] },
  { name: 'Wordtune', category: 'Writing & Editing', url: 'https://www.wordtune.com', access: 'Free tier',
    description: 'AI rewriting assistant that suggests clearer, more compelling phrasing.',
    features: ['Rewrite suggestions', 'Tone adjust', 'Shorten / expand'] },
  { name: 'Hemingway Editor', category: 'Writing & Editing', url: 'https://hemingwayapp.com', access: 'Free',
    description: 'Highlights complex sentences and passive voice to make writing bold and clear.',
    features: ['Readability score', 'Passive voice', 'Sentence clarity'] },

  // AI Chat
  { name: 'ChatGPT', category: 'AI Chat', url: 'https://chat.openai.com', access: 'Free tier',
    description: 'Conversational AI assistant for brainstorming, explanations and drafting.',
    features: ['Q&A', 'Drafting help', 'Explanations'] },
  { name: 'Gemini', category: 'AI Chat', url: 'https://gemini.google.com', access: 'Free tier',
    description: "Google's conversational AI with strong reasoning and Google integration.",
    features: ['Reasoning', 'Google integration', 'Multimodal'] },
  { name: 'Copilot', category: 'AI Chat', url: 'https://copilot.microsoft.com', access: 'Free',
    description: "Microsoft's AI chat assistant with web grounding and image generation.",
    features: ['Web-grounded answers', 'Image creation', 'Citations'] },
  { name: 'Claude', category: 'AI Chat', url: 'https://claude.ai', access: 'Free tier',
    description: 'Helpful AI assistant from Anthropic, strong at long documents and careful reasoning.',
    features: ['Long context', 'Document analysis', 'Careful reasoning'] },
  { name: 'Meta AI', category: 'AI Chat', url: 'https://www.meta.ai', access: 'Free',
    description: "Meta's conversational assistant for answers, ideas and image generation.",
    features: ['Q&A', 'Idea generation', 'Image creation'] },

  // Citation
  { name: 'ZoteroBib', category: 'Citation', url: 'https://zbib.org', access: 'Free',
    description: 'Build a bibliography instantly from a URL, ISBN or DOI — no account needed.',
    features: ['Instant citations', 'Many styles', 'No sign-up'] },
  { name: 'MyBib', category: 'Citation', url: 'https://www.mybib.com', access: 'Free',
    description: 'Free citation generator supporting thousands of styles including APA and MLA.',
    features: ['9,000+ styles', 'Auto-cite', 'Bibliography export'] },
  { name: 'Citation Machine', category: 'Citation', url: 'https://www.citationmachine.net', access: 'Free tier',
    description: 'Generate citations and check grammar across common academic styles.',
    features: ['APA / MLA / Chicago', 'Source citing', 'Grammar check'] },

  // Note-taking
  { name: 'NotebookLM', category: 'Note-taking', url: 'https://notebooklm.google.com', access: 'Free',
    description: "Google's source-grounded AI notebook — upload sources and ask questions about them.",
    features: ['Source-grounded Q&A', 'Audio overviews', 'Study guides'] },
  { name: 'Glasp', category: 'Note-taking', url: 'https://glasp.co', access: 'Free',
    description: 'Social web highlighter and note-taking tool to capture and organise insights.',
    features: ['Web highlights', 'Note export', 'AI summaries'] },
];

const CATEGORIES = [
  'All Tools',
  'Research & Discovery',
  'Writing & Editing',
  'AI Chat',
  'Citation',
  'Note-taking',
];

const CAT_COLORS: Record<string, string> = {
  'Research & Discovery': 'bg-blue-100 text-blue-700',
  'Writing & Editing': 'bg-teal-100 text-teal-700',
  'AI Chat': 'bg-purple-100 text-purple-700',
  'Citation': 'bg-amber-100 text-amber-700',
  'Note-taking': 'bg-rose-100 text-rose-700',
};

const ACCESS_COLORS: Record<string, string> = {
  'Free': 'bg-green-100 text-green-700',
  'Free tier': 'bg-green-100 text-green-700',
  'Freemium': 'bg-amber-100 text-amber-700',
};

export default function AITools() {
  usePageTitle('AI Tools');
  const [activeCategory, setActiveCategory] = useState('All Tools');
  const [search, setSearch] = useState('');

  const filtered = AI_TOOLS.filter(t => {
    const matchesCategory = activeCategory === 'All Tools' || t.category === activeCategory;
    const q = search.toLowerCase();
    const matchesSearch = !q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="section py-14">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-white/60 text-sm mb-4 font-medium">
              <Link to="/" className="hover:text-white transition-colors">Home</Link>
              <span>›</span>
              <span>AI Tools</span>
            </div>
            <h1 className="text-4xl font-bold text-white mb-3">AI Tools</h1>
            <p className="text-white/75 text-lg leading-relaxed">
              A curated directory of free AI tools for research, writing, citation and study —
              organised by category to support your academic work.
            </p>
          </div>
        </div>
      </div>

      <div className="section py-10">
        {/* Disclaimer */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 flex items-start gap-3">
          <span className="text-xl shrink-0">⚠️</span>
          <p className="text-sm text-amber-900 leading-relaxed">
            These tools are for academic support. ESUT Smart Library does not endorse third-party
            platforms. Always verify AI-generated content.
          </p>
        </div>

        {/* Search */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search AI tools..."
              className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            />
          </div>
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-primary-700 text-white'
                  : `${CAT_COLORS[cat] ?? 'bg-white border border-neutral-200 text-neutral-600'} hover:opacity-80`
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20 bg-white border border-neutral-100 rounded-2xl">
            <div className="text-5xl mb-3">🔍</div>
            <p className="text-neutral-500">No tools found for "{search}"</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(tool => (
              <a
                key={tool.name}
                href={tool.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white border border-neutral-100 rounded-2xl p-5 hover:shadow-lg hover:border-primary-200 transition-all group flex flex-col h-full"
              >
                <div className="flex items-start gap-3 mb-3">
                  {/* Logo placeholder */}
                  <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center font-bold text-primary-700 text-sm shrink-0">
                    {tool.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-neutral-900 group-hover:text-primary-700 transition-colors text-sm leading-tight">
                      {tool.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CAT_COLORS[tool.category] ?? 'bg-neutral-100 text-neutral-600'}`}>
                        {tool.category}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACCESS_COLORS[tool.access] ?? 'bg-neutral-100 text-neutral-600'}`}>
                        {tool.access}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-neutral-600 leading-relaxed flex-1">{tool.description}</p>
                <div className="mt-4">
                  <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2">Key Features</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tool.features.map(f => (
                      <span key={f} className="text-xs bg-neutral-50 border border-neutral-200 text-neutral-600 px-2 py-0.5 rounded-full">{f}</span>
                    ))}
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-neutral-50 flex items-center justify-end">
                  <span className="text-xs font-semibold text-primary-700 flex items-center gap-1 group-hover:underline">
                    Visit Tool
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
