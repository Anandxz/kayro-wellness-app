"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

type View = "desktop" | "mobile";
const PreviewContext = createContext<{
  view: View;
  setView: (view: View) => void;
} | null>(null);
const PortalContext = createContext<HTMLElement | null>(null);
export function usePreviewPortal() {
  return useContext(PortalContext);
}

export function PreviewToggle() {
  const preview = useContext(PreviewContext);
  if (!preview) return null;
  return (
    <div
      className="preview-toggle"
      role="group"
      aria-label="Application preview size"
    >
      {(["desktop", "mobile"] as const).map((view) => (
        <button
          key={view}
          type="button"
          aria-pressed={preview.view === view}
          onClick={() => preview.setView(view)}
        >
          {view === "desktop" ? "Desktop" : "Mobile"}
        </button>
      ))}
    </div>
  );
}

export function ClientPreview({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>("desktop");
  const [portal, setPortal] = useState<HTMLDivElement | null>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    scroll.current?.scrollTo({ top: 0 });
  }, [pathname]);
  return (
    <PreviewContext.Provider value={{ view, setView }}>
      <PortalContext.Provider value={portal}>
        <div className="client-preview" data-preview={view}>
          <div className="preview-toolbar">
            <div>
              <p className="eyebrow">Kayro, wherever you are</p>
              <p className="preview-caption">A little care, in your pocket.</p>
            </div>
            <PreviewToggle />
          </div>
          <div className="preview-device responsive-surface">
            <div className="preview-scroll" ref={scroll}>
              {children}
            </div>
            <div ref={setPortal} className="preview-portals" />
          </div>
        </div>
      </PortalContext.Provider>
    </PreviewContext.Provider>
  );
}
