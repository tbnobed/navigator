import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { getNode, type Building, type BuildingNode } from "@/lib/buildings";
import { useBuildings, getBuildingIn } from "@/lib/sites";
import { findShortestPath, buildRoute } from "@/lib/routing";
import { useIndoorNavigation } from "@/hooks/useIndoorNavigation";
import { useCameraStream } from "@/hooks/useCameraStream";
import { ARPathOverlay } from "@/components/ARPathOverlay";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Map, Video, ArrowLeft, ArrowUp, Compass, Navigation, CheckCircle2, RotateCcw, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

// Internal components
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
            {cameraStatus === 'active' && (
              <ARPathOverlay 
                points={nav.upcomingPoints} 
                userX={nav.position.x} 
                userY={nav.position.y} 
                facingBearing={nav.facingFloorplanBearing} 
                width={size.w} 
                height={size.h} 
                color="hsl(var(--primary))" 
              />
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

      {/* Bottom HUD */}
      <div className="relative z-10 mt-auto p-4 safe-area-pb pointer-events-none">
        <div className="glass-panel bg-black/60 dark:bg-black/60 backdrop-blur-xl border border-white/10 p-6 rounded-[2rem] shadow-2xl pointer-events-auto mb-2 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/20 text-primary rounded-full flex items-center justify-center">
                <Navigation className="w-6 h-6 rotate-45" />
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


function CalibrationScreen({ nav, onStart }: { nav: any; onStart: () => void }) {
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

  return (
    <div className="absolute inset-0 bg-background flex flex-col items-center justify-center p-6 text-center safe-area-pt safe-area-pb z-50">
      <h1 className="text-3xl font-extrabold tracking-tight mb-2">Calibrate Compass</h1>
      <p className="text-muted-foreground mb-12 max-w-sm">
        Point your phone straight down the hall. Use the buttons below until the arrow points straight ahead.
      </p>

      <div className="relative w-64 h-64 border-4 border-muted rounded-full flex items-center justify-center mb-12 shadow-inner">
        {/* Compass markings */}
        <div className="absolute top-2 text-xs font-bold text-muted-foreground">N</div>
        <div className="absolute bottom-2 text-xs font-bold text-muted-foreground">S</div>
        <div className="absolute left-2 text-xs font-bold text-muted-foreground">W</div>
        <div className="absolute right-2 text-xs font-bold text-muted-foreground">E</div>
        
        <div 
          className="absolute w-full h-full flex items-start justify-center pb-2 transition-transform duration-300 ease-out"
          style={{ transform: `rotate(${nav.arrowRotation}deg)` }}
        >
          <div className="w-2 h-32 bg-primary rounded-t-full shadow-lg relative mt-6">
            <div className="absolute -top-4 -left-3 w-0 h-0 border-l-[16px] border-r-[16px] border-b-[24px] border-l-transparent border-r-transparent border-b-primary" />
          </div>
        </div>
      </div>

      <div className="flex gap-4 mb-16 w-full max-w-sm">
        <Button variant="outline" size="lg" className="flex-1 rounded-full h-14" onClick={() => nav.adjustHeading(-15)}>
          <RotateCcw className="w-5 h-5 mr-2" /> -15°
        </Button>
        <Button variant="outline" size="lg" className="flex-1 rounded-full h-14" onClick={() => nav.adjustHeading(15)}>
          +15° <RotateCw className="w-5 h-5 ml-2" />
        </Button>
      </div>

      <Button size="lg" className="w-full max-w-sm rounded-full h-16 text-lg shadow-lg shadow-primary/25" onClick={onStart}>
        Looks Good, Let's Go
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
    return <CalibrationScreen nav={nav} onStart={() => setStarted(true)} />;
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
