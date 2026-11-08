import { useQuery } from "@tanstack/react-query";
import { ApiError, fetchHealth } from "../../services/api-client.js";

export function FoundationPage() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
  });

  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-sm font-medium tracking-wide text-slate-500">Phase 1</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Payment Recovery</h1>
      <p className="mt-3 max-w-xl text-slate-600">
        The application shell is running. Customers, invoices, and payments are added in later
        phases.
      </p>

      <div className="mt-8 rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-medium text-slate-500">API health</h2>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => {
              void health.refetch();
            }}
          >
            Check again
          </button>
        </div>
        <HealthStatus
          pending={health.isPending}
          database={(health.data as any)?.database}
          message={health.error instanceof ApiError ? health.error.message : undefined}
          unreachable={health.isError && !(health.error instanceof ApiError)}
        />
      </div>
    </section>
  );
}

function HealthStatus({
  pending,
  database,
  message,
  unreachable,
}: {
  pending: boolean;
  database: string | undefined;
  message: string | undefined;
  unreachable: boolean;
}) {
  if (pending) {
    return <p className="mt-3 text-slate-700">Checking the API…</p>;
  }
  if (database === "connected") {
    return <p className="mt-3 text-slate-900">Database connected.</p>;
  }
  if (message) {
    return <p className="mt-3 text-slate-900">{message}</p>;
  }
  if (unreachable) {
    return <p className="mt-3 text-slate-900">The API could not be reached.</p>;
  }
  return <p className="mt-3 text-slate-900">Health has not been checked.</p>;
}
