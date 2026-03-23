"use client";

import { FOLLOW_UP_INTRO, FOLLOW_UP_SECTIONS } from "./follow-up-data";

export function FollowUpMeetingClient() {
  return (
    <div className="flex-1 container mx-auto px-6 py-10 max-w-3xl pb-24">
      <div className="mb-10">
        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-3">
          Top 5 questions for your next meeting
        </h2>
        <p className="text-gray-400 text-sm sm:text-base leading-relaxed border-l-2 border-emerald-500/40 pl-4">
          {FOLLOW_UP_INTRO}
        </p>
        <p className="mt-4 text-xs text-gray-500">
          Check off when asked. Use notes for verbatim answers, objections, and next steps.
        </p>
      </div>

      <ol className="space-y-12 list-none">
        {FOLLOW_UP_SECTIONS.map((section, sIdx) => (
          <li key={section.id}>
            <div className="flex items-baseline gap-3 mb-4">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 text-sm font-bold border border-emerald-500/25"
                aria-hidden
              >
                {sIdx + 1}
              </span>
              <h3 className="text-lg sm:text-xl font-semibold text-emerald-400/95">{section.title}</h3>
            </div>

            <ul className="space-y-8 pl-0 sm:pl-2">
              {section.questions.map((q) => (
                <li
                  key={q.id}
                  className="rounded-xl border border-gray-800 bg-gray-950/60 p-5 shadow-[0_0_0_1px_rgba(16,185,129,0.06)]"
                >
                  <label className="flex gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      name={`covered-${q.id}`}
                      className="mt-1.5 h-4 w-4 shrink-0 rounded border-gray-600 bg-gray-900 text-emerald-500 focus:ring-emerald-500/40"
                    />
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 group-hover:text-gray-400">
                      Asked / covered
                    </span>
                  </label>

                  <p className="mt-3 text-gray-100 text-[15px] sm:text-base leading-relaxed">{q.prompt}</p>

                  {q.hint ? (
                    <p className="mt-3 text-sm text-gray-500 leading-relaxed border-l-2 border-amber-500/30 pl-3">
                      {q.hint}
                    </p>
                  ) : null}

                  {q.subBullets && q.subBullets.length > 0 ? (
                    <ul className="mt-4 space-y-2 text-sm text-gray-300 list-disc pl-5 marker:text-emerald-600">
                      {q.subBullets.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : null}

                  <label className="block mt-5">
                    <span className="sr-only">Notes for this question</span>
                    <span className="text-xs font-medium text-gray-500 mb-2 block">Notes (answers, objections, follow-ups)</span>
                    <textarea
                      name={`notes-${q.id}`}
                      rows={4}
                      placeholder={'Capture responses, names, dates, "send me…", etc.'}
                      className="w-full resize-y min-h-[100px] rounded-lg border border-gray-700 bg-black/50 px-4 py-3 text-sm text-gray-100 placeholder-gray-600 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                    />
                  </label>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <footer className="mt-14 pt-8 border-t border-gray-800 text-center text-xs text-gray-500">
        Static capture page — data stays in this browser tab until you copy or print. Not financial advice.
      </footer>
    </div>
  );
}
