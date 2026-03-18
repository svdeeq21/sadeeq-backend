"use client";
import { useState, useEffect } from "react";
import { Shell } from "@/components/layout/Shell";
import { Card, Btn, SectionHeader } from "@/components/ui";
import { colors, fonts, radius } from "@/lib/tokens";

const BASE   = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://svdeeq-bot.onrender.com";
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

type Mode = "single" | "batch";

interface Presets { categories: string[]; states: string[]; zones: Record<string, string[]>; lagos_areas: string[]; abuja_areas: string[]; }

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""));
  return lines.slice(1).map(line => {
    const vals = line.split(","); const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = (vals[i] ?? "").trim().replace(/^"|"$/g, ""); }); return obj;
  });
}

function ScraperSection() {
  const [presets,   setPresets]   = useState<Presets | null>(null);
  const [mode,      setMode]      = useState<Mode>("single");
  const [category,  setCategory]  = useState("");
  const [state,     setState]     = useState("");
  const [region,    setRegion]    = useState("");
  const [selStates, setSelStates] = useState<string[]>([]);
  const [maxPer,    setMaxPer]    = useState(20);
  const [status,    setStatus]    = useState<"idle"|"loading"|"done"|"error">("idle");
  const [result,    setResult]    = useState<any>(null);
  const [progress,  setProgress]  = useState("");
  const [error,     setError]     = useState("");

  useEffect(() => {
    fetch(`${BASE}/api/scrape/presets`).then(r => r.json()).then((d: Presets) => { setPresets(d); if (d.states?.length) setState(d.states[0]); }).catch(() => {});
  }, []);

  useEffect(() => { if (region && presets?.zones[region]) setSelStates(presets.zones[region]); }, [region, presets]);

  const toggle = (s: string) => setSelStates(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);

  const run = async (url: string, body: any) => {
    setStatus("loading"); setResult(null); setError("");
    try {
      const res  = await fetch(`${BASE}${url}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed");
      setResult(data); setStatus("done");
    } catch (e: any) { setError(e.message); setStatus("error"); }
    setProgress("");
  };

  const handleSingle = () => { setProgress("Searching…"); run("/api/scrape", { category, location: state, max_results: maxPer }); };
  const handleBatch  = () => {
    const cnt = selStates.length || presets?.states.length || 37;
    setProgress(`Scraping ${cnt} states…`);
    const body: any = { category, max_per_city: maxPer, delay_secs: 2 };
    if (region && !selStates.length) body.region = region;
    else if (selStates.length) body.cities = selStates;
    run("/api/scrape/batch", body);
  };

  const cats   = presets?.categories ?? [];
  const states = presets?.states ?? [];
  const zones  = presets?.zones ?? {};

  return (
    <Card style={{ padding: "16px 18px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 18 }}>🗺</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: colors.ink }}>Google Maps Scraper</div>
          <div style={{ fontSize: 11.5, color: colors.inkD }}>Pull businesses across Nigeria</div>
        </div>
      </div>

      {/* Mode toggle */}
      <div style={{ display: "flex", background: colors.surfaceB, borderRadius: radius.md, padding: 3, marginBottom: 16, width: "fit-content" }}>
        {(["single", "batch"] as Mode[]).map(m => (
          <button key={m} onClick={() => setMode(m)} style={{ padding: "6px 16px", borderRadius: radius.sm, cursor: "pointer", border: "none", fontSize: 12.5, fontWeight: mode === m ? 600 : 400, background: mode === m ? colors.surface : "transparent", color: mode === m ? colors.ink : colors.inkC, transition: "all 0.15s" }}>
            {m === "single" ? "Single State" : "Batch"}
          </button>
        ))}
      </div>

      {/* Category */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: colors.inkD, fontFamily: fonts.mono, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Category</div>
        <input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. pharmacy, bakery…" list="cat-list"
          style={{ width: "100%", boxSizing: "border-box", background: colors.surfaceB, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: "8px 12px", fontSize: 13, color: colors.ink, outline: "none" }} />
        <datalist id="cat-list">{cats.map(c => <option key={c} value={c} />)}</datalist>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
          {cats.slice(0, 8).map(c => (
            <button key={c} onClick={() => setCategory(c)} style={{ padding: "3px 9px", borderRadius: radius.full, cursor: "pointer", fontSize: 11, border: `1px solid ${category === c ? colors.borderC : colors.border}`, background: category === c ? colors.surfaceC : "transparent", color: category === c ? colors.ink : colors.inkC, transition: "all 0.12s" }}>{c}</button>
          ))}
        </div>
      </div>

      {mode === "single" ? (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 10, color: colors.inkD, fontFamily: fonts.mono, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>State</div>
            <select value={state} onChange={e => setState(e.target.value)} style={{ width: "100%", background: colors.surfaceB, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: "8px 10px", fontSize: 13, color: colors.ink, outline: "none" }}>
              {states.length > 0 ? states.map(s => <option key={s} value={s}>{s}</option>) : <option value="FCT Abuja">FCT Abuja</option>}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 10, color: colors.inkD, fontFamily: fonts.mono, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Max</div>
            <select value={maxPer} onChange={e => setMaxPer(Number(e.target.value))} style={{ background: colors.surfaceB, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: "8px 10px", fontSize: 13, color: colors.ink, outline: "none" }}>
              {[10,20,30,50].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <Btn variant="primary" onClick={handleSingle} disabled={!category || status === "loading"}>{status === "loading" && mode === "single" ? "Scraping…" : "Scrape"}</Btn>
        </div>
      ) : (
        <div style={{ marginBottom: 14 }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: colors.inkD, fontFamily: fonts.mono, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Region</div>
            <select value={region} onChange={e => setRegion(e.target.value)} style={{ width: "100%", background: colors.surfaceB, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: "8px 10px", fontSize: 13, color: colors.ink, outline: "none" }}>
              <option value="">All Nigeria</option>
              {Object.keys(zones).map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
            {states.map(s => (
              <button key={s} onClick={() => toggle(s)} style={{ padding: "3px 9px", borderRadius: radius.full, cursor: "pointer", fontSize: 11, border: `1px solid ${selStates.includes(s) ? colors.borderC : colors.border}`, background: selStates.includes(s) ? colors.surfaceC : "transparent", color: selStates.includes(s) ? colors.ink : colors.inkC, transition: "all 0.12s" }}>
                {s.replace(" State","").replace(" Abuja","")}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <select value={maxPer} onChange={e => setMaxPer(Number(e.target.value))} style={{ background: colors.surfaceB, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: "7px 10px", fontSize: 13, color: colors.ink, outline: "none" }}>
              {[10,20,30].map(n => <option key={n} value={n}>{n}/state</option>)}
            </select>
            <Btn variant="primary" onClick={handleBatch} disabled={!category || status === "loading"}>{status === "loading" && mode === "batch" ? "Running…" : `Batch — ${selStates.length || states.length} States`}</Btn>
          </div>
          <div style={{ marginTop: 10, padding: "8px 12px", background: colors.amberBg, border: `1px solid ${colors.amber}15`, borderRadius: radius.md, fontSize: 11.5, color: colors.amber }}>
            ⚠ Uses {selStates.length || states.length} of your 100 free searches/month
          </div>
        </div>
      )}

      {status === "loading" && progress && <div style={{ padding: "10px 12px", background: colors.surfaceB, borderRadius: radius.md, fontSize: 12, color: colors.inkC, fontFamily: fonts.mono }}>{progress}</div>}

      {status === "done" && result && (
        <div style={{ marginTop: 14, background: colors.greenBg, border: `1px solid ${colors.green}20`, borderRadius: radius.md, padding: "14px 16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: result.leads?.length ? 12 : 0 }}>
            {[
              { label: "Found",    value: result.scraped ?? result.cities_run },
              { label: "New",      value: result.new,    color: colors.green },
              { label: "Skipped",  value: result.skipped },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: (s as any).color ?? colors.ink, fontFamily: fonts.sans }}>{s.value}</div>
                <div style={{ fontSize: 11, color: colors.inkD, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
          {result.leads?.map((l: any, i: number) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: `1px solid ${colors.border}`, fontSize: 12 }}>
              <span style={{ color: colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, marginRight: 10 }}>{l.name}</span>
              <span style={{ color: colors.inkD, fontFamily: fonts.mono, flexShrink: 0 }}>{l.phone_number}</span>
            </div>
          ))}
        </div>
      )}

      {status === "error" && (
        <div style={{ marginTop: 14, background: colors.redBg, border: `1px solid ${colors.red}15`, borderRadius: radius.md, padding: "12px 14px", fontSize: 13, color: colors.red }}>
          ✗ {error}
          {error.includes("SERPAPI_KEY") && <div style={{ fontSize: 11.5, color: colors.inkC, marginTop: 6 }}>Add SERPAPI_KEY to Render env vars · <a href="https://serpapi.com" target="_blank" rel="noopener noreferrer" style={{ color: colors.ink }}>serpapi.com →</a></div>}
        </div>
      )}

      <div style={{ marginTop: 12, fontSize: 11.5, color: colors.inkD }}>
        Requires <code style={{ fontFamily: fonts.mono, color: colors.inkC }}>SERPAPI_KEY</code> in Render · 100 free searches/month
      </div>
    </Card>
  );
}

function CsvSection() {
  const [dragging, setDragging] = useState(false);
  const [rows,     setRows]     = useState<Record<string, string>[]>([]);
  const [headers,  setHeaders]  = useState<string[]>([]);
  const [status,   setStatus]   = useState<"idle"|"loading"|"done"|"error">("idle");
  const [inserted, setInserted] = useState(0);
  const [skipped,  setSkipped]  = useState(0);
  const [error,    setError]    = useState("");

  const handleFile = (file: File) => {
    const r = new FileReader();
    r.onload = e => { const p = parseCsv(e.target?.result as string); setRows(p); setHeaders(p.length > 0 ? Object.keys(p[0]) : []); setStatus("idle"); };
    r.readAsText(file);
  };

  const handleImport = async () => {
    if (!rows.length) return; setStatus("loading");
    let skip = 0;
    const batch = rows.map(row => {
      const phone = (row.phone_number ?? row.phone ?? row.whatsapp ?? row.mobile ?? "").replace(/[^0-9]/g, "");
      if (!phone || phone.length < 7) { skip++; return null; }
      return { name: row.name ?? row.full_name ?? "Unknown", phone_number: phone, business_name: row.business_name ?? row.company ?? "", industry: row.industry ?? row.category ?? "", location: row.location ?? row.city ?? row.state ?? "", status: "PENDING" };
    }).filter(Boolean);
    try {
      const res = await fetch(`${SB_URL}/rest/v1/leads`, { method: "POST", headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(batch) });
      if (!res.ok) throw new Error(await res.text());
      setInserted(batch.length); setSkipped(skip); setStatus("done");
    } catch (e: any) { setError(e.message); setStatus("error"); }
  };

  return (
    <Card style={{ padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 18 }}>📄</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: colors.ink }}>Upload CSV</div>
          <div style={{ fontSize: 11.5, color: colors.inkD }}>Requires name, phone_number columns</div>
        </div>
      </div>

      <div
        style={{ border: `1px dashed ${dragging ? colors.borderC : colors.border}`, borderRadius: radius.lg, padding: "28px 0", textAlign: "center", background: dragging ? colors.surfaceC : colors.surfaceB, transition: "all 0.2s", marginBottom: 14 }}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f?.name.endsWith(".csv")) handleFile(f); }}>
        <div style={{ fontSize: 12, color: colors.inkD, marginBottom: 10 }}>Drag & drop CSV or</div>
        <label style={{ cursor: "pointer" }}>
          <input type="file" accept=".csv" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <Btn variant="ghost">Browse</Btn>
        </label>
      </div>

      {rows.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: colors.ink }}>{rows.length} rows</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {status === "done" && <span style={{ fontSize: 12, color: colors.green, fontFamily: fonts.mono }}>✓ {inserted} in · {skipped} skip</span>}
              {status === "error" && <span style={{ fontSize: 12, color: colors.red }}>{error.slice(0, 40)}</span>}
              <Btn variant="primary" onClick={handleImport} disabled={status === "loading"}>{status === "loading" ? "Importing…" : `Import ${rows.length}`}</Btn>
            </div>
          </div>

          {/* Table — horizontally scrollable */}
          <div style={{ overflowX: "auto", borderRadius: radius.md, border: `1px solid ${colors.border}` }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>{headers.map(h => <th key={h} style={{ textAlign: "left", padding: "7px 10px", borderBottom: `1px solid ${colors.border}`, fontSize: 10, fontWeight: 500, color: colors.inkD, fontFamily: fonts.mono, background: colors.surfaceB, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((row, i) => (
                  <tr key={i}>{headers.map(h => <td key={h} style={{ padding: "7px 10px", borderBottom: `1px solid ${colors.border}`, color: colors.inkB, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row[h] || "—"}</td>)}</tr>
                ))}
              </tbody>
            </table>
            {rows.length > 5 && <div style={{ padding: "6px 10px", fontSize: 11, color: colors.inkD, fontFamily: fonts.mono }}>+ {rows.length - 5} more</div>}
          </div>
        </>
      )}
    </Card>
  );
}

function ValidateSection() {
  const [status,  setStatus]  = useState<"idle"|"loading"|"done"|"error">("idle");
  const [result,  setResult]  = useState<any>(null);
  const [error,   setError]   = useState("");

  const handleValidate = async () => {
    setStatus("loading"); setResult(null); setError("");
    try {
      const res  = await fetch(`${BASE}/api/scrape/validate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed");
      setResult(data); setStatus("done");
    } catch (e: any) { setError(e.message); setStatus("error"); }
  };

  return (
    <Card style={{ padding: "16px 18px", marginBottom: 16, border: `1px solid ${colors.amber}20` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: colors.ink, marginBottom: 3 }}>Validate Pending Leads</div>
          <div style={{ fontSize: 12, color: colors.inkD }}>Check which PENDING leads are actually on WhatsApp before outreach starts</div>
        </div>
        <Btn variant="warning" onClick={handleValidate} disabled={status === "loading"}>
          {status === "loading" ? "Checking…" : "Run Validation"}
        </Btn>
      </div>
      {status === "done" && result && (
        <div style={{ marginTop: 12, padding: "10px 12px", background: colors.greenBg, border: `1px solid ${colors.green}15`, borderRadius: radius.md, fontSize: 12.5, color: colors.inkB }}>
          ✓ {result.message}
        </div>
      )}
      {status === "error" && (
        <div style={{ marginTop: 12, fontSize: 12.5, color: colors.red }}>{error}</div>
      )}
    </Card>
  );
}

export default function ImportPage() {
  return (
    <Shell>
      <div style={{ padding: "20px 16px", maxWidth: 700, margin: "0 auto" }}>
        <SectionHeader title="Import Leads" sub="Scrape Google Maps or upload CSV — all land as PENDING" />
        <ValidateSection />
        <ScraperSection />
        <CsvSection />
      </div>
    </Shell>
  );
}
