import { useState, useEffect, useRef } from 'react';
import {
  Search, Zap, AlertCircle, CheckCircle, TrendingUp,
  Leaf, Scale, Star, Shield, Plus, X,
} from 'lucide-react';
import { useApp, ScanResult } from '../context/AppContext';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { GEMINI_KEY, geminiCascadeFetch, extractJson, friendlyError } from '../services/gemini';

// ─────────────────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────────────────
interface AnalysisResult extends Partial<ScanResult> {
  isSimulated: boolean;
  notCommercial?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Core Gemini call — throws on any error when key is present
// ─────────────────────────────────────────────────────────────────────────────
async function analyzeWithGemini(brand: string, lang: string): Promise<AnalysisResult> {
  const keyPresent = Boolean(GEMINI_KEY && GEMINI_KEY.trim().length > 0);
  console.log(
    `%c[OzScan AI] analyzeWithGemini`,
    'color:#22c55e;font-weight:bold',
    { brand, lang, keyPresent, prefix: keyPresent ? GEMINI_KEY.slice(0, 8) + '…' : '(empty)' }
  );

  const outputLang = lang === 'tr' ? 'Turkish' : 'English';

  const prompt = `You are an enterprise sustainability intelligence analyst.

STEP 1 — ENTITY VERIFICATION:
First, determine whether "${brand}" is a real, recognizable commercial entity (a company, brand, retailer, or product line).
- If it is NOT a real commercial entity (e.g. random letters like "asdasd", "abc", "xyz", single characters, gibberish, or a non-commercial word), you MUST return this exact JSON and nothing else:
{"notCommercial": true}

STEP 2 — IF it IS a real commercial entity, return ONLY a valid JSON object (no markdown, no code blocks, no trailing commas) with this exact structure:
{
  "notCommercial": false,
  "supplyChainScore": <integer 0-100>,
  "carbonScore": <integer 0-100>,
  "laborGrade": "<A | B | C | D | F>",
  "sentimentScore": <integer 0-100>,
  "overallScore": <integer 0-100>,
  "carbonEstimate": "<estimated CO2 e.g. '2.4M tonnes/year'>",
  "summary": "<2-3 sentence analysis in ${outputLang}>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "risks": ["<risk 1>", "<risk 2>", "<risk 3>"]
}
Base your analysis on publicly available ESG data, sustainability reports, and news.
Respond ONLY with the JSON object — no other text whatsoever.`;

  // ── LIVE API PATH ──────────────────────────────────────────────────────────
  if (keyPresent) {
    console.log('[OzScan AI] 🚀 Attempting LIVE Gemini API call…');
    const text = await geminiCascadeFetch(prompt, 1024); // throws on failure
    const parsed = extractJson<Partial<ScanResult> & { notCommercial?: boolean }>(text);

    if (parsed.notCommercial === true) {
      console.warn('[OzScan AI] ⚠️ Gemini flagged input as non-commercial entity:', brand);
      return { isSimulated: false, notCommercial: true };
    }

    console.log('%c[OzScan AI] ✅ LIVE result received', 'color:#22c55e;font-weight:bold', parsed);
    return { ...parsed, isSimulated: false, notCommercial: false };
  }

  // ── NO-KEY PATH: simulation ────────────────────────────────────────────────
  console.warn('%c[OzScan AI] ⚠️ No Gemini key — SIMULATION mode.', 'color:#f59e0b;font-weight:bold');
  return buildSimulation(brand, lang);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Simulation builder (no-key path only)
// ─────────────────────────────────────────────────────────────────────────────
function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function buildSimulation(brand: string, lang: string): AnalysisResult {
  const brandLower = brand.toLowerCase();
  const isKnownGreen = ['patagonia', 'tesla', 'ikea', 'unilever', 'microsoft'].some(b => brandLower.includes(b));
  const isKnownBad  = ['shein', 'primark', 'boohoo', 'fast fashion'].some(b => brandLower.includes(b));

  const base = isKnownGreen ? 75 : isKnownBad ? 30 : 48 + Math.floor(Math.random() * 30);
  const v = () => Math.floor((Math.random() - 0.5) * 20);

  const supplyChainScore = clamp(base + v(), 10, 100);
  const carbonScore      = clamp(base + v(), 10, 100);
  const sentimentScore   = clamp(base + 10 + v(), 10, 100);
  const overallScore     = Math.round((supplyChainScore + carbonScore + sentimentScore) / 3);
  const laborGrade =
    overallScore >= 80 ? 'A' :
    overallScore >= 65 ? 'B' :
    overallScore >= 50 ? 'C' :
    overallScore >= 35 ? 'D' : 'F';

  const isTr = lang === 'tr';
  const summary = isTr
    ? `${brand}, sürdürülebilirlik performansı açısından ${overallScore >= 70 ? 'sektörün üst diliminde' : overallScore >= 50 ? 'ortalama düzeyde' : 'geliştirilmesi gereken alanlarda'} yer almaktadır.`
    : `${brand} ranks ${overallScore >= 70 ? 'in the top tier' : overallScore >= 50 ? 'at average levels' : 'in areas needing improvement'} for sustainability.`;

  return {
    supplyChainScore, carbonScore, laborGrade, sentimentScore, overallScore,
    carbonEstimate: `${(Math.random() * 5 + 0.5).toFixed(1)}M tonnes/year`,
    summary,
    strengths: isTr
      ? ['Güçlü marka bilinirliği ve tüketici güveni', 'Sürdürülebilirlik raporlama standartlarına uyum', 'Yenilenebilir enerji yatırımları']
      : ['Strong brand recognition and consumer trust', 'Compliance with sustainability reporting standards', 'Renewable energy investments'],
    risks: isTr
      ? ['Tedarik zincirinde izlenemeyen alt yükleniciler', 'Scope 3 emisyonlarında yetersiz şeffaflık', 'Gelişmekte olan pazarlarda işçi hakları riskleri']
      : ['Untracked sub-contractors in supply chain', 'Insufficient Scope 3 emissions transparency', 'Labor rights risks in emerging markets'],
    isSimulated: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  AnimatedScoreBar — fills from 0 → score on mount
// ─────────────────────────────────────────────────────────────────────────────
function AnimatedScoreBar({ label, score, max = 100, isLight }: {
  label: string; score: number; max?: number; isLight: boolean;
}) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setWidth((score / max) * 100), 80);
    return () => clearTimeout(t);
  }, [score, max]);

  const color =
    (score / max) >= 0.8 ? '#00d980' :
    (score / max) >= 0.6 ? '#3b82f6' :
    (score / max) >= 0.4 ? '#eab308' : '#ef4444';

  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span style={{ color: isLight ? '#555555' : '#a1a1aa' }}>{label}</span>
        <span style={{ color: isLight ? '#000000' : '#ffffff', fontWeight: 700 }}>{score}</span>
      </div>
      <div
        className="h-2.5 rounded-full overflow-hidden"
        style={{ backgroundColor: isLight ? '#e5e7eb' : '#27272a' }}
      >
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Dynamic loading panel — cycling messages every 2s
// ─────────────────────────────────────────────────────────────────────────────
function LoadingPanel({ lang, brand }: { lang: string; brand: string }) {
  const [phase, setPhase] = useState(0);
  const isTr = lang === 'tr';

  const phases = isTr
    ? [
        `"${brand}" marka veritabanında aranıyor…`,
        'Yapay zeka tedarik zincirini tarıyor…',
        'Karbon emisyon verileri analiz ediliyor…',
        'İşçi hakları karnesi hesaplanıyor…',
        'Kullanıcı duygu analizi yapılıyor…',
        'ESG skoru derleniyor…',
        'Sonuçlar hazırlanıyor…',
      ]
    : [
        `Searching brand database for "${brand}"…`,
        'AI scanning supply chain data…',
        'Analyzing carbon emission records…',
        'Calculating labor rights scorecard…',
        'Running live sentiment analysis…',
        'Compiling ESG score…',
        'Preparing your results…',
      ];

  useEffect(() => {
    const interval = setInterval(() => setPhase(p => (p + 1) % phases.length), 2000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="rounded-2xl p-12 text-center mb-6"
      style={{
        background: 'linear-gradient(135deg, rgba(0,217,128,0.04) 0%, rgba(0,0,0,0) 100%)',
        border: '1px solid rgba(0,217,128,0.15)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Triple ring spinner */}
      <div className="relative w-20 h-20 mx-auto mb-6">
        <div className="absolute inset-0 border-4 rounded-full" style={{ borderColor: 'rgba(0,217,128,0.08)' }} />
        <div className="absolute inset-0 border-4 border-transparent rounded-full animate-spin"
          style={{ borderTopColor: '#00d980', borderRightColor: 'rgba(0,217,128,0.3)', animationDuration: '1.2s' }} />
        <div className="absolute inset-2 border-4 border-transparent rounded-full animate-spin"
          style={{ borderTopColor: 'rgba(52,211,153,0.6)', animationDirection: 'reverse', animationDuration: '0.9s' }} />
        <div className="absolute inset-4 border-4 border-transparent rounded-full animate-spin"
          style={{ borderTopColor: 'rgba(0,217,128,0.4)', animationDuration: '0.6s' }} />
      </div>

      <p className="font-bold text-lg mb-3" style={{ color: '#00d980' }}>
        {isTr ? 'Analiz Yapılıyor' : 'Analyzing'}
      </p>

      {/* Cycling phase message */}
      <div className="min-h-[24px] mb-6">
        <p
          key={phase}
          className="text-sm animate-pulse"
          style={{ color: 'var(--text-secondary)' }}
        >
          {phases[phase]}
        </p>
      </div>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2">
        {phases.map((_, i) => (
          <div
            key={i}
            className="rounded-full transition-all duration-500"
            style={{
              width: i === phase ? 24 : 8,
              height: 6,
              backgroundColor: i <= phase ? '#00d980' : 'rgba(113,113,122,0.4)',
              opacity: i < phase ? 0.4 : 1,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Friendly error panel with Retry
// ─────────────────────────────────────────────────────────────────────────────
function ErrorPanel({ message, onRetry, lang }: { message: string; onRetry: () => void; lang: string }) {
  const isTr = lang === 'tr';
  const isRetryable = /yoğunluk|traffic|moment|deneyin|again|tekrar|bekleyin|wait/i.test(message);

  return (
    <div className="rounded-2xl p-8 mb-6 text-center" style={{
      background: 'rgba(234,179,8,0.03)',
      border: '1px solid rgba(234,179,8,0.2)',
    }}>
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
        style={{ backgroundColor: 'rgba(234,179,8,0.1)' }}>
        <AlertCircle size={28} className="text-amber-400" />
      </div>
      <h3 className="font-semibold text-lg mb-2" style={{ color: 'var(--text-primary)' }}>
        {isTr ? 'Analiz şu an tamamlanamadı' : 'Analysis could not complete'}
      </h3>
      <p className="text-sm leading-relaxed max-w-md mx-auto mb-6" style={{ color: 'var(--text-secondary)' }}>
        {message}
      </p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 font-semibold px-6 py-3 rounded-xl transition-all text-sm hover:opacity-90"
        style={{ backgroundColor: '#00d980', color: '#000' }}
      >
        <Zap size={15} />
        {isRetryable
          ? (isTr ? 'Tekrar Dene' : 'Try Again')
          : (isTr ? 'Yeni Arama' : 'New Search')}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Glassmorphism card wrapper
// ─────────────────────────────────────────────────────────────────────────────
function GlassCard({ children, className = '', style = {} }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className={`rounded-2xl transition-all duration-300 ${className}`}
      style={{
        backgroundColor: 'var(--card-bg)',
        border: `1px solid ${hovered ? 'rgba(0,217,128,0.3)' : 'var(--card-border)'}`,
        backdropFilter: 'blur(12px)',
        boxShadow: hovered ? '0 8px 32px rgba(0,217,128,0.08)' : '0 2px 8px rgba(0,0,0,0.04)',
        transform: hovered ? 'translateY(-2px)' : 'none',
        ...style,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main Page
// ─────────────────────────────────────────────────────────────────────────────
export function ScannerPage() {
  const {
    t, lang, theme, isAuthenticated, user,
    setShowAuthModal, setAuthModalMode,
    spendCredit, addScanResult, addToWatchlist, setCurrentPage,
    demoQuery, clearDemoQuery,
  } = useApp();

  const [query, setQuery]               = useState('');
  const [loading, setLoading]           = useState(false);
  const [result, setResult]             = useState<ScanResult | null>(null);
  const [isSimulated, setIsSimulated]   = useState(false);
  const [error, setError]               = useState('');
  const [inputError, setInputError]     = useState('');
  const [authWarning, setAuthWarning]   = useState(false);
  const [creditWarning, setCreditWarning] = useState(false);
  const [addedToWatch, setAddedToWatch] = useState(false);
  const [lastQuery, setLastQuery]       = useState('');
  const typewriterRef                   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLight = theme === 'light';

  // Log key status once on mount
  useEffect(() => {
    if (GEMINI_KEY) {
      console.log('%c[OzScan AI] 🔑 GEMINI KEY ACTIVE.', 'color:#22c55e;font-weight:bold', 'Prefix:', GEMINI_KEY.slice(0, 8) + '…');
    } else {
      console.warn('%c[OzScan AI] ⚠️ No Gemini key — simulation mode.', 'color:#f59e0b;font-weight:bold');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Demo Engine (triggered from HomePage "Demo İzle" button) ─────────────
  useEffect(() => {
    if (!demoQuery) return;
    setResult(null); setError(''); setInputError('');
    setAuthWarning(false); setCreditWarning(false);

    const target = demoQuery;
    let currentText = '';
    let charIndex = 0;

    const typeChar = () => {
      if (charIndex < target.length) {
        currentText += target[charIndex];
        setQuery(currentText);
        charIndex++;
        typewriterRef.current = setTimeout(typeChar, 60);
      } else {
        // After typing completes, run a real scan
        typewriterRef.current = setTimeout(async () => {
          clearDemoQuery();
          // Trigger a real scan via handleScan logic
          const raw = target;
          if (isAuthenticated && user && user.credits > 0) {
            await runScan(raw);
          } else {
            // Not authenticated — just show auth prompt
            setAuthWarning(true);
          }
        }, 600);
      }
    };

    typewriterRef.current = setTimeout(typeChar, 300);
    return () => { if (typewriterRef.current) clearTimeout(typewriterRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoQuery]);

  // ── Run scan ───────────────────────────────────────────────────────────────
  const runScan = async (raw: string) => {
    setLoading(true);
    setResult(null);
    setIsSimulated(false);
    setError('');
    setAuthWarning(false);
    setCreditWarning(false);

    try {
      const data = await analyzeWithGemini(raw, lang);

      if (data.notCommercial) {
        setInputError(t('input_not_commercial'));
        setLoading(false);
        return;
      }

      const scanResult: ScanResult = {
        id:               `scan_${Date.now()}`,
        brand:            raw,
        url:              raw.includes('.') ? raw : `${raw.toLowerCase().replace(/\s+/g, '')}.com`,
        date:             new Date().toISOString(),
        supplyChainScore: data.supplyChainScore ?? 50,
        carbonScore:      data.carbonScore      ?? 50,
        laborGrade:       data.laborGrade       ?? 'C',
        sentimentScore:   data.sentimentScore   ?? 50,
        overallScore:     data.overallScore     ?? 50,
        carbonEstimate:   data.carbonEstimate   ?? 'N/A',
        summary:          data.summary          ?? '',
        strengths:        data.strengths        ?? [],
        risks:            data.risks            ?? [],
      };

      spendCredit();
      addScanResult(scanResult);
      setResult(scanResult);
      setIsSimulated(data.isSimulated);
      setAddedToWatch(false);
      setLastQuery(raw);

      console.log(
        data.isSimulated
          ? '%c[OzScan AI] ℹ️ SIMULATION result rendered.' : '%c[OzScan AI] ✅ LIVE Gemini result rendered.',
        data.isSimulated ? 'color:#f59e0b;font-weight:bold' : 'color:#22c55e;font-weight:bold'
      );
    } catch (err) {
      const friendly = friendlyError(err, lang);
      console.error('[OzScan AI] ❌ handleScan error:', err);
      setError(friendly);
    }

    setLoading(false);
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = query.trim();
    setInputError(''); setAuthWarning(false); setCreditWarning(false); setError('');
    if (!raw) return;

    // Input validation
    const isUrl = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(raw);
    const isBrandName = raw.replace(/\s/g, '').length >= 3 && /[a-zA-ZğüşıöçĞÜŞİÖÇ]{3,}/.test(raw);

    if (!isUrl && !isBrandName) { setInputError(t('input_invalid')); return; }
    if (!isAuthenticated) { setAuthWarning(true); return; }
    if (!user || user.credits <= 0) { setCreditWarning(true); return; }

    await runScan(raw);
  };

  const handleRetry = () => {
    setError('');
    if (lastQuery) runScan(lastQuery);
  };

  const radarData = result ? [
    { subject: t('chart_supply'),    val: result.supplyChainScore },
    { subject: t('chart_carbon'),    val: result.carbonScore },
    { subject: t('chart_labor'),     val: result.laborGrade === 'A' ? 90 : result.laborGrade === 'B' ? 75 : result.laborGrade === 'C' ? 60 : result.laborGrade === 'D' ? 40 : 20 },
    { subject: t('chart_sentiment'), val: result.sentimentScore },
    { subject: t('chart_overall'),   val: result.overallScore },
  ] : [];

  const handleAddToWatchlist = () => {
    if (result) { addToWatchlist(result.brand); setAddedToWatch(true); }
  };

  const gradeColor: Record<string, string> = {
    A: '#00d980', B: '#3b82f6', C: '#eab308', D: '#f97316', F: '#ef4444',
  };
  const overallColor = result
    ? result.overallScore >= 80 ? '#00d980'
    : result.overallScore >= 60 ? '#3b82f6'
    : result.overallScore >= 40 ? '#eab308'
    : '#ef4444'
    : '';

  // ── Color helpers — pure black/white for maximum contrast ──────────────────
  const textPrimary  = isLight ? '#000000' : '#ffffff';
  const textBody     = isLight ? '#111827' : '#e4e4e7';
  const textMuted    = isLight ? '#555555' : '#71717a';
  const cardBg       = isLight ? 'rgba(255,255,255,0.95)' : 'rgba(12,12,12,0.9)';
  const cardBorder   = isLight ? '#e5e7eb' : '#1c1c1c';
  const inputBg      = isLight ? '#ffffff' : '#0f0f0f';

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)', paddingTop: 64 }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">

        {/* ── Header ── */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold" style={{ color: textPrimary }}>
            {t('scanner_title')}
          </h1>
          <p className="mt-1 text-base" style={{ color: textMuted }}>{t('scanner_desc')}</p>
        </div>

        {/* ── Search Form ── */}
        <form onSubmit={handleScan} className="mb-6">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: textMuted }} />
              <input
                value={query}
                onChange={e => { setQuery(e.target.value); if (inputError) setInputError(''); }}
                placeholder={t('scanner_placeholder')}
                className="w-full rounded-xl pl-12 pr-4 py-4 text-base transition-all outline-none placeholder:opacity-40"
                style={{
                  backgroundColor: inputBg,
                  border: `1px solid ${inputError ? '#ef4444' : isLight ? '#d1d5db' : '#2a2a2a'}`,
                  color: textPrimary,
                  boxShadow: inputError ? '0 0 0 3px rgba(239,68,68,0.1)' : 'none',
                }}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="flex items-center gap-2 font-bold px-6 py-4 rounded-xl transition-all min-w-[140px] justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
              style={{ backgroundColor: '#00d980', color: '#000000' }}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  {t('scanner_scanning')}
                </>
              ) : (
                <>
                  <Zap size={18} />
                  {t('scanner_btn')}
                </>
              )}
            </button>
          </div>

          <p className="text-xs mt-2 ml-1" style={{ color: textMuted }}>
            {user ? `${user.credits} ${lang === 'tr' ? 'kredi mevcut' : 'credits available'} · ` : ''}
            {t('scanner_cost')}
          </p>

          {inputError && (
            <div className="flex items-center gap-2 mt-3 text-sm rounded-xl px-4 py-3"
              style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}>
              <AlertCircle size={15} className="flex-shrink-0" />
              {inputError}
            </div>
          )}
        </form>

        {/* ── Auth Warning ── */}
        {authWarning && (
          <div className="rounded-xl p-4 mb-6 flex items-center justify-between"
            style={{ backgroundColor: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)' }}>
            <div className="flex items-center gap-2">
              <AlertCircle size={16} style={{ color: '#eab308' }} />
              <span className="text-sm" style={{ color: '#eab308' }}>{t('scanner_auth_required')}</span>
            </div>
            <button
              onClick={() => { setAuthModalMode('login'); setShowAuthModal(true); }}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
              style={{ backgroundColor: '#eab308', color: '#000' }}
            >
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
              <span className="text-sm" style={{ color: '#ef4444' }}>{t('scanner_credit_required')}</span>
            </div>
            <button onClick={() => setCurrentPage('pricing')}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: '#ef4444', color: '#fff' }}>
              {t('settings_buy_credits')}
            </button>
          </div>
        )}

        {/* ── Error Panel ── */}
        {error && !loading && <ErrorPanel message={error} onRetry={handleRetry} lang={lang} />}

        {/* ── Loading Panel ── */}
        {loading && <LoadingPanel lang={lang} brand={query || '…'} />}

        {/* ── Results ── */}
        {result && !loading && (
          <div className="space-y-5">

            {/* Result header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold" style={{ color: textPrimary }}>
                  {t('scanner_results')} — {result.brand}
                </h2>
                {/* Live / Simulation badge */}
                {!isSimulated ? (
                  <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium"
                    style={{ backgroundColor: 'rgba(0,217,128,0.1)', border: '1px solid rgba(0,217,128,0.3)', color: '#00d980' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    {lang === 'tr' ? 'CANLI · Gemini AI' : 'LIVE · Gemini AI'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium"
                    style={{ backgroundColor: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)', color: '#eab308' }}>
                    {lang === 'tr' ? '⚗ SİMÜLASYON · API anahtarı yok' : '⚗ SIMULATION · No API key'}
                  </span>
                )}
              </div>
              <button
                onClick={handleAddToWatchlist}
                disabled={addedToWatch}
                className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg transition-all disabled:opacity-50 hover:opacity-80"
                style={{
                  border: `1px solid ${isLight ? '#d1d5db' : '#3f3f46'}`,
                  color: addedToWatch ? '#00d980' : textMuted,
                }}
              >
                {addedToWatch ? <CheckCircle size={14} style={{ color: '#00d980' }} /> : <Plus size={14} />}
                {addedToWatch ? t('watch_add') + ' ✓' : t('nav_watchlist')}
              </button>
            </div>

            {/* Overall score banner */}
            <GlassCard style={{ padding: '1.5rem', backgroundColor: cardBg, borderColor: cardBorder }}>
              <div className="flex items-center gap-6">
                <div className="text-center flex-shrink-0">
                  <div className="text-5xl font-black" style={{ color: overallColor }}>{result.overallScore}</div>
                  <div className="text-xs mt-1" style={{ color: textMuted }}>{t('scanner_overall')}</div>
                </div>
                <div className="flex-1">
                  <p className="text-sm leading-relaxed" style={{ color: textBody }}>
                    {result.summary}
                  </p>
                </div>
              </div>
            </GlassCard>

            {/* Score grid — 4 metric cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: Shield, label: t('scanner_supply_score'),   value: result.supplyChainScore, sub: undefined,             type: 'score' },
                { icon: Leaf,   label: t('scanner_carbon_est'),     value: result.carbonScore,      sub: result.carbonEstimate, type: 'score' },
                { icon: Scale,  label: t('scanner_labor_grade'),    value: result.laborGrade,       sub: undefined,             type: 'grade' },
                { icon: Star,   label: t('scanner_sentiment_live'), value: result.sentimentScore,   sub: undefined,             type: 'score' },
              ].map(({ icon: Icon, label, value, sub, type }) => (
                <GlassCard key={label} style={{ padding: '1.25rem', textAlign: 'center', backgroundColor: cardBg, borderColor: cardBorder }}>
                  <Icon size={20} style={{ color: '#00d980', margin: '0 auto 8px' }} />
                  <div className="text-3xl font-black mb-1"
                    style={{ color: type === 'grade' ? (gradeColor[value as string] ?? textPrimary) : textPrimary }}>
                    {value}
                  </div>
                  {sub && <div className="text-xs mb-1" style={{ color: textMuted }}>{sub}</div>}
                  <div className="text-xs" style={{ color: textMuted }}>{label}</div>
                </GlassCard>
              ))}
            </div>

            {/* Charts + Animated score bars */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <GlassCard style={{ padding: '1.5rem', backgroundColor: cardBg, borderColor: cardBorder }}>
                <h3 className="font-semibold mb-4" style={{ color: textPrimary }}>{t('chart_brand_comparison')}</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke={isLight ? '#e0e0e0' : '#27272a'} />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: textMuted, fontSize: 11 }} />
                    <Radar dataKey="val" stroke="#00d980" fill="#00d980" fillOpacity={0.15} />
                  </RadarChart>
                </ResponsiveContainer>
              </GlassCard>

              <GlassCard style={{ padding: '1.5rem', backgroundColor: cardBg, borderColor: cardBorder }}>
                <h3 className="font-semibold mb-4" style={{ color: textPrimary }}>{t('scanner_results')}</h3>
                <div className="space-y-4">
                  <AnimatedScoreBar label={t('scanner_supply_score')}   score={result.supplyChainScore} isLight={isLight} />
                  <AnimatedScoreBar label={t('scanner_carbon_est')}     score={result.carbonScore}      isLight={isLight} />
                  <AnimatedScoreBar label={t('scanner_sentiment_live')} score={result.sentimentScore}   isLight={isLight} />
                  <AnimatedScoreBar label={t('scanner_overall')}        score={result.overallScore}     isLight={isLight} />
                </div>
              </GlassCard>
            </div>

            {/* Strengths & Risks */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <GlassCard style={{ padding: '1.5rem', backgroundColor: 'rgba(0,217,128,0.04)', borderColor: 'rgba(0,217,128,0.2)' }}>
                <h3 className="font-semibold flex items-center gap-2 mb-4" style={{ color: '#00d980' }}>
                  <TrendingUp size={16} /> {t('scanner_strengths')}
                </h3>
                <ul className="space-y-2">
                  {result.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: textBody }}>
                      <CheckCircle size={14} style={{ color: '#00d980', marginTop: 2, flexShrink: 0 }} />
                      {s}
                    </li>
                  ))}
                </ul>
              </GlassCard>

              <GlassCard style={{ padding: '1.5rem', backgroundColor: 'rgba(239,68,68,0.04)', borderColor: 'rgba(239,68,68,0.2)' }}>
                <h3 className="font-semibold flex items-center gap-2 mb-4" style={{ color: '#ef4444' }}>
                  <AlertCircle size={16} /> {t('scanner_risks')}
                </h3>
                <ul className="space-y-2">
                  {result.risks.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: textBody }}>
                      <AlertCircle size={14} style={{ color: '#ef4444', marginTop: 2, flexShrink: 0 }} />
                      {r}
                    </li>
                  ))}
                </ul>
              </GlassCard>
            </div>

            {/* Back to home */}
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setCurrentPage('home')}
                className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg transition-all hover:opacity-80"
                style={{ border: `1px solid ${cardBorder}`, color: textMuted }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,217,128,0.4)';
                  (e.currentTarget as HTMLElement).style.color = '#00d980';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = cardBorder;
                  (e.currentTarget as HTMLElement).style.color = textMuted;
                }}
              >
                <X size={14} />
                {lang === 'tr' ? 'Ana Sayfaya Dön' : 'Back to Home'}
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
