"use client";

// Last-resort boundary for failures in the root layout itself, where the translation and theme
// providers are not available. Kept minimal, bilingual and without external resources.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#f5f4ee", color: "#15261b", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ textAlign: "center", padding: 24, maxWidth: 420 }}>
          <h1 style={{ fontWeight: 300 }}>Something went wrong</h1>
          <p lang="tr">Bir şeyler ters gitti.</p>
          <button type="button" onClick={reset} style={{ padding: "10px 18px", background: "#15261b", color: "#eeede4", border: 0, borderRadius: 3, cursor: "pointer" }}>
            Try again · Tekrar dene
          </button>
        </main>
      </body>
    </html>
  );
}
