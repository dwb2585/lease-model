import { useState, useMemo } from "react";
import {
  ComposedChart, LineChart, Line, BarChart, Bar, Area, AreaChart, XAxis, YAxis,
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
  brassSoft: "#F5EEDD",
  teal: "#16766A",
  tealSoft: "#E2F0ED",
  tealDeep: "#0E5049",
  sage: "#7FA896",
  danger: "#B4463C",
};

// ---------- July 15, 2026 LOI — executed terms ----------
const SF = 2952;
const RENT = [15, 18, 25, 27, 28.35, 29.48, 30.66, 31.89, 33.17, 34.49]; // $/SF/yr
// Guaranty burn-down (month → amount), per LOI schedule
const GUARANTY = [
  { month: 1, amt: 204662 }, { month: 13, amt: 204662 }, { month: 25, amt: 204662 },
  { month: 37, amt: 204662 }, { month: 49, amt: 185473 }, { month: 61, amt: 163635 },
  { month: 73, amt: 138783 }, { month: 85, amt: 110501 }, { month: 97, amt: 78314 },
  { month: 109, amt: 41685 },
];
const TI_TOTAL = 73800; // $25/SF — buildout, cabling, moving costs

// ---------- practice constants ----------
const AMBER_BASE_MRR = 46453;  // her 325 existing patients
const AMBER_BASE_PANEL = 325;
const AMBER_NEW_RATE = 245;    // her new-patient rate
const AMBER_SALARY = 120000;
const JEN_COMP = 110000;   // fully loaded
const FIXED_OH = 95000;    // YTD 2026 P&L, ex-rent ex-payroll
const VAR_PP = 10;         // $/patient/mo

const fmtM = (v) => "$" + (v / 1e6).toFixed(2) + "M";
const fmtK = (v) => (v < 0 ? "-" : "") + "$" + Math.round(Math.abs(v) / 1000) + "k";
const fmt$ = (v) => (v < 0 ? "-" : "") + "$" + Math.round(Math.abs(v)).toLocaleString();

// ---------- model: the signed deal, simulated monthly ----------
function simulate(p) {
  const { jStart, adds, cap, jRate, amberAdds, opexBase, opexEsc, maYear, depYear, gapMonths, p3Year, p3Rate, p3Adds, p3Comp } = p;
  const amberMRR = AMBER_BASE_MRR + amberAdds * AMBER_NEW_RATE;
  const amberPanel = AMBER_BASE_PANEL + amberAdds;
  let panel = Math.min(jStart, cap); // Jennifer's panel at commencement — the slider
  let panel3 = 0;
  let gapLeft = 0;
  const years = [];
  for (let y = 0; y < 10; y++) {
    let rev = 0, varCost = 0, jenCost = 0, p3Cost = 0, jEndPanel = 0, p3EndPanel = 0;
    for (let m = 0; m < 12; m++) {
      const mAbs = y * 12 + m;
      if (depYear > 0 && mAbs === (depYear - 1) * 12) { panel = 0; gapLeft = gapMonths; }
      const p3Active = p3Year > 0 && mAbs >= (p3Year - 1) * 12;
      rev += amberMRR + panel * jRate + panel3 * p3Rate;
      varCost += VAR_PP * (amberPanel + panel + panel3);
      if (gapLeft > 0) { gapLeft--; }
      else { jenCost += JEN_COMP / 12; panel = Math.min(panel + adds, cap); }
      if (p3Active) { p3Cost += p3Comp / 12; panel3 = Math.min(panel3 + p3Adds, 350); }
    }
    jEndPanel = Math.round(panel); p3EndPanel = Math.round(panel3);
    const opexPSF = opexBase * Math.pow(1 + opexEsc / 100, y + 1);
    const baseRent = RENT[y] * SF;
    const opex = opexPSF * SF;
    const ma = maYear > 0 && y >= maYear - 1 ? 66000 * Math.pow(1.03, y - (maYear - 1)) : 0;
    const fixed = FIXED_OH * Math.pow(1.03, y + 1);
    const take = rev - (baseRent + opex + jenCost + p3Cost + ma + fixed + varCost);
    years.push({
      yr: "Y" + (y + 1),
      rentPSF: RENT[y],
      baseRentMo: Math.round(baseRent / 12),
      opexMo: Math.round(opex / 12),
      occMo: Math.round((baseRent + opex) / 12),
      occ: Math.round(baseRent + opex),
      rev: Math.round(rev),
      take: Math.round(take),
      takeMo: Math.round(take / 12),
      jPanel: jEndPanel,
      p3Panel: p3EndPanel,
      guaranty: GUARANTY[y].amt,
    });
  }
  return years;
}

// ---------- small pieces ----------
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
          <button key={String(o.v)} onClick={() => set(o.v)}
            style={{
              flex: 1, padding: "7px 10px", fontSize: 13, cursor: "pointer",
              borderRadius: 7, border: `1px solid ${value === o.v ? C.brass : C.line}`,
              background: value === o.v ? C.brassSoft : C.card,
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

function Card({ title, note, children }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "18px 20px" }}>
      <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 600, margin: "0 0 2px", color: C.ink }}>{title}</h3>
      {note && <p style={{ fontSize: 12.5, color: C.inkSoft, margin: "0 0 10px", lineHeight: 1.5 }}>{note}</p>}
      {children}
    </div>
  );
}

const tooltipStyle = {
  background: C.card, border: `1px solid ${C.line}`, borderRadius: 8,
  fontSize: 12.5, padding: "8px 12px", boxShadow: "0 4px 12px rgba(35,39,30,0.08)",
};

// ---------- app ----------
export default function App() {
  const [jStart, setJStart] = useState(80);
  const [adds, setAdds] = useState(8);
  const [cap, setCap] = useState(350);
  const [jRate, setJRate] = useState(130);
  const [amberAdds, setAmberAdds] = useState(25);
  const [dist, setDist] = useState(15000);
  const [maYear, setMaYear] = useState(1);
  const [opexBase, setOpexBase] = useState(20.45);
  const [opexEsc, setOpexEsc] = useState(4);
  const [p3Year, setP3Year] = useState(0);
  const [p3Rate, setP3Rate] = useState(160);
  const [p3Adds, setP3Adds] = useState(6);
  const [p3Comp, setP3Comp] = useState(110000);
  const [depYear, setDepYear] = useState(0);
  const [gapMonths, setGapMonths] = useState(6);

  const rows = useMemo(
    () => simulate({ jStart, adds, cap, jRate, amberAdds, opexBase, opexEsc, maYear, depYear, gapMonths, p3Year, p3Rate, p3Adds, p3Comp }),
    [jStart, adds, cap, jRate, amberAdds, opexBase, opexEsc, maYear, depYear, gapMonths, p3Year, p3Rate, p3Adds, p3Comp]
  );
  const amberPanel = AMBER_BASE_PANEL + amberAdds;
  const amberMRR = AMBER_BASE_MRR + amberAdds * AMBER_NEW_RATE;

  const target = AMBER_SALARY + dist * 12;
  const totTake = rows.reduce((a, r) => a + r.take, 0);
  const totOcc = rows.reduce((a, r) => a + r.occ, 0);
  const clear = rows.filter((r) => r.take >= target).length;
  const worstYear = rows.reduce((w, r) => (r.take < w.take ? r : w), rows[0]);

  const guarantyData = GUARANTY.map((g, i) => ({ yr: "Y" + (i + 1), Guaranty: g.amt }));
  const panelData = rows.map((r) => ({ yr: r.yr, "Dr. Wobbekind": amberPanel, Jennifer: r.jPanel, "Provider 3": r.p3Panel }));

  return (
    <div style={{ minHeight: "100vh", background: C.paper, color: C.ink, fontFamily: "'Instrument Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Instrument+Sans:wght@400;500;600&display=swap');
        input[type=range]{cursor:pointer}
        *:focus-visible{outline:2px solid ${C.brass};outline-offset:2px}
        @media print { .no-print { display:none } }

        .lm-page { max-width: 1060px; margin: 0 auto; padding: 36px 24px 64px; }
        .lm-mast { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 12px; }
        .lm-headline-row { display: flex; gap: 40px; align-items: flex-end; flex-wrap: wrap; }
        .lm-headline-num { font-family: 'Fraunces', serif; font-weight: 700; font-size: 58px; line-height: 1; color: #7A5F22; font-variant-numeric: tabular-nums lining-nums; }
        .lm-stats { display: flex; gap: 32px; padding-bottom: 6px; flex-wrap: wrap; }
        .lm-assumptions { display: grid; grid-template-columns: minmax(260px, 320px) minmax(0, 1fr); gap: 24px; margin-bottom: 24px; }
        .lm-twocol { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; margin-bottom: 24px; }
        .lm-chart-tall { width: 100%; height: 330px; }
        .lm-chart { width: 100%; height: 240px; }

        @media (max-width: 860px) {
          .lm-assumptions { grid-template-columns: 1fr; gap: 16px; }
        }
        @media (max-width: 720px) {
          .lm-page { padding: 22px 14px 56px; }
          .lm-mast { flex-direction: column; align-items: flex-start; gap: 6px; }
          .lm-mast h1 { font-size: 28px !important; }
          .lm-headline-row { flex-direction: column; align-items: flex-start; gap: 18px; }
          .lm-headline-num { font-size: 44px; }
          .lm-stats { gap: 16px 22px; padding-bottom: 0; }
          .lm-twocol { grid-template-columns: 1fr; gap: 14px; }
          .lm-chart-tall { height: 240px; }
          .lm-chart { height: 200px; }
        }
        @media (max-width: 420px) {
          .lm-page { padding: 18px 12px 48px; }
          .lm-headline-num { font-size: 38px; }
        }
      `}</style>

      <div className="lm-page">

        {/* masthead */}
        <header style={{ borderBottom: `2px solid ${C.ink}`, paddingBottom: 18 }}>
          <div className="lm-mast">
            <div>
              <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.brass, fontWeight: 600, marginBottom: 6 }}>
                The Golden Stethoscope · Suite 280 · Red Rocks Medical Center
              </div>
              <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 34, fontWeight: 700, margin: 0, lineHeight: 1.1 }}>
                The deal, year by year
              </h1>
            </div>
            <div style={{ fontSize: 12.5, color: C.inkSoft, textAlign: "right", lineHeight: 1.6 }}>
              Per landlord LOI of July 15, 2026<br />
              2,952 SF · 120 months · TI ${TI_TOTAL.toLocaleString()}
            </div>
          </div>
        </header>

        {/* headline band */}
        <section style={{ padding: "30px 0 26px", borderBottom: `1px solid ${C.line}`, marginBottom: 28 }}>
          <div className="lm-headline-row">
            <div>
              <div style={{ fontSize: 13, color: C.inkSoft, marginBottom: 4 }}>10-year owner take under this lease</div>
              <div className="lm-headline-num">
                {fmtM(totTake)}
              </div>
            </div>
            <div className="lm-stats">
              <div>
                <div style={{ fontSize: 12.5, color: C.inkSoft }}>Years clearing target</div>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 600, color: C.teal, fontVariantNumeric: "tabular-nums" }}>
                  {clear}<span style={{ color: C.inkSoft, fontSize: 14, fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400 }}> of 10</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12.5, color: C.inkSoft }}>Leanest year</div>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  {worstYear.yr}<span style={{ color: C.inkSoft, fontSize: 15, fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400 }}> · {fmtK(worstYear.take)}</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12.5, color: C.inkSoft }}>Total occupancy, 10 yrs</div>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmtM(totOcc)}</div>
              </div>
            </div>
          </div>
          <p style={{ fontSize: 13.5, color: C.inkSoft, margin: "14px 0 0", maxWidth: 660, lineHeight: 1.6 }}>
            Owner take = everything available to Dr. Wobbekind (salary + distributions) after occupancy,
            provider compensation, the MA, and operating costs. The target is her ${(AMBER_SALARY / 1000)}k salary
            plus the distribution slider.
          </p>
        </section>

        {/* assumptions + owner take */}
        <div className="lm-assumptions">
          <aside style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "20px 20px 8px", alignSelf: "start" }}>
            <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 600, margin: "0 0 16px" }}>Assumptions</h3>

            <Slider label="Jennifer's panel at lease start" value={jStart} set={setJStart} min={15} max={150} step={5} />
            <Slider label="Jennifer net adds / month" value={adds} set={setAdds} min={2} max={12} />
            <Slider label="Jennifer panel cap" value={cap} set={setCap} min={250} max={400} step={10} />
            <Slider label="New-patient rate (Jennifer)" value={jRate} set={setJRate} min={100} max={180} step={5} format={(v) => "$" + v + "/mo"} />
            <Slider label={"Dr. Amber new adds by start ($" + AMBER_NEW_RATE + "/mo)"} value={amberAdds} set={setAmberAdds} min={0} max={25} />

            <div style={{ borderTop: `1px solid ${C.line}`, margin: "4px 0 16px" }} />

            <Slider label="Distribution target (Dr. W)" value={dist} set={setDist} min={10000} max={25000} step={500}
              format={(v) => "$" + (v / 1000) + "k/mo"} />
            <Slider label="MA hire — lease year" value={maYear} set={setMaYear} min={0} max={6}
              format={(v) => (v === 0 ? "Never" : "Y" + v)} />

            <div style={{ borderTop: `1px solid ${C.line}`, margin: "4px 0 16px" }} />

            <Slider label="OpEx baseline ($/SF, 2026)" value={opexBase} set={setOpexBase} min={17.31} max={20.45} step={0.01} format={(v) => "$" + v.toFixed(2)} />
            <Slider label="OpEx escalation / year" value={opexEsc} set={setOpexEsc} min={2} max={6} step={0.5} unit="%" />

            <div style={{ borderTop: `1px solid ${C.line}`, margin: "4px 0 16px" }} />

            <div style={{ fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: C.brass, fontWeight: 600, marginBottom: 12 }}>
              Third provider
            </div>
            <Slider label="Starts in lease year" value={p3Year} set={setP3Year} min={0} max={8}
              format={(v) => (v === 0 ? "Never" : "Y" + v)} />
            {p3Year > 0 && (<>
              <Slider label="Their patient rate" value={p3Rate} set={setP3Rate} min={100} max={250} step={5} format={(v) => "$" + v + "/mo"} />
              <Slider label="Their net adds / month" value={p3Adds} set={setP3Adds} min={2} max={12} />
              <Slider label="Their pay (fully loaded)" value={p3Comp} set={setP3Comp} min={80000} max={250000} step={5000}
                format={(v) => "$" + Math.round(v / 1000) + "k/yr"} />
            </>)}

            <div style={{ borderTop: `1px solid ${C.line}`, margin: "4px 0 16px" }} />

            <Toggle label="Stress test: Jennifer departs" value={depYear} set={setDepYear}
              options={[{ v: 0, label: "Never" }, { v: 2, label: "Y2" }, { v: 3, label: "Y3" }, { v: 5, label: "Y5" }]} />
            {depYear > 0 && (
              <Slider label="Months to replace her" value={gapMonths} set={setGapMonths} min={3} max={18} />
            )}
          </aside>

          <Card title="Annual owner take" note="Each lease year under the signed terms, against the salary + distribution target.">
            <LegendRow items={[
              { label: "Owner take", color: C.teal },
              { label: "Salary + distribution target", color: C.brass, dash: true },
            ]} />
            <div className="lm-chart-tall">
              <ResponsiveContainer>
                <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={C.line} vertical={false} />
                  <XAxis dataKey="yr" tick={{ fontSize: 12, fill: C.inkSoft }} axisLine={{ stroke: C.line }} tickLine={false} />
                  <YAxis tickFormatter={fmtK} tick={{ fontSize: 12, fill: C.inkSoft }} axisLine={false} tickLine={false} width={54} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [fmt$(v), n]} />
                  <Area type="monotone" dataKey="take" name="Owner take" stroke="none" fill={C.tealSoft} fillOpacity={0.7} />
                  <ReferenceLine y={target} stroke={C.brass} strokeDasharray="4 4" strokeWidth={1.5}
                    label={{ value: "Target " + fmtK(target), position: "insideTopRight", fontSize: 11, fill: C.brassDeep }} />
                  <Line type="monotone" dataKey="take" name="Owner take" stroke={C.teal} strokeWidth={2.5}
                    dot={{ r: 3.5, fill: C.teal, strokeWidth: 0 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* occupancy + guaranty */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24, marginBottom: 24 }}>
          <Card title="Monthly occupancy cost" note="Base rent per the LOI phase-in schedule, stacked with pass-through OpEx.">
            <LegendRow items={[{ label: "Base rent", color: C.teal }, { label: "OpEx pass-through", color: C.sage }]} />
            <div className="lm-chart">
              <ResponsiveContainer>
                <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={C.line} vertical={false} />
                  <XAxis dataKey="yr" tick={{ fontSize: 12, fill: C.inkSoft }} axisLine={{ stroke: C.line }} tickLine={false} />
                  <YAxis tickFormatter={fmtK} tick={{ fontSize: 12, fill: C.inkSoft }} axisLine={false} tickLine={false} width={46} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [fmt$(v) + "/mo", n]} cursor={{ fill: "rgba(35,39,30,0.04)" }} />
                  <Bar dataKey="baseRentMo" name="Base rent" stackId="occ" fill={C.teal} maxBarSize={26} />
                  <Bar dataKey="opexMo" name="OpEx" stackId="occ" fill={C.sage} radius={[3, 3, 0, 0]} maxBarSize={26} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Dr. Wobbekind's personal guaranty" note="The negotiated burn-down: flat through month 48, then stepping toward $41,685 by month 109.">
            <LegendRow items={[{ label: "Guaranteed amount at start of year", color: C.brass }]} />
            <div className="lm-chart">
              <ResponsiveContainer>
                <ComposedChart data={guarantyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={C.line} vertical={false} />
                  <XAxis dataKey="yr" tick={{ fontSize: 12, fill: C.inkSoft }} axisLine={{ stroke: C.line }} tickLine={false} />
                  <YAxis tickFormatter={fmtK} tick={{ fontSize: 12, fill: C.inkSoft }} axisLine={false} tickLine={false} width={50} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [fmt$(v), "Guaranty"]} />
                  <Area type="stepAfter" dataKey="Guaranty" stroke="none" fill={C.brassSoft} fillOpacity={0.9} />
                  <Line type="stepAfter" dataKey="Guaranty" stroke={C.brass} strokeWidth={2.5} dot={{ r: 3, fill: C.brass, strokeWidth: 0 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* panel growth */}
        <div style={{ marginBottom: 24 }}>
          <Card title="Who's caring for whom" note="Panel by provider at each year-end. Dr. Wobbekind holds at 350; growth comes from Jennifer and, if enabled, a third provider.">
            <LegendRow items={[
              { label: "Dr. Wobbekind", color: C.ink },
              { label: "Jennifer", color: C.teal },
              { label: "Provider 3", color: C.brass },
            ]} />
            <div className="lm-chart">
              <ResponsiveContainer>
                <AreaChart data={panelData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={C.line} vertical={false} />
                  <XAxis dataKey="yr" tick={{ fontSize: 12, fill: C.inkSoft }} axisLine={{ stroke: C.line }} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: C.inkSoft }} axisLine={false} tickLine={false} width={42} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [v + " patients", n]} />
                  <Area type="monotone" dataKey="Dr. Wobbekind" stackId="p" stroke={C.ink} fill={C.ink} fillOpacity={0.14} strokeWidth={1.5} />
                  <Area type="monotone" dataKey="Jennifer" stackId="p" stroke={C.teal} fill={C.teal} fillOpacity={0.25} strokeWidth={1.5} />
                  <Area type="monotone" dataKey="Provider 3" stackId="p" stroke={C.brass} fill={C.brass} fillOpacity={0.25} strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* year-by-year ledger */}
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "18px 20px", marginBottom: 24, overflowX: "auto" }}>
          <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 600, margin: "0 0 12px" }}>Year-by-year ledger</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, fontVariantNumeric: "tabular-nums", minWidth: 780 }}>
            <thead>
              <tr style={{ color: C.inkSoft, textAlign: "right" }}>
                <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 500 }}>Lease year</th>
                <th style={{ padding: "6px 8px", fontWeight: 500 }}>Rent $/SF</th>
                <th style={{ padding: "6px 8px", fontWeight: 500 }}>Rent /mo</th>
                <th style={{ padding: "6px 8px", fontWeight: 500 }}>Occupancy /mo</th>
                <th style={{ padding: "6px 8px", fontWeight: 500 }}>Revenue /yr</th>
                <th style={{ padding: "6px 8px", fontWeight: 500 }}>Owner take /yr</th>
                <th style={{ padding: "6px 8px", fontWeight: 500 }}>Distributions</th>
                <th style={{ padding: "6px 8px", fontWeight: 500 }}>Net after dist.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const distYr = dist * 12;
                const netAfter = r.take - AMBER_SALARY - distYr;
                return (
                  <tr key={r.yr} style={{ borderTop: `1px solid ${C.line}`, textAlign: "right" }}>
                    <td style={{ textAlign: "left", padding: "7px 8px", fontWeight: 600 }}>{r.yr}</td>
                    <td style={{ padding: "7px 8px" }}>${r.rentPSF.toFixed(2)}</td>
                    <td style={{ padding: "7px 8px" }}>{fmt$(r.baseRentMo)}</td>
                    <td style={{ padding: "7px 8px" }}>{fmt$(r.occMo)}</td>
                    <td style={{ padding: "7px 8px" }}>{fmt$(r.rev)}</td>
                    <td style={{ padding: "7px 8px", color: r.take >= target ? C.tealDeep : C.danger, fontWeight: 600 }}>{fmt$(r.take)}</td>
                    <td style={{ padding: "7px 8px", color: C.brassDeep }}>{fmt$(distYr)}</td>
                    <td style={{ padding: "7px 8px", color: netAfter >= 0 ? C.tealDeep : C.danger, fontWeight: 600 }}>
                      {netAfter < 0 ? "−" : ""}{fmt$(Math.abs(netAfter))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p style={{ fontSize: 12, color: C.inkSoft, margin: "10px 0 0" }}>
            Distributions = the distribution slider × 12. Net after dist. = owner take minus Dr. Wobbekind's ${AMBER_SALARY / 1000}k salary
            minus distributions — what's left for reserves, taxes, and reinvestment. Red means that year can't fully fund
            the salary + distribution target.
          </p>
        </div>

        {/* fixed facts */}
        <footer style={{ fontSize: 12.5, color: C.inkSoft, lineHeight: 1.7, borderTop: `1px solid ${C.line}`, paddingTop: 16 }}>
          <strong style={{ color: C.ink }}>Deal terms held fixed (July 15 LOI):</strong> Suite 280, 2,952 SF · 120-month
          term · phase-in rent $15 → $34.49/SF per schedule · TI $25/SF (${TI_TOTAL.toLocaleString()}) usable for buildout,
          cabling, and moving, forfeited if unused within 6 months · OpEx cap 5% non-cumulative, non-compounding ·
          guaranty burn-down per schedule · one 5-year renewal at greater of FMV or 103%.
          <br />
          <strong style={{ color: C.ink }}>Model assumptions:</strong> Dr. Wobbekind at {amberPanel} patients
          ({fmt$(amberMRR)}/mo MRR — 325 existing plus the slider's new adds at ${AMBER_NEW_RATE}) ·
          Jennifer's comp $110k/yr fully loaded · third provider pay per slider, panel capped at 350 ·
          MA $66k/yr escalating 3% from the chosen year · fixed overhead $95k/yr escalating 3% · variable cost $10/patient/mo ·
          no staff raises or attrition modeled.
        </footer>
      </div>
    </div>
  );
}
