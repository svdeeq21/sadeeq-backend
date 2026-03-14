"use client";
import { useState } from "react";
import { Shell } from "@/components/layout/Shell";
import { Card, Btn, SectionHeader } from "@/components/ui";
import { colors, fonts } from "@/lib/tokens";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

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

function normalizePhone(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

export default function ImportPage() {
  const [dragging, setDragging]   = useState(false);
  const [rows, setRows]           = useState<Record<string, string>[]>([]);
  const [headers, setHeaders]     = useState<string[]>([]);
  const [status, setStatus]       = useState<"idle" | "loading" | "done" | "error">("idle");
  const [inserted, setInserted]   = useState(0);
  const [skipped, setSkipped]     = useState(0);
  const [errorMsg, setErrorMsg]   = useState("");

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const parsed = parseCsv(text);
      setRows(parsed);
      setHeaders(parsed.length > 0 ? Object.keys(parsed[0]) : []);
      setStatus("idle");
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".csv")) handleFile(file);
  };

  const handleImport = async () => {
    if (!rows.length) return;
    setStatus("loading");
    let ok = 0, skip = 0;

    const batch = rows.map(row => {
      // Map flexible CSV column names to schema
      const phone = normalizePhone(
        row.phone_number ?? row.phone ?? row.whatsapp ?? row.mobile ?? ""
      );
      const name  = row.name ?? row.full_name ?? row.contact_name ?? "Unknown";
      const biz   = row.business_name ?? row.business ?? row.company ?? "";
      const ind   = row.industry ?? row.category ?? row.type ?? "";
      const loc   = row.location ?? row.city ?? row.area ?? "";

      if (!phone || phone.length < 7) { skip++; return null; }
      return { name, phone_number: phone, business_name: biz, industry: ind, location: loc, status: "PENDING" };
    }).filter(Boolean);

    try {
      const res = await fetch(`${SB_URL}/rest/v1/leads`, {
        method: "POST",
        headers: {
          apikey: SB_KEY,
          Authorization: `Bearer ${SB_KEY}`,
          "Content-Type": "application/json",
          Prefer: "resolution=ignore-duplicates,return=minimal",
        },
        body: JSON.stringify(batch),
      });
      if (!res.ok) throw new Error(await res.text());
      ok = batch.length;
      setInserted(ok); setSkipped(skip);
      setStatus("done");
    } catch (e: any) {
      setErrorMsg(e.message ?? "Unknown error");
      setStatus("error");
    }
  };

  return (
    <Shell>
      <div style={{ padding: "28px 32px" }}>
        <SectionHeader title="Import Leads" sub="Upload CSV files to add leads to the outreach pipeline" />

        {/* Drop zone */}
        <Card style={{
          padding: "40px 0", textAlign: "center", marginBottom: 20,
          border: `2px dashed ${dragging ? colors.accent : colors.border}`,
          background: dragging ? colors.accentBg : colors.surface,
          transition: "all 0.2s",
        }}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <div style={{ fontSize: 32, marginBottom: 10 }}>↓</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: colors.ink, fontFamily: fonts.sans, marginBottom: 6 }}>
            Drag & drop a CSV file here
          </div>
          <div style={{ fontSize: 12.5, color: colors.inkD, fontFamily: fonts.sans, marginBottom: 18 }}>
            or click to browse · Required columns: <code style={{ fontFamily: fonts.mono, color: colors.accent }}>name</code>, <code style={{ fontFamily: fonts.mono, color: colors.accent }}>phone_number</code>
          </div>
          <label style={{ cursor: "pointer" }}>
            <input type="file" accept=".csv" style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            <Btn variant="ghost">Browse Files</Btn>
          </label>
        </Card>

        {/* CSV preview */}
        {rows.length > 0 && (
          <Card style={{ padding: "20px 22px", marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: colors.ink, fontFamily: fonts.sans }}>
                Preview — {rows.length} rows detected
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {status === "done" && (
                  <span style={{ fontSize: 12, color: colors.green, fontFamily: fonts.mono }}>
                    ✓ {inserted} imported · {skipped} skipped
                  </span>
                )}
                {status === "error" && (
                  <span style={{ fontSize: 12, color: colors.red, fontFamily: fonts.mono }}>
                    ✗ {errorMsg}
                  </span>
                )}
                <Btn variant="primary" onClick={handleImport} disabled={status === "loading"}>
                  {status === "loading" ? "Importing…" : `↑ Import ${rows.length} Leads`}
                </Btn>
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: fonts.sans }}>
                <thead>
                  <tr>
                    {headers.map(h => (
                      <th key={h} style={{
                        textAlign: "left", padding: "8px 12px",
                        borderBottom: `1px solid ${colors.border}`,
                        fontSize: 10.5, fontWeight: 600, color: colors.inkD,
                        fontFamily: fonts.mono, textTransform: "uppercase", letterSpacing: "0.06em",
                        background: colors.surfaceB,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 8).map((row, i) => (
                    <tr key={i}>
                      {headers.map(h => (
                        <td key={h} style={{
                          padding: "9px 12px", borderBottom: `1px solid ${colors.border}`,
                          color: colors.inkB, maxWidth: 200, overflow: "hidden",
                          textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{row[h] || "—"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 8 && (
                <div style={{ padding: "10px 12px", fontSize: 11.5, color: colors.inkD, fontFamily: fonts.mono }}>
                  + {rows.length - 8} more rows not shown
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Instructions */}
        <Card style={{ padding: "20px 22px" }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: colors.inkD, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14, fontFamily: fonts.mono }}>
            CSV Format Guide
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: colors.green, fontFamily: fonts.mono, marginBottom: 8 }}>Required</div>
              {["name", "phone_number"].map(col => (
                <div key={col} style={{ fontSize: 12, color: colors.inkB, fontFamily: fonts.mono, marginBottom: 4 }}>
                  · {col}
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: colors.inkD, fontFamily: fonts.mono, marginBottom: 8 }}>Optional</div>
              {["business_name", "industry", "location", "whatsapp", "phone", "company", "city"].map(col => (
                <div key={col} style={{ fontSize: 12, color: colors.inkD, fontFamily: fonts.mono, marginBottom: 4 }}>
                  · {col}
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 14, padding: "10px 14px", background: colors.surfaceB, borderRadius: 8, fontSize: 12, color: colors.inkC, fontFamily: fonts.sans, lineHeight: 1.6 }}>
            Phone numbers will be cleaned automatically. Duplicates are silently ignored. 
            Imported leads enter the pipeline at <span style={{ color: colors.accent, fontFamily: fonts.mono }}>PENDING</span> status.
          </div>
        </Card>
      </div>
    </Shell>
  );
}
