import { useState, useEffect } from 'react';
import { Zap, AlertCircle, Shield, Leaf, Scale, Star, Trophy } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Legend } from 'recharts';
import { GEMINI_KEY, geminiCascadeFetch, extractJson, friendlyError } from '../services/gemini';

// ─────────────────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────────────────
interface BattleResult {
  brand: string;
  supplyChainScore: number;
  carbonScore: number;
  laborGrade: string;
  sentimentScore: number;
  overallScore: number;
  notCommercial?: boolean;
  isSimulated?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Input validation
// ─────────────────────────────────────────────────────────────────────────────
function isValidInput(val: string): boolean {
  const isUrl = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(val);
  const isBrandName = val.replace(/\s/g, '').length >= 3 && /[a-zA-ZğüşıöçĞÜŞİÖÇ]{3,}/.test(val);
  return isUrl || isBrandName;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Gemini scan — uses centralised gemini.ts service
// ─────────────────────────────────────────────────────────────────────────────
async function geminiScanBrand(brand: string, lang: string): Promise<BattleResult> {
  const outputLang = lang === 'tr' ? 'Turkish' : 'English';
  const keyPresent = Boolean(GEMINI_KEY && GEMINI_KEY.trim().length > 0);

  const prompt = `You are an enterprise sustainability intelligence analyst.

STEP 1 — ENTITY VERIFICATION:
Determine whether "${brand}" is a real, recognizable commercial entity (company, brand, retailer, or product line).
If it is NOT a real commercial entity (e.g. random letters like "asdasd", single chars, gibberish), return ONLY:
{"notCommercial": true}

STEP 2 — IF it IS a real commercial entity, return ONLY valid JSON (no markdown, no code blocks):
{
  "notCommercial": false,
  "supplyChainScore": <integer 0-100>,
  "carbonScore": <integer 0-100>,
  "laborGrade": "<A | B | C | D | F>",
  "sentimentScore": <integer 0-100>,
  "overallScore": <integer 0-100>
}
Use publicly available ESG data. Output ONLY the JSON object.
Summary language: ${outputLang}.`;

  if (keyPresent) {
    console.log(`[OzScan Battle] 🚀 Live scan for "${brand}"…`);
    const text = await geminiCascadeFetch(prompt, 512); // throws on failure
    const parsed = extractJson<Partial<BattleResult> & { notCommercial?: boolean }>(text);

    if (parsed.notCommercial === true) {
      console.warn(`[OzScan Battle] ⚠️ "${brand}" flagged as non-commercial`);
      return {
        brand,
        supplyChainScore: 0, carbonScore: 0, laborGrade: 'F',
        sentimentScore: 0, overallScore: 0,
        notCommercial: true, isSimulated: false,
      };
    }

    console.log(`%c[OzScan Battle] ✅ Live result for "${brand}"`, 'color:#22c55e;font-weight:bold', parsed);
    return {
      brand,
      supplyChainScore: parsed.supplyChainScore ?? 50,
      carbonScore:      parsed.carbonScore      ?? 50,
      laborGrade:       parsed.laborGrade       ?? 'C',
      sentimentScore:   parsed.sentimentScore   ?? 50,
      overallScore:     parsed.overallScore     ?? 50,
      notCommercial: false,
      isSimulated: false,
    };
  }

  // No key → simulation
  console.warn(`[OzScan Battle] ⚠️ No API key — simulation for "${brand}"`);
  return buildFallback(brand);
}

function buildFallback(brand: string): BattleResult {
  const base = 40 + Math.floor(Math.random() * 50);
  const v = () => Math.floor((Math.random() - 0.5) * 20);
  const s    = Math.min(100, Math.max(10, base + v()));
  const c    = Math.min(100, Math.max(10, base + v()));
  const sent = Math.min(100, Math.max(10, base + 10 + v()));
  const overall = Math.round((s + c + sent) / 3);
  const grade = overall >= 80 ? 'A' : overall >= 65 ? 'B' : overall >= 50 ? 'C' : overall >= 35 ? 'D' : 'F';
  return {
    brand, supplyChainScore: s, carbonScore: c, laborGrade: grade,
    sentimentScore: sent, overallScore: overall,
    notCommercial: false, isSimulated: true,
  };
}

function laborToNum(grade: string) {
  return grade === 'A' ? 90 : grade === 'B' ? 75 : grade === 'C' ? 60 : grade === 'D' ? 40 : 20;
}

// ─────────────────────────────────────────────────────────────────────────────
//  AnimatedBar — fills from 0 to pct on mount (useEffect, not useState init)
// ─────────────────────────────────────────────────────────────────────────────
function AnimatedBar({ pct, color }: { pct: number; color: string }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(pct), 100);
    return () => clearTimeout(t);
  }, [pct]);
  return (
    <div
      className="h-full rounded-full transition-all duration-700 ease-out"
      style={{ width: `${w}%`, backgroundColor: color }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Loading panel
// ─────────────────────────────────────────────────────────────────────────────
function BattleLoadingPanel({ brandA, brandB, lang }: { brandA: string; brandB: string; lang: string }) {
  const isTr = lang === 'tr';
  return (
    <div className="rounded-2xl p-10 text-center mb-6"
      style={{
        background: 'linear-gradient(135deg, rgba(0,217,128,0.04) 0%, transparent 100%)',
        border: '1px solid rgba(0,217,128,0.15)',
        backdropFilter: 'blur(12px)',
      }}>
      <div className="flex items-center justify-center gap-8 mb-6">
        <div className="text-center">
          <div className="relative w-14 h-14 mx-auto mb-2">
            <div className="absolute inset-0 border-4 rounded-full" style={{ borderColor: 'rgba(0,217,128,0.1)' }} />
            <div className="absolute inset-0 border-4 border-transparent rounded-full animate-spin"
              style={{ borderTopColor: '#00d980', animationDuration: '1.1s' }} />
          </div>
          <p className="text-xs font-semibold truncate max-w-[100px]" style={{ color: '#00d980' }}>{brandA}</p>
        </div>
        <div className="font-black text-2xl" style={{ color: 'rgba(100,100,100,0.6)' }}>VS</div>
        <div className="text-center">
          <div className="relative w-14 h-14 mx-auto mb-2">
            <div className="absolute inset-0 border-4 rounded-full" style={{ borderColor: 'rgba(59,130,246,0.1)' }} />
            <div className="absolute inset-0 border-4 border-transparent rounded-full animate-spin"
              style={{ borderTopColor: '#3b82f6', animationDuration: '0.9s' }} />
          </div>
          <p className="text-xs font-semibold truncate max-w-[100px]" style={{ color: '#3b82f6' }}>{brandB}</p>
        </div>
      </div>
      <p className="font-semibold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>
        {isTr ? 'Karşılaştırma analizi yapılıyor…' : 'Running comparison analysis…'}
      </p>
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {isTr ? 'İki marka eş zamanlı olarak taranıyor' : 'Both brands being scanned simultaneously'}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Error panel
// ─────────────────────────────────────────────────────────────────────────────
function BattleErrorPanel({ message, onRetry, lang }: { message: string; onRetry: () => void; lang: string }) {
  const isTr = lang === 'tr';
  return (
    <div className="rounded-2xl p-8 mb-6 text-center"
      style={{ background: 'rgba(234,179,8,0.03)', border: '1px solid rgba(234,179,8,0.2)' }}>
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
        style={{ backgroundColor: 'rgba(234,179,8,0.1)' }}>
        <AlertCircle size={24} className="text-amber-400" />
      </div>
      <h3 className="font-semibold text-lg mb-2" style={{ color: 'var(--text-primary)' }}>
        {isTr ? 'Karşılaştırma tamamlanamadı' : 'Comparison could not complete'}
      </h3>
      <p className="text-sm leading-relaxed max-w-sm mx-auto mb-5" style={{ color: 'var(--text-secondary)' }}>
        {message}
      </p>
      <button onClick={onRetry}
        className="inline-flex items-center gap-2 font-semibold px-5 py-2.5 rounded-xl text-sm transition-all hover:opacity-90"
        style={{ backgroundColor: '#00d980', color: '#000' }}>
        <Zap size={14} />
        {isTr ? 'Tekrar Dene' : 'Try Again'}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Page
// ─────────────────────────────────────────────────────────────────────────────
export function BattlePage() {
  const {
    t, lang, theme, isAuthenticated, user,
    setShowAuthModal, setAuthModalMode, spendCredit, setCurrentPage,
  } = useApp();

  const [brandA, setBrandA] = useState('');
  const [brandB, setBrandB] = useState('');
  const [inputErrorA, setInputErrorA] = useState('');
  const [inputErrorB, setInputErrorB] = useState('');
  const [apiError, setApiError]       = useState('');
  const [loading, setLoading] = useState(false);
  const [resultA, setResultA] = useState<BattleResult | null>(null);
  const [resultB, setResultB] = useState<BattleResult | null>(null);
  const [authWarning, setAuthWarning] = useState(false);
  const [creditWarning, setCreditWarning] = useState(false);

  const isLight = theme === 'light';

  // ── Color helpers ──────────────────────────────────────────────────────────
  const textPrimary = isLight ? '#000000' : '#ffffff';
  const textBody    = isLight ? '#111827' : '#e4e4e7';
  const textMuted   = isLight ? '#555555' : '#71717a';
  const cardBg      = isLight ? 'rgba(255,255,255,0.95)' : 'rgba(12,12,12,0.9)';
  const cardBorder  = isLight ? '#e5e7eb' : '#1c1c1c';
  const inputBg     = isLight ? '#ffffff' : '#0f0f0f';
  const inputBorder = isLight ? '#d1d5db' : '#2a2a2a';

  const runCompare = async (a: string, b: string) => {
    setLoading(true);
    setResultA(null);
    setResultB(null);
    setApiError('');

    try {
      const [ra, rb] = await Promise.all([
        geminiScanBrand(a, lang),
        geminiScanBrand(b, lang),
      ]);

      if (ra.notCommercial) { setInputErrorA(t('input_not_commercial')); }
      if (rb.notCommercial) { setInputErrorB(t('input_not_commercial')); }
      if (ra.notCommercial || rb.notCommercial) { setLoading(false); return; }

      spendCredit();
      spendCredit();
      setResultA(ra);
      setResultB(rb);
    } catch (err) {
      const friendly = friendlyError(err, lang);
      console.error('[OzScan Battle] ❌ handleCompare error:', err);
      setApiError(friendly);
    }

    setLoading(false);
  };

  const handleCompare = async (e: React.FormEvent) => {
    e.preventDefault();
    let valid = true;
    if (!isValidInput(brandA.trim())) { setInputErrorA(t('input_invalid')); valid = false; } else { setInputErrorA(''); }
    if (!isValidInput(brandB.trim())) { setInputErrorB(t('input_invalid')); valid = false; } else { setInputErrorB(''); }
    if (!valid) return;

    setAuthWarning(false); setCreditWarning(false); setApiError('');
    if (!isAuthenticated) { setAuthWarning(true); return; }
    if (!user || user.credits < 2) { setCreditWarning(true); return; }

    await runCompare(brandA.trim(), brandB.trim());
  };

  const handleRetry = () => {
    setApiError('');
    if (brandA.trim() && brandB.trim()) runCompare(brandA.trim(), brandB.trim());
  };

  // Winner logic: require ≥5 pt gap to declare a clear winner
  const GAP_THRESHOLD = 5;
  const winner = resultA && resultB
    ? Math.abs(resultA.overallScore - resultB.overallScore) < GAP_THRESHOLD
      ? 'insufficient'
      : resultA.overallScore > resultB.overallScore ? resultA.brand : resultB.brand
    : null;

  const radarData = resultA && resultB ? [
    { subject: t('chart_supply'),    A: resultA.supplyChainScore, B: resultB.supplyChainScore },
    { subject: t('chart_carbon'),    A: resultA.carbonScore,      B: resultB.carbonScore },
    { subject: t('chart_labor'),     A: laborToNum(resultA.laborGrade), B: laborToNum(resultB.laborGrade) },
    { subject: t('chart_sentiment'), A: resultA.sentimentScore,   B: resultB.sentimentScore },
    { subject: t('chart_overall'),   A: resultA.overallScore,     B: resultB.overallScore },
  ] : [];

  const gradeColor: Record<string, string> = {
    A: '#00d980', B: '#3b82f6', C: '#eab308', D: '#f97316', F: '#ef4444',
  };

  const metrics = resultA && resultB ? [
    { label: t('scanner_supply_score'),   icon: Shield, a: resultA.supplyChainScore, b: resultB.supplyChainScore },
    { label: t('scanner_carbon_est'),     icon: Leaf,   a: resultA.carbonScore,      b: resultB.carbonScore },
    { label: t('scanner_sentiment_live'), icon: Star,   a: resultA.sentimentScore,   b: resultB.sentimentScore },
    { label: t('scanner_overall'),        icon: Zap,    a: resultA.overallScore,     b: resultB.overallScore },
  ] : [];

  const anySimulated = (resultA?.isSimulated || resultB?.isSimulated) ?? false;
  const keyPresent   = Boolean(GEMINI_KEY && GEMINI_KEY.trim().length > 0);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)', paddingTop: 64 }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">

        {/* ── Header ── */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold" style={{ color: textPrimary }}>{t('battle_title')}</h1>
          <p className="mt-1 text-base" style={{ color: textMuted }}>{t('battle_desc')}</p>
        </div>

        {/* ── Form ── */}
        <div className="rounded-2xl p-6 mb-6"
          style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, backdropFilter: 'blur(12px)' }}>
          <form onSubmit={handleCompare}>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-4 items-start">

              {/* Brand A */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: textMuted }}>{t('battle_brand_a')}</label>
                <input
                  value={brandA}
                  onChange={e => { setBrandA(e.target.value); if (inputErrorA) setInputErrorA(''); }}
                  placeholder="Nike, Tesla, H&M..."
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                  style={{
                    backgroundColor: inputBg,
                    border: `1px solid ${inputErrorA ? '#ef4444' : inputBorder}`,
                    color: textPrimary,
                    boxShadow: inputErrorA ? '0 0 0 3px rgba(239,68,68,0.1)' : 'none',
                  }}
                />
                {inputErrorA && (
                  <p className="flex items-center gap-1 text-xs mt-1.5" style={{ color: '#ef4444' }}>
                    <AlertCircle size={12} className="flex-shrink-0" /> {inputErrorA}
                  </p>
                )}
              </div>

              {/* VS separator */}
              <div className="flex items-center justify-center sm:pt-7">
                <div className="font-bold text-lg w-12 h-12 flex items-center justify-center rounded-xl"
                  style={{
                    backgroundColor: isLight ? '#f3f4f6' : '#1a1a1a',
                    border: `1px solid ${cardBorder}`,
                    color: textMuted,
                  }}>
                  {t('battle_vs')}
                </div>
              </div>

              {/* Brand B */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: textMuted }}>{t('battle_brand_b')}</label>
                <input
                  value={brandB}
                  onChange={e => { setBrandB(e.target.value); if (inputErrorB) setInputErrorB(''); }}
                  placeholder="Adidas, Ford, Zara..."
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                  style={{
                    backgroundColor: inputBg,
                    border: `1px solid ${inputErrorB ? '#ef4444' : inputBorder}`,
                    color: textPrimary,
                    boxShadow: inputErrorB ? '0 0 0 3px rgba(239,68,68,0.1)' : 'none',
                  }}
                />
                {inputErrorB && (
                  <p className="flex items-center gap-1 text-xs mt-1.5" style={{ color: '#ef4444' }}>
                    <AlertCircle size={12} className="flex-shrink-0" /> {inputErrorB}
                  </p>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !brandA.trim() || !brandB.trim()}
              className="mt-5 w-full flex items-center justify-center gap-2 font-bold py-4 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #00d980, #00b86a)', color: '#000000' }}
            >
              {loading ? (
                <><div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />{t('scanner_scanning')}</>
              ) : (
                <><Zap size={18} />{t('battle_compare')}</>
              )}
            </button>

            <p className="text-xs mt-2 text-center" style={{ color: textMuted }}>
              {user ? `${user.credits} ${t('nav_credits')} · ` : ''}
              {lang === 'tr' ? '2 kredi harcar' : 'costs 2 credits'}
            </p>
          </form>
        </div>

        {/* ── Auth Warning ── */}
        {authWarning && (
          <div className="rounded-xl p-4 mb-6 flex items-center justify-between"
            style={{ backgroundColor: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)' }}>
            <div className="flex items-center gap-2">
              <AlertCircle size={16} style={{ color: '#eab308' }} />
              <span className="text-sm" style={{ color: '#eab308' }}>{t('scanner_auth_required')}</span>
            </div>
            <button onClick={() => { setAuthModalMode('login'); setShowAuthModal(true); }}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: '#eab308', color: '#000' }}>
              {t('nav_login')}
            </button>
          </div>
        )}

        {/* ── Credit Warning ── */}
        {creditWarning && (
          <div className="rounded-xl p-4 mb-6 flex items-center justify-between"
            style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
            <div className="flex items-center gap-2">
              <AlertCircle size={16} style={{ color: '#ef4444' }} />
              <span className="text-sm" style={{ color: '#ef4444' }}>
                {t('scanner_credit_required')} {lang === 'tr' ? '(2 kredi gerekli)' : '(2 credits required)'}
              </span>
            </div>
            <button onClick={() => setCurrentPage('pricing')}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: '#ef4444', color: '#fff' }}>
              {t('settings_buy_credits')}
            </button>
          </div>
        )}

        {/* ── Loading ── */}
        {loading && <BattleLoadingPanel brandA={brandA} brandB={brandB} lang={lang} />}

        {/* ── Error ── */}
        {apiError && !loading && <BattleErrorPanel message={apiError} onRetry={handleRetry} lang={lang} />}

        {/* ── Results ── */}
        {resultA && resultB && !loading && (
          <div className="space-y-5">

            {/* Simulation notice — only shown when no key */}
            {anySimulated && !keyPresent && (
              <div className="rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm"
                style={{ backgroundColor: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', color: '#eab308' }}>
                ⚗ {lang === 'tr' ? 'Simülasyon verisi · API anahtarı yok' : 'Simulation data · No API key'}
              </div>
            )}

            {/* Winner banner */}
            <div className="rounded-2xl p-5 flex items-center gap-4"
              style={{
                backgroundColor: winner === 'insufficient'
                  ? (isLight ? 'rgba(243,244,246,0.9)' : 'rgba(30,30,30,0.8)')
                  : winner
                    ? 'rgba(234,179,8,0.08)'
                    : (isLight ? 'rgba(243,244,246,0.9)' : 'rgba(30,30,30,0.8)'),
                border: `1px solid ${winner && winner !== 'insufficient' ? 'rgba(234,179,8,0.3)' : cardBorder}`,
              }}>
              <Trophy size={28} style={{
                color: winner && winner !== 'insufficient' ? '#eab308' : textMuted,
                flexShrink: 0,
              }} />
              <div>
                <div className="font-bold text-lg" style={{ color: textPrimary }}>
                  {winner === 'insufficient'
                    ? t('battle_winner_insufficient')
                    : winner
                      ? `🏆 ${t('battle_winner')}: ${winner}`
                      : t('battle_tie')}
                </div>
                <div className="text-sm" style={{ color: textMuted }}>
                  {resultA.overallScore} vs {resultB.overallScore} — {t('scanner_overall')}
                  {winner === 'insufficient' && (
                    <span className="ml-2 text-xs" style={{ color: textMuted }}>
                      ({lang === 'tr' ? 'Fark < 5 puan' : 'Gap < 5 pts'})
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Radar chart */}
            <div className="rounded-2xl p-6"
              style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, backdropFilter: 'blur(12px)' }}>
              <h3 className="font-semibold mb-4" style={{ color: textPrimary }}>{t('chart_brand_comparison')}</h3>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke={isLight ? '#e0e0e0' : '#27272a'} />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: textMuted, fontSize: 11 }} />
                  <Radar name={resultA.brand} dataKey="A" stroke="#00d980" fill="#00d980" fillOpacity={0.15} />
                  <Radar name={resultB.brand} dataKey="B" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} />
                  <Legend wrapperStyle={{ color: textMuted, fontSize: '12px' }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Metric bars */}
            <div className="rounded-2xl p-6 space-y-4"
              style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, backdropFilter: 'blur(12px)' }}>
              {metrics.map(({ label, icon: Icon, a, b }) => {
                const aWins = a > b + 2;
                const bWins = b > a + 2;
                const total = a + b || 1;
                return (
                  <div key={label}>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon size={14} style={{ color: textMuted }} />
                      <span className="text-sm" style={{ color: textMuted }}>{label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold w-8 text-right"
                        style={{ color: aWins ? '#00d980' : textPrimary }}>{a}</span>
                      <div className="flex-1 flex gap-0.5 h-3 rounded-full overflow-hidden"
                        style={{ backgroundColor: isLight ? '#f3f4f6' : '#1a1a1a' }}>
                        <AnimatedBar pct={(a / total) * 100} color="#00d980" />
                        <AnimatedBar pct={(b / total) * 100} color="#3b82f6" />
                      </div>
                      <span className="text-sm font-bold w-8"
                        style={{ color: bWins ? '#3b82f6' : textPrimary }}>{b}</span>
                    </div>
                    <div className="flex justify-between text-xs mt-0.5 px-11" style={{ color: textMuted }}>
                      <span>{resultA.brand}</span>
                      <span>{resultB.brand}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Labor grades */}
            <div className="grid grid-cols-2 gap-4">
              {[resultA, resultB].map((r, idx) => (
                <div key={r.brand} className="rounded-xl p-5 text-center"
                  style={{
                    backgroundColor: cardBg,
                    border: `1px solid ${idx === 0 ? 'rgba(0,217,128,0.25)' : 'rgba(59,130,246,0.25)'}`,
                    backdropFilter: 'blur(12px)',
                  }}>
                  <Scale size={20} style={{ color: textMuted, margin: '0 auto 8px' }} />
                  <div className="text-4xl font-black mb-1" style={{ color: gradeColor[r.laborGrade] ?? textPrimary }}>
                    {r.laborGrade}
                  </div>
                  <div className="text-xs" style={{ color: textMuted }}>{t('scanner_labor_grade')}</div>
                  <div className="text-sm font-semibold mt-1" style={{ color: textBody }}>{r.brand}</div>
                </div>
              ))}
            </div>

            {/* Insufficient data notice */}
            {winner === 'insufficient' && (
              <div className="rounded-xl p-4 flex items-start gap-3"
                style={{
                  backgroundColor: isLight ? 'rgba(243,244,246,0.9)' : 'rgba(30,30,30,0.8)',
                  border: `1px solid ${cardBorder}`,
                }}>
                <AlertCircle size={18} style={{ color: textMuted, flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: textPrimary }}>{t('battle_insufficient_data')}</p>
                  <p className="text-xs mt-1" style={{ color: textMuted }}>
                    {lang === 'tr'
                      ? 'İki markanın puanları birbirine çok yakın. Kesin bir sonuç belirlemek mümkün değil.'
                      : 'The two brands scored too closely together. No definitive conclusion can be drawn.'}
                  </p>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
