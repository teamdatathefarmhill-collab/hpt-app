import { useState, useEffect } from "react";

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxOualqyMiSlynwZ_v1jhJu0OJJuTwgsIPk7IqN6Xji3I2BIJL9jlbeneKjsuARi_ekkw/exec";

async function gasFetch(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: "follow" });
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const buatBaris = (jumlah, varianMap) => {
  const abjad = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return Array.from({ length: jumlah }, (_, i) => {
    const label = i < 26 ? abjad[i] : abjad[Math.floor(i / 26) - 1] + abjad[i % 26];
    return { baris: label, varian: varianMap[label] || "–" };
  });
};

const MOCK_GH_DATA = {
  "TOHUDAN 2": {
    periode: "26.1", tanam: "2026-02-09",
    baris: buatBaris(21, { A:"Aruni",B:"Aruni",C:"Aruni",D:"Greeniegal",E:"Greeniegal",F:"Aruni",G:"Midori",H:"Aruni",I:"Sarasuka",J:"Greeniegal",K:"Greeniegal",L:"Midori",M:"Midori",N:"Midori",O:"Sarasuka",P:"Sarasuka",Q:"Greeniegal",R:"Greeniegal",S:"Greeniegal",T:"Midori",U:"Greeniegal" }),
  },
  "COLOMADU 1": {
    periode: "26.1", tanam: "2026-02-09",
    baris: buatBaris(18, { A:"Servo F1",B:"Servo F1",C:"Tombatu F1",D:"Tombatu F1",E:"Inko F1",F:"Inko F1",G:"Servo F1",H:"Tombatu F1",I:"Inko F1",J:"Servo F1",K:"Tombatu F1",L:"Inko F1",M:"Servo F1",N:"Tombatu F1",O:"Inko F1",P:"Servo F1",Q:"Tombatu F1",R:"Inko F1" }),
  },
  "BERGAS 1": { periode: "26.1", tanam: "2026-02-15", baris: buatBaris(18, {}) },
  "SAWAHAN 1": { periode: "26.1", tanam: "2026-01-20", baris: buatBaris(42, {}) },
};

// ─── Mock data Semai (placeholder — tunggu info tim) ──────────────────────────
const MOCK_SEMAI_DATA = {
  "SEMAI 1": { lokasi: "Blok A", tanam: "2026-02-20", keterangan: "Batch 26.1" },
  "SEMAI 2": { lokasi: "Blok B", tanam: "2026-02-25", keterangan: "Batch 26.1" },
  "SEMAI 3": { lokasi: "Blok C", tanam: "2026-03-01", keterangan: "Batch 26.2" },
};

const LS_KEY = `hpt_${new Date().toLocaleDateString("id-ID")}`;
function getSubmittedToday() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); }
  catch { return []; }
}
function markSubmitted(gh) {
  const list = getSubmittedToday();
  if (!list.includes(gh)) localStorage.setItem(LS_KEY, JSON.stringify([...list, gh]));
}

function hitungHST(tgl) {
  return Math.floor((new Date() - new Date(tgl)) / 86400000);
}

function hstColor(hst) {
  if (hst <= 40) return { bg: "rgba(76,175,80,0.15)", border: "rgba(76,175,80,0.4)", text: "#81c784" };
  if (hst <= 50) return { bg: "rgba(255,179,0,0.12)", border: "rgba(255,179,0,0.35)", text: "#FFB300" };
  return { bg: "rgba(229,57,53,0.12)", border: "rgba(229,57,53,0.35)", text: "#ef9a9a" };
}

const todayISO   = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
const todayLabel = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

// ─── Daftar Hama ─────────────────────────────────────────────────────────────
const HAMA_LIST = [
  { key: "kutu_kebul",   label: "Kutu Kebul",      icon: "🦟", color: "#FF7043", unit: "ekor" },
  { key: "thrips",       label: "Thrips",           icon: "🐛", color: "#FFB300", unit: "ekor" },
  { key: "ulat_kupu",    label: "Ulat/Kupu-kupu",  icon: "🦋", color: "#AB47BC", unit: "ekor" },
  { key: "tungau",       label: "Tungau",           icon: "🕷️", color: "#E53935", unit: "per daun" },
  { key: "tikus",        label: "Tikus",            icon: "🐭", color: "#795548", unit: "ekor" },
  { key: "aphids",       label: "Aphids",           icon: "🐜", color: "#26A69A", unit: "ekor" },
  { key: "ulat_kompos",  label: "Ulat Kompos",      icon: "🪱", color: "#8D6E63", unit: "ekor" },
  { key: "kutu_putih",   label: "Kutu Putih",       icon: "🤍", color: "#B0BEC5", unit: "ekor" },
];

// Hama khusus Semai (subset)
const HAMA_SEMAI = ["thrips", "kutu_kebul", "tungau"];

// ─── Daftar Penyakit ──────────────────────────────────────────────────────────
// PM & DM: insidensi + skor 1-4 (jumlah tanaman per tingkat keparahan)
// GSB: jumlah tanaman saja
const PENYAKIT_SKOR = [
  { key: "dm",  label: "DM",  fullLabel: "Downy Mildew",      icon: "💧", color: "#1E88E5", hasSkor: true },
  { key: "pm",  label: "PM",  fullLabel: "Powdery Mildew",    icon: "⬜", color: "#90CAF9", hasSkor: true },
];
const PENYAKIT_SIMPLE = [
  { key: "gsb", label: "GSB", fullLabel: "Gummy Stem Blight", icon: "⚠️", color: "#EF5350" },
];

function initHPTData() {
  const hama = {};
  HAMA_LIST.forEach(h => { hama[h.key] = ""; });
  const penyakit = {};
  PENYAKIT_SKOR.forEach(p => {
    penyakit[p.key] = { insidensi: "", skor1: "", skor2: "", skor3: "", skor4: "" };
  });
  PENYAKIT_SIMPLE.forEach(p => {
    penyakit[p.key] = { jumlah: "" };
  });
  return { hama, penyakit, keterangan: "" };
}



// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [step, setStep]             = useState(1);
  const [ghData, setGhData]         = useState({});
  const [loadingGH, setLoadingGH]   = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isOnline, setIsOnline]     = useState(navigator.onLine);

  const [selectedGH, setSelectedGH] = useState("");
  const [activeTab, setActiveTab]   = useState("produksi"); // "produksi" | "semai"
  const [operator, setOperator]     = useState("");
  const [hptData, setHptData]       = useState(initHPTData());
  const [syncing, setSyncing]       = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const [submittedToday, setSubmittedToday] = useState(getSubmittedToday());
  const [showWarning, setShowWarning]       = useState(false);
  const [pendingGH, setPendingGH]           = useState("");

  useEffect(() => {
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => { fetchGHData(); }, []);

  const fetchGHData = async () => {
    setLoadingGH(true);
    try {
      const data = await gasFetch(`${SCRIPT_URL}?action=getGH`);
      if (data && typeof data === "object" && !data.error) {
        // GAS returns { produksi: {...}, semai: {...} }
        setGhData({
          produksi: data.produksi || {},
          semai: data.semai || {},
        });
        setIsDemoMode(false);
      } else throw new Error("invalid");
    } catch {
      // Fallback ke mock data
      setGhData({
        produksi: MOCK_GH_DATA,
        semai: MOCK_SEMAI_DATA,
      });
      setIsDemoMode(true);
    } finally {
      setLoadingGH(false);
    }
  };

  const ghAktif = Object.entries(ghData.produksi || {});
  const semaiAktif = Object.entries(ghData.semai || {});

  const handleSelectGH = (gh) => {
    if (submittedToday.includes(gh)) {
      setPendingGH(gh);
      setShowWarning(true);
    } else {
      doSelectGH(gh);
    }
  };

  const doSelectGH = (gh) => {
    setSelectedGH(gh);
    setHptData(initHPTData());
    setShowWarning(false);
    setPendingGH("");
  };

  const ghInfo = activeTab === "semai"
    ? (ghData.semai || {})[selectedGH]
    : (ghData.produksi || {})[selectedGH];
  const hst  = ghInfo?.tanam ? hitungHST(ghInfo.tanam) : null;
  const hstC = hst !== null ? hstColor(hst) : null;

  const canProceedStep2 = operator.trim().length >= 2;

  // Count isian
  const totalHamaIsi     = HAMA_LIST.filter(h => hptData.hama[h.key] !== "").length;
  const totalPenyakitIsi = [...PENYAKIT_SKOR, ...PENYAKIT_SIMPLE].filter(p => {
    const pd = hptData.penyakit[p.key];
    return pd && Object.values(pd).some(v => v !== "" && v !== "0");
  }).length;

  const handleHama = (key, val) => {
    if (val === "" || /^\d+$/.test(val)) {
      setHptData(d => ({ ...d, hama: { ...d.hama, [key]: val } }));
    }
  };

  const handlePenyakitField = (key, field, val) => {
    if (val === "" || /^\d*\.?\d*$/.test(val)) {
      setHptData(d => ({ ...d, penyakit: { ...d.penyakit, [key]: { ...d.penyakit[key], [field]: val } } }));
    }
  };

  const resetForm = () => {
    setStep(1); setSelectedGH(""); setOperator(""); setActiveTab("produksi");
    setHptData(initHPTData()); setSyncing(false);
    setSubmitError(null);
  };

  const handleSubmit = async () => {
    if (isDemoMode) { markSubmitted(selectedGH); setSubmittedToday(getSubmittedToday()); setStep(4); return; }
    setSyncing(true); setSubmitError(null);
    try {
      const payload = {
        action: "submitHPT",
        tipe: activeTab,
        tanggal: todayISO,
        gh: selectedGH,
        periode: ghInfo?.periode || "",
        hst,
        operator,
        ...Object.fromEntries(HAMA_LIST.map(h => [`hama_${h.key}`, hptData.hama[h.key] || "0"])),
        ...Object.fromEntries(PENYAKIT_SKOR.flatMap(p => [
          [`penyakit_${p.key}_insidensi`, hptData.penyakit[p.key]?.insidensi || "0"],
          [`penyakit_${p.key}_skor1`,     hptData.penyakit[p.key]?.skor1     || "0"],
          [`penyakit_${p.key}_skor2`,     hptData.penyakit[p.key]?.skor2     || "0"],
          [`penyakit_${p.key}_skor3`,     hptData.penyakit[p.key]?.skor3     || "0"],
          [`penyakit_${p.key}_skor4`,     hptData.penyakit[p.key]?.skor4     || "0"],
        ])),
        ...Object.fromEntries(PENYAKIT_SIMPLE.map(p => [
          [`penyakit_${p.key}`, hptData.penyakit[p.key]?.jumlah || "0"],
        ])),
        keterangan: hptData.keterangan,
      };
      const params = new URLSearchParams(payload).toString();
      const result = await gasFetch(`${SCRIPT_URL}?${params}`);
      if (result?.status === "ok" || result?.success) {
        markSubmitted(selectedGH);
        setSubmittedToday(getSubmittedToday());
        setStep(4);
      } else {
        throw new Error(result?.message || "Gagal menyimpan");
      }
    } catch (e) {
      setSubmitError(e.message || "Terjadi kesalahan, coba lagi.");
    } finally {
      setSyncing(false);
    }
  };

  // ─── Styles ────────────────────────────────────────────────────────────────
  const S = {
    wrap: {
      minHeight: "100vh",
      background: "linear-gradient(160deg, #0a0f0a 0%, #0d1a0e 50%, #0a120d 100%)",
      display: "flex", justifyContent: "center", alignItems: "flex-start",
      padding: "0 0 40px",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    },
    card: {
      width: "100%", maxWidth: 480,
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 20, overflow: "hidden",
      marginTop: 0,
    },
    header: {
      padding: "16px 16px 12px",
      background: "rgba(0,0,0,0.3)",
      borderBottom: "1px solid rgba(255,255,255,0.07)",
    },
    body: { padding: "16px" },
    sectionTitle: {
      fontSize: 11, fontWeight: 700, letterSpacing: 2,
      textTransform: "uppercase", color: "rgba(255,255,255,0.3)",
      marginBottom: 10,
    },
  };

  return (
    <div style={S.wrap}>
      <div style={S.card}>

        {/* ── Header ── */}
        <div style={S.header}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: -0.5 }}>
                🌿 Form HPT
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{todayLabel}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              {isDemoMode && (
                <span style={{ fontSize: 10, background: "rgba(255,179,0,0.15)", border: "1px solid rgba(255,179,0,0.3)", color: "#FFB300", padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>
                  DEMO
                </span>
              )}
              <span style={{ fontSize: 10, background: isOnline ? "rgba(76,175,80,0.15)" : "rgba(244,67,54,0.15)", border: `1px solid ${isOnline ? "rgba(76,175,80,0.3)" : "rgba(244,67,54,0.3)"}`, color: isOnline ? "#81c784" : "#ef9a9a", padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>
                {isOnline ? "● Online" : "● Offline"}
              </span>
            </div>
          </div>

          {/* Step indicator */}
          <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
            {["Pilih GH","Operator","Input HPT","Selesai"].map((label, i) => {
              const s = i + 1;
              const active = step === s, done = step > s;
              return (
                <div key={s} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{
                    height: 3, borderRadius: 2, marginBottom: 4,
                    background: done ? "#4CAF50" : active ? "#81c784" : "rgba(255,255,255,0.1)",
                    transition: "background 0.3s",
                  }} />
                  <div style={{ fontSize: 9, color: active ? "#81c784" : done ? "#4CAF50" : "rgba(255,255,255,0.25)", fontWeight: active ? 700 : 500 }}>
                    {label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={S.body}>

          {/* ══ STEP 1 — Pilih GH ══ */}
          {step === 1 && (
            <div>
              {/* Tab toggle */}
              <div style={{ display: "flex", gap: 6, marginBottom: 14, background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 4 }}>
                {[
                  { key: "produksi", label: "🌿 GH Produksi" },
                  { key: "semai",    label: "🌱 Semai" },
                ].map(tab => (
                  <button key={tab.key} onClick={() => { setActiveTab(tab.key); setSelectedGH(""); }} style={{
                    flex: 1, padding: "8px 0",
                    background: activeTab === tab.key ? "rgba(76,175,80,0.2)" : "transparent",
                    border: `1px solid ${activeTab === tab.key ? "rgba(76,175,80,0.4)" : "transparent"}`,
                    borderRadius: 8, cursor: "pointer",
                    color: activeTab === tab.key ? "#81c784" : "rgba(255,255,255,0.4)",
                    fontSize: 13, fontWeight: 700, transition: "all 0.2s",
                  }}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Badge info semai */}
              {activeTab === "semai" && (
                <div style={{ marginBottom: 12, padding: "8px 12px", background: "rgba(76,175,80,0.07)", border: "1px solid rgba(76,175,80,0.25)", borderRadius: 9, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14 }}>🌱</span>
                  <span style={{ fontSize: 11, color: "#81c784" }}>HPT Semai: Thrips, Kutu Kebul, Tungau · DM, PM, GSB</span>
                </div>
              )}

              {/* GH Produksi list */}
              {activeTab === "produksi" && (
                loadingGH ? (
                  <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.3)", fontSize: 13 }}>⏳ Memuat data GH...</div>
                ) : ghAktif.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Tidak ada GH aktif saat ini.</div>
                ) : (
                  <>
                    <div style={{ fontSize: 11, color: "#81c784", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
                      GH Aktif ({ghAktif.length})
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {ghAktif.map(([gh, info]) => {
                        const h = info.tanam ? hitungHST(info.tanam) : null;
                        const hc = h !== null ? hstColor(h) : null;
                        const done = submittedToday.includes(gh);
                        const selected = selectedGH === gh;
                        return (
                          <button key={gh} onClick={() => handleSelectGH(gh)} style={{
                            padding: "12px 12px 10px",
                            background: selected ? "rgba(76,175,80,0.12)" : done ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)",
                            border: `1px solid ${selected ? "rgba(76,175,80,0.45)" : done ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.1)"}`,
                            borderRadius: 14, cursor: "pointer", textAlign: "left",
                            transition: "all 0.2s", opacity: done ? 0.7 : 1,
                          }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: selected ? "#81c784" : "#fff", marginBottom: 3 }}>{gh}</div>
                            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 10 }}>
                              P{info.periode}
                            </div>
                            {/* HST Badge */}
                            <div style={{
                              display: "inline-block", padding: "5px 10px", borderRadius: 8,
                              background: done ? "rgba(76,175,80,0.15)" : (hc ? hc.bg : "rgba(255,255,255,0.06)"),
                              border: `1px solid ${done ? "rgba(76,175,80,0.3)" : (hc ? hc.border : "rgba(255,255,255,0.1)")}`,
                            }}>
                              {done
                                ? <span style={{ fontSize: 12, fontWeight: 700, color: "#81c784" }}>✓ Done</span>
                                : h !== null
                                  ? <span style={{ fontSize: 14, fontWeight: 800, color: hc.text }}>{h} HST</span>
                                  : <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>– HST</span>
                              }
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )
              )}

              {/* Semai list */}
              {activeTab === "semai" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {semaiAktif.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Tidak ada data semai.</div>
                  ) : semaiAktif.map(([nama, info]) => {
                    const done = submittedToday.includes(nama);
                    const selected = selectedGH === nama;
                    const hss = info.tanam ? hitungHST(info.tanam) : null;
                    return (
                      <button key={nama} onClick={() => handleSelectGH(nama)} style={{
                        padding: "12px 14px",
                        background: selected ? "rgba(76,175,80,0.12)" : done ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${selected ? "rgba(76,175,80,0.45)" : done ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.1)"}`,
                        borderRadius: 12, cursor: "pointer",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        transition: "all 0.2s", opacity: done ? 0.6 : 1,
                      }}>
                        <div style={{ textAlign: "left" }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: selected ? "#81c784" : "#fff" }}>{nama}</div>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
                            Periode {info.periode}{info.hssRef ? ` · Ref: ${info.hssRef} HSS` : ""}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          {done && <span style={{ fontSize: 10, color: "#81c784", background: "rgba(76,175,80,0.1)", border: "1px solid rgba(76,175,80,0.3)", borderRadius: 20, padding: "2px 7px" }}>✓ Done</span>}
                          {hss !== null && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#81c784", background: "rgba(76,175,80,0.1)", border: "1px solid rgba(76,175,80,0.25)", borderRadius: 20, padding: "3px 9px" }}>{hss} HSS</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Warning double submit */}
              {showWarning && (
                <div style={{ marginTop: 12, padding: 14, background: "rgba(255,179,0,0.08)", border: "1px solid rgba(255,179,0,0.3)", borderRadius: 12 }}>
                  <div style={{ fontSize: 13, color: "#FFB300", fontWeight: 600, marginBottom: 8 }}>⚠️ {pendingGH} sudah disubmit hari ini</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 12 }}>Yakin ingin input ulang?</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setShowWarning(false)} style={{ flex: 1, padding: "9px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9, color: "rgba(255,255,255,0.6)", fontSize: 12, cursor: "pointer" }}>Batal</button>
                    <button onClick={() => doSelectGH(pendingGH)} style={{ flex: 2, padding: "9px", background: "rgba(255,179,0,0.15)", border: "1px solid rgba(255,179,0,0.4)", borderRadius: 9, color: "#FFB300", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Lanjut Input Ulang</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ STEP 2 — Operator ══ */}
          {step === 2 && (
            <div>
              {/* Info GH */}
              {ghInfo && hst !== null && hstC && (
                <div style={{ padding: "10px 14px", background: "rgba(76,175,80,0.06)", border: "1px solid rgba(76,175,80,0.15)", borderRadius: 12, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#81c784" }}>{selectedGH}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Periode {ghInfo.periode}</div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: hstC.text, background: hstC.bg, border: `1px solid ${hstC.border}`, borderRadius: 20, padding: "4px 12px" }}>
                    {hst} HST
                  </span>
                </div>
              )}

              <div style={S.sectionTitle}>Nama Operator</div>
              <input
                type="text"
                value={operator}
                onChange={e => setOperator(e.target.value)}
                placeholder="Masukkan nama operator..."
                style={{
                  width: "100%", padding: "13px 14px",
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${operator.length >= 2 ? "rgba(76,175,80,0.4)" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: 12, color: "#fff", fontSize: 15, outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}

          {/* ══ STEP 3 — Input HPT ══ */}
          {step === 3 && (
            <div>
              {/* Info bar */}
              <div style={{ padding: "9px 12px", background: "rgba(76,175,80,0.06)", border: "1px solid rgba(76,175,80,0.12)", borderRadius: 10, marginBottom: activeTab === "semai" ? 8 : 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 12, color: "#81c784", fontWeight: 600 }}>{selectedGH}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{operator} · {activeTab === "semai" ? `${hst} HSS` : `${hst} HST`}</div>
              </div>
              {activeTab === "semai" && (
                <div style={{ marginBottom: 14, padding: "7px 12px", background: "rgba(76,175,80,0.06)", border: "1px solid rgba(76,175,80,0.2)", borderRadius: 8 }}>
                  <span style={{ fontSize: 11, color: "#81c784" }}>🌱 Menampilkan kategori HPT khusus Semai</span>
                </div>
              )}

              {/* ── HAMA ── */}
              <div style={S.sectionTitle}>🐛 Populasi Hama</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 20 }}>
                {HAMA_LIST.filter(h => activeTab === "semai" ? HAMA_SEMAI.includes(h.key) : true).map(h => {
                  const val = hptData.hama[h.key];
                  const hasVal = val !== "" && val !== "0";
                  return (
                    <div key={h.key} style={{
                      background: hasVal ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.025)",
                      border: `1px solid ${hasVal ? h.color + "55" : "rgba(255,255,255,0.07)"}`,
                      borderRadius: 10, padding: "9px 10px",
                      transition: "all 0.2s",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
                        <span style={{ fontSize: 15 }}>{h.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: hasVal ? "#fff" : "rgba(255,255,255,0.55)" }}>{h.label}</div>
                          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>{h.unit}</div>
                        </div>
                      </div>
                      <input
                        type="number" inputMode="numeric"
                        value={val}
                        onChange={e => handleHama(h.key, e.target.value)}
                        placeholder="0"
                        style={{
                          width: "100%", padding: "7px 10px",
                          background: "rgba(0,0,0,0.3)",
                          border: `1px solid ${hasVal ? h.color : "rgba(255,255,255,0.12)"}`,
                          borderRadius: 7, color: hasVal ? h.color : "#fff",
                          fontSize: 15, fontWeight: 700, outline: "none",
                          textAlign: "center", boxSizing: "border-box",
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* ── PENYAKIT (DM & PM) ── */}
              <div style={S.sectionTitle}>🦠 Penyakit — Insidensi & Skor</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                {PENYAKIT_SKOR.map(p => {
                  const pd = hptData.penyakit[p.key];
                  const active = pd && Object.values(pd).some(v => v !== "" && v !== "0");
                  const inputStyle = (field) => ({
                    width: "100%", padding: "7px 8px",
                    background: "rgba(0,0,0,0.3)",
                    border: `1px solid ${pd?.[field] && pd[field] !== "0" ? p.color : "rgba(255,255,255,0.1)"}`,
                    borderRadius: 7, color: pd?.[field] && pd[field] !== "0" ? p.color : "#fff",
                    fontSize: 14, fontWeight: 700, outline: "none",
                    textAlign: "center", boxSizing: "border-box",
                  });
                  return (
                    <div key={p.key} style={{
                      background: active ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.025)",
                      border: `1px solid ${active ? p.color + "44" : "rgba(255,255,255,0.07)"}`,
                      borderRadius: 12, padding: "12px 14px", transition: "all 0.2s",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 18 }}>{p.icon}</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: active ? p.color : "#fff" }}>{p.label}</span>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{p.fullLabel}</span>
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 5, letterSpacing: 1, textTransform: "uppercase" }}>Insidensi (jumlah tanaman terserang)</div>
                        <input type="number" inputMode="numeric" value={pd?.insidensi || ""} onChange={e => handlePenyakitField(p.key, "insidensi", e.target.value)} placeholder="0" style={inputStyle("insidensi")} />
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 6, letterSpacing: 1, textTransform: "uppercase" }}>Intensitas — Jumlah Tanaman per Skor</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
                          {["skor1","skor2","skor3","skor4"].map((sk, i) => (
                            <div key={sk}>
                              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textAlign: "center", marginBottom: 3 }}>Skor {i+1}</div>
                              <input type="number" inputMode="numeric" value={pd?.[sk] || ""} onChange={e => handlePenyakitField(p.key, sk, e.target.value)} placeholder="0" style={inputStyle(sk)} />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── GSB ── */}
              <div style={S.sectionTitle}>⚠️ GSB — Gummy Stem Blight</div>
              <div style={{ marginBottom: 20 }}>
                {PENYAKIT_SIMPLE.map(p => {
                  const pd = hptData.penyakit[p.key];
                  const active = pd?.jumlah && pd.jumlah !== "0";
                  return (
                    <div key={p.key} style={{
                      background: active ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.025)",
                      border: `1px solid ${active ? p.color + "44" : "rgba(255,255,255,0.07)"}`,
                      borderRadius: 12, padding: "12px 14px", transition: "all 0.2s",
                    }}>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Jumlah Tanaman Terserang</div>
                      <input
                        type="number" inputMode="numeric"
                        value={pd?.jumlah || ""}
                        onChange={e => handlePenyakitField(p.key, "jumlah", e.target.value)}
                        placeholder="0 tanaman"
                        style={{
                          width: "100%", padding: "9px 12px",
                          background: "rgba(0,0,0,0.3)",
                          border: `1px solid ${active ? p.color : "rgba(255,255,255,0.1)"}`,
                          borderRadius: 8, color: active ? p.color : "#fff",
                          fontSize: 15, fontWeight: 700, outline: "none", boxSizing: "border-box",
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Keterangan */}
              <div style={S.sectionTitle}>📝 Keterangan (opsional)</div>
              <textarea
                value={hptData.keterangan}
                onChange={e => setHptData(d => ({ ...d, keterangan: e.target.value }))}
                placeholder="Catatan tambahan..."
                rows={3}
                style={{
                  width: "100%", padding: "11px 13px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10, color: "#fff", fontSize: 13, outline: "none", resize: "none",
                  boxSizing: "border-box",
                }}
              />

              {submitError && (
                <div style={{ padding: 12, background: "rgba(244,67,54,0.1)", border: "1px solid rgba(244,67,54,0.3)", borderRadius: 10, fontSize: 13, color: "#ef9a9a", marginTop: 12 }}>
                  ⚠️ {submitError}
                </div>
              )}
            </div>
          )}

          {/* ══ STEP 4 — Sukses ══ */}
          {step === 4 && (
            <div style={{ textAlign: "center", paddingTop: 32 }}>
              <div style={{ fontSize: 60, marginBottom: 12 }}>{isDemoMode ? "🧪" : "✅"}</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: isDemoMode ? "#FFB300" : "#4CAF50", margin: "0 0 6px" }}>
                {isDemoMode ? "Demo Selesai!" : "Data Tersimpan!"}
              </h2>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", margin: "0 0 20px" }}>
                {isDemoMode ? "Data tidak dikirim (mode demo)" : "Data HPT berhasil dikirim ke Google Sheets"}
              </p>

              {/* Ringkasan */}
              <div style={{
                background: isDemoMode ? "rgba(255,179,0,0.07)" : "rgba(76,175,80,0.08)",
                border: `1px solid ${isDemoMode ? "rgba(255,179,0,0.25)" : "rgba(76,175,80,0.25)"}`,
                borderRadius: 14, padding: "14px 16px", textAlign: "left", marginBottom: 20,
              }}>
                <div style={{ fontSize: 12, color: isDemoMode ? "#FFB300" : "#81c784", fontWeight: 700, marginBottom: 10 }}>Ringkasan</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>
                  {selectedGH} · Periode {ghInfo?.periode} · {hst} HST
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 10 }}>Operator: {operator}</div>

                {/* Hama summary */}
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Hama</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
                  {HAMA_LIST.filter(h => hptData.hama[h.key] && hptData.hama[h.key] !== "0").map(h => (
                    <span key={h.key} style={{ fontSize: 12, background: "rgba(255,255,255,0.06)", border: `1px solid ${h.color}44`, borderRadius: 20, padding: "3px 9px", color: h.color }}>
                      {h.icon} {h.label}: {hptData.hama[h.key]} {h.unit}
                    </span>
                  ))}
                  {HAMA_LIST.every(h => !hptData.hama[h.key] || hptData.hama[h.key] === "0") && (
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Tidak ada hama</span>
                  )}
                </div>

                {/* Penyakit summary */}
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Penyakit</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {PENYAKIT_SKOR.map(p => {
                    const pd = hptData.penyakit[p.key];
                    return (
                      <div key={p.key} style={{ fontSize: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "rgba(255,255,255,0.5)" }}>{p.icon} {p.label}</span>
                          <span style={{ color: p.color, fontWeight: 700 }}>Insidensi: {pd?.insidensi || "0"}</span>
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 2, paddingLeft: 20 }}>
                          {["skor1","skor2","skor3","skor4"].map((sk, i) => (
                            <span key={sk} style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>S{i+1}: {pd?.[sk] || "0"}</span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {PENYAKIT_SIMPLE.map(p => {
                    const pd = hptData.penyakit[p.key];
                    return (
                      <div key={p.key} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ color: "rgba(255,255,255,0.5)" }}>{p.icon} {p.label}</span>
                        <span style={{ color: p.color, fontWeight: 700 }}>{pd?.jumlah || "0"} tanaman</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button onClick={resetForm} style={{
                width: "100%", padding: 16,
                background: isDemoMode ? "rgba(255,179,0,0.12)" : "rgba(76,175,80,0.15)",
                border: `2px solid ${isDemoMode ? "rgba(255,179,0,0.35)" : "rgba(76,175,80,0.35)"}`,
                borderRadius: 13, color: isDemoMode ? "#FFB300" : "#4CAF50",
                fontSize: 15, fontWeight: 700, cursor: "pointer",
              }}>
                + Input GH Berikutnya
              </button>
            </div>
          )}
        </div>

        {/* ── Bottom Nav ── */}
        {step < 4 && (
          <div style={{ padding: "12px 16px 20px", borderTop: "1px solid rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.3)", display: "flex", gap: 10 }}>
            {step > 1 && (
              <button onClick={() => setStep(s => s - 1)} style={{
                flex: 1, padding: 14, background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12,
                color: "rgba(255,255,255,0.65)", fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}>
                ← Kembali
              </button>
            )}
            {step < 3 && (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={step === 1 ? !selectedGH : !canProceedStep2}
                style={{
                  flex: 2, padding: 14, border: "none", borderRadius: 12,
                  background: (step === 1 ? selectedGH : canProceedStep2)
                    ? "linear-gradient(135deg, #2e7d32, #43a047)"
                    : "rgba(255,255,255,0.05)",
                  color: (step === 1 ? selectedGH : canProceedStep2) ? "#fff" : "rgba(255,255,255,0.25)",
                  fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "all 0.2s",
                }}
              >
                {step === 1 ? "Lanjut →" : "Input HPT →"}
              </button>
            )}
            {step === 3 && (
              <button
                onClick={handleSubmit}
                disabled={syncing}
                style={{
                  flex: 2, padding: 14,
                  background: syncing
                    ? "rgba(76,175,80,0.3)"
                    : isDemoMode
                      ? "linear-gradient(135deg, #5d4037, #795548)"
                      : "linear-gradient(135deg, #1b5e20, #2e7d32)",
                  border: "none", borderRadius: 12, color: "#fff",
                  fontSize: 15, fontWeight: 700, cursor: syncing ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                {syncing ? "⏳ Menyimpan..." : isDemoMode ? "Submit Demo 🧪" : "Submit HPT ✓"}
              </button>
            )}
          </div>
        )}

        <style>{`
          input[type=number]::-webkit-outer-spin-button,
          input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
          * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
          textarea::placeholder, input::placeholder { color: rgba(255,255,255,0.2); }
        `}</style>
      </div>
    </div>
  );
}