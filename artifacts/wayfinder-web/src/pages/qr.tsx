import { useLocation } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import { useBuildings } from "@/lib/sites";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";

export default function QRPosters() {
  const [, setLocation] = useLocation();
  const { buildings } = useBuildings();

  const handlePrint = () => {
    window.print();
  };

  const baseUrl = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Screen-only header */}
      <div className="print:hidden p-6 border-b flex items-center justify-between bg-card safe-area-pt">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/")} className="rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-bold text-lg">Print QR Codes</h1>
        <Button onClick={handlePrint} className="rounded-full">
          <Printer className="w-4 h-4 mr-2" />
          Print Posters
        </Button>
      </div>

      {/* Posters */}
      <div className="p-8 print:p-0 print:m-0 space-y-24 print:space-y-0">
        {buildings.flatMap(bldg => 
          bldg.entrances.map(ent => {
            const url = `${baseUrl}/?b=${bldg.id}&e=${ent.nodeId}`;
            return (
              <div 
                key={`${bldg.id}-${ent.nodeId}`} 
                className="max-w-2xl mx-auto bg-white text-black p-16 rounded-3xl shadow-xl print:shadow-none print:rounded-none print:w-[100vw] print:h-[100vh] print:max-w-none flex flex-col items-center justify-center break-after-page"
              >
                <div className="text-center mb-16">
                  <h1 className="text-6xl font-extrabold tracking-tighter mb-4 text-slate-900">Wayfinder</h1>
                  <h2 className="text-3xl font-medium text-slate-600 mb-2">{bldg.name}</h2>
                  <h3 className="text-4xl font-bold text-slate-800">{ent.label}</h3>
                </div>
                
                <div className="bg-white p-8 rounded-3xl border-4 border-slate-100 shadow-2xl mb-16">
                  <QRCodeSVG 
                    value={url} 
                    size={400}
                    level="H"
                    includeMargin={false}
                    fgColor="#0f172a"
                  />
                </div>

                <div className="text-center space-y-4">
                  <p className="text-3xl font-bold text-slate-800 tracking-tight">Scan to start navigating</p>
                  <p className="text-xl text-slate-500">No app download required</p>
                  <p className="text-lg text-slate-500 pt-4">
                    Camera not working? Open the site and enter code{" "}
                    <span className="font-mono font-bold text-slate-800">
                      {ent.qrValue.replace("WAYFINDER://", "")}
                    </span>
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
