"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="empty">
      <h2>Unable to load this page</h2>
      <p className="my-4">Please try again in a moment.</p>
      <button className="primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
