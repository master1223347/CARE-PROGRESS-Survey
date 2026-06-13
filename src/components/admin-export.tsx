"use client";

import Link from "next/link";
import { useState } from "react";

const files = [
  "respondents.csv",
  "care_loops.csv",
  "event_timeline.csv",
  "workflow_path.csv",
  "resolution_outcomes.csv",
  "evidence_quality.csv",
  "site_operations.csv",
];

export function AdminExport() {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");

  async function download(file: string) {
    setStatus(`Preparing ${file} for download...`);
    const response = await fetch(`/api/admin/export/${file}`, {
      headers: { "x-admin-password": password },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setStatus(body.error || "Export failed.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = file;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus(`${file} downloaded.`);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950">
      <section className="mx-auto max-w-3xl">
        <Link className="text-sm font-medium text-blue-700" href="/">
          Back to survey
        </Link>
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">CARE-PROGRESS India</p>
          <h1 className="mt-2 text-2xl font-semibold">Download CSV files with identifying details removed</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Enter the admin password from the deployment environment. These files contain survey data only, with identifying details removed.
          </p>
          <form className="mt-5" onSubmit={(event) => event.preventDefault()}>
            <label className="block text-sm font-medium" htmlFor="password">
              Admin password
            </label>
            <input
              autoComplete="current-password"
              id="password"
              className="mt-2 h-12 w-full rounded-md border border-slate-300 px-3 text-base outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {files.map((file) => (
                <button
                  className="h-12 rounded-md border border-slate-300 px-4 text-left text-sm font-medium hover:border-blue-500 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!password}
                  key={file}
                  onClick={() => download(file)}
                  type="button"
                >
                  {file}
                </button>
              ))}
            </div>
          </form>
          {status ? <p className="mt-4 text-sm text-slate-700">{status}</p> : null}
        </div>
      </section>
    </main>
  );
}
