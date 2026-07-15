import { useLocation } from "wouter";

/**
 * The InDoora wordmark, shown consistently at the top of every page.
 * Tapping it returns to the home screen.
 */
export function BrandLogo({ className = "h-6", link = true }: { className?: string; link?: boolean }) {
  const [, setLocation] = useLocation();
  const img = (
    <img
      src={`${import.meta.env.BASE_URL}brand/logo-wordmark.svg`}
      alt="Indoora"
      className={className}
      draggable={false}
    />
  );
  if (!link) return img;
  return (
    <button onClick={() => setLocation("/")} aria-label="Indoora home" className="inline-flex">
      {img}
    </button>
  );
}
