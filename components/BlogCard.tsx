import React, { useState } from "react";
import { BlogMetadata, BlogStatus } from "../types";
import { ExternalLink, Star, Calendar, Tag, Activity, FileText, Image as ImageIcon, MessageSquare, Users, BarChart3, ChevronDown, ChevronUp, Layers } from "lucide-react";
import { CATEGORY_ICONS } from "../constants";

interface BlogCardProps {
  blog: BlogMetadata;
  onToggleFavorite: (id: string) => void;
  onRefresh: (id: string) => void;
  onDelete: (id: string) => void;
}

const BlogCard: React.FC<BlogCardProps> = ({ blog, onToggleFavorite, onRefresh, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const Icon = CATEGORY_ICONS[blog.category] || CATEGORY_ICONS["Other"];
  
  const statusColor = {
    [BlogStatus.Active]: "bg-emerald-100 text-emerald-800 border-emerald-200",
    [BlogStatus.Inactive]: "bg-amber-100 text-amber-800 border-amber-200",
    [BlogStatus.Unreachable]: "bg-red-100 text-red-800 border-red-200",
  }[blog.status];

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-600 bg-emerald-50 border-emerald-100";
    if (score >= 50) return "text-blue-600 bg-blue-50 border-blue-100";
    return "text-amber-600 bg-amber-50 border-amber-100";
  };

  return (
    <div className="group bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-lg transition-all duration-300 flex flex-col h-full overflow-hidden">
      {/* Card Header */}
      <div className="p-5 border-b border-slate-100 flex justify-between items-start bg-gradient-to-br from-white to-slate-50">
        <div className="flex items-start gap-3 overflow-hidden">
          <div className="p-2 bg-brand-50 rounded-lg text-brand-600 shrink-0">
            <Icon size={20} />
          </div>
          <div className="overflow-hidden">
             <h3 className="font-bold text-slate-800 text-lg leading-tight truncate" title={blog.title}>
              {blog.title}
            </h3>
            <p className="text-xs text-slate-500 mt-1 truncate">{blog.url.replace('https://', '').replace(/\/$/, '')}</p>
          </div>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(blog.id); }}
          className={`p-1.5 rounded-full transition-colors ${blog.isFavorite ? 'text-yellow-400 bg-yellow-50 hover:bg-yellow-100' : 'text-slate-300 hover:text-yellow-400 hover:bg-slate-100'}`}
        >
          <Star size={20} fill={blog.isFavorite ? "currentColor" : "none"} />
        </button>
      </div>

      {/* Card Content */}
      <div className="p-5 flex-1 flex flex-col">
        {/* Status Bar */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
           <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColor}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${blog.status === BlogStatus.Active ? 'bg-emerald-500' : blog.status === BlogStatus.Inactive ? 'bg-amber-500' : 'bg-red-500'}`}></span>
              {blog.status}
           </span>
           
           <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${getScoreColor(blog.qualityScore)}`} title="Algorithmic Quality Score">
             <BarChart3 size={10} /> {blog.qualityScore}
           </span>

           {blog.stats.followersCount > 0 && (
             <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100" title="Scraped Followers">
               <Users size={10} /> {blog.stats.followersCount}
             </span>
           )}
        </div>

        <p className="text-slate-600 text-sm line-clamp-2 mb-4 flex-1" title={blog.description}>
          {blog.description || "No description available."}
        </p>
        
        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-2 mb-4 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg">
          <div className="flex items-center gap-1.5" title="Total Published Posts">
            <FileText size={12} className="text-slate-400" /> 
            <span className="font-semibold text-slate-700">{blog.stats.totalPosts}</span> posts
          </div>
          <div className="flex items-center gap-1.5" title="Consistency Score (Variance in posting interval)">
            <Activity size={12} className="text-slate-400" />
            <span className="font-semibold text-slate-700">{blog.stats.consistencyScore}%</span> const.
          </div>
          <div className="flex items-center gap-1.5" title="Average Words Per Post">
            <div className="flex items-center text-[10px] w-3 justify-center text-slate-400 font-bold">W</div>
            <span className="font-semibold text-slate-700">{blog.stats.avgWordsPerPost}</span> avg wds
          </div>
           <div className="flex items-center gap-1.5" title="Static Pages">
            <Layers size={12} className="text-slate-400" />
            <span className="font-semibold text-slate-700">{blog.stats.totalPages}</span> pages
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-4 h-6 overflow-hidden">
          {blog.tags.slice(0, 3).map(tag => (
            <span key={tag} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
              <Tag size={8} className="mr-1" /> {tag}
            </span>
          ))}
          {blog.tags.length > 3 && (
            <span className="text-[10px] text-slate-400 self-center">+{blog.tags.length - 3}</span>
          )}
        </div>

        {/* Expand/Collapse Details */}
        {expanded && (
          <div className="mb-4 pt-3 border-t border-slate-100 text-xs space-y-2 animate-in slide-in-from-top-2 duration-200 bg-slate-50/50 -mx-5 px-5 py-4 border-b">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
               <div className="flex justify-between items-center">
                <span className="text-slate-500">Est. Created:</span>
                <span className="font-medium text-slate-700">{new Date(blog.stats.firstPostDate).getFullYear()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Avg Interval:</span>
                <span className="font-medium text-slate-700">{blog.stats.avgDaysBetweenPosts}d</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Avg Comments:</span>
                <span className="font-medium text-slate-700">{blog.stats.avgCommentsPerPost}</span>
              </div>
               <div className="flex justify-between items-center">
                <span className="text-slate-500">Avg Images:</span>
                <span className="font-medium text-slate-700">{blog.stats.avgImagesPerPost}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Words/Page:</span>
                <span className="font-medium text-slate-700">{blog.stats.avgWordsPerPage}</span>
              </div>
               <div className="flex justify-between items-center">
                <span className="text-slate-500">Sentiment:</span>
                <span className="font-medium text-slate-700">{blog.sentimentScore}/100</span>
              </div>
            </div>
          </div>
        )}

        <button 
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-slate-400 hover:text-brand-600 font-semibold mb-3 transition-colors"
        >
          {expanded ? 'Show Less' : 'Full Analysis'} {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        </button>

        {/* Footer Actions */}
        <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5" title={`Last Updated: ${new Date(blog.lastBuildDate).toLocaleDateString()}`}>
            <Activity size={12} className={blog.status === BlogStatus.Active ? "text-emerald-500" : "text-amber-500"}/>
            {new Date(blog.lastBuildDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => onRefresh(blog.id)} 
              className="hover:text-brand-600 transition-colors"
              title="Refresh Analysis"
            >
              Update
            </button>
             <button 
              onClick={() => onDelete(blog.id)} 
              className="hover:text-red-600 transition-colors"
              title="Delete Blog"
            >
              Remove
            </button>
            <a 
              href={blog.url} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center gap-1 text-brand-600 font-medium hover:text-brand-700 hover:underline"
            >
              Visit <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlogCard;