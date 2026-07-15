import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { getBuilding, getPois, BuildingNode } from "@/lib/buildings";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronRight, Video } from "lucide-react";

export default function Destination() {
  const [, setLocation] = useLocation();
  const [b, setB] = useState<string | null>(null);
  const [e, setE] = useState<string | null>(null);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    setB(search.get("b"));
    setE(search.get("e"));
  }, []);

  const building = getBuilding(b);

  if (!b || !e || !building) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background safe-area-pt">
        <p className="text-muted-foreground animate-pulse">Loading location...</p>
      </div>
    );
  }

  const pois = getPois(building);
  
  // Group by category
  const grouped = pois.reduce((acc, poi) => {
    const cat = poi.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(poi);
    return acc;
  }, {} as Record<string, BuildingNode[]>);

  const categories = Object.keys(grouped).sort();

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-background text-foreground safe-area-pt safe-area-pb">
      <div className="p-6 pb-4 flex items-center gap-4 sticky top-0 bg-background/80 backdrop-blur-md z-10 border-b border-border/50">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setLocation(`/?b=${b}&e=${e}`)}
          className="rounded-full w-12 h-12 shrink-0 bg-secondary/50 hover:bg-secondary active:scale-95 transition-all"
        >
          <ArrowLeft className="w-6 h-6" />
        </Button>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Where to?</h1>
          <p className="text-sm text-muted-foreground font-medium">Select a destination</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
        {categories.map(cat => (
          <div key={cat} className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both">
            <h2 className="text-xs font-bold text-muted-foreground tracking-widest uppercase mb-4 pl-1">
              {cat}
            </h2>
            <div className="space-y-3">
              {grouped[cat].map((poi, idx) => (
                <button
                  key={poi.id}
                  onClick={() => setLocation(`/navigate?b=${b}&e=${e}&d=${poi.id}`)}
                  className="w-full text-left bg-card border border-card-border p-5 rounded-3xl shadow-sm hover:shadow-md hover:border-primary/30 transition-all active:scale-[0.98] flex items-center justify-between group"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <Video className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="block font-bold text-lg leading-tight">{poi.label}</span>
                      <span className="block text-sm text-muted-foreground mt-0.5">Studio</span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-secondary/50 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
