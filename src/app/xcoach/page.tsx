import Link from "next/link";
import { redirect } from "next/navigation";

import { AppUserApprovedHeader } from "@/app/ui/app-user-approved-header";
import { getSessionUser } from "@/lib/auth";

import "../xchat/xchat.css";
import "./xcoach.css";

export default async function XcoachPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login?next=/xcoach");
  }

  return (
    <div className="xchat-shell">
      <AppUserApprovedHeader current="xcoach" feedbackPageLabel="xCoach" session={session} />

      <div className="xchat-body" style={{ padding: "1rem" }}>
        <section className="hero-card xf-noise-overlay xc-hero" style={{ maxWidth: "720px", margin: "0 auto" }}>
          <p className="eyebrow">xCoach</p>
          <h1 className="hero-title">Exam readiness</h1>
          <p className="hero-copy">
            Stub surface — timed licensing-style exams and score breakdowns will plug in here. Pick a track
            below (placeholders).
          </p>
          <div className="xc-exam-grid" role="list">
            {[
              { id: "sie", title: "SIE fundamentals", blurb: "Industry essentials — coming soon." },
              { id: "s7", title: "Series 7", blurb: "General securities representative — stub." },
              { id: "s65", title: "Series 65", blurb: "Investment adviser law — stub." }
            ].map((exam) => (
              <button
                key={exam.id}
                className="xc-exam-card"
                disabled
                type="button"
                title="Exam flow not implemented yet"
              >
                <strong>{exam.title}</strong>
                <span>{exam.blurb}</span>
                <span className="xc-exam-badge">Stub</span>
              </button>
            ))}
          </div>
          <div className="cta-row" style={{ marginTop: "1.25rem" }}>
            <Link className="cta cta-secondary" href="/">
              Home
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
