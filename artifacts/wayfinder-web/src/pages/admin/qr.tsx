import { useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { api, storedToBuilding, uploadUrl } from "@/lib/sites";
import { buildings as staticBuildings } from "@/lib/buildings";
import type { Building } from "@/lib/buildings";
import type { StoredSite } from "@/lib/siteTypes";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";

export default function AdminQRPosters() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const siteFilter = new URLSearchParams(search).get("site");

  const me = useQuery({
    queryKey: ["admin-me"],
    queryFn: () => api<{ authenticated: boolean }>("/admin/me"),
  });

  const sites = useQuery({
    queryKey: ["admin-sites"],
    queryFn: () => api<{ sites: StoredSite[] }>("/admin/sites"),
    enabled: me.data?.authenticated === true,
  });

  useEffect(() => {
    if (me.data && !me.data.authenticated) {
      setLocation("/admin");
    }
  }, [me.data, setLocation]);

  if (me.isLoading || !me.data?.authenticated) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <p className="text-muted-foreground animate-pulse">Loading...</p>
      </div>
    );
  }

  const storedById = new Map((sites.data?.sites ?? []).map((s) => [s.id, s]));
  const dynamic = (sites.data?.sites ?? [])
    .map(storedToBuilding)
    .filter((b): b is Building => b !== null);
  const all = [...staticBuildings, ...dynamic];
  const buildings = siteFilter ? all.filter((b) => b.id === siteFilter) : all;

  const handlePrint = () => {
    window.print();
  };

  const baseUrl = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Screen-only header */}
      <div className="print:hidden p-6 border-b flex items-center justify-between bg-card safe-area-pt">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/admin")} className="rounded-full" data-testid="button-back-admin">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-bold text-lg">
          Print QR Codes{siteFilter && buildings[0] ? ` — ${buildings[0].name}` : ""}
        </h1>
        <Button onClick={handlePrint} className="rounded-full" data-testid="button-print-posters">
          <Printer className="w-4 h-4 mr-2" />
          Print Posters
        </Button>
      </div>

      {buildings.length === 0 && (
        <div className="text-center py-16 text-muted-foreground print:hidden">
          {siteFilter
            ? "This site has no floor plan or entrances yet, so there are no posters to print."
            : "No sites with entrances yet."}
        </div>
      )}

      {/* Posters */}
      <div className="p-8 print:p-0 print:m-0 space-y-24 print:space-y-0">
        {buildings.flatMap(bldg => {
          const stored = storedById.get(bldg.id);
          const posterTitle = stored?.posterTitle?.trim() || "Indoora";
          const posterLogo = stored?.posterLogoFile ? uploadUrl(stored.posterLogoFile) : null;
          const accent = stored?.posterAccentColor || "#0f172a";
          return bldg.entrances.map(ent => {
            const url = `${baseUrl}/?b=${bldg.id}&e=${ent.nodeId}`;
            return (
              <div
                key={`${bldg.id}-${ent.nodeId}`}
                className="max-w-2xl mx-auto bg-white text-black p-16 rounded-3xl shadow-xl print:shadow-none print:rounded-none print:max-w-none print:w-full print:h-auto print:p-6 flex flex-col items-center justify-center print:justify-start break-after-page break-inside-avoid"
              >
                <div className="text-center mb-16 print:mb-8">
                  {posterLogo && (
                    <img
                      src={posterLogo}
                      alt={`${posterTitle} logo`}
                      className="h-24 print:h-20 mx-auto mb-6 print:mb-4 object-contain"
                      data-testid={`img-poster-logo-${bldg.id}`}
                    />
                  )}
                  <h1 className="text-6xl print:text-5xl font-extrabold tracking-tighter mb-4 print:mb-2" style={{ color: accent }}>{posterTitle}</h1>
                  <h2 className="text-3xl print:text-2xl font-medium text-slate-600 mb-2">{bldg.name}</h2>
                  <h3 className="text-4xl print:text-3xl font-bold text-slate-800">{ent.label}</h3>
                </div>

                <div className="bg-white p-8 print:p-5 rounded-3xl border-4 border-slate-100 shadow-2xl mb-16 print:mb-8">
                  <QRCodeSVG
                    value={url}
                    size={400}
                    level="H"
                    includeMargin={false}
                    fgColor={accent}
                    className="print:w-[320px] print:h-[320px]"
                  />
                </div>

                <div className="text-center space-y-4 print:space-y-2">
                  <p className="text-3xl print:text-2xl font-bold text-slate-800 tracking-tight">Scan to start navigating</p>
                  <p className="text-xl print:text-lg text-slate-500">No app download required</p>
                  <p className="text-lg print:text-base text-slate-500 pt-4 print:pt-2">
                    Camera not working? Open the site and enter code{" "}
                    <span className="font-mono font-bold text-slate-800">
                      {ent.qrValue.replace("INDOORA://", "")}
                    </span>
                  </p>
                </div>
              </div>
            );
          });
        })}
      </div>
    </div>
  );
}
