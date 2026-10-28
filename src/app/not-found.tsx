import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main-content" className="main-container py-20">
      <p className="eyebrow">404 · A little off track</p>
      <h1 className="mt-5 mb-8">Let’s find your way back.</h1>
      <Link href="/" className="button">
        Back to Kayro
      </Link>
    </main>
  );
}
