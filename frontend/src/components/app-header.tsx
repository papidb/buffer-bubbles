import { ExternalLink, HelpCircle, Info, Layers3 } from "lucide-react";

type AppHeaderProps = {
  onAbout: () => void;
  onTour: () => void;
};

export function AppHeader({ onAbout, onTour }: AppHeaderProps) {
  return (
    <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
              <Layers3 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight text-slate-900">Buffer Bubbles</div>
              <div className="text-sm text-slate-600">Interactive view of aggregated Buffer feature requests</div>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onAbout}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
          >
            <Info className="h-4 w-4" />
            About
          </button>

          <button
            type="button"
            onClick={onTour}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <HelpCircle className="h-4 w-4" />
            Take a tour
          </button>

          <a
            href="https://github.com/papidb/buffer-bubbles"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            GitHub
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </header>
  );
}
