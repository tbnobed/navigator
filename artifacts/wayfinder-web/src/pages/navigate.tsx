import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { getNode, type Building, type BuildingNode } from "@/lib/buildings";
import { useBuildings, getBuildingIn } from "@/lib/sites";
import { findShortestPath, buildRoute } from "@/lib/routing";
import { useIndoorNavigation } from "@/hooks/useIndoorNavigation";
import { useCameraStream } from "@/hooks/useCameraStream";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { BrandLogo } from "@/components/BrandLogo";
import { Map, Video, ArrowLeft, ArrowUp, Compass, Navigation, CheckCircle2, RotateCcw, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

// Internal components

/**
 * Small compass rose. Rotates so the needle keeps pointing at floorplan
 * "north" (map-up) while the user turns — shown on both AR and Map views.
 */
function CompassWidget({ facingBearing }: { facingBearing: number }) {
  return (
    <div className="w-14 h-14 rounded-full bg-black/50 backdrop-blur-md border border-white/10 shadow-lg relative flex items-center justify-center pointer-events-none">
      <div
        className="absolute inset-0 transition-transform duration-300 ease-out"
        style={{ transform: `rotate(${-facingBearing}deg)` }}
      >
        {/* Needle: red = north (map-up), white = south */}
        <svg viewBox="0 0 56 56" className="w-full h-full">
          <polygon points="28,10 32,28 24,28" fill="#ef4444" />
          <polygon points="28,46 32,28 24,28" fill="rgba(255,255,255,0.75)" />
          <circle cx="28" cy="28" r="2.5" fill="white" />
          <text x="28" y="9" textAnchor="middle" fill="#ef4444" fontSize="8" fontWeight="bold">N</text>
        </svg>
      </div>
    </div>
  );
}

function MapView({ 
  floor, 
  nav, 
  width, 
  height 
}: { 
  floor: any; 
  nav: any; 
  width: number; 
  height: number; 
}) {
  const scale = 25; // 25px per meter
  const mapW = floor.width * scale;
  const mapH = floor.height * scale;
  const userPx = nav.position.x * scale;
  const userPy = nav.position.y * scale;

  return (
    <div className="absolute inset-0 bg-[#0f172a] overflow-hidden">
      <div 
        className="absolute transition-transform duration-500 ease-out"
        style={{
          width: `${mapW}px`,
          height: `${mapH}px`,
          transform: `translate(${width/2 - userPx}px, ${height/2 - userPy}px)`,
        }}
      >
        {/* Floorplan Image */}
        {floor.image && (
          <img 
            src={floor.image} 
            alt="Floor plan" 
            className="w-full h-full object-cover opacity-40 brightness-110" 
          />
        )}
        
        {/* Route overlays */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${floor.width} ${floor.height}`}>
          {/* Past/Entire leg in muted color */}
          <polyline 
            points={nav.leg.points.map((p: any) => `${p.x},${p.y}`).join(' ')} 
            fill="none" 
            stroke="hsl(var(--primary))" 
            strokeWidth="0.8" 
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.3" 
          />
          
          {/* Upcoming path in bright color */}
          <polyline 
            points={nav.upcomingPoints.map((p: any) => `${p.x},${p.y}`).join(' ')} 
            fill="none" 
            stroke="hsl(var(--primary))" 
            strokeWidth="1.2" 
            strokeLinecap="round"
            strokeLinejoin="round" 
            opacity="0.9"
          />
          
          {/* User direction indicator cone */}
          <polygon 
            points={`${nav.position.x},${nav.position.y - 3} ${nav.position.x - 2},${nav.position.y + 1} ${nav.position.x + 2},${nav.position.y + 1}`}
            fill="url(#view-cone)"
            opacity="0.5"
            transform={`rotate(${nav.facingFloorplanBearing} ${nav.position.x} ${nav.position.y})`}
          />
          
          {/* User current position dot */}
          <circle 
            cx={nav.position.x} 
            cy={nav.position.y} 
            r="1.2" 
            fill="white" 
            className="drop-shadow-lg"
          />
          <circle 
            cx={nav.position.x} 
            cy={nav.position.y} 
            r="0.6" 
            fill="hsl(var(--primary))" 
          />

          <defs>
            <linearGradient id="view-cone" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
}

function ActiveNavigation({ 
  nav, 
  building, 
  destination,
  onExit
}: { 
  nav: any; 
  building: any; 
  destination: any;
  onExit: () => void;
}) {
  const [viewMode, setViewMode] = useState<'ar' | 'map'>('ar');
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const { videoRef, status: cameraStatus } = useCameraStream(viewMode === 'ar');
  const floor = building.floors.find((f: any) => f.level === nav.floor);

  if (nav.arrived) {
    return (
      <div className="absolute inset-0 bg-background flex flex-col items-center justify-center p-6 text-center animate-in zoom-in-95 duration-500 z-50">
        <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mb-8 relative">
          <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping" />
          <CheckCircle2 className="w-12 h-12 text-green-500" />
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight mb-4">You've Arrived</h1>
        <p className="text-xl text-muted-foreground mb-12">
          You are at <strong className="text-foreground">{destination.label}</strong>
        </p>
        <Button size="lg" className="w-full max-w-sm rounded-full h-16 text-lg" onClick={onExit}>
          Done
        </Button>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-black overflow-hidden flex flex-col">
      {/* Background Layer: AR Camera or 2D Map */}
      <div className="absolute inset-0">
        {viewMode === 'ar' ? (
          <>
            <video 
              ref={videoRef} 
              className="absolute inset-0 w-full h-full object-cover" 
              muted 
              playsInline 
            />
            {/* Floor-painted path overlay disabled for now (projection scale
                issues on device) — a big directional arrow guides instead.
                TODO: revisit ARPathOverlay ground-plane projection. */}
            {cameraStatus === 'active' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div
                  className="transition-transform duration-300 ease-out drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
                  style={{ transform: `rotate(${nav.arrowRotation}deg)` }}
                >
                  <Navigation
                    className="w-32 h-32 text-primary -rotate-45"
                    fill="currentColor"
                    strokeWidth={1}
                  />
                </div>
                <p className="mt-6 text-white text-lg font-bold bg-black/50 backdrop-blur-md px-5 py-2 rounded-full border border-white/10">
                  {Math.round(nav.arrowRotation) === 0 || Math.abs(nav.arrowRotation) < 20
                    ? 'Straight ahead'
                    : nav.arrowRotation > 0
                      ? 'Turn right'
                      : 'Turn left'}
                </p>
              </div>
            )}
            {cameraStatus !== 'active' && (
              <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
                <p className="text-slate-400 font-medium animate-pulse">
                  {cameraStatus === 'denied' ? 'Camera access denied' : 'Starting camera...'}
                </p>
              </div>
            )}
          </>
        ) : (
          <MapView floor={floor} nav={nav} width={size.w} height={size.h} />
        )}
      </div>

      {/* Top HUD */}
      <div className="relative z-10 p-4 safe-area-pt flex justify-between items-start pointer-events-none">
        <Button 
          variant="secondary" 
          size="icon" 
          className="rounded-full shadow-lg pointer-events-auto bg-black/50 backdrop-blur-md text-white border-white/10 hover:bg-black/70"
          onClick={onExit}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>

        <div className="flex bg-black/50 backdrop-blur-md p-1 rounded-full shadow-lg border border-white/10 pointer-events-auto">
          <button 
            className={cn("px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 transition-all", viewMode === 'ar' ? "bg-primary text-primary-foreground shadow-sm" : "text-white/70 hover:text-white")}
            onClick={() => setViewMode('ar')}
          >
            <Video className="w-4 h-4" /> AR
          </button>
          <button 
            className={cn("px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 transition-all", viewMode === 'map' ? "bg-primary text-primary-foreground shadow-sm" : "text-white/70 hover:text-white")}
            onClick={() => setViewMode('map')}
          >
            <Map className="w-4 h-4" /> Map
          </button>
        </div>
      </div>

      {/* Compass (both views) */}
      <div className="absolute top-20 right-4 z-10 safe-area-pt">
        <CompassWidget facingBearing={nav.facingFloorplanBearing} />
      </div>

      {/* Wrong-way alert (both views) */}
      {nav.wrongWay && (
        <div className="absolute top-36 left-0 right-0 z-10 flex justify-center px-4 pointer-events-none">
          <div className="bg-red-600/95 backdrop-blur-md text-white font-bold px-5 py-3 rounded-full shadow-2xl border border-red-400/40 flex items-center gap-2 animate-pulse">
            <RotateCcw className="w-5 h-5" />
            Wrong way — turn around
          </div>
        </div>
      )}

      {/* Bottom HUD */}
      <div className="relative z-10 mt-auto p-4 safe-area-pb pointer-events-none">
        <div className="glass-panel bg-black/60 dark:bg-black/60 backdrop-blur-xl border border-white/10 p-6 rounded-[2rem] shadow-2xl pointer-events-auto mb-2 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/20 text-primary rounded-full flex items-center justify-center">
                {/* Live direction-to-next-waypoint arrow, relative to which way
                    the user is facing. Navigation glyph points NE at 0°, so
                    offset by -45° to make it point straight up as the base. */}
                <Navigation
                  className="w-6 h-6 transition-transform duration-300"
                  style={{ transform: `rotate(${nav.arrowRotation - 45}deg)` }}
                />
              </div>
              <div>
                <p className="text-sm font-bold text-white/60 tracking-wider uppercase mb-1">Up Next</p>
                <h2 className="text-2xl font-bold leading-none tracking-tight">
                  {nav.currentInstruction?.instruction || 'Continue straight'}
                </h2>
              </div>
            </div>
            <div className="text-right">
              <span className="text-4xl font-extrabold tracking-tighter">
                {Math.max(nav.currentInstruction?.distance || 0, 0).toFixed(0)}
              </span>
              <span className="text-sm font-medium text-white/60 ml-1">m</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4 mt-6">
            <Button 
              variant="secondary" 
              className="flex-1 rounded-full h-12 bg-white/10 hover:bg-white/20 text-white border-transparent"
              onClick={nav.skipToNextWaypoint}
            >
              I'm at the corner
            </Button>
          </div>
        </div>

        {/* Demo Controls */}
        <div className="glass-panel bg-black/60 border border-white/10 p-4 rounded-3xl pointer-events-auto flex items-center justify-between text-white">
          <span className="text-sm font-medium text-white/80">Simulate walking (Demo)</span>
          <Switch 
            checked={nav.simulate} 
            onCheckedChange={nav.setSimulate} 
            className="data-[state=checked]:bg-primary"
          />
        </div>
      </div>
    </div>
  );
}


/**
 * Pre-walk orientation: shows the user on the actual floor plan — their
 * current facing direction (live compass beam), the route, and the
 * destination — so they can visually confirm/adjust which way they're
 * facing before starting, instead of trusting an abstract compass dial.
 */
function OrientationMap({
  floor,
  nav,
  routePoints,
  destination,
}: {
  floor: any;
  nav: any;
  routePoints: { x: number; y: number }[];
  destination: BuildingNode | null;
}) {
  // Defensive: with missing floor data or an empty leg we can't draw a map.
  if (!floor || routePoints.length === 0) {
    return (
      <div className="w-full rounded-3xl border border-border bg-muted/40 p-8 text-sm text-muted-foreground">
        Map preview unavailable for this floor — you can still start walking.
      </div>
    );
  }

  // Fit the whole route (plus some padding) into the view.
  const xs = routePoints.map((p) => p.x);
  const ys = routePoints.map((p) => p.y);
  const pad = 6;
  const minX = Math.max(Math.min(...xs) - pad, 0);
  const minY = Math.max(Math.min(...ys) - pad, 0);
  const maxX = Math.min(Math.max(...xs) + pad, floor.width);
  const maxY = Math.min(Math.max(...ys) + pad, floor.height);
  const vw = Math.max(maxX - minX, 10);
  const vh = Math.max(maxY - minY, 10);
  const start = routePoints[0];
  const destOnThisFloor = destination && destination.floor === floor.level;
  const endPoint = routePoints[routePoints.length - 1];
  // Scale marker/stroke sizes with the viewport so they stay readable.
  const u = Math.max(vw, vh) / 60;

  return (
    <svg
      className="w-full rounded-3xl border border-border bg-[#0f172a] shadow-inner"
      viewBox={`${minX} ${minY} ${vw} ${vh}`}
      style={{ aspectRatio: `${vw} / ${vh}`, maxHeight: '45dvh' }}
    >
      {floor.image && (
        <image
          href={floor.image}
          x="0"
          y="0"
          width={floor.width}
          height={floor.height}
          opacity="0.45"
          preserveAspectRatio="none"
        />
      )}

      {/* Planned route */}
      <polyline
        points={routePoints.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={1.1 * u}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={`${2.2 * u} ${1.6 * u}`}
        opacity="0.9"
      />

      {/* Destination (or leg end) marker */}
      <g>
        <circle cx={endPoint.x} cy={endPoint.y} r={2.6 * u} fill="hsl(var(--primary))" opacity="0.25">
          <animate attributeName="r" values={`${2.2 * u};${3.2 * u};${2.2 * u}`} dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx={endPoint.x} cy={endPoint.y} r={1.4 * u} fill="hsl(var(--primary))" stroke="white" strokeWidth={0.35 * u} />
      </g>

      {/* User facing beam — rotates live with the compass + manual adjustment */}
      <g transform={`rotate(${nav.facingFloorplanBearing} ${start.x} ${start.y})`}>
        <polygon
          points={`${start.x},${start.y - 9 * u} ${start.x - 3.4 * u},${start.y} ${start.x + 3.4 * u},${start.y}`}
          fill="url(#orient-beam)"
        />
        <polygon
          points={`${start.x},${start.y - 4.4 * u} ${start.x - 1.5 * u},${start.y - 1.4 * u} ${start.x + 1.5 * u},${start.y - 1.4 * u}`}
          fill="#38bdf8"
        />
      </g>

      {/* User position (entrance) */}
      <circle cx={start.x} cy={start.y} r={1.5 * u} fill="white" />
      <circle cx={start.x} cy={start.y} r={0.85 * u} fill="#38bdf8" />

      {/* Labels */}
      <text x={start.x} y={start.y + 4.2 * u} textAnchor="middle" fill="white" fontSize={2.4 * u} fontWeight="bold">
        You
      </text>
      <text x={endPoint.x} y={endPoint.y - 3 * u} textAnchor="middle" fill="white" fontSize={2.4 * u} fontWeight="bold">
        {destOnThisFloor ? (destination as any).label ?? 'Destination' : 'Next: stairs/elevator'}
      </text>

      <defs>
        <linearGradient id="orient-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.75" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function CalibrationScreen({
  nav,
  building,
  destination,
  onStart,
}: {
  nav: any;
  building: any;
  destination: BuildingNode | null;
  onStart: () => void;
}) {
  const [step, setStep] = useState<'intro' | 'calibrate'>('intro');

  const handlePermissions = async () => {
    await nav.requestSensorPermissions();
    setStep('calibrate');
  };

  if (step === 'intro') {
    return (
      <div className="absolute inset-0 bg-background flex flex-col items-center justify-center p-6 text-center safe-area-pt safe-area-pb z-50">
        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-8 relative">
          <Compass className="w-10 h-10 text-primary" />
          <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping opacity-50" style={{ animationDuration: '3s' }} />
        </div>
        
        <div className="mb-8">
          <BrandLogo className="h-6" link={false} />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight mb-4 text-balance">
          Ready to Walk?
        </h1>
        <p className="text-lg text-muted-foreground mb-12 max-w-sm">
          Indoora needs access to your camera and motion sensors to guide you.
        </p>

        <Button size="lg" className="w-full max-w-sm rounded-full h-16 text-lg shadow-lg shadow-primary/25" onClick={handlePermissions}>
          Enable Sensors
        </Button>
      </div>
    );
  }

  const floor = building.floors.find((f: any) => f.level === nav.floor);

  return (
    <div className="absolute inset-0 bg-background flex flex-col items-center justify-center p-6 text-center safe-area-pt safe-area-pb z-50 overflow-y-auto">
      <div className="mb-6">
        <BrandLogo className="h-6" link={false} />
      </div>
      <h1 className="text-3xl font-extrabold tracking-tight mb-2">Check Your Direction</h1>
      <p className="text-muted-foreground mb-6 max-w-sm">
        The blue beam shows which way we think you're facing. If it doesn't match
        the direction you're actually looking, tap the buttons to rotate it.
      </p>

      <div className="w-full max-w-sm mb-6">
        <OrientationMap
          floor={floor}
          nav={nav}
          routePoints={nav.leg.points}
          destination={destination}
        />
      </div>

      <div className="flex gap-4 mb-8 w-full max-w-sm">
        <Button variant="outline" size="lg" className="flex-1 rounded-full h-14" onClick={() => nav.adjustHeading(-15)}>
          <RotateCcw className="w-5 h-5 mr-2" /> Rotate Left
        </Button>
        <Button variant="outline" size="lg" className="flex-1 rounded-full h-14" onClick={() => nav.adjustHeading(15)}>
          Rotate Right <RotateCw className="w-5 h-5 ml-2" />
        </Button>
      </div>

      {(!nav.headingAvailable || !nav.stepDetectionAvailable) && (
        <p className="text-sm text-amber-600 dark:text-amber-500 font-medium mb-4 max-w-sm">
          {!nav.headingAvailable && !nav.stepDetectionAvailable
            ? "Compass and motion sensors aren't responding — walking won't be tracked automatically. Try reloading and allowing sensor access."
            : !nav.headingAvailable
              ? "Compass isn't responding — the direction won't follow you as you turn."
              : "Motion sensor isn't responding — your position won't advance as you walk. Use \"I'm at the corner\" to move along the route."}
        </p>
      )}

      <Button size="lg" className="w-full max-w-sm rounded-full h-16 text-lg shadow-lg shadow-primary/25" onClick={onStart}>
        Start Walking
      </Button>
    </div>
  );
}


export default function Navigate() {
  const [, setLocation] = useLocation();
  // Read query params synchronously so the first render already has them.
  const [params] = useState(() => {
    const search = new URLSearchParams(window.location.search);
    return { b: search.get("b"), e: search.get("e"), d: search.get("d") };
  });
  const { b, e, d } = params;

  const { buildings, isLoading } = useBuildings();
  const building = getBuildingIn(buildings, b);
  const entrance = building?.entrances.find((ent: any) => ent.nodeId === e);
  const destination = building ? getNode(building, d || "") : null;

  const route = useMemo(() => {
    if (!building || !e || !d) return null;
    const path = findShortestPath(building, e, d);
    if (!path) return null;
    return buildRoute(building, path.nodeIds, path.edges);
  }, [building, e, d]);

  if (isLoading && !building) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background safe-area-pt">
        <p className="text-muted-foreground animate-pulse">Loading location...</p>
      </div>
    );
  }

  if (!b || !e || !d || !building || !entrance || !destination || !route) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background p-6 text-center safe-area-pt">
        <h1 className="text-2xl font-bold mb-2">Route not found</h1>
        <p className="text-muted-foreground mb-8">We couldn't find a walking path to that destination.</p>
        <Button onClick={() => setLocation(b && e ? `/destination?b=${b}&e=${e}` : "/")}>Go Back</Button>
      </div>
    );
  }

  return (
    <NavigateInner
      route={route}
      entranceFacingBearing={entrance.facingBearing}
      building={building}
      destination={destination}
      onExit={() => setLocation(`/destination?b=${b}&e=${e}`)}
    />
  );
}

function NavigateInner({
  route,
  entranceFacingBearing,
  building,
  destination,
  onExit,
}: {
  route: ReturnType<typeof buildRoute>;
  entranceFacingBearing: number;
  building: Building;
  destination: BuildingNode;
  onExit: () => void;
}) {
  const nav = useIndoorNavigation(route, entranceFacingBearing);
  const [started, setStarted] = useState(false);

  if (!started) {
    return (
      <CalibrationScreen
        nav={nav}
        building={building}
        destination={destination}
        onStart={() => setStarted(true)}
      />
    );
  }

  return (
    <ActiveNavigation
      nav={nav}
      building={building}
      destination={destination}
      onExit={onExit}
    />
  );
}
