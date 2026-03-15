"use client";
import { useState, useEffect } from "react";
import { Shell } from "@/components/layout/Shell";
import { Card, Btn, SectionHeader } from "@/components/ui";
import { colors, fonts } from "@/lib/tokens";

const BASE   = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://svdeeq-bot.onrender.com";
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

type ScrapeMode = "single" | "batch";

// ── Presets shape from backend ────────────────────────────────────
interface Presets {
  categories:  string[];
  states:      string[];
  zones:       Record<string, string[]>;
  lagos_areas: string[];
  abuja_areas: string[];
}

// ── CSV helpers ───────────────────────────────────────────────────
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h =>
    h.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
  );
  return lines.slice(1).map(line => {
    const vals = line.split(",");
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = (vals[i] ?? "").trim().replace(/^"|"$/g, ""); });
    return obj;
  });
}

// ── Result card ───────────────────────────────────────────────────
function ResultCard({ result, isBatch }: { result: any; isBatch: boolean }) {
  return (
    <div style={{ marginTop: 16, background: colors.greenBg, border: `1px solid ${colors.green}25`, borderRadius: 10, padding: "16px 18px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: (result.leads?.length > 0 || result.cities_failed?.length > 0) ? 14 : 0 }}>
        {[
          { label: isBatch ? "States Scraped" : "Found on Maps", value: isBatch ? result.cities_run : result.scraped },
          { label: "New Leads Added",   value: result.new,     color: colors.green },
          { label: "Duplicates Skipped", value: result.skipped },
        ].map(s => (
          <div key={s.label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: (s as any).color ?? colors.ink, fontFamily: fonts.mono }}>{s.value ?? 0}</div>
            <div style={{ fontSize: 11, color: colors.inkD, fontFamily: fonts.sans, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>
      {result.cities_failed?.length > 0 && (
        <div style={{ fontSize: 12, color: colors.amber, fontFamily: fonts.sans, marginBottom: 10, padding: "7px 10px", background: colors.amberBg, borderRadius: 6 }}>
          ⚠ Failed: {result.cities_failed.join(", ")}
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
  );
}

// ── Scraper section ───────────────────────────────────────────────
function ScraperSection() {
  const [presets,      setPresets]      = useState<Presets | null>(null);
  const [mode,         setMode]         = useState<ScrapeMode>("single");
  const [category,     setCategory]     = useState("");

  // Single mode
  const [state,        setState]        = useState("");
  const [useAreaDrill, setUseAreaDrill] = useState(false);
  const [area,         setArea]         = useState("");
  const [maxResults,   setMaxResults]   = useState(20);

  // Batch mode
  const [selectedZone,   setSelectedZone]   = useState("");
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [maxPerState,    setMaxPerState]    = useState(20);

  const [status,   setStatus]   = useState<"idle"|"loading"|"done"|"error">("idle");
  const [result,   setResult]   = useState<any>(null);
  const [progress, setProgress] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Load presets
  useEffect(() => {
    fetch(`${BASE}/api/scrape/presets`)
      .then(r => r.json())
      .then((d: Presets) => {
        setPresets(d);
        if (d.states?.length) setState(d.states[0]);
      })
      .catch(() => {});
  }, []);

  // When zone changes, select those states
  useEffect(() => {
    if (selectedZone && presets?.zones[selectedZone]) {
      setSelectedStates(presets.zones[selectedZone]);
    }
  }, [selectedZone, presets]);

  const toggleState = (s: string) =>
    setSelectedStates(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const drilldownAreas = state.includes("Lagos") ? (presets?.lagos_areas ?? [])
    : state.includes("Abuja") || state.includes("FCT") ? (presets?.abuja_areas ?? [])
    : [];

  const handleSingle = async () => {
    if (!category || !state) return;
    setStatus("loading"); setResult(null); setErrorMsg(""); setProgress("Searching Google Maps…");
    const location = useAreaDrill && area ? area : state;
    try {
      const res = await fetch(`${BASE}/api/scrape`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, location, max_results: maxResults }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed");
      setResult(data); setStatus("done");
    } catch (e: any) { setErrorMsg(e.message); setStatus("error"); }
    setProgress("");
  };

  const handleBatch = async () => {
    if (!category) return;
    setStatus("loading"); setResult(null); setErrorMsg("");
    const stateCount = selectedStates.length || presets?.states.length || 37;
    setProgress(`Scraping across ${stateCount} states — this takes a few minutes…`);
    try {
      const body: any = { category, max_per_city: maxPerState, delay_secs: 2 };
      if (selectedZone && !selectedStates.length) {
        body.region = selectedZone;
      } else if (selectedStates.length) {
        body.cities = selectedStates;
      }
      // else: no selection = all states on backend
      const res = await fetch(`${BASE}/api/scrape/batch`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed");
      setResult(data); setStatus("done");
    } catch (e: any) { setErrorMsg(e.message); setStatus("error"); }
    setProgress("");
  };

  const states = presets?.states ?? [];
  const zones  = presets?.zones  ?? {};
  const cats   = presets?.categories ?? [];

  return (
    <Card style={{ padding: "22px 24px", marginBottom: 20 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: colors.accentBg, border: `1px solid ${colors.accent}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>🗺</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: colors.ink, fontFamily: fonts.sans }}>Scrape from Google Maps</div>
          <div style={{ fontSize: 12, color: colors.inkD, fontFamily: fonts.sans }}>Pull businesses by category · all 36 Nigerian states + FCT</div>
        </div>
      </div>

      {/* Mode toggle */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, background: colors.surfaceB, borderRadius: 8, padding: 3, width: "fit-content" }}>
        {(["single", "batch"] as ScrapeMode[]).map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            padding: "7px 20px", borderRadius: 6, cursor: "pointer", border: "none",
            fontFamily: fonts.sans, fontSize: 12.5, fontWeight: mode === m ? 600 : 400,
            background: mode === m ? colors.surface : "transparent",
            color: mode === m ? colors.ink : colors.inkC,
            boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,0.2)" : "none",
            transition: "all 0.15s",
          }}>
            {m === "single" ? "Single State" : "Batch — Multiple States"}
          </button>
        ))}
      </div>

      {/* Category — shared between both modes */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: colors.inkD, fontFamily: fonts.mono, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Business Category</div>
        <input
          value={category} onChange={e => setCategory(e.target.value)}
          placeholder="e.g. pharmacy, bakery, clinic…"
          list="cat-list"
          style={{ width: "100%", boxSizing: "border-box", background: colors.surfaceB, border: `1px solid ${colors.border}`, borderRadius: 7, padding: "8px 12px", fontSize: 13, color: colors.ink, fontFamily: fonts.sans, outline: "none" }}
        />
        <datalist id="cat-list">{cats.map(c => <option key={c} value={c} />)}</datalist>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
          {cats.slice(0, 12).map(c => (
            <button key={c} onClick={() => setCategory(c)} style={{
              padding: "3px 9px", borderRadius: 5, cursor: "pointer",
              fontFamily: fonts.sans, fontSize: 11,
              background: category === c ? colors.accentBg : colors.surfaceC,
              border: `1px solid ${category === c ? colors.accent + "40" : colors.border}`,
              color: category === c ? colors.accent : colors.inkC, transition: "all 0.12s",
            }}>{c}</button>
          ))}
        </div>
      </div>

      {/* ── Single State Mode ── */}
      {mode === "single" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "flex-end", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: colors.inkD, fontFamily: fonts.mono, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                State ({states.length} available)
              </div>
              <select value={state} onChange={e => { setState(e.target.value); setUseAreaDrill(false); setArea(""); }}
                style={{ width: "100%", background: colors.surfaceB, border: `1px solid ${colors.border}`, borderRadius: 7, padding: "8px 11px", fontSize: 13, color: colors.ink, fontFamily: fonts.sans, outline: "none", cursor: "pointer" }}>
                {states.length > 0
                  ? states.map(s => <option key={s} value={s}>{s}</option>)
                  : <option value="FCT Abuja">FCT Abuja</option>
                }
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: colors.inkD, fontFamily: fonts.mono, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Max</div>
              <select value={maxResults} onChange={e => setMaxResults(Number(e.target.value))}
                style={{ background: colors.surfaceB, border: `1px solid ${colors.border}`, borderRadius: 7, padding: "8px 11px", fontSize: 13, color: colors.ink, fontFamily: fonts.sans, outline: "none", cursor: "pointer" }}>
                {[10, 20, 30, 50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <Btn variant="primary" onClick={handleSingle} disabled={!category || !state || status === "loading"}>
              {status === "loading" && mode === "single" ? "Scraping…" : "⬡ Scrape"}
            </Btn>
          </div>

          {/* Area drilldown for Lagos / Abuja */}
          {drilldownAreas.length > 0 && (
            <div style={{ padding: "12px 14px", background: colors.surfaceB, borderRadius: 8, border: `1px solid ${colors.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: useAreaDrill ? 10 : 0 }}>
                <div onClick={() => setUseAreaDrill(p => !p)} style={{
                  width: 18, height: 18, borderRadius: 4, cursor: "pointer",
                  background: useAreaDrill ? colors.accent : colors.surfaceD,
                  border: `1px solid ${useAreaDrill ? colors.accent : colors.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  {useAreaDrill && <span style={{ color: "#000", fontSize: 11, fontWeight: 700 }}>✓</span>}
                </div>
                <span style={{ fontSize: 12.5, color: colors.inkB, fontFamily: fonts.sans, cursor: "pointer" }} onClick={() => setUseAreaDrill(p => !p)}>
                  Drill down by area within {state.replace(" State", "").replace(" Abuja", "")}
                </span>
              </div>
              {useAreaDrill && (
                <div>
                  <div style={{ fontSize: 11, color: colors.inkD, fontFamily: fonts.mono, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Select Area</div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {drilldownAreas.map(a => (
                      <button key={a} onClick={() => setArea(a)} style={{
                        padding: "4px 10px", borderRadius: 5, cursor: "pointer",
                        fontFamily: fonts.sans, fontSize: 11.5,
                        background: area === a ? colors.accentBg : colors.surface,
                        border: `1px solid ${area === a ? colors.accent + "40" : colors.border}`,
                        color: area === a ? colors.accent : colors.inkC, transition: "all 0.12s",
                      }}>{a}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Batch Mode ── */}
      {mode === "batch" && (
        <div>
          {/* Zone quick-select */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: colors.inkD, fontFamily: fonts.mono, marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Quick Select by Zone (or pick states manually below)
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button onClick={() => { setSelectedZone(""); setSelectedStates([]); }} style={{
                padding: "5px 12px", borderRadius: 6, cursor: "pointer",
                fontFamily: fonts.sans, fontSize: 12,
                background: !selectedZone ? colors.accentBg : colors.surfaceC,
                border: `1px solid ${!selectedZone ? colors.accent + "40" : colors.border}`,
                color: !selectedZone ? colors.accent : colors.inkC,
              }}>All Nigeria ({states.length})</button>
              {Object.entries(zones).map(([zone, zoneStates]) => (
                <button key={zone} onClick={() => setSelectedZone(zone === selectedZone ? "" : zone)} style={{
                  padding: "5px 12px", borderRadius: 6, cursor: "pointer",
                  fontFamily: fonts.sans, fontSize: 12,
                  background: selectedZone === zone ? colors.accentBg : colors.surfaceC,
                  border: `1px solid ${selectedZone === zone ? colors.accent + "40" : colors.border}`,
                  color: selectedZone === zone ? colors.accent : colors.inkC, transition: "all 0.12s",
                }}>{zone} ({zoneStates.length})</button>
              ))}
            </div>
          </div>

          {/* Individual state checkboxes */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
              <div style={{ fontSize: 11, color: colors.inkD, fontFamily: fonts.mono, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                States {selectedStates.length > 0 ? `(${selectedStates.length} selected)` : "(all selected by default)"}
              </div>
              {selectedStates.length > 0 && (
                <button onClick={() => setSelectedStates([])} style={{ background: "none", border: "none", color: colors.inkD, fontSize: 11, cursor: "pointer", fontFamily: fonts.sans }}>
                  Clear
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", maxHeight: 140, overflowY: "auto", padding: "2px 0" }}>
              {states.map(s => {
                const selected = selectedStates.includes(s);
                return (
                  <button key={s} onClick={() => toggleState(s)} style={{
                    padding: "4px 10px", borderRadius: 5, cursor: "pointer",
                    fontFamily: fonts.sans, fontSize: 11.5,
                    background: selected ? colors.accentBg : colors.surfaceC,
                    border: `1px solid ${selected ? colors.accent + "40" : colors.border}`,
                    color: selected ? colors.accent : colors.inkC, transition: "all 0.12s",
                  }}>{s.replace(" State", "").replace(" Abuja", "")}</button>
                );
              })}
            </div>
          </div>

          {/* Max per state + run */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 12, color: colors.inkD, fontFamily: fonts.sans }}>Max per state:</div>
            <select value={maxPerState} onChange={e => setMaxPerState(Number(e.target.value))}
              style={{ background: colors.surfaceB, border: `1px solid ${colors.border}`, borderRadius: 7, padding: "7px 10px", fontSize: 13, color: colors.ink, fontFamily: fonts.sans, outline: "none", cursor: "pointer" }}>
              {[10, 20, 30].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <Btn variant="primary" onClick={handleBatch} disabled={!category || status === "loading"}>
              {status === "loading" && mode === "batch" ? "Running…" : `⬡ Run Batch — ${selectedStates.length || states.length} States`}
            </Btn>
          </div>

          {/* Search cost warning */}
          <div style={{ marginTop: 12, padding: "9px 12px", background: colors.amberBg, border: `1px solid ${colors.amber}20`, borderRadius: 7, fontSize: 12, color: colors.amber, fontFamily: fonts.sans }}>
            ⚠ Uses {selectedStates.length || states.length} of your 100 free SerpAPI searches/month
          </div>
        </div>
      )}

      {/* Progress */}
      {status === "loading" && progress && (
        <div style={{ marginTop: 14, padding: "10px 14px", background: colors.surfaceB, borderRadius: 7, fontSize: 12, color: colors.inkC, fontFamily: fonts.mono }}>
          ⟳ {progress}
        </div>
      )}

      {/* Results */}
      {status === "done" && result && <ResultCard result={result} isBatch={mode === "batch"} />}

      {/* Error */}
      {status === "error" && (
        <div style={{ marginTop: 14, background: colors.redBg, border: `1px solid ${colors.red}20`, borderRadius: 9, padding: "12px 16px", fontSize: 13, color: colors.red, fontFamily: fonts.sans }}>
          ✗ {errorMsg}
          {errorMsg.includes("SERPAPI_KEY") && (
            <div style={{ fontSize: 12, color: colors.inkC, marginTop: 6 }}>
              Add <code style={{ fontFamily: fonts.mono, color: colors.accent }}>SERPAPI_KEY</code> to Render env vars · <a href="https://serpapi.com" target="_blank" rel="noopener noreferrer" style={{ color: colors.accent }}>Get free key at serpapi.com →</a>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 16, padding: "9px 12px", background: colors.surfaceB, borderRadius: 7, fontSize: 11.5, color: colors.inkD, fontFamily: fonts.sans }}>
        Requires <code style={{ fontFamily: fonts.mono, color: colors.accent }}>SERPAPI_KEY</code> in Render env vars · 100 free searches/month · <a href="https://serpapi.com" target="_blank" rel="noopener noreferrer" style={{ color: colors.accent }}>serpapi.com</a>
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
      return { name, phone_number: phone, business_name: row.business_name ?? row.company ?? "", industry: row.industry ?? row.category ?? "", location: row.location ?? row.city ?? row.state ?? "", status: "PENDING" };
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
        <div style={{ fontSize: 11.5, color: colors.inkD, fontFamily: fonts.sans, marginBottom: 10 }}>Drag & drop CSV here or</div>
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

// ── Page ──────────────────────────────────────────────────────────
export default function ImportPage() {
  return (
    <Shell>
      <div style={{ padding: "28px 32px" }}>
        <SectionHeader
          title="Import Leads"
          sub="Scrape Google Maps by state across all of Nigeria, or upload a CSV — all leads land as PENDING"
        />
        <ScraperSection />
        <CsvSection />
      </div>
    </Shell>
  );
}
