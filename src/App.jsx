import { useState, useMemo, useEffect } from "react";
import {
  ComposedChart, LineChart, Line, BarChart, Bar, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

// ---------- palette ----------
const C = {
  paper: "#F9F8F3",
  card: "#FFFFFF",
  ink: "#23271E",
  inkSoft: "#6C7062",
  line: "#E6E3D7",
  brass: "#9C7C33",
  brassDeep: "#7A5F22",
  move: "#16766A",
  moveSoft: "#E2F0ED",
  stay: "#8D8778",
  danger: "#B4463C",
};

// ---------- fixed deal facts (July 7 LOI / July 9 counter) ----------
const MOVE_SF = 2952;
const STAY_SF = 1372;
const MOVE_RENT = [15, 18, 25, 27, 28.35, 29.48, 30.66, 31.89, 33.17, 34.49]; // $/SF, Y2 toggles
const STAY_RENT_Y1 = 28; // Option A per July 7 LOI, 3% bumps
const AMBER_MRR = 52578; // 325 existing ($46,453) + 25 new @ $245
const JEN_COMP = 110000; // full-time salary + payroll burden
const P3_COMP = 110000;  // third provider default, fully loaded (PA-level)
const AMBER_SALARY = 120000; // Dr. Wobbekind W-2, for the target line
const FIXED_OH = 95000;  // from YTD 2026 P&L, ex-rent ex-payroll
const VAR_PP = 10;       // variable cost / patient / month (COGS)

const fmtM = (v) => "$" + (v / 1e6).toFixed(2) + "M";
const fmtK = (v) => (v < 0 ? "-" : "") + "$" + Math.round(Math.abs(v) / 1000) + "k";
const fmt$ = (v) => (v < 0 ? "-" : "") + "$" + Math.round(Math.abs(v)).toLocaleString();

// ---------- model ----------
function simulate(p) {
  const { adds, stayCap, moveCap, jRate, y2Rent, opexBase, opexEsc, maYear, depYear, gapMonths, p3Year, p3Rate, p3Adds, p3Salary } = p;
  const moveRent = [...MOVE_RENT];
  moveRent[1] = y2Rent;
  const jStart = Math.min(36 + adds * 10, moveCap); // panel at Aug 2027 commencement

  const run = (isMove) => {
    const cap = isMove ? moveCap : stayCap;
    let panel = Math.min(jStart, cap);
    let gapLeft = 0;
    let panel3 = 0;
    const years = [];
    for (let y = 0; y < 10; y++) {
      let rev = 0, varCost = 0, jenCost = 0, p3Cost = 0, panelSum = 0;
      for (let m = 0; m < 12; m++) {
        const mAbs = y * 12 + m;
        if (depYear > 0 && mAbs === (depYear - 1) * 12) { panel = 0; gapLeft = gapMonths; }
        const p3Active = isMove && p3Year > 0 && mAbs >= (p3Year - 1) * 12;
        rev += AMBER_MRR + panel * jRate + panel3 * p3Rate;
        varCost += VAR_PP * (350 + panel + panel3);
        panelSum += panel;
        if (gapLeft > 0) { gapLeft--; }
        else { jenCost += JEN_COMP / 12; panel = Math.min(panel + adds, cap); }
        if (p3Active) { p3Cost += p3Salary / 12; panel3 = Math.min(panel3 + p3Adds, 350); }
      }
      const opexPSF = opexBase * Math.pow(1 + opexEsc / 100, y + 1);
      const occ = isMove
        ? moveRent[y] * MOVE_SF + opexPSF * MOVE_SF
        : STAY_RENT_Y1 * Math.pow(1.03, y) * STAY_SF + opexPSF * STAY_SF;
      const ma = isMove && maYear > 0 && y >= maYear - 1 ? 66000 * Math.pow(1.03, y - (maYear - 1)) : 0;
      const fixed = FIXED_OH * Math.pow(1.03, y + 1);
      const take = rev - (occ + jenCost + p3Cost + ma + fixed + varCost);
      years.push({
        rev: Math.round(rev), occ: Math.round(occ), take: Math.round(take),
        panelEnd: Math.round(panel), p3End: Math.round(panel3),
        panelAvg: Math.round(panelSum / 12),
        rentPSF: isMove ? moveRent[y] : +(STAY_RENT_Y1 * Math.pow(1.03, y)).toFixed(2),
      });
    }
    return years;
  };

  const stay = run(false);
  const move = run(true);
  const sTot = stay.reduce((a, r) => a + r.take, 0);
  const mTot = move.reduce((a, r) => a + r.take, 0);
  const breakeven = move.map((r, y) => Math.ceil((r.occ - stay[y].occ) / (p.jRate * 12)));
  return { stay, move, sTot, mTot, diff: mTot - sTot, breakeven };
}

// ---------- small pieces ----------
function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    typeof window !== "undefined" && window.matchMedia(query).matches
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const m = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);
    m.addEventListener("change", handler);
    return () => m.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

function Slider({ label, value, set, min, max, step = 1, unit = "", format }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <label style={{ fontSize: 13, color: C.inkSoft }}>{label}</label>
        <span style={{ fontSize: 14, fontWeight: 600, color: C.ink, fontVariantNumeric: "tabular-nums" }}>
          {format ? format(value) : value}{unit}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => set(+e.target.value)}
        style={{ width: "100%", accentColor: C.brass, height: 4 }} />
    </div>
  );
}

function Toggle({ label, options, value, set }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 13, color: C.inkSoft, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", gap: 6 }}>
        {options.map((o) => (
          <button key={o.v} onClick={() => set(o.v)}
            style={{
              flex: 1, padding: "7px 10px", fontSize: 13, cursor: "pointer",
              borderRadius: 7, border: `1px solid ${value === o.v ? C.brass : C.line}`,
              background: value === o.v ? "#F5EEDD" : C.card,
              color: value === o.v ? C.brassDeep : C.inkSoft,
              fontWeight: value === o.v ? 600 : 400, fontFamily: "inherit",
            }}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function LegendRow({ items }) {
  return (
    <div style={{ display: "flex", gap: 18, fontSize: 12, color: C.inkSoft, marginBottom: 6, flexWrap: "wrap" }}>
      {items.map((it) => (
        <span key={it.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {it.dash
            ? <span style={{ width: 14, borderTop: `2px dashed ${it.color}` }} />
            : <span style={{ width: 10, height: 10, borderRadius: 2, background: it.color }} />}
          {it.label}
        </span>
      ))}
    </div>
  );
}

function ChartCard({ title, note, children, height = 260 }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "18px 20px" }}>
      <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 600, margin: "0 0 2px", color: C.ink }}>{title}</h3>
      {note && <p style={{ fontSize: 12.5, color: C.inkSoft, margin: "0 0 10px", lineHeight: 1.5 }}>{note}</p>}
      {children}
      <div style={{ width: "100%", height }} />
    </div>
  );
}

const tooltipStyle = {
  background: C.card, border: `1px solid ${C.line}`, borderRadius: 8,
  fontSize: 12.5, padding: "8px 12px", boxShadow: "0 4px 12px rgba(35,39,30,0.08)",
};

// ---------- app ----------
export default function App() {
  const [adds, setAdds] = useState(8);
  const [stayCap, setStayCap] = useState(100);
  const [moveCap, setMoveCap] = useState(350);
  const [jRate, setJRate] = useState(130);
  const [y2Rent, setY2Rent] = useState(18);
  const [opexBase, setOpexBase] = useState(20.45);
  const [opexEsc, setOpexEsc] = useState(4);
  const [maYear, setMaYear] = useState(1);
  const [depYear, setDepYear] = useState(0);
  const [gapMonths, setGapMonths] = useState(6);
  const [dist, setDist] = useState(15000);
  const [p3Year, setP3Year] = useState(0);
  const [p3Rate, setP3Rate] = useState(160);
  const [p3Adds, setP3Adds] = useState(6);
  const [p3Salary, setP3Salary] = useState(110000);
  const isMobile = useMediaQuery("(max-width: 720px)");

  const m = useMemo(
    () => simulate({ adds, stayCap, moveCap, jRate, y2Rent, opexBase, opexEsc, maYear, depYear, gapMonths, p3Year, p3Rate, p3Adds, p3Salary }),
    [adds, stayCap, moveCap, jRate, y2Rent, opexBase, opexEsc, maYear, depYear, gapMonths, p3Year, p3Rate, p3Adds, p3Salary]
  );
  const target = AMBER_SALARY + dist * 12;
  const clearStay = m.stay.filter((r) => r.take >= target).length;
  const clearMove = m.move.filter((r) => r.take >= target).length;

  const takeData = m.stay.map((r, i) => ({ yr: "Y" + (i + 1), Stay: r.take, Move: m.move[i].take }));
  const occData = m.stay.map((r, i) => ({ yr: "Y" + (i + 1), Stay: Math.round(r.occ / 12), Move: Math.round(m.move[i].occ / 12) }));
  const beData = m.breakeven.map((b, i) => ({ yr: "Y" + (i + 1), Needed: Math.max(b, 0), Panel: m.move[i].panelEnd }));
  const ahead = m.diff >= 0;

  return (
    <div style={{ minHeight: "100vh", background: C.paper, color: C.ink, fontFamily: "'Instrument Sans', system-ui, sans-serif" }}>
      <style>{`
        input[type=range]{cursor:pointer}
        *:focus-visible{outline:2px solid ${C.brass};outline-offset:2px}

        .lm-page{max-width:1060px;margin:0 auto;padding:36px 24px 64px}
        .lm-masthead-side{font-size:12.5px;color:${C.inkSoft};text-align:right;line-height:1.6}
        .lm-h1{font-family:'Fraunces',serif;font-size:34px;font-weight:700;margin:0;line-height:1.1}
        .lm-verdict{padding:30px 0 26px;border-bottom:1px solid ${C.line};margin-bottom:28px}
        .lm-verdict-main{display:flex;gap:40px;align-items:flex-end;flex-wrap:wrap}
        .lm-verdict-metrics{display:flex;gap:32px;padding-bottom:6px;flex-wrap:wrap}
        .lm-headline{font-family:'Fraunces',serif;font-weight:700;font-size:58px;line-height:1;font-variant-numeric:tabular-nums lining-nums}
        .lm-headline.pos{color:${C.brassDeep}}
        .lm-headline.neg{color:${C.danger}}
        .lm-metric{font-family:'Fraunces',serif;font-size:26px;font-weight:600;font-variant-numeric:tabular-nums}
        .lm-metric.move{color:${C.move}}
        .lm-main-grid{display:grid;grid-template-columns:minmax(260px,320px) minmax(0,1fr);gap:24px;margin-bottom:24px}
        .lm-assumptions{background:${C.card};border:1px solid ${C.line};border-radius:12px;padding:20px 20px 8px;align-self:start}
        .lm-secondary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:24px;margin-bottom:24px}
        .lm-ledger-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}

        @media (max-width: 720px) {
          .lm-page{padding:20px 16px 48px}
          .lm-masthead-side{text-align:left;width:100%}
          .lm-h1{font-size:26px}
          .lm-verdict{padding:22px 0 20px;margin-bottom:20px}
          .lm-verdict-main{gap:18px}
          .lm-verdict-metrics{gap:20px 24px;width:100%;padding-bottom:0}
          .lm-headline{font-size:44px}
          .lm-metric{font-size:22px}
          .lm-main-grid{grid-template-columns:1fr;gap:16px;margin-bottom:16px}
          .lm-secondary-grid{grid-template-columns:1fr;gap:16px;margin-bottom:16px}
          .lm-assumptions{padding:16px 16px 6px}
        }
        @media print { .no-print { display:none } }
      `}</style>

      <div className="lm-page">

        {/* masthead */}
        <header style={{ borderBottom: `2px solid ${C.ink}`, paddingBottom: 18, marginBottom: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.brass, fontWeight: 600, marginBottom: 6 }}>
                The Golden Stethoscope · Red Rocks Medical Center
              </div>
              <h1 className="lm-h1">
                Stay or move — the decision model
              </h1>
            </div>
            <div className="lm-masthead-side">
              Suite 260 (1,372 SF) vs Suite 280 (2,952 SF)<br />
              Terms per July 7 LOI · July 9 counter
            </div>
          </div>
        </header>

        {/* verdict band — the live headline */}
        <section className="lm-verdict">
          <div className="lm-verdict-main">
            <div>
              <div style={{ fontSize: 13, color: C.inkSoft, marginBottom: 4 }}>10-year advantage of moving</div>
              <div className={`lm-headline ${ahead ? "pos" : "neg"}`}>
                {ahead ? "+" : "−"}{fmtM(Math.abs(m.diff))}
              </div>
            </div>
            <div className="lm-verdict-metrics">
              <div>
                <div style={{ fontSize: 12.5, color: C.inkSoft }}>Owner take if you stay</div>
                <div className="lm-metric">{fmtM(m.sTot)}</div>
              </div>
              <div>
                <div style={{ fontSize: 12.5, color: C.inkSoft }}>Owner take if you move</div>
                <div className="lm-metric move">{fmtM(m.mTot)}</div>
              </div>
              <div>
                <div style={{ fontSize: 12.5, color: C.inkSoft }}>Years clearing target</div>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  <span style={{ color: C.stay }}>{clearStay}</span>
                  <span style={{ color: C.inkSoft, fontSize: 18 }}> / </span>
                  <span style={{ color: C.move }}>{clearMove}</span>
                  <span style={{ color: C.inkSoft, fontSize: 14, fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400 }}> of 10</span>
                </div>
              </div>
            </div>
          </div>
          <p style={{ fontSize: 13.5, color: C.inkSoft, margin: "14px 0 0", maxWidth: 640, lineHeight: 1.6 }}>
            Owner take = everything available to Dr. Wobbekind (salary + distributions) after occupancy,
            Jennifer's compensation, the MA, and operating costs. Adjust the assumptions below and this figure recomputes.
          </p>
        </section>

        {/* assumptions + main chart */}
        <div className="lm-main-grid">
          <aside className="lm-assumptions">
            <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 600, margin: "0 0 16px" }}>Assumptions</h3>

            <Slider label="Jennifer net adds / month" value={adds} set={setAdds} min={2} max={12} />
            <Slider label="Jennifer max panel if staying" value={stayCap} set={setStayCap} min={40} max={250} step={10} />
            <Slider label="Jennifer max panel if moving" value={moveCap} set={setMoveCap} min={250} max={400} step={10} />
            <Slider label="New-patient rate (Jennifer)" value={jRate} set={setJRate} min={100} max={180} step={5} format={(v) => "$" + v + "/mo"} />

            <div style={{ borderTop: `1px solid ${C.line}`, margin: "4px 0 16px" }} />

            <Slider label="Distribution target (Dr. W)" value={dist} set={setDist} min={10000} max={25000} step={500}
              format={(v) => "$" + (v / 1000) + "k/mo"} />
            <Slider label="MA hire — lease year" value={maYear} set={setMaYear} min={0} max={6}
              format={(v) => (v === 0 ? "Never" : "Y" + v)} />

            <div style={{ borderTop: `1px solid ${C.line}`, margin: "4px 0 16px" }} />

            <Toggle label="Year 2 rent" value={y2Rent} set={setY2Rent}
              options={[{ v: 18, label: "$18 — your counter" }, { v: 20, label: "$20 — landlord" }]} />
            <Slider label="OpEx baseline ($/SF, 2026)" value={opexBase} set={setOpexBase} min={17.31} max={20.45} step={0.01} format={(v) => "$" + v.toFixed(2)} />
            <Slider label="OpEx escalation / year" value={opexEsc} set={setOpexEsc} min={2} max={6} step={0.5} unit="%" />

            <div style={{ borderTop: `1px solid ${C.line}`, margin: "4px 0 16px" }} />

            <div style={{ fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: C.brass, fontWeight: 600, marginBottom: 12 }}>
              Third provider (move only)
            </div>
            <Slider label="Starts in lease year" value={p3Year} set={setP3Year} min={0} max={8}
              format={(v) => (v === 0 ? "Never" : "Y" + v)} />
            {p3Year > 0 && (<>
              <Slider label="Their patient rate" value={p3Rate} set={setP3Rate} min={100} max={250} step={5} format={(v) => "$" + v + "/mo"} />
              <Slider label="Their salary (fully loaded)" value={p3Salary} set={setP3Salary} min={60000} max={250000} step={5000} format={(v) => "$" + (v / 1000) + "k/yr"} />
              <Slider label="Their net adds / month" value={p3Adds} set={setP3Adds} min={2} max={12} />
            </>)}

            <div style={{ borderTop: `1px solid ${C.line}`, margin: "4px 0 16px" }} />

            <Toggle label="Stress test: Jennifer departs" value={depYear} set={setDepYear}
              options={[{ v: 0, label: "Never" }, { v: 2, label: "Y2" }, { v: 3, label: "Y3" }, { v: 5, label: "Y5" }]} />
            {depYear > 0 && (
              <Slider label="Months to replace her" value={gapMonths} set={setGapMonths} min={3} max={18} />
            )}
          </aside>

          <ChartCard
            title="Annual owner take"
            note="What reaches Dr. Wobbekind each lease year under each path."
            height={0}>
            <LegendRow items={[
              { label: "Stay", color: C.stay, dash: true },
              { label: "Move", color: C.move },
              { label: "Salary + distribution target", color: C.brass, dash: true },
            ]} />
            <div style={{ width: "100%", height: isMobile ? 280 : 330 }}>
              <ResponsiveContainer>
                <ComposedChart data={takeData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={C.line} vertical={false} />
                  <XAxis dataKey="yr" tick={{ fontSize: 12, fill: C.inkSoft }} axisLine={{ stroke: C.line }} tickLine={false} />
                  <YAxis tickFormatter={fmtK} tick={{ fontSize: 12, fill: C.inkSoft }} axisLine={false} tickLine={false} width={54} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [fmt$(v), n]} />
                  <Area type="monotone" dataKey="Move" stroke="none" fill={C.moveSoft} fillOpacity={0.7} />
                  <ReferenceLine y={target} stroke={C.brass} strokeDasharray="4 4" strokeWidth={1.5}
                    label={{ value: "Target " + fmtK(target), position: "insideTopRight", fontSize: 11, fill: C.brassDeep }} />
                  <Line type="monotone" dataKey="Move" stroke={C.move} strokeWidth={2.5} dot={{ r: 3.5, fill: C.move, strokeWidth: 0 }} />
                  <Line type="monotone" dataKey="Stay" stroke={C.stay} strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3, fill: C.stay, strokeWidth: 0 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        {/* secondary charts */}
        <div className="lm-secondary-grid">
          <ChartCard
            title="Monthly occupancy cost"
            note="Base rent plus pass-through OpEx, per the current LOI terms."
            height={0}>
            <LegendRow items={[{ label: "Stay — Suite 260", color: C.stay }, { label: "Move — Suite 280", color: C.move }]} />
            <div style={{ width: "100%", height: isMobile ? 220 : 240 }}>
              <ResponsiveContainer>
                <BarChart data={occData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
                  <CartesianGrid stroke={C.line} vertical={false} />
                  <XAxis dataKey="yr" tick={{ fontSize: 12, fill: C.inkSoft }} axisLine={{ stroke: C.line }} tickLine={false} />
                  <YAxis tickFormatter={fmtK} tick={{ fontSize: 12, fill: C.inkSoft }} axisLine={false} tickLine={false} width={46} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [fmt$(v) + "/mo", n]} cursor={{ fill: "rgba(35,39,30,0.04)" }} />
                  <Bar dataKey="Stay" fill={C.stay} radius={[3, 3, 0, 0]} maxBarSize={20} />
                  <Bar dataKey="Move" fill={C.move} radius={[3, 3, 0, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard
            title="Patients needed vs. patients coming"
            note="Extra patients (at Jennifer's rate) needed to cover the occupancy gap, against her projected panel."
            height={0}>
            <LegendRow items={[{ label: "Jennifer's panel (year-end)", color: C.move }, { label: "Needed to break even", color: C.danger, dash: true }]} />
            <div style={{ width: "100%", height: isMobile ? 220 : 240 }}>
              <ResponsiveContainer>
                <LineChart data={beData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={C.line} vertical={false} />
                  <XAxis dataKey="yr" tick={{ fontSize: 12, fill: C.inkSoft }} axisLine={{ stroke: C.line }} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: C.inkSoft }} axisLine={false} tickLine={false} width={38} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [v + " patients", n]} />
                  <Line type="monotone" dataKey="Panel" stroke={C.move} strokeWidth={2.5} dot={{ r: 3.5, fill: C.move, strokeWidth: 0 }} />
                  <Line type="monotone" dataKey="Needed" stroke={C.danger} strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3, fill: C.danger, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        {/* year-by-year ledger */}
        <div className="lm-ledger-wrap" style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "18px 20px", marginBottom: 24 }}>
          <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 600, margin: "0 0 12px" }}>Year-by-year ledger</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, fontVariantNumeric: "tabular-nums", minWidth: 720 }}>
            <thead>
              <tr style={{ color: C.inkSoft, textAlign: "right" }}>
                <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 500 }}>Lease year</th>
                <th style={{ padding: "6px 8px", fontWeight: 500 }}>Rent $/SF (move)</th>
                <th style={{ padding: "6px 8px", fontWeight: 500 }}>Occupancy — stay</th>
                <th style={{ padding: "6px 8px", fontWeight: 500 }}>Occupancy — move</th>
                <th style={{ padding: "6px 8px", fontWeight: 500 }}>Revenue — move</th>
                <th style={{ padding: "6px 8px", fontWeight: 500 }}>Take — stay</th>
                <th style={{ padding: "6px 8px", fontWeight: 500 }}>Take — move</th>
                <th style={{ padding: "6px 8px", fontWeight: 500 }}>Move Δ</th>
              </tr>
            </thead>
            <tbody>
              {m.stay.map((r, i) => {
                const d = m.move[i].take - r.take;
                return (
                  <tr key={i} style={{ borderTop: `1px solid ${C.line}`, textAlign: "right" }}>
                    <td style={{ textAlign: "left", padding: "7px 8px", fontWeight: 600 }}>Y{i + 1}</td>
                    <td style={{ padding: "7px 8px" }}>${m.move[i].rentPSF.toFixed(2)}</td>
                    <td style={{ padding: "7px 8px" }}>{fmt$(r.occ)}</td>
                    <td style={{ padding: "7px 8px" }}>{fmt$(m.move[i].occ)}</td>
                    <td style={{ padding: "7px 8px" }}>{fmt$(m.move[i].rev)}</td>
                    <td style={{ padding: "7px 8px" }}>{fmt$(r.take)}</td>
                    <td style={{ padding: "7px 8px", color: C.move, fontWeight: 600 }}>{fmt$(m.move[i].take)}</td>
                    <td style={{ padding: "7px 8px", color: d >= 0 ? C.brassDeep : C.danger, fontWeight: 600 }}>
                      {d >= 0 ? "+" : "−"}{fmt$(Math.abs(d))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* fixed facts */}
        <footer style={{ fontSize: 12.5, color: C.inkSoft, lineHeight: 1.7, borderTop: `1px solid ${C.line}`, paddingTop: 16 }}>
          <strong style={{ color: C.ink }}>Held constant in the model:</strong> Dr. Wobbekind at a full 350-patient panel
          ({fmt$(AMBER_MRR)}/mo MRR — 325 existing plus 25 new at $245) in both paths · Jennifer's comp $110k/yr
          fully loaded · third provider comp at the slider (default $110k/yr fully loaded), panel capped at 350, move scenario only ·
          MA $66k/yr escalating 3% from the chosen lease year · fixed overhead $95k/yr escalating 3% ·
          variable cost $10/patient/mo · stay = Option A at $28/SF + 3% bumps (July 7 LOI) ·
          move = Suite 280 phase-in schedule, 120-month term · commencement Aug 2027.
          The target line assumes a $120k W-2 salary for Dr. Wobbekind plus the distribution slider —
          years above the line fully fund her draw with room for reserves and taxes.
          Excluded: staff raises, attrition, TI economics, and moving costs.
        </footer>
      </div>
    </div>
  );
}
