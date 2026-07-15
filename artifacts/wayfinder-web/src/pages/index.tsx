import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import type { Building } from "@/lib/buildings";
import { useBuildings, getBuildingIn, findEntranceIn } from "@/lib/sites";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QrScanner } from "@/components/QrScanner";
import { MapPin, ArrowRight, Map as MapIcon, ChevronRight, ScanLine } from "lucide-react";

/**
 * Resolve any QR payload or typed site code to { b, e } params.
 * Accepts: a full app URL with ?b=&e= params, an INDOORA://building/entrance
 * value, or a short "building/entrance" (or bare building id) code.
 */
function resolveEntranceCode(buildings: Building[], raw: string): { b: string; e: string } | { b: string } | null {
  const text = raw.trim();
  if (!text) return null;

  // Full URL (what the printed posters encode).
  try {
    const url = new URL(text);
    const b = url.searchParams.get("b");
    const e = url.searchParams.get("e");
    if (b && e) return { b, e };
  } catch {
    // not a URL — fall through
  }

  // INDOORA://building/entrance QR value (legacy WAYFINDER:// posters still work).
  const legacy = text.replace(/^WAYFINDER:\/\//i, "INDOORA://");
  const byQr =
    findEntranceIn(buildings, legacy) ??
    findEntranceIn(buildings, `INDOORA://${text.toLowerCase()}`);
  if (byQr) return { b: byQr.building.id, e: byQr.entrance.nodeId };

  // Bare building/site id — caller shows its entrance list.
  if (getBuildingIn(buildings, text.toLowerCase())) return { b: text.toLowerCase() };

  return null;
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { buildings } = useBuildings();
  const [b, setB] = useState<string | null>(null);
  const [e, setE] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [siteCode, setSiteCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [siteFilter, setSiteFilter] = useState<string | null>(null);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    setB(search.get("b"));
    setE(search.get("e"));
  }, []);

  const applyResolved = useCallback(
    (resolved: ReturnType<typeof resolveEntranceCode> | null) => {
      if (!resolved) return false;
      if ("e" in resolved) {
        setLocation(`/destination?b=${resolved.b}&e=${resolved.e}`);
      } else {
        // Site known but entrance not — show only that site's entrances.
        setSiteFilter(resolved.b);
        setCodeError(null);
      }
      return true;
    },
    [setLocation],
  );

  const handleScan = useCallback(
    (text: string) => {
      setScanning(false);
      if (!applyResolved(resolveEntranceCode(buildings, text))) {
        setCodeError("That QR code isn't an Indoora entrance code.");
      }
    },
    [applyResolved, buildings],
  );

  const handleCodeSubmit = () => {
    if (!applyResolved(resolveEntranceCode(buildings, siteCode))) {
      setCodeError("Unknown site code. Check the code printed on the poster.");
    }
  };

  const building = getBuildingIn(buildings, b);
  const entrance = building?.entrances.find(ent => ent.nodeId === e);

  // If we have building and entrance from QR, greet them directly
  if (building && entrance) {
    return (
      <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-background text-foreground p-6 safe-area-pt safe-area-pb relative overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute top-[-10%] right-[-10%] w-[120vw] h-[120vw] rounded-full bg-primary/5 blur-3xl -z-10" />

        <div className="w-full flex-1 flex flex-col items-center justify-center max-w-sm mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mb-8 rotate-3 shadow-sm border border-primary/20">
            <MapPin className="w-10 h-10 text-primary" />
          </div>
          
          <h1 className="text-4xl font-extrabold tracking-tight text-center mb-4 text-balance">
            Welcome to {building.name}
          </h1>
          
          <p className="text-lg text-muted-foreground text-center mb-12">
            You are at the <strong className="text-foreground font-semibold">{entrance.label}</strong>. Let's get you where you need to go.
          </p>

          <Button 
            size="lg" 
            className="w-full h-16 text-lg rounded-full shadow-lg hover:shadow-xl transition-all shadow-primary/25"
            onClick={() => setLocation(`/destination?b=${b}&e=${e}`)}
          >
            Find a Destination
            <ArrowRight className="ml-2 w-6 h-6" />
          </Button>
        </div>
      </div>
    );
  }

  // If no params, offer QR scan / site code entry. Entrances stay hidden
  // until a valid site is identified (scan or code).
  const visibleBuildings = siteFilter
    ? buildings.filter((bldg) => bldg.id === siteFilter)
    : [];

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-background text-foreground safe-area-pt safe-area-pb">
      {scanning && <QrScanner onResult={handleScan} onClose={() => setScanning(false)} />}

      <div className="p-6 pb-2">
        <div className="w-12 h-12 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center mb-6 shadow-md shadow-primary/20">
          <MapIcon className="w-6 h-6" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">Indoora</h1>
        <p className="text-muted-foreground text-lg">Where are you starting from?</p>
      </div>

      <div className="px-6 mt-4 space-y-4">
        <Button
          size="lg"
          className="w-full h-16 text-lg rounded-3xl shadow-lg shadow-primary/25"
          onClick={() => {
            setCodeError(null);
            setScanning(true);
          }}
        >
          <ScanLine className="w-6 h-6 mr-3" />
          Scan Entrance QR Code
        </Button>

        <div className="flex gap-3">
          <Input
            value={siteCode}
            onChange={(ev) => {
              setSiteCode(ev.target.value);
              setCodeError(null);
            }}
            onKeyDown={(ev) => ev.key === "Enter" && handleCodeSubmit()}
            placeholder="Or enter a site code (e.g. studios/lobby)"
            className="h-14 rounded-2xl text-base"
            autoCapitalize="none"
            autoCorrect="off"
          />
          <Button
            variant="secondary"
            className="h-14 px-5 rounded-2xl"
            onClick={handleCodeSubmit}
            disabled={!siteCode.trim()}
          >
            <ArrowRight className="w-5 h-5" />
          </Button>
        </div>

        {codeError && <p className="text-sm font-medium text-destructive px-1">{codeError}</p>}

        {siteFilter && (
          <div className="flex items-center gap-4 pt-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              choose your entrance
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-12 space-y-8 mt-6">
        {visibleBuildings.map(bldg => (
          <div key={bldg.id} className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both">
            <h2 className="text-sm font-bold text-muted-foreground tracking-wider uppercase mb-4 pl-1">
              {bldg.name}
            </h2>
            <div className="space-y-3">
              {bldg.entrances.map(ent => (
                <button
                  key={ent.nodeId}
                  onClick={() => setLocation(`/destination?b=${bldg.id}&e=${ent.nodeId}`)}
                  className="w-full text-left bg-card border border-card-border p-5 rounded-3xl shadow-sm hover:shadow-md hover:border-primary/30 transition-all active:scale-[0.98] flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <MapPin className="w-5 h-5 text-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <span className="font-semibold text-lg">{ent.label}</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
