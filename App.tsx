import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Grid, 
  Star, 
  PlusCircle, 
  Search, 
  RefreshCw, 
  Filter, 
  Plus,
  Loader2,
  AlertTriangle,
  BarChart3
} from 'lucide-react';
import { BlogMetadata, BlogStatus, ViewState } from './types';
import { analyzeBlogAndFetch, normalizeUrl } from './services/rssService';
import { classifyBlogWithGemini } from './services/geminiService';
import BlogCard from './components/BlogCard';
import { CATEGORIES, SAMPLE_BLOGS } from './constants';

const App: React.FC = () => {
  // State
  const [blogs, setBlogs] = useState<BlogMetadata[]>([]);
  const [view, setView] = useState<ViewState>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isLoading, setIsLoading] = useState(false);
  const [currentAction, setCurrentAction] = useState('');
  
  // Add Blog State
  const [newBlogUrl, setNewBlogUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState('');

  // Initial Load
  useEffect(() => {
    const saved = localStorage.getItem('blogspotter_data');
    if (saved) {
      setBlogs(JSON.parse(saved));
    }
  }, []);

  // Persist
  useEffect(() => {
    localStorage.setItem('blogspotter_data', JSON.stringify(blogs));
  }, [blogs]);

  // Actions
  const handleAddBlog = async () => {
    if (!newBlogUrl) return;
    setIsAdding(true);
    setAddError('');
    setCurrentAction('Deep scanning blog history, pages & stats...');

    try {
      const cleanUrl = normalizeUrl(newBlogUrl);
      
      // Check duplicate
      if (blogs.some(b => b.url === cleanUrl)) {
        throw new Error("Blog already exists in your library.");
      }

      // 1. Deep Analysis (Stats, Scraping, JSON Feed)
      const analysisData = await analyzeBlogAndFetch(cleanUrl);
      
      if (!analysisData.title) {
        throw new Error("Could not parse blog data.");
      }

      setCurrentAction('Running Gemini AI Classification...');
      
      // 2. Classify with Gemini
      const classification = await classifyBlogWithGemini(
        analysisData.title!,
        analysisData.description || "",
        analysisData.posts || []
      );

      // 3. Construct Object
      // Combine analysis tags with Gemini tags
      const combinedTags = Array.from(new Set([...(analysisData.tags || []), ...classification.tags]));

      const newBlog: BlogMetadata = {
        id: crypto.randomUUID(),
        url: cleanUrl,
        feedUrl: cleanUrl + '/feeds/posts/default?alt=json',
        title: analysisData.title!,
        description: analysisData.description || "",
        lastBuildDate: analysisData.lastBuildDate!,
        posts: analysisData.posts || [],
        status: analysisData.status!,
        stats: analysisData.stats!,
        qualityScore: analysisData.qualityScore!,
        
        // AI Data
        category: classification.category,
        tags: combinedTags,
        sentimentScore: classification.sentimentScore,
        language: classification.language,
        
        isFavorite: false,
        addedAt: new Date().toISOString(),
        lastCheckedAt: new Date().toISOString()
      };

      setBlogs(prev => [newBlog, ...prev]);
      setNewBlogUrl('');
      setView('directory');
    } catch (err: any) {
      setAddError(err.message || "Failed to add blog");
    } finally {
      setIsAdding(false);
      setCurrentAction('');
    }
  };

  const handleDeleteBlog = (id: string) => {
    if(confirm('Are you sure you want to remove this blog and all its historical data?')) {
      setBlogs(prev => prev.filter(b => b.id !== id));
    }
  };

  const handleToggleFavorite = (id: string) => {
    setBlogs(prev => prev.map(b => 
      b.id === id ? { ...b, isFavorite: !b.isFavorite } : b
    ));
  };

  const handleRefreshBlog = async (id: string) => {
    const blog = blogs.find(b => b.id === id);
    if (!blog) return;

    // Use toast or similar in real app, here we just optimistically update or show loader if needed
    // For individual refresh we don't block UI unless it's global
    try {
        const analysisData = await analyzeBlogAndFetch(blog.url);
        
        setBlogs(prev => prev.map(b => {
          if (b.id === id) {
            return {
              ...b,
              title: analysisData.title!,
              description: analysisData.description || "",
              lastBuildDate: analysisData.lastBuildDate!,
              posts: analysisData.posts || [],
              status: analysisData.status!,
              stats: analysisData.stats!,
              qualityScore: analysisData.qualityScore!,
              // Merge tags carefully
              tags: Array.from(new Set([...b.tags, ...(analysisData.tags || [])])),
              lastCheckedAt: new Date().toISOString()
            };
          }
          return b;
        }));
    } catch (e) {
        console.error("Failed to refresh", e);
    }
  };

  const refreshAll = async () => {
    setIsLoading(true);
    setCurrentAction('Batch updating analytics for all blogs...');
    for (const blog of blogs) {
      await handleRefreshBlog(blog.id);
    }
    setIsLoading(false);
    setCurrentAction('');
  };

  // Filter Logic
  const filteredBlogs = blogs.filter(blog => {
    const matchesSearch = blog.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          blog.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          blog.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'All' || blog.category === selectedCategory;
    
    if (view === 'favorites') {
      return matchesSearch && matchesCategory && blog.isFavorite;
    }
    return matchesSearch && matchesCategory;
  });

  // Dashboard Stats
  const activeCount = blogs.filter(b => b.status === BlogStatus.Active).length;
  const favoriteCount = blogs.filter(b => b.isFavorite).length;
  const totalPostsTracked = blogs.reduce((acc, b) => acc + b.stats.totalPosts, 0);
  const avgQualityScore = blogs.length > 0 
    ? Math.round(blogs.reduce((acc, b) => acc + b.qualityScore, 0) / blogs.length) 
    : 0;

  // Render Helpers
  const renderSidebar = () => (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-900 text-slate-300 flex flex-col z-20">
      <div className="p-6 flex items-center gap-3 text-white">
        <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
          <span className="font-bold text-lg">B</span>
        </div>
        <h1 className="text-xl font-bold tracking-tight">BlogSpotter</h1>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        <button 
          onClick={() => setView('dashboard')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${view === 'dashboard' ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/20' : 'hover:bg-slate-800'}`}
        >
          <LayoutDashboard size={20} />
          <span className="font-medium">Dashboard</span>
        </button>
        <button 
          onClick={() => setView('directory')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${view === 'directory' ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/20' : 'hover:bg-slate-800'}`}
        >
          <Grid size={20} />
          <span className="font-medium">Directory</span>
          <span className="ml-auto text-xs bg-slate-800 px-2 py-0.5 rounded-full">{blogs.length}</span>
        </button>
        <button 
          onClick={() => setView('favorites')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${view === 'favorites' ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/20' : 'hover:bg-slate-800'}`}
        >
          <Star size={20} />
          <span className="font-medium">Favorites</span>
          <span className="ml-auto text-xs bg-slate-800 px-2 py-0.5 rounded-full">{favoriteCount}</span>
        </button>
        
        <div className="pt-8 px-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Curator Tools</p>
          <button 
            onClick={() => setView('add')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${view === 'add' ? 'bg-brand-600 text-white' : 'hover:bg-slate-800 text-brand-400'}`}
          >
            <PlusCircle size={20} />
            <span className="font-medium">Add New Blog</span>
          </button>
        </div>
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs font-medium text-emerald-400">Deep Scanner Active</span>
          </div>
          <p className="text-[10px] text-slate-500">Analytics Engine v2.1</p>
        </div>
      </div>
    </aside>
  );

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Grid size={24} /></div>
            <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded">Total</span>
          </div>
          <h3 className="text-3xl font-bold text-slate-800">{blogs.length}</h3>
          <p className="text-sm text-slate-500">Tracked Blogs</p>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
           <div className="flex justify-between items-start mb-4">
             <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><RefreshCw size={24} /></div>
             <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded">Active</span>
          </div>
          <h3 className="text-3xl font-bold text-slate-800">{activeCount}</h3>
          <p className="text-sm text-slate-500">Blogs Active &gt; 6mo</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
           <div className="flex justify-between items-start mb-4">
             <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><BarChart3 size={24} /></div>
          </div>
          <h3 className="text-3xl font-bold text-slate-800">{avgQualityScore}</h3>
          <p className="text-sm text-slate-500">Avg. Quality Score</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
           <div className="flex justify-between items-start mb-4">
             <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Filter size={24} /></div>
          </div>
          <h3 className="text-3xl font-bold text-slate-800">{totalPostsTracked}</h3>
          <p className="text-sm text-slate-500">Total Posts Indexed</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Highest Quality Blogs</h2>
          <div className="space-y-4">
             {blogs.length === 0 ? (
               <div className="text-center py-10 text-slate-400">
                 No blogs tracked yet. Add one to get started.
               </div>
             ) : (
               blogs
                .sort((a, b) => b.qualityScore - a.qualityScore)
                .slice(0, 5)
                .map(blog => (
                  <div key={blog.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors border-b border-slate-100 last:border-0 cursor-pointer" onClick={() => { setView('directory'); setSearchQuery(blog.title); }}>
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-100 to-brand-50 flex items-center justify-center text-brand-600 font-bold text-sm">
                         {blog.qualityScore}
                       </div>
                       <div>
                         <h4 className="font-medium text-slate-800">{blog.title}</h4>
                         <p className="text-xs text-slate-500">{blog.stats.totalPosts} posts • {blog.stats.consistencyScore}% consistent</p>
                       </div>
                    </div>
                    <span className="text-xs font-medium px-2 py-1 bg-slate-100 text-slate-600 rounded">
                      {blog.category}
                    </span>
                  </div>
                ))
             )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <button 
              onClick={refreshAll} 
              disabled={isLoading || blogs.length === 0}
              className="w-full py-3 px-4 bg-white border border-slate-200 hover:border-brand-300 hover:bg-brand-50 text-slate-700 hover:text-brand-700 rounded-lg transition-all flex items-center justify-center gap-2 font-medium"
            >
              {isLoading ? <Loader2 className="animate-spin" size={18}/> : <RefreshCw size={18} />}
              Scan & Update All
            </button>
            <button 
              onClick={() => setView('add')}
              className="w-full py-3 px-4 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-all flex items-center justify-center gap-2 font-medium shadow-md hover:shadow-lg"
            >
              <Plus size={18} />
              Curate New Blog
            </button>
          </div>
          
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">System Health</h3>
            <div className="space-y-2">
               <div className="flex justify-between text-xs text-slate-600">
                 <span>Blogger JSON API</span>
                 <span className="text-emerald-600 font-medium">Connected</span>
               </div>
               <div className="flex justify-between text-xs text-slate-600">
                 <span>Scraping Engine</span>
                 <span className="text-emerald-600 font-medium">Active</span>
               </div>
               <div className="flex justify-between text-xs text-slate-600">
                 <span>Gemini Classifier</span>
                 <span className={`${process.env.API_KEY ? 'text-emerald-600' : 'text-amber-500'} font-medium`}>
                    {process.env.API_KEY ? 'Online' : 'Key Missing'}
                 </span>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAddView = () => (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-slate-800 mb-2">Curate a New Blog</h2>
        <p className="text-slate-500">Enter a Blogspot URL. We will perform a deep scan of its history, consistency, pages, and content quality.</p>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="p-8">
           <label className="block text-sm font-medium text-slate-700 mb-2">Blog URL</label>
           <div className="flex gap-2 mb-6">
             <input 
              type="text" 
              value={newBlogUrl}
              onChange={(e) => setNewBlogUrl(e.target.value)}
              placeholder="e.g., googleblog.blogspot.com"
              className="flex-1 px-4 py-3 rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none transition-all text-slate-700"
              disabled={isAdding}
             />
             <button 
              onClick={handleAddBlog}
              disabled={isAdding || !newBlogUrl}
              className="px-6 py-3 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all shadow-md flex items-center gap-2"
             >
               {isAdding ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
               Analyze
             </button>
           </div>

           {isAdding && (
             <div className="bg-brand-50 border border-brand-100 rounded-lg p-4 flex items-center gap-3 text-brand-700 animate-pulse">
               <Loader2 className="animate-spin" size={20} />
               <span className="font-medium">{currentAction}</span>
             </div>
           )}

           {addError && (
             <div className="bg-red-50 border border-red-100 rounded-lg p-4 flex items-start gap-3 text-red-700">
               <AlertTriangle className="shrink-0 mt-0.5" size={20} />
               <div>
                 <p className="font-bold text-sm">Error Adding Blog</p>
                 <p className="text-sm mt-1">{addError}</p>
               </div>
             </div>
           )}

           <div className="mt-8 pt-8 border-t border-slate-100">
             <h3 className="text-sm font-semibold text-slate-900 mb-4">Or try these sample blogs:</h3>
             <div className="flex flex-wrap gap-2">
               {SAMPLE_BLOGS.map(url => (
                 <button 
                  key={url}
                  onClick={() => setNewBlogUrl(url)}
                  className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-brand-50 text-slate-600 hover:text-brand-600 text-xs font-medium border border-transparent hover:border-brand-200 transition-all"
                 >
                   {url.replace('https://', '')}
                 </button>
               ))}
             </div>
           </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {renderSidebar()}
      
      <main className="pl-64 min-h-screen">
        <div className="p-8">
          {/* Top Bar (Search & Filter) - Visible on Dashboard/Directory */}
          {view !== 'add' && (
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
               <div>
                 <h2 className="text-2xl font-bold text-slate-800 capitalize">{view === 'dashboard' ? 'Overview' : view}</h2>
                 <p className="text-slate-500 text-sm">Manage and curate your blog collection</p>
               </div>
               
               <div className="flex gap-2 w-full md:w-auto">
                 <div className="relative group">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-500 transition-colors" size={18} />
                   <input 
                    type="text" 
                    placeholder="Search blogs..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 w-full md:w-64 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all shadow-sm"
                   />
                 </div>
                 
                 <select 
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 text-sm focus:outline-none focus:border-brand-500 shadow-sm cursor-pointer hover:bg-slate-50"
                 >
                   <option value="All">All Categories</option>
                   {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                 </select>
               </div>
             </div>
          )}

          {/* Main Content Area */}
          <div className="animate-fade-in">
            {view === 'dashboard' && renderDashboard()}
            {view === 'add' && renderAddView()}
            
            {(view === 'directory' || view === 'favorites') && (
              <>
                 {filteredBlogs.length === 0 ? (
                   <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-300">
                        <Search size={40} />
                      </div>
                      <h3 className="text-lg font-bold text-slate-700">No blogs found</h3>
                      <p className="text-slate-500 max-w-md mt-2">
                        {searchQuery || selectedCategory !== 'All' 
                          ? "Try adjusting your filters or search query." 
                          : "You haven't added any blogs yet. Head to the 'Add New Blog' section to get started."}
                      </p>
                   </div>
                 ) : (
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                     {filteredBlogs.map(blog => (
                       <BlogCard 
                        key={blog.id} 
                        blog={blog} 
                        onToggleFavorite={handleToggleFavorite}
                        onRefresh={handleRefreshBlog}
                        onDelete={handleDeleteBlog}
                       />
                     ))}
                   </div>
                 )}
              </>
            )}
          </div>
        </div>
      </main>
      
      {/* Loading Overlay for Global Actions */}
      {isLoading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
           <Loader2 className="animate-spin text-brand-600 mb-4" size={48} />
           <p className="text-slate-700 font-medium animate-pulse">{currentAction}</p>
        </div>
      )}
    </div>
  );
};

export default App;