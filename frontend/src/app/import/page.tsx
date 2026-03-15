"use client";
import { useState, useEffect } from "react";
import { Shell } from "@/components/layout/Shell";
import { Card, Btn, SectionHeader } from "@/components/ui";
import { colors, fonts } from "@/lib/tokens";

const BASE   = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://svdeeq-bot.onrender.com";
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

type ScrapeMode = "single" | "batch";

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""));
  return lines.slice(1).map(line => {
    const vals = line.split(",");
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = (vals[i] ?? "").trim().replace(/^"|"$/g, ""); });
    return obj;
  });
}

// ── Scraper Section ───────────────────────────────────────────────
function ScraperSection() {
  const [mode,       setMode]       = useState<ScrapeMode>("single");
  const [categories, setCategories] = useState<string[]>([]);
  const [allCities,  setAllCities]  = useState<string[]>([]);
  const [regions,    setRegions]    = useState<Record<string, string[]>>({});
  const [category,   setCategory]   = useState("");
  const [city,       setCity]       = useState("Abuja, Nigeria");
  const [region,     setRegion]     = useState("");
  const [batchCities, setBatchCities] = useState<string[]>([]);
  const [maxPerCity, setMaxPerCity] = useState(20);
  const [status,     setStatus]     = useState<"idle"|"loading"|"done"|"error">("idle");
  const [result,     setResult]     = useState<any>(null);
  const [progress,   setProgress]   = useState("");
  const [errorMsg,   setErrorMsg]   = useState("");

  useEffect(() => {
    fetch(`${BASE}/api/scrape/presets`)
      .then(r => r.json())
      .then(d => {
        setCategories(d.categories ?? []);
        setAllCities(d.locations ?? []);
        setRegions(d.regions ?? {});
        if (d.locations?.length) setCity(d.locations[0]);
      })
      .catch(() => {});
  }, []);

  // When region changes, update batch cities selection
  useEffect(() => {
    if (region && regions[region]) {
      setBatchCities(regions[region]);
    }
  }, [region, regions]);

  const handleSingleScrape = async () => {
    if (!category) return;
    setStatus("loading"); setResult(null); setErrorMsg(""); setProgress("Searching Google Maps…");
    try {
      const res = await fetch(`${BASE}/api/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, location: city, max_results: maxPerCity }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Scrape failed");
      setResult(data); setStatus("done");
    } catch (e: any) { setErrorMsg(e.message); setStatus("error"); }
    setProgress("");
  };

  const handleBatchScrape = async () => {
    if (!category) return;
    setStatus("loading"); setResult(null); setErrorMsg("");
    const cityCount = batchCities.length || allCities.length;
    setProgress(`Running across ${cityCount} cities — this may take a few minutes…`);
    try {
      const body: any = { category, max_per_city: maxPerCity, delay_secs: 2 };
      if (region) body.region = region;
      else if (batchCities.length) body.cities = batchCities;
      // else: no cities = all cities on backend

      const res = await fetch(`${BASE}/api/scrape/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Batch failed");
      setResult(data); setStatus("done");
    } catch (e: any) { setErrorMsg(e.message); setStatus("error"); }
    setProgress("");
  };

  const toggleCity = (c: string) => {
    setBatchCities(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  return (
    <Card style={{ padding: "22px 24px", marginBottom: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: colors.accentBg, border: `1px solid ${colors.accent}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>🗺</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: colors.ink, fontFamily: fonts.sans }}>Scrape from Google Maps</div>
          <div style={{ fontSize: 12, color: colors.inkD, fontFamily: fonts.sans }}>Pull businesses by category across Nigerian cities</div>
        </div>
      </div>

      {/* Mode toggle */}
      <div style={{ display: "flex", gap: 0, marginBottom: 18, background: colors.surfaceB, borderRadius: 8, padding: 3, width: "fit-content" }}>
        {(["single", "batch"] as ScrapeMode[]).map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            padding: "6px 18px", borderRadius: 6, cursor: "pointer", border: "none",
            fontFamily: fonts.sans, fontSize: 12.5, fontWeight: mode === m ? 600 : 400,
            background: mode === m ? colors.surface : "transparent",
            color: mode === m ? colors.ink : colors.inkC,
            boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,0.2)" : "none",
            transition: "all 0.15s",
          }}>
            {m === "single" ? "Single City" : "Batch — Multiple Cities"}
          </button>
        ))}
      </div>

      {/* Category input */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: colors.inkD, fontFamily: fonts.mono, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Business Category</div>
        <input
          value={category} onChange={e => setCategory(e.target.value)}
          placeholder="e.g. pharmacy, bakery, clinic…"
          list="cat-list"
          style={{ width: "100%", boxSizing: "border-box", background: colors.surfaceB, border: `1px solid ${colors.border}`, borderRadius: 7, padding: "8px 11px", fontSize: 13, color: colors.ink, fontFamily: fonts.sans, outline: "none" }}
        />
        <datalist id="cat-list">{categories.map(c => <option key={c} value={c} />)}</datalist>

        {/* Quick preset pills */}
        {categories.length > 0 && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
            {categories.slice(0, 10).map(c => (
              <button key={c} onClick={() => setCategory(c)} style={{
                padding: "3px 9px", borderRadius: 5, cursor: "pointer",
                fontFamily: fonts.sans, fontSize: 11,
                background: category === c ? colors.accentBg : colors.surfaceC,
                border: `1px solid ${category === c ? colors.accent + "40" : colors.border}`,
                color: category === c ? colors.accent : colors.inkC, transition: "all 0.12s",
              }}>{c}</button>
            ))}
          </div>
        )}
      </div>

      {/* Single mode controls */}
      {mode === "single" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 11, color: colors.inkD, fontFamily: fonts.mono, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>City</div>
            <select value={city} onChange={e => setCity(e.target.value)}
              style={{ width: "100%", background: colors.surfaceB, border: `1px solid ${colors.border}`, borderRadius: 7, padding: "8px 11px", fontSize: 13, color: colors.ink, fontFamily: fonts.sans, outline: "none", cursor: "pointer" }}>
              {allCities.length > 0 ? allCities.map(l => <option key={l} value={l}>{l}</option>) : <option value="Abuja, Nigeria">Abuja, Nigeria</option>}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: colors.inkD, fontFamily: fonts.mono, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Max</div>
            <select value={maxPerCity} onChange={e => setMaxPerCity(Number(e.target.value))}
              style={{ background: colors.surfaceB, border: `1px solid ${colors.border}`, borderRadius: 7, padding: "8px 11px", fontSize: 13, color: colors.ink, fontFamily: fonts.sans, outline: "none", cursor: "pointer" }}>
              {[10, 20, 30, 50].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <Btn variant="primary" onClick={handleSingleScrape} disabled={!category || status === "loading"}>
            {status === "loading" ? "Scraping…" : "⬡ Scrape"}
          </Btn>
        </div>
      )}

      {/* Batch mode controls */}
      {mode === "batch" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "flex-end", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: colors.inkD, fontFamily: fonts.mono, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Region (or pick cities below)</div>
              <select value={region} onChange={e => setRegion(e.target.value)}
                style={{ width: "100%", background: colors.surfaceB, border: `1px solid ${colors.border}`, borderRadius: 7, padding: "8px 11px", fontSize: 13, color: colors.ink, fontFamily: fonts.sans, outline: "none", cursor: "pointer" }}>
                <option value="">All Nigerian Cities</option>
                {Object.keys(regions).map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: colors.inkD, fontFamily: fonts.mono, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Max/City</div>
              <select value={maxPerCity} onChange={e => setMaxPerCity(Number(e.target.value))}
                style={{ background: colors.surfaceB, border: `1px solid ${colors.border}`, borderRadius: 7, padding: "8px 11px", fontSize: 13, color: colors.ink, fontFamily: fonts.sans, outline: "none", cursor: "pointer" }}>
                {[10, 20, 30].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <Btn variant="primary" onClick={handleBatchScrape} disabled={!category || status === "loading"}>
              {status === "loading" ? "Running…" : "⬡ Run Batch"}
            </Btn>
          </div>

          {/* City checkboxes — show when no region selected */}
          {!region && allCities.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: colors.inkD, fontFamily: fonts.mono, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Or select specific cities ({batchCities.length > 0 ? `${batchCities.length} selected` : "all cities if none selected"})
              </div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", maxHeight: 130, overflowY: "auto" }}>
                {allCities.map(c => (
                  <button key={c} onClick={() => toggleCity(c)} style={{
                    padding: "4px 10px", borderRadius: 5, cursor: "pointer",
                    fontFamily: fonts.sans, fontSize: 11,
                    background: batchCities.includes(c) ? colors.accentBg : colors.surfaceC,
                    border: `1px solid ${batchCities.includes(c) ? colors.accent + "40" : colors.border}`,
                    color: batchCities.includes(c) ? colors.accent : colors.inkC, transition: "all 0.12s",
                  }}>{c}</button>
                ))}
              </div>
              {batchCities.length > 0 && (
                <button onClick={() => setBatchCities([])} style={{ marginTop: 6, background: "none", border: "none", color: colors.inkD, fontSize: 11, cursor: "pointer", fontFamily: fonts.sans }}>
                  Clear selection
                </button>
              )}
            </div>
          )}

          {/* Estimated searches warning */}
          <div style={{ marginTop: 12, padding: "9px 12px", background: colors.amberBg, border: `1px solid ${colors.amber}20`, borderRadius: 7, fontSize: 11.5, color: colors.amber, fontFamily: fonts.sans }}>
            ⚠ Batch mode uses 1 SerpAPI search per city. Running all {allCities.length} cities uses {allCities.length} of your 100 free monthly searches.
          </div>
        </div>
      )}

      {/* Progress */}
      {progress && (
        <div style={{ marginTop: 14, padding: "10px 14px", background: colors.surfaceB, borderRadius: 7, fontSize: 12, color: colors.inkC, fontFamily: fonts.mono }}>
          ⟳ {progress}
        </div>
      )}

      {/* Result */}
      {status === "done" && result && (
        <div style={{ marginTop: 16, background: colors.greenBg, border: `1px solid ${colors.green}25`, borderRadius: 9, padding: "16px 18px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: result.leads?.length > 0 ? 14 : 0 }}>
            {[
              { label: "Found on Maps",    value: result.scraped ?? result.cities_run },
              { label: "New Leads Added",  value: result.new,      color: colors.green },
              { label: "Duplicates",       value: result.skipped },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: (s as any).color ?? colors.ink, fontFamily: fonts.mono }}>{s.value}</div>
                <div style={{ fontSize: 11, color: colors.inkD, fontFamily: fonts.sans, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
          {result.cities_failed?.length > 0 && (
            <div style={{ fontSize: 11.5, color: colors.amber, fontFamily: fonts.sans, marginBottom: 10 }}>
              ⚠ Failed cities: {result.cities_failed.join(", ")}
            </div>
          )}
          {result.leads?.length > 0 && (
            <div>
              <div style={{ fontSize: 10.5, color: colors.inkD, fontFamily: fonts.mono, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Sample leads added:</div>
              {result.leads.map((l: any, i: number) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < result.leads.length - 1 ? `1px solid ${colors.border}` : "none", fontSize: 12.5, fontFamily: fonts.sans }}>
                  <span style={{ color: colors.ink, fontWeight: 500 }}>{l.name}</span>
                  <span style={{ color: colors.inkD, fontFamily: fonts.mono }}>{l.phone_number}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {status === "error" && (
        <div style={{ marginTop: 14, background: colors.redBg, border: `1px solid ${colors.red}20`, borderRadius: 9, padding: "12px 16px", fontSize: 13, color: colors.red, fontFamily: fonts.sans }}>
          ✗ {errorMsg}
          {errorMsg.includes("SERPAPI_KEY") && (
            <div style={{ fontSize: 12, color: colors.inkC, marginTop: 6 }}>
              Add <code style={{ fontFamily: fonts.mono, color: colors.accent }}>SERPAPI_KEY</code> to your Render env vars. Free key at <a href="https://serpapi.com" target="_blank" rel="noopener noreferrer" style={{ color: colors.accent }}>serpapi.com</a>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 14, padding: "9px 12px", background: colors.surfaceB, borderRadius: 7, fontSize: 11.5, color: colors.inkD, fontFamily: fonts.sans }}>
        Requires <code style={{ fontFamily: fonts.mono, color: colors.accent }}>SERPAPI_KEY</code> in Render env vars · 100 free searches/month · <a href="https://serpapi.com" target="_blank" rel="noopener noreferrer" style={{ color: colors.accent }}>Get free key →</a>
      </div>
    </Card>
  );
}

// ── CSV Section ───────────────────────────────────────────────────
function CsvSection() {
  const [dragging, setDragging] = useState(false);
  const [rows,     setRows]     = useState<Record<string, string>[]>([]);
  const [headers,  setHeaders]  = useState<string[]>([]);
  const [status,   setStatus]   = useState<"idle"|"loading"|"done"|"error">("idle");
  const [inserted, setInserted] = useState(0);
  const [skipped,  setSkipped]  = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const parsed = parseCsv(e.target?.result as string);
      setRows(parsed); setHeaders(parsed.length > 0 ? Object.keys(parsed[0]) : []); setStatus("idle");
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!rows.length) return;
    setStatus("loading");
    let skip = 0;
    const batch = rows.map(row => {
      const phone = (row.phone_number ?? row.phone ?? row.whatsapp ?? row.mobile ?? "").replace(/[^0-9]/g, "");
      const name  = row.name ?? row.full_name ?? "Unknown";
      if (!phone || phone.length < 7) { skip++; return null; }
      return { name, phone_number: phone, business_name: row.business_name ?? row.company ?? "", industry: row.industry ?? row.category ?? "", location: row.location ?? row.city ?? "", status: "PENDING" };
    }).filter(Boolean);

    try {
      const res = await fetch(`${SB_URL}/rest/v1/leads`, {
        method: "POST",
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify(batch),
      });
      if (!res.ok) throw new Error(await res.text());
      setInserted(batch.length); setSkipped(skip); setStatus("done");
    } catch (e: any) { setErrorMsg(e.message); setStatus("error"); }
  };

  return (
    <Card style={{ padding: "22px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: colors.surfaceC, border: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>📄</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: colors.ink, fontFamily: fonts.sans }}>Upload CSV</div>
          <div style={{ fontSize: 12, color: colors.inkD, fontFamily: fonts.sans }}>Import from a spreadsheet · Required: name, phone_number</div>
        </div>
      </div>

      <div
        style={{ border: `2px dashed ${dragging ? colors.accent : colors.border}`, borderRadius: 10, padding: "28px 0", textAlign: "center", background: dragging ? colors.accentBg : colors.surfaceB, transition: "all 0.2s", marginBottom: 14 }}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f?.name.endsWith(".csv")) handleFile(f); }}
      >
        <div style={{ fontSize: 11.5, color: colors.inkD, fontFamily: fonts.sans, marginBottom: 10 }}>Drag & drop CSV or</div>
        <label style={{ cursor: "pointer" }}>
          <input type="file" accept=".csv" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <Btn variant="ghost">Browse Files</Btn>
        </label>
      </div>

      {rows.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: colors.ink, fontFamily: fonts.sans }}>{rows.length} rows detected</span>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {status === "done" && <span style={{ fontSize: 12, color: colors.green, fontFamily: fonts.mono }}>✓ {inserted} imported · {skipped} skipped</span>}
              {status === "error" && <span style={{ fontSize: 12, color: colors.red, fontFamily: fonts.mono }}>✗ {errorMsg}</span>}
              <Btn variant="primary" onClick={handleImport} disabled={status === "loading"}>
                {status === "loading" ? "Importing…" : `↑ Import ${rows.length}`}
              </Btn>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: fonts.sans }}>
              <thead>
                <tr>{headers.map(h => <th key={h} style={{ textAlign: "left", padding: "6px 10px", borderBottom: `1px solid ${colors.border}`, fontSize: 10, fontWeight: 600, color: colors.inkD, fontFamily: fonts.mono, textTransform: "uppercase", letterSpacing: "0.06em", background: colors.surfaceB }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(0, 6).map((row, i) => (
                  <tr key={i}>{headers.map(h => <td key={h} style={{ padding: "7px 10px", borderBottom: `1px solid ${colors.border}`, color: colors.inkB, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row[h] || "—"}</td>)}</tr>
                ))}
              </tbody>
            </table>
            {rows.length > 6 && <div style={{ padding: "7px 10px", fontSize: 11, color: colors.inkD, fontFamily: fonts.mono }}>+ {rows.length - 6} more rows</div>}
          </div>
        </>
      )}
    </Card>
  );
}

export default function ImportPage() {
  return (
    <Shell>
      <div style={{ padding: "28px 32px" }}>
        <SectionHeader
          title="Import Leads"
          sub="Scrape Google Maps or upload a CSV — all leads land as PENDING and get analyzed automatically"
        />
        <ScraperSection />
        <CsvSection />
      </div>
    </Shell>
  );
}
