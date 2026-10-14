import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

const TOOLTIP_WIDTH = 300;
const VIEWPORT_MARGIN = 12;
const TRIGGER_GAP = 6;

interface Position {
  top: number;
  left: number;
  maxHeight: number;
}

// Info-icon tooltip/popover — hover + click + keyboard (Escape / outside
// click to close), accessible via aria-label/aria-expanded on the trigger
// button. Shared across KPI cards that need a "how is this calculated"
// explainer next to the title, without touching the card's own layout.
//
// Rendered through a portal into document.body and positioned with
// `fixed` coordinates computed from the trigger's own bounding rect — a
// card's ancestor commonly clips overflow (e.g. a rounded panel clipping a
// decorative background), which silently truncated an absolutely-positioned
// tooltip nested inside it. Escaping to the body sidesteps that regardless
// of which page or panel the trigger sits in. Position is computed once on
// open, which is enough for a hover/click popover that isn't expected to
// stay open through a scroll.
export function InfoTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const openTooltip = () => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect) {
      const overflowsRight = rect.left + TOOLTIP_WIDTH > window.innerWidth - VIEWPORT_MARGIN;
      const left = overflowsRight
        ? Math.max(VIEWPORT_MARGIN, rect.right - TOOLTIP_WIDTH)
        : rect.left;
      const top = rect.bottom + TRIGGER_GAP;
      const maxHeight = Math.max(160, window.innerHeight - top - VIEWPORT_MARGIN);
      setPosition({ top, left, maxHeight });
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        rootRef.current && !rootRef.current.contains(target) &&
        panelRef.current && !panelRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="relative inline-flex"
      onMouseEnter={openTooltip}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openTooltip())}
        onFocus={openTooltip}
        className="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2"
        style={{ color: '#9CA3AF' }}
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && position && createPortal(
        <div
          ref={panelRef}
          role="tooltip"
          className="fixed z-50 overflow-y-auto rounded-xl border bg-white p-3.5"
          style={{
            top: position.top,
            left: position.left,
            width: TOOLTIP_WIDTH,
            maxHeight: position.maxHeight,
            borderColor: '#D8E2F4',
            boxShadow: '0 12px 28px rgba(15, 23, 42, 0.16)',
          }}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          {children}
        </div>,
        document.body,
      )}
    </div>
  );
}
