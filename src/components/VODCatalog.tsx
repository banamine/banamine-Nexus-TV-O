import React, { useState } from "react";
import { 
  Film, 
  Clapperboard, 
  Star, 
  Play, 
  Plus, 
  Check, 
  X, 
  Clock, 
  Sparkles, 
  RotateCcw,
  SlidersHorizontal,
  Search
} from "lucide-react";
import { VODItem } from "../types";

interface VODCatalogProps {
  catalog: VODItem[];
  onPlayVOD: (item: VODItem) => void;
}

export const VODCatalog: React.FC<VODCatalogProps> = ({
  catalog,
  onPlayVOD,
}) => {
  const [activeTab, setActiveTab] = useState<"all" | "movie" | "series">("all");
  const [selectedGenre, setSelectedCategory] = useState<string>("All");
  const [sortBy, setSortBy] = useState<"rating" | "year">("rating");
  const [selectedItem, setSelectedItem] = useState<VODItem | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set(["vod-1"]));
  const [searchQuery, setSearchQuery] = useState<string>("");

  const genres = ["All", "Sci-Fi / Thriller", "Action / Cyberpunk", "Documentary / Nature", "Drama / Crime"];

  const filteredCatalog = catalog.filter((item) => {
    if (activeTab !== "all" && item.type !== activeTab) return false;
    if (selectedGenre !== "All" && !item.genre.toLowerCase().includes(selectedGenre.toLowerCase())) return false;
    if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === "rating") return b.rating - a.rating;
    return b.year - a.year;
  });

  const toggleFav = (id: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* VOD Header & Filters */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 glass p-5 rounded-2xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white uppercase tracking-tight">VOD Catalog &amp; Series Vault</h1>
            <p className="text-xs text-white/50">Explore high-resolution movies, series, and archival documentaries.</p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto font-mono">
          {/* Search Input */}
          <div className="relative flex-1 md:w-48">
            <Search className="w-3.5 h-3.5 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search VOD..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#05070A] border border-white/10 text-xs rounded-xl pl-8 pr-3 py-1.5 text-white placeholder-white/30 outline-none focus:border-[#0088FF]"
            />
          </div>

          {/* Type Tab */}
          <div className="flex bg-[#05070A] p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                activeTab === "all" ? "bg-[#0088FF] text-white" : "text-white/40 hover:text-white"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActiveTab("movie")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                activeTab === "movie" ? "bg-[#0088FF] text-white" : "text-white/40 hover:text-white"
              }`}
            >
              Movies
            </button>
            <button
              onClick={() => setActiveTab("series")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                activeTab === "series" ? "bg-[#0088FF] text-white" : "text-white/40 hover:text-white"
              }`}
            >
              Series
            </button>
          </div>

          {/* Genre Dropdown */}
          <select
            value={selectedGenre}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-[#05070A] border border-white/10 text-xs text-white px-3 py-1.5 rounded-xl outline-none"
          >
            {genres.map(g => <option key={g} value={g}>{g}</option>)}
          </select>

          {/* Sort Option */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-[#05070A] border border-white/10 text-xs text-white px-3 py-1.5 rounded-xl outline-none"
          >
            <option value="rating">Sort: Rating ★</option>
            <option value="year">Sort: Year 📅</option>
          </select>
        </div>
      </div>

      {/* POSTER GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {filteredCatalog.map((item) => (
          <div
            key={item.id}
            onClick={() => setSelectedItem(item)}
            className="group glass-card overflow-hidden border border-white/10 hover:border-[#0088FF] rounded-2xl relative transition-all cursor-pointer flex flex-col hover:scale-[1.02]"
          >
            <div className="aspect-[2/3] relative overflow-hidden bg-black">
              <img
                src={item.posterUrl}
                alt={item.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute top-3 right-3 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded-md text-[11px] font-mono font-bold text-amber-400 border border-amber-500/30 flex items-center gap-1">
                <Star className="w-3 h-3 fill-amber-400" />
                <span>{item.rating}</span>
              </div>

              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-[#0088FF] text-white flex items-center justify-center shadow-xl shadow-[#0088FF]/40 group-hover:scale-110 transition-transform">
                  <Play className="w-5 h-5 fill-white ml-0.5" />
                </div>
              </div>
            </div>

            <div className="p-3 bg-[#0D121D] space-y-1 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold text-white line-clamp-1 group-hover:text-[#0088FF] transition-colors">
                  {item.title}
                </h3>
                <p className="text-[10px] text-white/40 font-mono">{item.genre}</p>
              </div>

              <div className="flex items-center justify-between text-[10px] text-white/40 pt-2 border-t border-white/5 font-mono">
                <span>{item.year}</span>
                <span>{item.durationStr}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* DETAIL MODAL OVERLAY */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass rounded-3xl max-w-3xl w-full overflow-hidden border border-white/10 shadow-2xl relative animate-in fade-in zoom-in duration-200">
            {/* Close Button */}
            <button
              onClick={() => setSelectedItem(null)}
              className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/60 hover:bg-black text-white transition-colors cursor-pointer border border-white/10"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="grid grid-cols-1 md:grid-cols-3">
              {/* Poster Column */}
              <div className="relative aspect-[2/3] md:aspect-auto bg-black">
                <img
                  src={selectedItem.posterUrl}
                  alt={selectedItem.title}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Details Column */}
              <div className="p-6 md:col-span-2 space-y-4 flex flex-col justify-between bg-[#0D121D]">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-mono text-[#0088FF]">
                    <span className="px-2 py-0.5 rounded bg-[#0088FF]/20 border border-[#0088FF]/40 uppercase font-bold">
                      {selectedItem.type}
                    </span>
                    <span>• {selectedItem.resolution}</span>
                  </div>

                  <h2 className="text-2xl font-black text-white leading-tight uppercase">
                    {selectedItem.title}
                  </h2>

                  <div className="flex items-center gap-4 text-xs text-white/50 font-mono">
                    <span className="flex items-center gap-1 text-amber-400 font-bold">
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                      {selectedItem.rating}
                    </span>
                    <span>Year: {selectedItem.year}</span>
                    <span>Duration: {selectedItem.durationStr}</span>
                  </div>

                  <p className="text-xs text-white/70 leading-relaxed">
                    {selectedItem.synopsis}
                  </p>

                  <div className="space-y-1 text-xs text-white/50 pt-2 border-t border-white/5 font-mono">
                    <div><strong className="text-white">Cast:</strong> {selectedItem.cast.join(", ")}</div>
                    <div><strong className="text-white">Director:</strong> {selectedItem.director}</div>
                    <div><strong className="text-white">Audio Track:</strong> {selectedItem.audio}</div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-white/10">
                  <button
                    onClick={() => {
                      onPlayVOD(selectedItem);
                      setSelectedItem(null);
                    }}
                    className="px-5 py-2.5 bg-[#0088FF] hover:bg-[#006CD0] text-white text-xs font-mono font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-[#0088FF]/30 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>WATCH NOW</span>
                  </button>

                  <button
                    onClick={() => toggleFav(selectedItem.id)}
                    className={`px-4 py-2.5 text-xs font-mono font-bold rounded-xl flex items-center gap-2 border cursor-pointer transition-colors ${
                      favorites.has(selectedItem.id)
                        ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                        : "bg-[#05070A] text-white border-white/10 hover:bg-white/5"
                    }`}
                  >
                    <Star className={`w-4 h-4 ${favorites.has(selectedItem.id) ? "fill-amber-400" : ""}`} />
                    <span>{favorites.has(selectedItem.id) ? "FAVORITED" : "ADD FAVORITE"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
