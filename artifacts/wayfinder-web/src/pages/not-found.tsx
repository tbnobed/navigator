import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Compass } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-background text-foreground p-6 safe-area-pt safe-area-pb">
      <div className="mb-10">
        <BrandLogo className="h-7" />
      </div>
      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-6">
        <Compass className="w-8 h-8 text-muted-foreground" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight mb-2">Lost your way?</h1>
      <p className="text-muted-foreground text-center mb-8 max-w-sm">
        We couldn't find the location you're looking for.
      </p>
      <Button size="lg" onClick={() => setLocation("/")} className="w-full max-w-xs rounded-full">
        Return to start
      </Button>
    </div>
  );
}
