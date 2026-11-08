import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-3 text-slate-600">This address is not part of the application.</p>
      <Link to="/" className="mt-6 inline-block text-sm font-medium text-slate-900 underline">
        Back to foundation
      </Link>
    </section>
  );
}
