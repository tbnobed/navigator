import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import type { Building } from "@/lib/buildings";
import { useBuildings, getBuildingIn, findEntranceIn } from "@/lib/sites";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QrScanner } from "@/components/QrScanner";
import { MapPin, ArrowRight, ChevronRight, ScanLine } from "lucide-react";

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
    <div className="min-h-[100dvh] w-full flex flex-col bg-background text-foreground safe-area-pt safe-area-pb relative overflow-hidden">
      {/* Decorative background wash */}
      <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[140vw] h-[100vw] rounded-full bg-primary/5 blur-3xl -z-10 pointer-events-none" />

      {scanning && <QrScanner onResult={handleScan} onClose={() => setScanning(false)} />}

      {/* Brand header */}
      <header className="flex items-center justify-center pt-8 pb-2">
        <img
          src={`${import.meta.env.BASE_URL}brand/logo-wordmark.svg`}
          alt="Indoora"
          className="h-8"
        />
      </header>

      {!siteFilter ? (
        /* ---------- Hero: no site chosen yet ---------- */
        <div className="flex-1 overflow-y-auto flex flex-col px-6 py-6 max-w-sm w-full mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="my-auto w-full">
          <div className="flex flex-col items-center text-center mb-10">
            <div className="relative mb-8">
              <div className="absolute inset-0 rounded-[2rem] bg-primary/20 blur-2xl scale-110" />
              <img
                src={`${import.meta.env.BASE_URL}brand/glyph-app-icon.svg`}
                alt=""
                className="relative w-24 h-24 rounded-[2rem] shadow-xl shadow-primary/25"
              />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-balance mb-3">
              Find your way inside
            </h1>
            <p className="text-muted-foreground text-lg text-balance">
              Scan the QR poster at the entrance and we'll guide you to any room.
            </p>
          </div>

          <Button
            size="lg"
            className="w-full h-16 text-lg rounded-full shadow-lg shadow-primary/25 active:scale-[0.98] transition-transform"
            onClick={() => {
              setCodeError(null);
              setScanning(true);
            }}
          >
            <ScanLine className="w-6 h-6 mr-3" />
            Scan QR Code
          </Button>

          <div className="flex items-center gap-4 my-6">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              or enter a code
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="flex gap-2">
            <Input
              value={siteCode}
              onChange={(ev) => {
                setSiteCode(ev.target.value);
                setCodeError(null);
              }}
              onKeyDown={(ev) => ev.key === "Enter" && handleCodeSubmit()}
              placeholder="Site code from the poster"
              aria-label="Site code"
              className="h-14 rounded-full text-base px-5 bg-card"
              autoCapitalize="none"
              autoCorrect="off"
              inputMode="text"
              enterKeyHint="go"
              data-testid="input-site-code"
            />
            <Button
              className="h-14 w-14 shrink-0 rounded-full p-0"
              onClick={handleCodeSubmit}
              disabled={!siteCode.trim()}
              aria-label="Go"
              data-testid="button-site-code-go"
            >
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2 px-2">
            It's printed under the QR code, like <span className="font-mono">studios/lobby</span>
          </p>

          {codeError && (
            <p className="text-sm font-medium text-destructive text-center mt-3 px-1" role="alert">
              {codeError}
            </p>
          )}
          </div>
        </div>
      ) : (
        /* ---------- Site found: pick an entrance ---------- */
        <div className="flex-1 flex flex-col px-6 max-w-sm w-full mx-auto pt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h1 className="text-2xl font-extrabold tracking-tight mb-1">Almost there</h1>
          <p className="text-muted-foreground mb-6">Which entrance are you standing at?</p>

          {codeError && (
            <p className="text-sm font-medium text-destructive mb-3 px-1" role="alert">
              {codeError}
            </p>
          )}

          <div className="flex-1 overflow-y-auto pb-12 space-y-8 -mx-1 px-1">
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
                      data-testid={`button-entrance-${ent.nodeId}`}
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

          <button
            onClick={() => {
              setSiteFilter(null);
              setSiteCode("");
              setCodeError(null);
            }}
            className="text-sm font-semibold text-primary text-center py-4"
          >
            Not this site? Start over
          </button>
        </div>
      )}
    </div>
  );
}
