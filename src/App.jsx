import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// ── CONSTANTS ──────────────────────────────────────────────
const SPEEDS = [1000, 400, 200, 50, 10];
const SPEED_LABELS = ["1/s", "2.5/s", "5/s", "20/s", "100/s"];
const CANDLE_PERIOD = 5;

const ASSET_DEFS = [
  // baseVol  = σ par tick pour initialiser l'EWMA  (≈ vol annuelle / √252000)
  // mu       = drift μ par tick (très petit, légèrement positif = croissance longue terme)
  // La volatilité réelle sera calculée dynamiquement via EWMA à chaque tick
  { id: 0, ticker: "APEX", name: "Apex Technology",  color: "#60a5fa", initPrice: 100, divYield: 0.02, baseVol: 0.012, mu:  0.00005, corr: [1,    0.3,  0.1,  0.2,  0.4 ] },
  { id: 1, ticker: "NORD", name: "Nord Energy",       color: "#fbbf24", initPrice: 80,  divYield: 0.04, baseVol: 0.010, mu:  0.00000, corr: [0.3,  1,    0.05, 0.5,  0.15] },
  { id: 2, ticker: "VEGA", name: "Vega Pharma",       color: "#a78bfa", initPrice: 120, divYield: 0.01, baseVol: 0.022, mu:  0.00008, corr: [0.1,  0.05, 1,    0.05, 0.1 ] },
  { id: 3, ticker: "IRON", name: "IronCore Ind.",     color: "#fb923c", initPrice: 60,  divYield: 0.03, baseVol: 0.008, mu: -0.00002, corr: [0.2,  0.5,  0.05, 1,    0.25] },
  { id: 4, ticker: "LUNA", name: "Luna Consumer",     color: "#f472b6", initPrice: 90,  divYield: 0.02, baseVol: 0.011, mu:  0.00003, corr: [0.4,  0.15, 0.1,  0.25, 1   ] },
];

const AGENT_DEFS = [
  { id: 0, name: "TrendBot",      emoji: "📈", color: "#34d399", strategy: "trend",       aggression: 0.7 },
  { id: 1, name: "MeanRev",       emoji: "🔄", color: "#60a5fa", strategy: "meanrev",     aggression: 0.6 },
  { id: 2, name: "MomentumKing",  emoji: "🚀", color: "#f472b6", strategy: "momentum",    aggression: 0.8 },
  { id: 3, name: "ValueHunter",   emoji: "🎯", color: "#fbbf24", strategy: "fundamental", aggression: 0.5 },
  { id: 4, name: "ChaosMonkey",   emoji: "🐒", color: "#a78bfa", strategy: "noise",       aggression: 0.9 },
  { id: 5, name: "Contrarian",    emoji: "🦅", color: "#fb923c", strategy: "contrarian",  aggression: 0.6 },
  { id: 6, name: "Citadel",       emoji: "🏛️", color: "#e2e8f0", strategy: "marketmaker", aggression: 0.95 },
];

const NEWS = [
  { text: "APEX annonce rachat d'actions 2Mds$",             imp: [0.04, 0.09],  ast: [0]       },
  { text: "Partenariat stratégique APEX & LUNA",             imp: [0.02, 0.06],  ast: [0, 4]    },
  { text: "APEX bat les estimations de CA de 12%",           imp: [0.05, 0.10],  ast: [0]       },
  { text: "Nouveau supercalculateur APEX révolutionnaire",   imp: [0.03, 0.07],  ast: [0]       },
  { text: "APEX signe contrat gouvernemental 500M$",         imp: [0.04, 0.09],  ast: [0]       },
  { text: "Brevets IA d'APEX valorisés à 3Mds$",            imp: [0.03, 0.06],  ast: [0]       },
  { text: "Spin-off division cloud APEX annoncé",            imp: [0.06, 0.11],  ast: [0]       },
  { text: "Goldman Sachs rehausse APEX à Strong Buy",        imp: [0.02, 0.05],  ast: [0]       },
  { text: "Rapport ESG : APEX leader durabilité",            imp: [0.02, 0.04],  ast: [0]       },
  { text: "Boom semi-conducteurs profite à APEX",            imp: [0.03, 0.07],  ast: [0]       },
  { text: "Fuite de données massive chez APEX",              imp: [-0.08, -0.04], ast: [0]       },
  { text: "APEX visé par enquête antitrust EU",              imp: [-0.07, -0.03], ast: [0]       },
  { text: "CEO d'APEX démissionne brutalement",              imp: [-0.09, -0.05], ast: [0]       },
  { text: "APEX manque objectifs de 15%",                    imp: [-0.10, -0.05], ast: [0]       },
  { text: "Recall produit coûteux pour APEX",                imp: [-0.06, -0.03], ast: [0]       },
  { text: "Régulation IA : nouvelles contraintes tech",      imp: [-0.04, -0.01], ast: [0]       },
  { text: "NORD découvre nouveau gisement pétrolier",        imp: [0.06, 0.12],  ast: [1]       },
  { text: "Prix du pétrole s'envolent de 8%",                imp: [0.04, 0.08],  ast: [1, 3]    },
  { text: "NORD remporte contrat infrastructure",            imp: [0.03, 0.07],  ast: [1]       },
  { text: "NORD augmente son dividende de 10%",              imp: [0.03, 0.06],  ast: [1]       },
  { text: "Fusion IRON & NORD en discussion",                imp: [0.05, 0.10],  ast: [1, 3]    },
  { text: "Pipeline NORD endommagé, fermeture temporaire",   imp: [-0.07, -0.03], ast: [1]       },
  { text: "Chute prix du gaz naturel de 12%",                imp: [-0.08, -0.04], ast: [1]       },
  { text: "NORD sous amende environnementale majeure",       imp: [-0.06, -0.02], ast: [1]       },
  { text: "Morgan Stanley dégrade NORD à Sell",              imp: [-0.04, -0.02], ast: [1]       },
  { text: "Sécheresse : production énergétique en baisse",   imp: [-0.04, -0.02], ast: [1]       },
  { text: "VEGA obtient approbation FDA blockbuster",        imp: [0.10, 0.18],  ast: [2]       },
  { text: "Essai clinique VEGA phase 3 : résultats excellents", imp: [0.08, 0.15], ast: [2]      },
  { text: "VEGA signe accord licence 1Md$",                  imp: [0.05, 0.10],  ast: [2]       },
  { text: "Nouveau brevet VEGA prolongé 10 ans",             imp: [0.03, 0.07],  ast: [2]       },
  { text: "OPA hostile sur VEGA : prime de 30%",             imp: [0.10, 0.20],  ast: [2]       },
  { text: "Percée thérapeutique cancer : VEGA pivot",        imp: [0.05, 0.10],  ast: [2]       },
  { text: "Effets secondaires : essai VEGA suspendu",        imp: [-0.12, -0.06], ast: [2]       },
  { text: "Brevet VEGA expiré, génériques en approche",      imp: [-0.08, -0.04], ast: [2]       },
  { text: "FDA rejette demande d'approbation VEGA",          imp: [-0.11, -0.06], ast: [2]       },
  { text: "Recall médicament VEGA aux USA",                  imp: [-0.09, -0.05], ast: [2]       },
  { text: "Bridgewater short massivement VEGA",              imp: [-0.05, -0.03], ast: [2]       },
  { text: "Commandes industrielles IRON +18%",               imp: [0.05, 0.09],  ast: [3]       },
  { text: "IRON remporte méga-contrat infrastructure",       imp: [0.06, 0.11],  ast: [3]       },
  { text: "Plan relance : IRON bénéficiaire principal",      imp: [0.07, 0.12],  ast: [3, 1]    },
  { text: "IRON automatise 3 usines, productivité +25%",     imp: [0.04, 0.08],  ast: [3]       },
  { text: "Warren Buffett révèle position dans IRON",        imp: [0.05, 0.09],  ast: [3]       },
  { text: "Grève générale dans les usines IRON",             imp: [-0.07, -0.03], ast: [3]       },
  { text: "Matières premières : coûts +30% pour IRON",       imp: [-0.06, -0.03], ast: [3, 1]   },
  { text: "IRON rappelle 40 000 unités défectueuses",        imp: [-0.05, -0.02], ast: [3]       },
  { text: "Accord Paris : normes strictes pour industrie",   imp: [-0.03, -0.01], ast: [1, 3]   },
  { text: "Ventes record LUNA fêtes +22%",                   imp: [0.05, 0.10],  ast: [4]       },
  { text: "LUNA s'implante sur le marché asiatique",         imp: [0.06, 0.11],  ast: [4]       },
  { text: "LUNA lance plateforme fidélité premium",          imp: [0.04, 0.08],  ast: [4]       },
  { text: "LUNA acquiert startup IA pour 800M$",             imp: [0.02, 0.06],  ast: [4]       },
  { text: "E-commerce explose : LUNA bénéficiaire",          imp: [0.04, 0.08],  ast: [4, 0]    },
  { text: "Boycott massif produits LUNA sur réseaux",        imp: [-0.07, -0.03], ast: [4]       },
  { text: "Scandale qualité : LUNA rappelle ses produits",   imp: [-0.08, -0.04], ast: [4]       },
  { text: "Inflation : consommateurs réduisent dépenses",    imp: [-0.05, -0.02], ast: [4, 3]   },
  { text: "La Fed baisse ses taux de 50 bps",                imp: [0.02, 0.05],  ast: [0,1,2,3,4] },
  { text: "PIB Q3 surprend à la hausse (+3.2%)",             imp: [0.01, 0.04],  ast: [0,1,2,3,4] },
  { text: "Inflation retombe à 2% : euphorie des marchés",   imp: [0.03, 0.06],  ast: [0,1,2,3,4] },
  { text: "Accord commercial USA-UE signé",                  imp: [0.02, 0.05],  ast: [0, 3, 4] },
  { text: "Chômage au plus bas historique (3.1%)",           imp: [0.01, 0.04],  ast: [4, 0]    },
  { text: "S&P 500 franchit nouveau record historique",      imp: [0.02, 0.04],  ast: [0,1,2,3,4] },
  { text: "La Fed remonte les taux de 75 bps",               imp: [-0.04, -0.02], ast: [0,1,2,3,4] },
  { text: "Récession technique confirmée au Q2",             imp: [-0.05, -0.02], ast: [0,1,2,3,4] },
  { text: "Tensions géopolitiques : marchés sous pression",  imp: [-0.03, -0.01], ast: [1, 3]   },
  { text: "Crise bancaire : liquidités en tension",          imp: [-0.06, -0.03], ast: [0,1,2,3,4] },
  { text: "Flash crash : circuit breakers activés",          imp: [-0.05, -0.03], ast: [0,1,2,3,4] },
  { text: "Inflation surprise 6.8% : panique obligataire",   imp: [-0.04, -0.02], ast: [0,1,2,3,4] },
  { text: "Cyberattaque mondiale paralyse bourses 2h",       imp: [-0.04, -0.02], ast: [0, 2]   },
  { text: "Défaut souverain : onde de choc marchés",         imp: [-0.07, -0.04], ast: [0,1,2,3,4] },
  { text: "Prix lithium s'effondrent : bonne nouvelle",      imp: [0.02, 0.05],  ast: [3, 0]    },
  { text: "Indice confiance consommateur au plus haut",      imp: [0.03, 0.06],  ast: [4, 0]    },
  { text: "APEX lève 3Mds$ en obligations vertes",           imp: [0.02, 0.05],  ast: [0]       },
  { text: "VEGA et APEX co-développent IA médicale",         imp: [0.03, 0.07],  ast: [0, 2]    },
  { text: "NORD et IRON fusionnent leur logistique",         imp: [0.02, 0.05],  ast: [1, 3]    },
  { text: "LUNA entre au CAC 40",                            imp: [0.04, 0.08],  ast: [4]       },
  { text: "Hausse TVA : consommation en berne",              imp: [-0.03, -0.01], ast: [4, 3]   },
  { text: "Rapport sénatorial sur la fraude fiscale tech",   imp: [-0.02, -0.01], ast: [0]       },
  { text: "Pénurie de composants : IRON en sous-prod.",      imp: [-0.04, -0.02], ast: [3, 0]   },
  { text: "APEX rachète son concurrent pour 5Mds$",         imp: [0.03, 0.08],  ast: [0]       },
];

const SCENARIOS = [
  { name: "💥 Crise 2008",  id: "crash2008"   },
  { name: "🫧 Bulle Tech",  id: "techbubble"  },
  { name: "📉 Stagflation", id: "stagflation" },
  { name: "🐂 Bull Run",    id: "bullrun"     },
];

// ── INIT ──────────────────────────────────────────────────
const mkAssets = () => ASSET_DEFS.map(d => ({
  ...d,
  price:       d.initPrice,
  fv:          d.initPrice,
  anchorPrice: d.initPrice,
  ewmaVar:     d.baseVol ** 2,   // variance EWMA initialisée à baseVol²
  history:     [{ t: 0, price: d.initPrice, fv: d.initPrice }],
  candles:     [],
  cc:          { open: d.initPrice, high: d.initPrice, low: d.initPrice, close: d.initPrice, vol: 0 },
  nextEarnings: 60 + Math.floor(Math.random() * 40),
  nextDiv:      180 + Math.floor(Math.random() * 60),
  divHistory:   [],
  splitHistory: [],
  newsShock:    0,  // impact news résiduel à diffuser sur les prochains ticks
}));

const mkAgents = () => AGENT_DEFS.map(d => ({
  ...d,
  cash: 10000,
  port: Object.fromEntries(ASSET_DEFS.map(a => [a.id, 10])),
  pnlH: [0],
  memory: [],
  inv: Object.fromEntries(ASSET_DEFS.map(a => [a.id, 0])),
}));

const mkCorr = () => ASSET_DEFS.map(a => [...a.corr]);

const initTv = ag => ag.cash + ASSET_DEFS.reduce((s, a) => s + (ag.port[a.id] || 0) * a.initPrice, 0);
const tv     = (ag, assets) => ag.cash + ASSET_DEFS.reduce((s, a) => s + (ag.port[a.id] || 0) * assets[a.id].price, 0);

// ── AGENT DECISION ────────────────────────────────────────
function decide(agent, assets, lastNews) {
  const aid = Math.floor(Math.random() * ASSET_DEFS.length);
  const asset = assets[aid];
  const { history, price, fv } = asset;

  if (history.length < 5) return null;

  const s5  = history.slice(-5).map(h => h.price);
  const s10 = history.slice(-Math.min(10, history.length)).map(h => h.price);
  const ma  = s10.reduce((a, b) => a + b, 0) / s10.length;
  const last = s5[s5.length - 1];
  const prev = s5[s5.length - 2];
  const mom  = (last - s5[0]) / s5[0];

  const recentLoss = agent.memory.slice(-8).filter(m => m.aid === aid && m.r < 0).length;
  const aggrMod = recentLoss > 5 ? 0.25 : recentLoss > 3 ? 0.55 : 1;

  // News reaction — fundamental & valueHunter sur-réagissent aux news qui les concernent
  if (lastNews && lastNews.ast.includes(aid)) {
    const newsImpact = lastNews.imp; // positif ou négatif
    if (agent.strategy === "fundamental" || agent.strategy === "meanrev") {
      // Ils agissent dans le sens de la news avec forte conviction
      const newsQty = Math.max(1, Math.floor(Math.random() * 8 * agent.aggression));
      if (newsImpact > 0) {
        const mb = Math.floor(agent.cash / price);
        if (mb >= 1) return { type: "buy", qty: Math.min(newsQty, mb), aid };
      } else {
        const sh = agent.port[aid] || 0;
        if (sh >= 1) return { type: "sell", qty: Math.min(newsQty, sh), aid };
      }
    }
    if (agent.strategy === "contrarian") {
      // Contrarian fait l'inverse
      const newsQty = Math.max(1, Math.floor(Math.random() * 5 * agent.aggression));
      if (newsImpact > 0) {
        const sh = agent.port[aid] || 0;
        if (sh >= 1) return { type: "sell", qty: Math.min(newsQty, sh), aid };
      } else {
        const mb = Math.floor(agent.cash / price);
        if (mb >= 1) return { type: "buy", qty: Math.min(newsQty, mb), aid };
      }
    }
  }

  if (agent.strategy === "marketmaker") {
    const invAid = (agent.port[aid] || 0) - 10; // inventaire net = positions détenues - position neutre cible (10)

    // Spread dynamique : s'élargit avec la volatilité réalisée récente
    const recentPrices = history.slice(-10).map(h => h.price);
    let realizedVol = 0;
    if (recentPrices.length > 2) {
      const returns = recentPrices.slice(1).map((p, k) => (p - recentPrices[k]) / recentPrices[k]);
      const meanR   = returns.reduce((a, b) => a + b, 0) / returns.length;
      realizedVol   = Math.sqrt(returns.reduce((s, r) => s + (r - meanR) ** 2, 0) / returns.length);
    }
    // Spread minimum 0.2%, max 2.5% en période très volatile
    const dynamicSpread = Math.min(0.025, Math.max(0.002, realizedVol * 3));

    // Limite stricte d'inventaire : max ±30 actions par rapport à la cible neutre
    const MAX_INV = 30;
    // Réserve de cash : ne jamais descendre sous 20% du cash initial
    const CASH_FLOOR = 2000;

    // Signal : rééquilibrer vers la position neutre si trop exposé,
    // sinon alterner buy/sell pour capturer le spread
    let sig;
    if (invAid > MAX_INV)       sig = -1;  // trop long → vendre
    else if (invAid < -MAX_INV) sig = 1;   // trop short → acheter
    else                        sig = Math.random() > 0.5 ? 1 : -1;

    const qty = Math.max(1, Math.floor(Math.random() * 5));

    if (sig === 1) {
      // Achat : on achète BAS (bid) pour revendre plus haut
      if (agent.cash - qty * price < CASH_FLOOR) return null;
      const execPrice = price * (1 - dynamicSpread); // on achète en dessous du mid
      const mb = Math.floor((agent.cash - CASH_FLOOR) / execPrice);
      if (mb < 1) return null;
      return { type: "buy", qty: Math.min(qty, mb), aid, mm: true, execPrice };
    } else {
      // Vente : on vend HAUT (ask) pour avoir acheté plus bas
      const execPrice = price * (1 + dynamicSpread); // on vend au-dessus du mid
      const sh = agent.port[aid] || 0;
      if (sh < 1) return null;
      return { type: "sell", qty: Math.min(qty, sh), aid, mm: true, execPrice };
    }
  }

  let sig = 0;
  switch (agent.strategy) {
    case "trend":       sig = last > prev ? 1 : -1; break;
    case "meanrev":     sig = price < ma * 0.98 ? 1 : price > ma * 1.02 ? -1 : 0; break;
    case "momentum":    sig = mom > 0.01 ? 1 : mom < -0.01 ? -1 : 0; break;
    case "fundamental": sig = price < fv * 0.95 ? 1 : price > fv * 1.05 ? -1 : 0; break;
    case "noise":       sig = Math.random() > 0.5 ? 1 : -1; break;
    case "contrarian":  sig = mom > 0.015 ? -1 : mom < -0.015 ? 1 : 0; break;
  }

  if (sig === 0 || Math.random() > agent.aggression * aggrMod) return null;

  const qty = Math.max(1, Math.floor(Math.random() * 5 * agent.aggression));
  if (sig === 1) {
    const mb = Math.floor(agent.cash / price);
    if (mb < 1) return null;
    return { type: "buy", qty: Math.min(qty, mb), aid };
  } else {
    const sh = agent.port[aid] || 0;
    if (sh < 1) return null;
    return { type: "sell", qty: Math.min(qty, sh), aid };
  }
}

// ── CANDLESTICK SVG ───────────────────────────────────────
const CandleChart = ({ candles, fvLine }) => {
  if (!candles || candles.length < 2) {
    return (
      <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#334155", fontSize: 12 }}>
        En attente de données…
      </div>
    );
  }

  const W = 560, H = 200, PL = 44, PR = 8, PT = 8;
  const VOL_H = 30; // hauteur zone volume
  const PRICE_H = H - PT - VOL_H - 24; // hauteur zone prix (24 = labels bas)
  const cW = W - PL - PR;

  const prices = candles.flatMap(c => [c.high, c.low]);
  const fvs  = fvLine || [];
  const mn   = Math.min(...prices, ...fvs) * 0.998;
  const mx   = Math.max(...prices, ...fvs) * 1.002;
  const rng  = mx - mn || 1;
  const toY  = p => PT + PRICE_H - ((p - mn) / rng) * PRICE_H;

  const maxVol = Math.max(...candles.map(c => c.vol || 1), 1);
  const volY   = (v) => VOL_H * (v / maxVol); // hauteur de barre volume

  const sp = cW / candles.length;
  const cw = Math.max(2, sp * 0.7);
  const ticks = [mn, mn + rng / 3, mn + 2 * rng / 3, mx];
  const volTop = PT + PRICE_H + 6; // y de base des barres volume

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      {/* Price grid lines */}
      {ticks.map((v, i) => (
        <g key={i}>
          <line x1={PL} y1={toY(v)} x2={PL + cW} y2={toY(v)} stroke="#1e3a5f" strokeWidth={1} />
          <text x={PL - 4} y={toY(v) + 4} textAnchor="end" fill="#475569" fontSize={8}>${v.toFixed(1)}</text>
        </g>
      ))}
      {/* Fair value line */}
      {fvs.length > 1 && (
        <polyline
          points={fvs.map((f, i) => `${PL + (i / (fvs.length - 1)) * cW},${toY(f)}`).join(" ")}
          fill="none" stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="5 3" opacity={0.7}
        />
      )}
      {/* Candles */}
      {candles.map((c, i) => {
        const cx  = PL + i * sp + sp / 2;
        const up  = c.close >= c.open;
        const col = up ? "#34d399" : "#f87171";
        const bT  = toY(Math.max(c.open, c.close));
        const bB  = toY(Math.min(c.open, c.close));
        const vh  = volY(c.vol || 0);
        const volCol = up ? "#166534" : "#7f1d1d";
        return (
          <g key={i}>
            {/* Wick */}
            <line x1={cx} y1={toY(c.high)} x2={cx} y2={toY(c.low)} stroke={col} strokeWidth={1} />
            {/* Body */}
            <rect x={cx - cw / 2} y={bT} width={cw} height={Math.max(1, bB - bT)} fill={col} />
            {/* Volume bar */}
            <rect x={cx - cw / 2} y={volTop + VOL_H - vh} width={cw} height={Math.max(1, vh)} fill={volCol} opacity={0.85} />
          </g>
        );
      })}
      {/* Volume label */}
      <text x={PL - 4} y={volTop + 8} textAnchor="end" fill="#334155" fontSize={7}>VOL</text>
    </svg>
  );
};

// ── HEATMAP ───────────────────────────────────────────────
const Heatmap = ({ matrix, labels, title }) => {
  const bg = v =>
    v >= 0.7 ? "#065f46" : v >= 0.4 ? "#047857" : v >= -0.4 ? "#1e293b" : v >= -0.7 ? "#7f1d1d" : "#450a0a";
  const fg = v =>
    v >= 0.4 ? "#34d399" : v >= -0.4 ? "#94a3b8" : "#fca5a5";

  return (
    <div>
      {title && <div style={{ color: "#94a3b8", fontSize: 10, letterSpacing: 1, marginBottom: 8 }}>{title}</div>}
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "separate", borderSpacing: 2, fontSize: 10 }}>
          <thead>
            <tr>
              <td style={{ width: 45 }} />
              {labels.map(l => (
                <th key={l} style={{ color: "#64748b", padding: "2px 4px", fontWeight: 600 }}>{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={i}>
                <td style={{ color: "#64748b", paddingRight: 4, fontWeight: 600, fontSize: 9, textAlign: "right" }}>
                  {labels[i]}
                </td>
                {row.map((v, j) => (
                  <td key={j} style={{ background: bg(v), color: fg(v), padding: "3px 5px", textAlign: "center", borderRadius: 3 }}>
                    {v.toFixed(2)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── ORDER BOOK ────────────────────────────────────────────
const OrderBook = ({ book, asset }) => {
  if (!book || !book.bids || book.bids.length === 0) {
    return (
      <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#334155", fontSize: 12 }}>
        En attente de données…
      </div>
    );
  }

  const maxQty = Math.max(...book.bids.map(b => b.qty), ...book.asks.map(a => a.qty), 1);

  return (
    <div style={{ fontFamily: "monospace", fontSize: 11 }}>
      {/* Header */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, color: "#64748b", fontSize: 9, letterSpacing: 1, marginBottom: 6, padding: "0 4px" }}>
        <span>QTÉ</span>
        <span style={{ textAlign: "center" }}>PRIX</span>
        <span style={{ textAlign: "right" }}>QTÉ</span>
      </div>

      {/* Bids & Asks interleaved by level */}
      {book.asks.slice().reverse().map((ask, k) => {
        const bid = book.bids[book.asks.length - 1 - k];
        const askFill = (ask.qty / maxQty) * 100;
        const bidFill = bid ? (bid.qty / maxQty) * 100 : 0;
        return (
          <div key={k} style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 2, marginBottom: 2, alignItems: "center" }}>
            {/* Bid side */}
            <div style={{ position: "relative", height: 18, borderRadius: 3, overflow: "hidden", background: "#0f172a" }}>
              <div style={{ position: "absolute", right: 0, top: 0, height: "100%", width: `${bidFill}%`, background: "#064e3b", opacity: 0.8 }} />
              {bid && <span style={{ position: "absolute", right: 4, top: 2, color: "#34d399", fontSize: 10 }}>{bid.qty}</span>}
            </div>
            {/* Mid price column */}
            <div style={{ width: 72, textAlign: "center", fontSize: 10, fontWeight: 700 }}>
              <span style={{ color: "#f87171" }}>{ask.px.toFixed(2)}</span>
            </div>
            {/* Ask side */}
            <div style={{ position: "relative", height: 18, borderRadius: 3, overflow: "hidden", background: "#0f172a" }}>
              <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${askFill}%`, background: "#450a0a", opacity: 0.8 }} />
              <span style={{ position: "absolute", left: 4, top: 2, color: "#f87171", fontSize: 10 }}>{ask.qty}</span>
            </div>
          </div>
        );
      })}

      {/* Spread row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 2, margin: "4px 0", alignItems: "center" }}>
        <div />
        <div style={{ width: 72, textAlign: "center", background: "#1e3a5f", borderRadius: 4, padding: "2px 0" }}>
          <div style={{ color: "#e2e8f0", fontSize: 9, fontWeight: 700 }}>MID</div>
          <div style={{ color: asset?.color || "#60a5fa", fontSize: 11, fontWeight: 700 }}>${book.mid?.toFixed(2)}</div>
          <div style={{ color: "#475569", fontSize: 8 }}>spread ${book.spread}</div>
        </div>
        <div />
      </div>

      {/* Bid rows */}
      {book.bids.map((bid, k) => {
        const ask = book.asks[k];
        const bidFill = (bid.qty / maxQty) * 100;
        const askFill = ask ? (ask.qty / maxQty) * 100 : 0;
        return (
          <div key={k} style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 2, marginBottom: 2, alignItems: "center" }}>
            <div style={{ position: "relative", height: 18, borderRadius: 3, overflow: "hidden", background: "#0f172a" }}>
              <div style={{ position: "absolute", right: 0, top: 0, height: "100%", width: `${bidFill}%`, background: "#064e3b", opacity: 0.8 }} />
              <span style={{ position: "absolute", right: 4, top: 2, color: "#34d399", fontSize: 10 }}>{bid.qty}</span>
            </div>
            <div style={{ width: 72, textAlign: "center", fontSize: 10, fontWeight: 700 }}>
              <span style={{ color: "#34d399" }}>{bid.px.toFixed(2)}</span>
            </div>
            <div style={{ position: "relative", height: 18, borderRadius: 3, overflow: "hidden", background: "#0f172a" }}>
              {ask && <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${askFill}%`, background: "#450a0a", opacity: 0.8 }} />}
              {ask && <span style={{ position: "absolute", left: 4, top: 2, color: "#f87171", fontSize: 10 }}>{ask.qty}</span>}
            </div>
          </div>
        );
      })}

      {/* Imbalance bar */}
      <div style={{ marginTop: 10 }}>
        <div style={{ color: "#64748b", fontSize: 9, letterSpacing: 1, marginBottom: 4 }}>IMBALANCE BID/ASK</div>
        {(() => {
          const totalBid = book.bids.reduce((s, b) => s + b.qty, 0);
          const totalAsk = book.asks.reduce((s, a) => s + a.qty, 0);
          const total    = totalBid + totalAsk || 1;
          const bidPct   = (totalBid / total * 100).toFixed(1);
          const askPct   = (totalAsk / total * 100).toFixed(1);
          return (
            <div>
              <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 4 }}>
                <div style={{ width: `${bidPct}%`, background: "#16a34a" }} />
                <div style={{ width: `${askPct}%`, background: "#dc2626" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#64748b" }}>
                <span style={{ color: "#34d399" }}>BID {bidPct}%</span>
                <span style={{ color: "#f87171" }}>ASK {askPct}%</span>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

// ── APP ───────────────────────────────────────────────────
export default function App() {
  const [tab,     setTab]     = useState("market");
  const [run,     setRun]     = useState(false);
  const [spd,     setSpd]     = useState(1);
  const [selA,    setSelA]    = useState(0);
  const [assets,  setAssets]  = useState(mkAssets);
  const [agents,  setAgents]  = useState(mkAgents);
  const [corr,    setCorr]    = useState(mkCorr);
  const [tick,    setTick]    = useState(0);
  const [trades,     setTrades]     = useState([]);
  const [newsLog,    setNewsLog]    = useState([]);
  const [orderBook,  setOrderBook]  = useState({ bids: [], asks: [] });
  const [notif,   setNotif]   = useState(null);
  const [player,  setPlayer]  = useState({
    cash: 50000,
    port: Object.fromEntries(ASSET_DEFS.map(a => [a.id, 0])),
    pnlH: [0],
    oi: { aid: 0, qty: 10 },
  });

  const ref    = useRef(null);
  const selARef = useRef(selA);
  useEffect(() => { selARef.current = selA; }, [selA]);

  const initRef = () => ({
    assets:    mkAssets(),
    agents:    mkAgents(),
    corr:      mkCorr(),
    tick:      0,
    player:    { cash: 50000, port: Object.fromEntries(ASSET_DEFS.map(a => [a.id, 0])), pnlH: [0], oi: { aid: 0, qty: 10 } },
    nextNews:  50 + Math.floor(Math.random() * 50),
  });
  if (!ref.current) ref.current = initRef();

  const notify = useCallback(msg => {
    setNotif(msg);
    setTimeout(() => setNotif(null), 3500);
  }, []);

  const reset = useCallback(() => {
    setRun(false);
    const s = initRef();
    ref.current = s;
    setAssets([...s.assets]);
    setAgents([...s.agents]);
    setCorr([...s.corr]);
    setTick(0);
    setTrades([]);
    setNewsLog([]);
    setOrderBook({ bids: [], asks: [] });
    setNotif(null);
    setPlayer({ cash: 50000, port: Object.fromEntries(ASSET_DEFS.map(a => [a.id, 0])), pnlH: [0], oi: { aid: 0, qty: 10 } });
  }, []);

  const shock = useCallback(type => {
    const s = ref.current;
    const pct = type === "crash" ? -(Math.random() * 15 + 15) : Math.random() * 15 + 15;
    const na = s.assets.map(a => ({ ...a, price: Math.max(1, a.price * (1 + pct / 100)) }));
    ref.current = { ...s, assets: na };
    setAssets([...na]);
    notify({
      text: `${type === "crash" ? "💥 KRACH" : "🚀 RALLYE"} ${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`,
      color: type === "crash" ? "#f87171" : "#34d399",
      bg: type === "crash" ? "#450a0a" : "#052e16",
      border: type === "crash" ? "#dc2626" : "#16a34a",
    });
  }, [notify]);

  const scenario = useCallback(id => {
    const s = ref.current;
    let na  = [...s.assets];
    let msg = "", color = "#fbbf24", bg = "#422006", border = "#d97706";

    if (id === "crash2008") {
      na  = na.map(a => {
        const factor = 0.52 + Math.random() * 0.12;
        return { ...a, price: Math.max(1, a.price * factor), fv: a.fv * (0.6 + Math.random() * 0.1), anchorPrice: a.anchorPrice * (0.58 + Math.random() * 0.1) };
      });
      msg = "💥 CRISE 2008 — Marchés en chute libre";
    }
    if (id === "techbubble") {
      na  = na.map((a, i) => i === 0
        ? { ...a, price: a.price * (2.5 + Math.random()), fv: a.fv * 0.8, anchorPrice: a.anchorPrice * 0.85 }
        : a);
      msg = "🫧 BULLE TECH — APEX suracheté";
    }
    if (id === "stagflation") {
      na  = na.map(a => ({ ...a, fv: a.fv * (0.72 + Math.random() * 0.1), anchorPrice: a.anchorPrice * (0.74 + Math.random() * 0.08) }));
      msg = "📉 STAGFLATION — Fair values en baisse";
    }
    if (id === "bullrun") {
      na  = na.map(a => ({ ...a, fv: a.fv * (1.28 + Math.random() * 0.22), anchorPrice: a.anchorPrice * (1.25 + Math.random() * 0.2) }));
      msg = "🐂 BULL RUN — Fondamentaux en hausse";
    }

    ref.current = { ...s, assets: na };
    setAssets([...na]);
    notify({ text: msg, color, bg, border });
  }, [notify]);

  const placeOrder = useCallback((type, aid, qty) => {
    const s     = ref.current;
    const price = s.assets[aid].price;
    const p     = s.player;

    if (type === "buy") {
      if (p.cash < qty * price) {
        notify({ text: "⚠️ Cash insuffisant", color: "#f87171", bg: "#450a0a", border: "#dc2626" });
        return;
      }
      const np = { ...p, cash: p.cash - qty * price, port: { ...p.port, [aid]: (p.port[aid] || 0) + qty } };
      ref.current = { ...s, player: np };
      setPlayer(prev => ({ ...np, oi: prev.oi }));
    } else {
      if ((p.port[aid] || 0) < qty) {
        notify({ text: "⚠️ Positions insuffisantes", color: "#f87171", bg: "#450a0a", border: "#dc2626" });
        return;
      }
      const np = { ...p, cash: p.cash + qty * price, port: { ...p.port, [aid]: (p.port[aid] || 0) - qty } };
      ref.current = { ...s, player: np };
      setPlayer(prev => ({ ...np, oi: prev.oi }));
    }

    notify({
      text: `✅ ${type === "buy" ? "Achat" : "Vente"} ${qty}× ${ASSET_DEFS[aid].ticker} @ $${price.toFixed(2)}`,
      color: type === "buy" ? "#34d399" : "#f87171",
      bg: type === "buy" ? "#052e16" : "#450a0a",
      border: type === "buy" ? "#16a34a" : "#dc2626",
    });
  }, [notify]);

// ── GAUSSIAN SAMPLER (Box-Muller) ────────────────────────
// Produit Z ~ N(0,1) pour le terme de Wiener du GBM
function randn() {
  let u, v;
  do { u = Math.random(); } while (u === 0);
  do { v = Math.random(); } while (v === 0);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ── SIMULATION LOOP ─────────────────────────────────────
  useEffect(() => {
    if (!run) return;

    const interval = setInterval(() => {
      const s = ref.current;
      let { assets, agents, corr, tick, player, nextNews, lastNews } = s;
      const nt = tick + 1;

      const pressures = Array(5).fill(0);
      const newTrades = [];

      // Agents make decisions
      let newAgents = agents.map(ag => {
        const dec = decide(ag, assets, lastNews);
        if (!dec) return ag;

        const a     = { ...ag, port: { ...ag.port }, inv: { ...ag.inv }, memory: [...ag.memory] };
        const asset = assets[dec.aid];
        const price = dec.execPrice ?? (asset.price * (dec.mm ? (dec.type === "buy" ? 1.001 : 0.999) : 1));

        if (dec.type === "buy") {
          const cost = dec.qty * price;
          if (a.cash < cost) return ag;
          a.cash -= cost;
          a.port[dec.aid] = (a.port[dec.aid] || 0) + dec.qty;
          if (dec.mm) a.inv[dec.aid] = (a.inv[dec.aid] || 0) + dec.qty;
          pressures[dec.aid] += dec.qty;
          newTrades.push({ agent: ag.name, emoji: ag.emoji, color: ag.color, type: "BUY",  qty: dec.qty, aid: dec.aid, price: price.toFixed(2) });
        } else {
          const sh = a.port[dec.aid] || 0;
          if (sh < dec.qty) return ag;
          const rev = dec.qty * price;
          a.cash += rev;
          a.port[dec.aid] = sh - dec.qty;
          if (dec.mm) a.inv[dec.aid] = (a.inv[dec.aid] || 0) - dec.qty;
          pressures[dec.aid] -= dec.qty;
          newTrades.push({ agent: ag.name, emoji: ag.emoji, color: ag.color, type: "SELL", qty: dec.qty, aid: dec.aid, price: price.toFixed(2) });
        }

        const result = dec.type === "buy" ? asset.price - price : price - asset.price;
        a.memory = [...a.memory, { aid: dec.aid, type: dec.type, r: result }].slice(-20);
        return a;
      });

      // Update assets
      let newsEntry    = null;
      let newNextNews  = nextNews;

      let newAssets = assets.map((asset, i) => {
        let { price, fv, history, candles, cc, nextEarnings, nextDiv,
              divHistory, splitHistory, divYield, ewmaVar, newsShock = 0 } = asset;

        // ── 1. EWMA volatility update (RiskMetrics λ = 0.94)
        // On calcule le log-return du tick précédent et on met à jour la variance
        const LAMBDA     = 0.94;
        const lastPrice  = history.length > 0 ? history[history.length - 1].price : price;
        const lastReturn = lastPrice > 0 ? Math.log(price / lastPrice) : 0;
        const newEwmaVar = LAMBDA * ewmaVar + (1 - LAMBDA) * lastReturn ** 2;
        // Plancher : on ne laisse pas la vol tomber en dessous de baseVol/3
        // Plafond : 5× baseVol² pour éviter les explosions après un choc extrême
        const clampedVar = Math.max(
          (asset.baseVol / 3) ** 2,
          Math.min(newEwmaVar, (asset.baseVol * 5) ** 2)
        );
        const sigma = Math.sqrt(clampedVar); // σ réalisé ce tick

        // ── 2. Fair value drift — mean-reversion lente vers anchorPrice
        const fvPull  = (asset.anchorPrice - fv) * 0.003;
        const fvNoise = sigma * 0.4 * randn(); // FV bouge moins que le prix
        fv = Math.max(1, fv + fvPull + fvNoise);

        // ── 3. Correlation effect from order pressures
        let corrFx = 0;
        pressures.forEach((p, j) => { if (i !== j) corrFx += corr[i][j] * p * 0.015; });

        // ── 4. GBM price step : S(t+1) = S(t) · exp((μ - σ²/2) + σ·Z)
        // Le terme (μ - σ²/2) est la correction d'Itô pour rester non-biaisé
        const mu       = asset.mu;
        const Z        = randn();
        const gbmStep  = Math.exp((mu - clampedVar / 2) + sigma * Z);
        // Pression d'ordres : impact réduit (0.02 au lieu de 0.06)
        const pressure = pressures[i] * 0.02 / Math.max(price, 1);
        // Mean-reversion vers la fair value — force de rappel douce (0.8% par tick)
        const fvPullPrice = (fv - price) / price * 0.008;
        // Diffusion progressive du choc news : 5% de l'impact résiduel par tick sur ~20 ticks
        const SHOCK_DECAY  = 0.05;
        const shockStep    = newsShock * SHOCK_DECAY;
        const newNewsShock = newsShock * (1 - SHOCK_DECAY);
        let newPrice = Math.max(0.01, price * gbmStep * (1 + pressure + fvPullPrice + shockStep) * (1 + corrFx / price));

        // ── 5. Volume ce tick
        const tickVol = Math.abs(pressures[i]) + Math.floor(Math.random() * 6);

        // ── 6. Plancher de faillite — extrêmement rare
        const bankruptcyFloor = asset.initPrice * 0.04;
        if (newPrice < bankruptcyFloor && Math.random() < 0.003) {
          newPrice = 0.01;
          fv = 0.01;
          setTimeout(() => notify({
            text:   `☠️ FAILLITE — ${asset.ticker} délisted !`,
            color:  "#fca5a5", bg: "#450a0a", border: "#dc2626",
          }), 0);
        }

        // Earnings event
        let nE = nextEarnings;
        if (nt >= nextEarnings) {
          const r        = Math.random();
          const surprise = r > 0.65 ? Math.random() * 10 + 3 : r < 0.3 ? -(Math.random() * 10 + 3) : (Math.random() - 0.5) * 4;
          fv = Math.max(1, fv * (1 + surprise / 100));
          nE = nt + 60 + Math.floor(Math.random() * 40);
          setTimeout(() => notify({
            text:   `📊 ${asset.ticker} Earnings ${surprise >= 3 ? "BEAT 🟢" : surprise <= -3 ? "MISS 🔴" : "IN-LINE ⚪"} ${surprise >= 0 ? "+" : ""}${surprise.toFixed(1)}%`,
            color:  surprise >= 3 ? "#34d399" : surprise <= -3 ? "#f87171" : "#a5b4fc",
            bg:     surprise >= 3 ? "#052e16" : surprise <= -3 ? "#450a0a" : "#1e1b4b",
            border: surprise >= 3 ? "#16a34a" : surprise <= -3 ? "#dc2626" : "#6366f1",
          }), 0);
        }

        // Dividend
        let nD  = nextDiv;
        let nDH = divHistory;
        if (nt >= nextDiv) {
          const amt       = newPrice * divYield * (0.9 + Math.random() * 0.2);
          nDH             = [...divHistory, { t: nt, amount: +amt.toFixed(2) }].slice(-10);
          nD              = nt + 180 + Math.floor(Math.random() * 60);
          const newDivYield = Math.max(0.005, divYield + (Math.random() - 0.5) * 0.001);
          newAgents = newAgents.map(ag => {
            const sh = ag.port[i] || 0;
            return sh === 0 ? ag : { ...ag, cash: ag.cash + sh * amt };
          });
          asset = { ...asset, divYield: newDivYield };
        }

        // Stock split
        let nSH = splitHistory;
        let sp  = newPrice;
        if (sp > asset.initPrice * 3 && Math.random() < 0.001) {
          sp  = sp / 2;
          fv  = fv / 2;
          nSH = [...splitHistory, { t: nt, ratio: "2:1", price: +sp.toFixed(2) }];
          newAgents = newAgents.map(ag => ({ ...ag, port: { ...ag.port, [i]: (ag.port[i] || 0) * 2 } }));
          setTimeout(() => notify({ text: `✂️ SPLIT 2:1 — ${asset.ticker} prix ÷2, actions ×2`, color: "#fbbf24", bg: "#422006", border: "#d97706" }), 0);
        }

        const newH = [...history, { t: nt, price: +sp.toFixed(2), fv: +fv.toFixed(2), vol: +sigma.toFixed(5) }].slice(-200);

        // Candle update — on accumule le volume dans cc.vol
        let newCC      = { ...cc, high: Math.max(cc.high, sp), low: Math.min(cc.low, sp), close: sp, vol: (cc.vol || 0) + tickVol };
        let newCandles = candles;
        if (nt % CANDLE_PERIOD === 0) {
          newCandles = [...candles, { ...newCC, t: nt }].slice(-80);
          newCC      = { open: sp, high: sp, low: sp, close: sp, vol: 0 };
        }

        return {
          ...asset,
          price:    +sp.toFixed(2),
          fv:       +fv.toFixed(2),
          ewmaVar:  clampedVar,
          newsShock: newNewsShock,
          history:  newH, candles: newCandles, cc: newCC,
          nextEarnings: nE, nextDiv: nD, divHistory: nDH, splitHistory: nSH,
        };
      });

      // News event
      if (nt >= nextNews) {
        const item = NEWS[Math.floor(Math.random() * NEWS.length)];
        // Amplitude réduite de ~35% pour éviter les sauts trop violents
        const rawImp = item.imp[0] + Math.random() * (item.imp[1] - item.imp[0]);
        const imp    = rawImp * 0.65;
        newAssets = newAssets.map((a, i) => {
          if (!item.ast.includes(i)) return a;
          // L'impact sur fv reste (ancrage fondamental), mais le prix se diffuse via newsShock
          const newFv = Math.max(1, a.fv * (1 + imp));
          // newsShock s'accumule : impact total étalé sur ~20 ticks
          const addedShock = imp * 0.6; // 60% de l'impact passe par le prix progressivement
          return { ...a, fv: newFv, newsShock: (a.newsShock || 0) + addedShock };
        });
        newsEntry  = { t: nt, text: item.text, imp: +(imp * 100).toFixed(1), ast: item.ast };
        newNextNews = nt + 30 + Math.floor(Math.random() * 70);
      }

      // Correlation drift
      const newCorr = corr.map((row, i) => row.map((v, j) => {
        if (i === j) return 1;
        return Math.max(-0.9, Math.min(0.9, v + (Math.random() - 0.5) * 0.002));
      }));

      // PnL history
      newAgents = newAgents.map(ag => {
        const pct = ((tv(ag, newAssets) / initTv(ag)) - 1) * 100;
        return { ...ag, pnlH: [...ag.pnlH, +pct.toFixed(2)].slice(-200) };
      });

      const playerTv  = player.cash + ASSET_DEFS.reduce((s, a) => s + (player.port[a.id] || 0) * newAssets[a.id].price, 0);
      const playerPct = ((playerTv / 50000) - 1) * 100;
      const newPlayer = { ...player, pnlH: [...player.pnlH, +playerPct.toFixed(2)].slice(-200) };

      ref.current = { assets: newAssets, agents: newAgents, corr: newCorr, tick: nt, player: newPlayer, nextNews: newNextNews, lastNews: newsEntry || lastNews };

      setAssets([...newAssets]);
      setAgents([...newAgents]);
      setCorr([...newCorr]);
      setTick(nt);
      setTrades(prev => [...newTrades, ...prev].slice(0, 40));
      if (newsEntry) setNewsLog(prev => [newsEntry, ...prev].slice(0, 25));
      setPlayer(prev => ({ ...newPlayer, oi: prev.oi }));

      // ── ORDER BOOK — reconstruit à chaque tick pour l'actif sélectionné
      // On simule un carnet d'ordres à partir du prix mid + spread Citadel
      setOrderBook(prev => {
        const midPrice = newAssets[selARef.current].price;
        const spread   = midPrice * 0.002; // spread 0.2%
        const LEVELS   = 8;
        const bids = Array.from({ length: LEVELS }, (_, k) => {
          const px  = +(midPrice - spread * (k + 1) * (0.5 + Math.random() * 0.5)).toFixed(2);
          const qty = Math.floor(5 + Math.random() * 30 + (pressures[selARef.current] > 0 ? pressures[selARef.current] * 2 : 0));
          return { px, qty };
        });
        const asks = Array.from({ length: LEVELS }, (_, k) => {
          const px  = +(midPrice + spread * (k + 1) * (0.5 + Math.random() * 0.5)).toFixed(2);
          const qty = Math.floor(5 + Math.random() * 30 + (pressures[selARef.current] < 0 ? -pressures[selARef.current] * 2 : 0));
          return { px, qty };
        });
        return { bids, asks, mid: midPrice, spread: +(spread * 2).toFixed(3) };
      });
    }, SPEEDS[spd]);

    return () => clearInterval(interval);
  }, [run, spd, notify]);

  // ── DERIVED ──────────────────────────────────────────────
  const asset  = assets[selA];
  const pctChg = asset.history.length > 1
    ? ((asset.price - asset.history[0].price) / asset.history[0].price * 100).toFixed(2)
    : "0.00";
  const priceUp = parseFloat(pctChg) >= 0;

  const pnlData = useMemo(() => {
    const maxL = Math.max(...agents.map(a => a.pnlH.length), player.pnlH.length);
    return Array.from({ length: maxL }, (_, i) => {
      const row = { t: i };
      agents.forEach(ag => { row[ag.name] = ag.pnlH[i] ?? null; });
      row["Vous"] = player.pnlH[i] ?? null;
      return row;
    });
  }, [agents, player.pnlH]);

  const agentCorrM = useMemo(() => agents.map((a, i) => agents.map((b, j) => {
    if (i === j) return 1;
    const na  = a.pnlH.slice(-40);
    const nb  = b.pnlH.slice(-40);
    const len = Math.min(na.length, nb.length);
    if (len < 4) return 0;
    const ma  = na.slice(0, len).reduce((s, v) => s + v, 0) / len;
    const mb  = nb.slice(0, len).reduce((s, v) => s + v, 0) / len;
    const num = na.slice(0, len).reduce((s, v, k) => s + (v - ma) * (nb[k] - mb), 0);
    const da  = Math.sqrt(na.slice(0, len).reduce((s, v) => s + (v - ma) ** 2, 0));
    const db  = Math.sqrt(nb.slice(0, len).reduce((s, v) => s + (v - mb) ** 2, 0));
    return da * db === 0 ? 0 : +(num / (da * db)).toFixed(2);
  })), [agents]);

  const pTv  = player.cash + ASSET_DEFS.reduce((s, a) => s + (player.port[a.id] || 0) * assets[a.id].price, 0);
  const pPnl = (((pTv / 50000) - 1) * 100).toFixed(2);

  const tabSt = t => ({
    padding: "7px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600,
    border: "none",
    background:   tab === t ? "#1e293b" : "transparent",
    color:        tab === t ? "#f8fafc"  : "#64748b",
    borderBottom: tab === t ? "2px solid #60a5fa" : "2px solid transparent",
    borderRadius: "6px 6px 0 0",
  });

  const fvLine = asset.candles.slice(-60).map((_, i) => {
    const idx = asset.history.length - 60 + i;
    return idx >= 0 ? (asset.history[idx]?.fv || asset.fv) : asset.fv;
  });

  // ── RENDER ────────────────────────────────────────────────
  return (
    <div style={{ background: "#0f172a", minHeight: "100vh", color: "#e2e8f0", fontFamily: "monospace", padding: "12px 16px", maxWidth: 900, margin: "0 auto" }}>
      <style>{`
        @media (max-width: 620px) {
          .grid-3col { grid-template-columns: 1fr !important; }
          .grid-2col { grid-template-columns: 1fr !important; }
          .topbar-btns { flex-direction: column; align-items: flex-start; }
          .tabs-row button { padding: 5px 8px !important; font-size: 10px !important; }
        }
      `}</style>

      {/* TOP BAR */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>
          📊 MarketSim <span style={{ color: "#64748b", fontWeight: 400, fontSize: 11 }}>t#{tick}</span>
        </div>
        <div className="topbar-btns" style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={() => setRun(r => !r)} style={{ background: run ? "#dc2626" : "#16a34a", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontWeight: 700, cursor: "pointer" }}>
            {run ? "⏸ Pause" : "▶ Start"}
          </button>
          <button onClick={() => shock("crash")} style={{ background: "#7f1d1d", color: "#fca5a5", border: "none", borderRadius: 6, padding: "6px 10px", cursor: "pointer" }}>
            💥 Krach
          </button>
          <button onClick={() => shock("rally")} style={{ background: "#14532d", color: "#86efac", border: "none", borderRadius: 6, padding: "6px 10px", cursor: "pointer" }}>
            🚀 Rallye
          </button>
          <select
            onChange={e => { if (e.target.value) { scenario(e.target.value); e.target.value = ""; } }}
            style={{ background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 6, padding: "5px 8px", cursor: "pointer" }}
          >
            <option value="">📋 Scénarios</option>
            {SCENARIOS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button onClick={reset} style={{ background: "#334155", color: "#e2e8f0", border: "none", borderRadius: 6, padding: "6px 10px", cursor: "pointer" }}>
            🔄 Reset
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#1e293b", borderRadius: 6, padding: "4px 10px" }}>
            <span style={{ color: "#64748b", fontSize: 11 }}>⚡</span>
            <input type="range" min={0} max={4} value={spd} onChange={e => setSpd(+e.target.value)} style={{ width: 64 }} />
            <span style={{ color: "#60a5fa", fontWeight: 700, minWidth: 36, fontSize: 11 }}>{SPEED_LABELS[spd]}</span>
          </div>
        </div>
      </div>

      {/* NOTIFICATION */}
      {notif && (
        <div style={{ background: notif.bg, border: `1px solid ${notif.border}`, borderRadius: 8, padding: "8px 14px", marginBottom: 10, color: notif.color, fontWeight: 600, fontSize: 13 }}>
          {notif.text}
        </div>
      )}

      {/* TABS */}
      <div className="tabs-row" style={{ display: "flex", gap: 2, borderBottom: "1px solid #1e293b", marginBottom: 12 }}>
        {[["market", "📈 Marché"], ["agents", "🤖 Agents"], ["assets", "📦 Actifs"], ["player", "🎮 Joueur"]].map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} style={tabSt(t)}>{l}</button>
        ))}
      </div>

      {/* ── MARCHÉ ── */}
      {tab === "market" && (
        <div>
          {/* Asset selector */}
          <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
            {assets.map((a, i) => {
              const ch = a.history.length > 1 ? ((a.price - a.history[0].price) / a.history[0].price * 100).toFixed(2) : "0.00";
              return (
                <button key={i} onClick={() => setSelA(i)} style={{ background: selA === i ? "#1e3a5f" : "#1e293b", color: "#e2e8f0", border: `1px solid ${selA === i ? a.color : "#334155"}`, borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontFamily: "monospace" }}>
                  {a.ticker} <span style={{ color: parseFloat(ch) >= 0 ? "#34d399" : "#f87171", fontWeight: 700 }}>{parseFloat(ch) >= 0 ? "+" : ""}{ch}%</span>
                </button>
              );
            })}
          </div>

          {/* Asset stats */}
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            {(() => {
              const liveVol   = Math.sqrt(asset.ewmaVar || asset.baseVol ** 2);
              const liveVolPct = (liveVol * 100).toFixed(2);
              const volColor  = liveVol > asset.baseVol * 2   ? "#f87171"
                              : liveVol > asset.baseVol * 1.3 ? "#fbbf24"
                              : "#94a3b8";
              return [
                { l: "PRIX",       v: `$${asset.price.toFixed(2)}`,                c: priceUp ? "#34d399" : "#f87171" },
                { l: "VAR.",       v: `${priceUp ? "+" : ""}${pctChg}%`,           c: priceUp ? "#34d399" : "#f87171" },
                { l: "FAIR VALUE", v: `$${asset.fv.toFixed(2)}`,                   c: "#60a5fa"                       },
                { l: "VOL σ/tick", v: `${liveVolPct}%`,                            c: volColor                        },
                { l: "DIV YIELD",  v: `${(asset.divYield * 100).toFixed(2)}%`,     c: "#fbbf24"                       },
              ].map(({ l, v, c }) => (
                <div key={l} style={{ background: "#1e293b", borderRadius: 8, padding: "6px 12px", flex: "1 0 70px" }}>
                  <div style={{ color: "#64748b", fontSize: 9, letterSpacing: 1 }}>{l}</div>
                  <div style={{ color: c, fontWeight: 700, fontSize: 13 }}>{v}</div>
                </div>
              ));
            })()}
          </div>

          {/* Candlestick chart */}
          <div style={{ background: "#1e293b", borderRadius: 10, padding: "10px 6px", marginBottom: 12 }}>
            <div style={{ color: "#94a3b8", fontSize: 10, marginLeft: 8, marginBottom: 4 }}>
              {asset.ticker} — {asset.name}
              <span style={{ color: "#475569", fontSize: 9, marginLeft: 8 }}>1 bougie = {CANDLE_PERIOD} ticks</span>
            </div>
            <CandleChart candles={asset.candles.slice(-60)} fvLine={fvLine} />
            <div style={{ display: "flex", gap: 10, marginLeft: 12, marginTop: 4, flexWrap: "wrap" }}>
              <span style={{ fontSize: 9, color: "#64748b" }}><span style={{ color: "#34d399" }}>█</span> Haussier <span style={{ color: "#f87171" }}>█</span> Baissier</span>
              <span style={{ fontSize: 9, color: "#64748b" }}><span style={{ color: "#60a5fa" }}>- -</span> Fair Value</span>
              <span style={{ fontSize: 9, color: "#64748b" }}><span style={{ color: "#334155" }}>▬</span> Volume</span>
            </div>
          </div>

          {/* Trades, Order Book & News */}
          <div className="grid-3col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div style={{ background: "#1e293b", borderRadius: 10, padding: 10 }}>
              <div style={{ color: "#94a3b8", fontSize: 10, letterSpacing: 1, marginBottom: 8 }}>FLUX D'ORDRES</div>
              <div style={{ maxHeight: 190, overflowY: "auto" }}>
                {trades.length === 0 && <div style={{ color: "#475569", textAlign: "center", marginTop: 20 }}>Aucun trade</div>}
                {trades.map((tr, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0", borderBottom: "1px solid #0f172a", fontSize: 10 }}>
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <span>{tr.emoji}</span>
                      <span style={{ color: tr.color, fontWeight: 600 }}>{tr.agent}</span>
                      <span style={{ color: "#475569", fontSize: 10 }}>{ASSET_DEFS[tr.aid]?.ticker}</span>
                    </div>
                    <div style={{ display: "flex", gap: 5 }}>
                      <span style={{ background: tr.type === "BUY" ? "#064e3b" : "#450a0a", color: tr.type === "BUY" ? "#34d399" : "#f87171", borderRadius: 3, padding: "1px 5px", fontSize: 9 }}>{tr.type}</span>
                      <span style={{ color: "#94a3b8" }}>{tr.qty}×${tr.price}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: "#1e293b", borderRadius: 10, padding: 10 }}>
              <div style={{ color: "#94a3b8", fontSize: 10, letterSpacing: 1, marginBottom: 8 }}>
                ORDER BOOK — {asset.ticker}
              </div>
              <OrderBook book={orderBook} asset={asset} />
            </div>

            <div style={{ background: "#1e293b", borderRadius: 10, padding: 10 }}>
              <div style={{ color: "#94a3b8", fontSize: 10, letterSpacing: 1, marginBottom: 8 }}>NEWS FEED</div>
              <div style={{ maxHeight: 190, overflowY: "auto" }}>
                {newsLog.length === 0 && <div style={{ color: "#475569", textAlign: "center", marginTop: 20 }}>Aucune news</div>}
                {newsLog.map((n, i) => (
                  <div key={i} style={{ padding: "4px 0", borderBottom: "1px solid #0f172a" }}>
                    <div style={{ color: n.imp >= 0 ? "#34d399" : "#f87171", fontSize: 9, fontWeight: 600 }}>
                      {n.imp >= 0 ? "▲" : "▼"} {n.imp >= 0 ? "+" : ""}{n.imp}% <span style={{ color: "#475569" }}>t#{n.t}</span>
                    </div>
                    <div style={{ color: "#cbd5e1", fontSize: 10 }}>{n.text}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── AGENTS ── */}
      {tab === "agents" && (
        <div>
          {/* PnL chart */}
          <div style={{ background: "#1e293b", borderRadius: 10, padding: 10, marginBottom: 12 }}>
            <div style={{ color: "#94a3b8", fontSize: 10, letterSpacing: 1, marginBottom: 8 }}>PNL HISTORIQUE (%)</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={pnlData.slice(-150)}>
                <XAxis dataKey="t" hide />
                <YAxis width={40} tick={{ fill: "#64748b", fontSize: 9 }} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", fontFamily: "monospace", fontSize: 10 }} />
                {agents.map(ag => (
                  <Line key={ag.id} type="monotone" dataKey={ag.name} stroke={ag.color} dot={false} strokeWidth={1.5} />
                ))}
                <Line type="monotone" dataKey="Vous" stroke="#fff" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              {agents.map(ag => <span key={ag.id} style={{ fontSize: 9, color: ag.color }}>● {ag.name}</span>)}
              <span style={{ fontSize: 9, color: "#fff" }}>-- Vous</span>
            </div>
          </div>

          {/* Portfolio table */}
          <div style={{ background: "#1e293b", borderRadius: 10, padding: 10, marginBottom: 12 }}>
            <div style={{ color: "#94a3b8", fontSize: 10, letterSpacing: 1, marginBottom: 8 }}>PORTEFEUILLES</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                <thead>
                  <tr style={{ color: "#64748b" }}>
                    <th style={{ textAlign: "left", padding: "3px 6px" }}>Agent</th>
                    <th style={{ padding: "3px 6px" }}>PnL</th>
                    <th style={{ padding: "3px 6px" }}>Cash</th>
                    {ASSET_DEFS.map(a => <th key={a.id} style={{ color: a.color, padding: "3px 6px" }}>{a.ticker}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {agents.map(ag => {
                    const pct = ((tv(ag, assets) / initTv(ag)) - 1) * 100;
                    return (
                      <tr key={ag.id} style={{ borderTop: "1px solid #0f172a" }}>
                        <td style={{ padding: "4px 6px" }}>{ag.emoji} <span style={{ color: ag.color }}>{ag.name}</span></td>
                        <td style={{ color: pct >= 0 ? "#34d399" : "#f87171", fontWeight: 700, textAlign: "center", padding: "4px 6px" }}>{pct >= 0 ? "+" : ""}{pct.toFixed(1)}%</td>
                        <td style={{ color: "#94a3b8", textAlign: "center", padding: "4px 6px" }}>${ag.cash.toFixed(0)}</td>
                        {ASSET_DEFS.map(a => <td key={a.id} style={{ color: "#cbd5e1", textAlign: "center", padding: "4px 6px" }}>{ag.port[a.id] || 0}</td>)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Agent correlation heatmap */}
          <div style={{ background: "#1e293b", borderRadius: 10, padding: 10 }}>
            <Heatmap matrix={agentCorrM} labels={agents.map(a => a.name.slice(0, 6))} title="CORRÉLATION PNL AGENTS" />
          </div>
        </div>
      )}

      {/* ── ACTIFS ── */}
      {tab === "assets" && (
        <div>
          {/* Mini cards */}
          <div className="grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            {assets.map((a, i) => {
              const ch = a.history.length > 1 ? ((a.price - a.history[0].price) / a.history[0].price * 100).toFixed(2) : "0.00";
              const up = parseFloat(ch) >= 0;
              return (
                <div key={i} onClick={() => { setSelA(i); setTab("market"); }} style={{ background: "#1e293b", borderRadius: 10, padding: 10, cursor: "pointer", border: `1px solid #334155` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ color: a.color, fontWeight: 700 }}>{a.ticker} <span style={{ color: "#64748b", fontWeight: 400, fontSize: 10 }}>{a.name}</span></span>
                    <span style={{ color: up ? "#34d399" : "#f87171", fontSize: 11, fontWeight: 700 }}>{up ? "+" : ""}{ch}%</span>
                  </div>
                  <div style={{ color: "#64748b", fontSize: 9, marginBottom: 4 }}>
                    Prix: ${a.price.toFixed(2)} · FV: ${a.fv.toFixed(2)} · <span style={{ color: "#94a3b8" }}>σ {(Math.sqrt(a.ewmaVar || a.baseVol**2)*100).toFixed(2)}%</span>
                  </div>
                  <ResponsiveContainer width="100%" height={45}>
                    <LineChart data={a.history.slice(-60)}>
                      <Line type="monotone" dataKey="price" stroke={a.color} dot={false} strokeWidth={1.5} />
                      <YAxis domain={["auto", "auto"]} hide />
                    </LineChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                    <span style={{ color: "#64748b", fontSize: 9 }}>Div: {(a.divYield * 100).toFixed(2)}%</span>
                    <span style={{ color: "#64748b", fontSize: 9 }}>{a.splitHistory?.length || 0} splits</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Correlation heatmap */}
          <div style={{ background: "#1e293b", borderRadius: 10, padding: 10, marginBottom: 12 }}>
            <Heatmap matrix={corr} labels={ASSET_DEFS.map(a => a.ticker)} title="CORRÉLATIONS INTER-ACTIFS" />
          </div>

          {/* Dividends & Splits */}
          <div className="grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div style={{ background: "#1e293b", borderRadius: 10, padding: 10 }}>
              <div style={{ color: "#94a3b8", fontSize: 10, letterSpacing: 1, marginBottom: 8 }}>💰 DIVIDENDES</div>
              {assets.every(a => !a.divHistory?.length) && <div style={{ color: "#475569", textAlign: "center", fontSize: 11 }}>Aucun dividende versé</div>}
              {assets.flatMap(a => (a.divHistory || []).map((d, i) => (
                <div key={`${a.id}-${i}`} style={{ padding: "3px 0", borderBottom: "1px solid #0f172a", display: "flex", gap: 8, fontSize: 10 }}>
                  <span style={{ color: a.color, fontWeight: 700 }}>{a.ticker}</span>
                  <span style={{ color: "#fbbf24" }}>+${d.amount}/action</span>
                  <span style={{ color: "#475569", fontSize: 9 }}>t#{d.t}</span>
                </div>
              )))}
            </div>
            <div style={{ background: "#1e293b", borderRadius: 10, padding: 10 }}>
              <div style={{ color: "#94a3b8", fontSize: 10, letterSpacing: 1, marginBottom: 8 }}>✂️ SPLITS</div>
              {assets.every(a => !a.splitHistory?.length) && <div style={{ color: "#475569", textAlign: "center", fontSize: 11 }}>Aucun split</div>}
              {assets.flatMap(a => (a.splitHistory || []).map((sp, i) => (
                <div key={`${a.id}-${i}`} style={{ padding: "3px 0", borderBottom: "1px solid #0f172a", display: "flex", gap: 8, fontSize: 10 }}>
                  <span style={{ color: a.color, fontWeight: 700 }}>{a.ticker}</span>
                  <span style={{ color: "#fbbf24" }}>{sp.ratio}</span>
                  <span style={{ color: "#475569", fontSize: 9 }}>→${sp.price} t#{sp.t}</span>
                </div>
              )))}
            </div>
          </div>
        </div>
      )}

      {/* ── JOUEUR ── */}
      {tab === "player" && (
        <div>
          {/* Player stats */}
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            {[
              { l: "CASH",  v: `$${player.cash.toFixed(0)}`,                                  c: "#94a3b8"                          },
              { l: "TOTAL", v: `$${pTv.toFixed(0)}`,                                          c: "#e2e8f0"                          },
              { l: "PNL",   v: `${parseFloat(pPnl) >= 0 ? "+" : ""}${pPnl}%`,                c: parseFloat(pPnl) >= 0 ? "#34d399" : "#f87171" },
            ].map(({ l, v, c }) => (
              <div key={l} style={{ background: "#1e293b", borderRadius: 8, padding: "6px 12px", flex: "1 0 80px" }}>
                <div style={{ color: "#64748b", fontSize: 9 }}>{l}</div>
                <div style={{ color: c, fontWeight: 700, fontSize: 15 }}>{v}</div>
              </div>
            ))}
          </div>

          {/* PnL vs agents */}
          <div style={{ background: "#1e293b", borderRadius: 10, padding: 10, marginBottom: 10 }}>
            <div style={{ color: "#94a3b8", fontSize: 10, letterSpacing: 1, marginBottom: 8 }}>VOTRE PNL VS AGENTS</div>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={pnlData.slice(-150)}>
                <XAxis dataKey="t" hide />
                <YAxis width={40} tick={{ fill: "#64748b", fontSize: 9 }} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", fontFamily: "monospace", fontSize: 10 }} />
                {agents.map(ag => <Line key={ag.id} type="monotone" dataKey={ag.name} stroke={ag.color} dot={false} strokeWidth={1} opacity={0.5} />)}
                <Line type="monotone" dataKey="Vous" stroke="#fff" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Positions */}
          <div style={{ background: "#1e293b", borderRadius: 10, padding: 10, marginBottom: 10 }}>
            <div style={{ color: "#94a3b8", fontSize: 10, letterSpacing: 1, marginBottom: 8 }}>VOS POSITIONS</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {ASSET_DEFS.map(a => {
                const sh = player.port[a.id] || 0;
                return (
                  <div key={a.id} style={{ background: "#0f172a", borderRadius: 6, padding: "5px 10px", minWidth: 90 }}>
                    <div style={{ color: a.color, fontWeight: 700 }}>{a.ticker}</div>
                    <div style={{ color: "#94a3b8" }}>{sh} actions</div>
                    <div style={{ color: "#64748b", fontSize: 9 }}>${(sh * assets[a.id].price).toFixed(0)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Order form */}
          <div style={{ background: "#1e293b", borderRadius: 10, padding: 10 }}>
            <div style={{ color: "#94a3b8", fontSize: 10, letterSpacing: 1, marginBottom: 10 }}>PASSER UN ORDRE</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <select
                value={player.oi?.aid ?? 0}
                onChange={e => setPlayer(p => ({ ...p, oi: { ...p.oi, aid: +e.target.value } }))}
                style={{ background: "#0f172a", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 6, padding: "5px 8px" }}
              >
                {ASSET_DEFS.map(a => <option key={a.id} value={a.id}>{a.ticker} — ${assets[a.id].price.toFixed(2)}</option>)}
              </select>
              <input
                type="number" min={1} max={500} value={player.oi?.qty ?? 10}
                onChange={e => setPlayer(p => ({ ...p, oi: { ...p.oi, qty: Math.max(1, +e.target.value) } }))}
                style={{ background: "#0f172a", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 6, padding: "5px 8px", width: 70 }}
              />
              <span style={{ color: "#64748b", fontSize: 10 }}>
                ≈ ${((player.oi?.qty || 10) * assets[player.oi?.aid ?? 0].price).toFixed(0)}
              </span>
              <button
                onClick={() => placeOrder("buy", player.oi?.aid ?? 0, player.oi?.qty ?? 10)}
                style={{ background: "#064e3b", color: "#34d399", border: "1px solid #16a34a", borderRadius: 6, padding: "6px 14px", fontWeight: 700, cursor: "pointer" }}
              >
                ACHETER
              </button>
              <button
                onClick={() => placeOrder("sell", player.oi?.aid ?? 0, player.oi?.qty ?? 10)}
                style={{ background: "#450a0a", color: "#f87171", border: "1px solid #dc2626", borderRadius: 6, padding: "6px 14px", fontWeight: 700, cursor: "pointer" }}
              >
                VENDRE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}