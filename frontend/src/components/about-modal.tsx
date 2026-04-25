import { AnimatePresence, motion } from "framer-motion";
import { HelpCircle, Info } from "lucide-react";

export function AboutModal({
  show,
  onClose,
  onTakeTour,
}: {
  show: boolean;
  onClose: () => void;
  onTakeTour: () => void;
}) {
  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 py-6 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-buffer-bubbles-title"
            className="w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl sm:p-7"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                  <Info className="h-3.5 w-3.5" />
                  About Buffer Bubbles
                </div>
                <h2
                  id="about-buffer-bubbles-title"
                  className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
                >
                  Why this project exists
                </h2>
              </div>
            </div>

            <div className="mt-6 space-y-4 text-sm leading-6 text-slate-600 sm:text-[15px]">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  What it does
                </div>
                <p className="mt-2">
                  Buffer Bubbles turns public Buffer suggestion boards into an
                  interactive map of feature demand so repeated themes are
                  easier to spot than they are in a long chronological list of
                  posts.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  How clustering works
                </div>
                <p className="mt-2">
                  The pipeline collects public requests, cleans the text, groups
                  semantically similar ideas into clusters, and then rolls up
                  the evidence behind each theme with request counts, votes,
                  comments, boards, and statuses.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  How to use the UI
                </div>
                <p className="mt-2">
                  Search or filter the dataset, switch between the bubble chart
                  and the ranked list, change the sizing or sorting controls,
                  and select a cluster to inspect the original Buffer requests
                  linked in the detail panel.
                </p>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-200 pt-5">
              <button
                type="button"
                onClick={onTakeTour}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                <HelpCircle className="h-4 w-4" />
                Take a tour
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
