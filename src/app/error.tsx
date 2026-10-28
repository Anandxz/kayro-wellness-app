"use client";
export default function AppErrorScreen({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main-content" className="main-container py-16">
      <section className="card placeholder">
        <p className="eyebrow">A small pause</p>
        <h1 className="mt-4">Let’s try that again.</h1>
        <p className="muted my-6">
          Something interrupted this page. Refresh your appointments before
          repeating a change so you can check whether it was saved.
        </p>
        <button className="button" onClick={reset}>
          Try again
        </button>
      </section>
    </main>
  );
}
