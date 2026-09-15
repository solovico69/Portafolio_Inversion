import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, Save, RotateCcw, AlertTriangle, ArrowUpRight, ArrowDownRight, Copy, Plus, Globe, Building2, Layers, X } from 'lucide-react';
import { PrecioCierreRegistro } from '../types';
import { getTodayISO, parseNumberInput, formatBs, formatUsdt, formatPercent, isInternationalTicker, normalizeTicker } from '../utils/formatters';
import { CompanyLogo } from './CompanyLogo';

interface PriceFormProps {
  onSave: (registro: Omit<PrecioCierreRegistro, 'id'>) => void;
  latestRegistro: PrecioCierreRegistro | undefined;
  onNavigateToHistory: () => void;
  availableTickers?: string[];
}

const DEFAULT_AVAILABLE_TICKERS: string[] = ['BNC', 'BPV', 'BVCC', 'RST-B', 'SPYB/USDT', 'NVDAB/USDT'];

export const PriceForm: React.FC<PriceFormProps> = ({
  onSave,
  latestRegistro,
  onNavigateToHistory,
  availableTickers = DEFAULT_AVAILABLE_TICKERS,
}) => {
  // Serializar claves primitivas para evitar recalcular memorizaciones en cada render
  const latestKeysString = latestRegistro?.empresas ? Object.keys(latestRegistro.empresas).sort().join(',') : '';
  const availableTickersString = availableTickers.join(',');

  // Asegurar que contenga tanto nacionales como internacionales por defecto sin duplicados
  const baseTickers = useMemo(() => {
    const fromLatest = latestRegistro?.empresas ? Object.keys(latestRegistro.empresas) : [];
    const combined = [...availableTickers, ...fromLatest, 'SPYB/USDT', 'NVDAB/USDT'];
    const unique: string[] = [];
    combined.forEach((t) => {
      const clean = normalizeTicker(t);
      if (clean && clean !== 'TICKER' && !unique.includes(clean)) {
        unique.push(clean);
      }
    });
    return unique;
  }, [availableTickersString, latestKeysString]);

  const [fecha, setFecha] = useState<string>(getTodayISO);
  const [filterCategory, setFilterCategory] = useState<'all' | 'nacional' | 'internacional'>('all');
  
  // Lista activa de tickers en pantalla
  const [activeTickers, setActiveTickers] = useState<string[]>(baseTickers);

  // Sincronizar activeTickers si baseTickers cambia sin crear bucles infinitos de re-render
  useEffect(() => {
    setActiveTickers((prev) => {
      const prevSet = new Set(prev);
      let changed = false;
      const next = [...prev];
      baseTickers.forEach((t) => {
        const clean = normalizeTicker(t);
        if (clean && clean !== 'TICKER' && !prevSet.has(clean)) {
          next.push(clean);
          prevSet.add(clean);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [baseTickers]);

  // Mapa de precios por ticker
  const [preciosMap, setPreciosMap] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    baseTickers.forEach((t) => {
      initial[t] = '';
    });
    return initial;
  });

  const [customTicker, setCustomTicker] = useState('');
  const [customType, setCustomType] = useState<'nacional' | 'internacional'>('nacional');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Helper para obtener el precio anterior de forma robusta
  const getLatestPriceData = (ticker: string) => {
    if (!latestRegistro) return { precio: undefined as number | undefined, varDiaria: undefined as number | undefined };
    const clean = normalizeTicker(ticker);
    if (latestRegistro.empresas) {
      if (latestRegistro.empresas[clean]?.precio !== undefined && latestRegistro.empresas[clean].precio > 0) {
        return latestRegistro.empresas[clean];
      }
      for (const [k, v] of Object.entries(latestRegistro.empresas) as [string, { precio: number; varDiaria?: number }][]) {
        if (normalizeTicker(k) === clean && v && v.precio > 0) {
          return v;
        }
      }
    }
    const legacy = (latestRegistro as any)[clean.toLowerCase()];
    if (legacy?.precio !== undefined && legacy.precio > 0) {
      return legacy;
    }
    return { precio: undefined, varDiaria: undefined };
  };

  // Separar tickers en Nacionales e Internacionales
  const nacionales = useMemo(() => activeTickers.filter((t) => !isInternationalTicker(t)), [activeTickers]);
  const internacionales = useMemo(() => activeTickers.filter((t) => isInternationalTicker(t)), [activeTickers]);

  // Copiar valores del último registro
  const handleAutofillLatest = () => {
    if (!latestRegistro) return;

    const newMap: Record<string, string> = { ...preciosMap };

    activeTickers.forEach((t) => {
      const { precio } = getLatestPriceData(t);
      if (precio !== undefined && precio > 0) {
        newMap[t] = precio.toString();
      }
    });

    setPreciosMap(newMap);
    setErrors({});
  };

  const handleClear = () => {
    setFecha(getTodayISO());
    const resetMap: Record<string, string> = {};
    activeTickers.forEach((t) => (resetMap[t] = ''));
    setPreciosMap(resetMap);
    setErrors({});
  };

  const handleAddCustomTicker = (tickerToAdd?: string) => {
    let clean = normalizeTicker(tickerToAdd || customTicker);
    if (!clean) return;
    
    if (customType === 'internacional' && !clean.includes('/') && !clean.includes('USDT')) {
      clean = `${clean}/USDT`;
    }

    if (!activeTickers.includes(clean)) {
      setActiveTickers([...activeTickers, clean]);
      setPreciosMap((prev) => ({ ...prev, [clean]: '' }));
    }
    setCustomTicker('');
  };

  const handleRemoveTicker = (tickerToRemove: string) => {
    setActiveTickers((prev) => prev.filter((t) => t !== tickerToRemove));
    setPreciosMap((prev) => {
      const copy = { ...prev };
      delete copy[tickerToRemove];
      return copy;
    });
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!fecha || fecha.trim() === '') {
      newErrors.fecha = 'La fecha de ingreso es obligatoria';
    }

    activeTickers.forEach((ticker) => {
      const rawVal = preciosMap[ticker];
      if (rawVal && rawVal.trim() !== '') {
        const parsed = parseNumberInput(rawVal);
        if (isNaN(parsed) || parsed < 0) {
          newErrors[ticker] = `Ingrese un precio válido para ${ticker}`;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const empresas: Record<string, { precio: number }> = {};

    activeTickers.forEach((ticker) => {
      const raw = preciosMap[ticker];
      if (raw && raw.trim() !== '') {
        const cleanTicker = normalizeTicker(ticker);
        empresas[cleanTicker] = { precio: parseNumberInput(raw) };
      }
    });

    const bncP = empresas['BNC']?.precio || parseNumberInput(preciosMap['BNC'] || 0);
    const bpvP = empresas['BPV']?.precio || parseNumberInput(preciosMap['BPV'] || 0);
    const bvccP = empresas['BVCC']?.precio || parseNumberInput(preciosMap['BVCC'] || 0);

    const nuevoRegistro: Omit<PrecioCierreRegistro, 'id'> = {
      fecha,
      empresas,
      bnc: { precio: bncP },
      bpv: { precio: bpvP },
      bvcc: { precio: bvccP },
    };

    onSave(nuevoRegistro);
    handleClear();
  };

  const renderVariationBadge = (ticker: string, currentStr: string) => {
    const isInter = isInternationalTicker(ticker);
    const val = parseNumberInput(currentStr);
    const { precio: prevPrice } = getLatestPriceData(ticker);

    if (!val || !prevPrice || prevPrice === 0) return null;

    const diff = val - prevPrice;
    const pct = (diff / prevPrice) * 100;

    if (diff === 0) {
      return (
        <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
          Sin cambio ({isInter ? formatUsdt(prevPrice) : formatBs(prevPrice)})
        </span>
      );
    }

    const isUp = diff > 0;
    const diffFormatted = isInter
      ? `$ ${diff.toFixed(2)} USDT`
      : `${diff.toFixed(2)} Bs.`;

    return (
      <span
        className={`text-[11px] font-mono px-2 py-0.5 rounded-full inline-flex items-center gap-1 font-semibold ${
          isUp
            ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-800/50'
            : 'text-rose-400 bg-rose-950/60 border border-rose-800/50'
        }`}
      >
        {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        {isUp ? '+' : ''}{diffFormatted} ({formatPercent(pct)})
      </span>
    );
  };

  const renderTickerCard = (ticker: string) => {
    const isInter = isInternationalTicker(ticker);
    const { precio: lastPrice } = getLatestPriceData(ticker);
    const isCoreTicker = ['BNC', 'BPV', 'BVCC'].includes(ticker);

    return (
      <div
        key={ticker}
        className={`bg-slate-900 border rounded-2xl p-4 shadow-lg transition-all space-y-3 relative group ${
          isInter ? 'border-amber-500/30 hover:border-amber-500/60' : 'border-slate-800 hover:border-blue-500/40'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <CompanyLogo ticker={ticker} size="md" showName={true} />
          
          <div className="flex items-center gap-1.5">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                isInter
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
              }`}
            >
              {isInter ? 'USDT' : 'Bs.'}
            </span>

            {!isCoreTicker && (
              <button
                type="button"
                onClick={() => handleRemoveTicker(ticker)}
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 rounded-md hover:bg-slate-800 transition-all"
                title={`Quitar ${ticker} del formulario`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {lastPrice !== undefined && lastPrice > 0 && (
          <div className="bg-slate-950/80 px-2.5 py-1.5 rounded-lg border border-slate-800/80 text-[11px] flex items-center justify-between">
            <span className="text-slate-400">Último Cierre:</span>
            <span className="font-mono font-semibold text-slate-200">
              {isInter ? formatUsdt(lastPrice) : formatBs(lastPrice)}
            </span>
          </div>
        )}

        <div>
          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
            {isInter ? 'Precio Cierre ($ USDT)' : 'Precio Cierre (Bs.)'}
          </label>
          <div className="relative">
            <span className="absolute left-2.5 top-2 text-slate-500 text-xs font-mono">
              {isInter ? '$' : 'Bs.'}
            </span>
            <input
              type="text"
              placeholder={isInter ? 'ej. 778,01' : 'ej. 476,50'}
              value={preciosMap[ticker] || ''}
              onChange={(e) => {
                setPreciosMap({ ...preciosMap, [ticker]: e.target.value });
                if (errors[ticker]) setErrors({ ...errors, [ticker]: '' });
              }}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl font-mono text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500"
            />
          </div>
          {errors[ticker] ? (
            <p className="text-[10px] text-rose-400 mt-1 font-medium">{errors[ticker]}</p>
          ) : (
            <div className="mt-1">
              {renderVariationBadge(ticker, preciosMap[ticker] || '')}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* Banner de introducción */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>Registro Diario de Precios de Cierre</span>
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Registre los precios de cierre diarios de sus activos <strong className="text-blue-400">Nacionales (BVC)</strong> y <strong className="text-amber-400">Empresas Internacionales (Binance bStock)</strong>. Se guardarán en la hoja <strong className="text-emerald-400 font-mono">PRECIOS_CIERRE</strong>.
          </p>
        </div>

        {latestRegistro && (
          <button
            type="button"
            onClick={handleAutofillLatest}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium transition-all shadow-sm shrink-0"
            title="Copiar los precios del último registro para agilizar el llenado"
          >
            <Copy className="w-3.5 h-3.5 text-blue-400" />
            <span>Copiar último cierre</span>
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Campo de Fecha Obligatoria y Selector de Filtro */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <label htmlFor="fecha-cierre" className="block text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-400" />
              <span>Fecha de Ingreso del Cierre *</span>
            </label>
            <p className="text-xs text-slate-400 mt-0.5">
              Seleccione la fecha correspondiente a los precios de la jornada.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Filtro rápido */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setFilterCategory('all')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                  filterCategory === 'all' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Todos ({activeTickers.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterCategory('nacional')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                  filterCategory === 'nacional' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Nacionales ({nacionales.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterCategory('internacional')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                  filterCategory === 'internacional' ? 'bg-amber-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Globe className="w-3.5 h-3.5 text-amber-400" />
                <span>Internacionales ({internacionales.length})</span>
              </button>
            </div>

            <div className="sm:w-52">
              <input
                id="fecha-cierre"
                type="date"
                value={fecha}
                onChange={(e) => {
                  setFecha(e.target.value);
                  if (errors.fecha) setErrors((prev) => ({ ...prev, fecha: '' }));
                }}
                className={`w-full px-3.5 py-2 bg-slate-950 border rounded-xl font-mono text-xs text-slate-100 focus:outline-none focus:ring-2 transition-all ${
                  errors.fecha
                    ? 'border-rose-500 focus:ring-rose-500/30'
                    : 'border-slate-700 focus:border-blue-500 focus:ring-blue-500/20'
                }`}
              />
              {errors.fecha && (
                <p className="text-xs text-rose-400 mt-1 flex items-center gap-1 font-medium">
                  <AlertTriangle className="w-3 h-3" />
                  {errors.fecha}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Sección: Acciones Nacionales */}
        {(filterCategory === 'all' || filterCategory === 'nacional') && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <Building2 className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-bold text-slate-200">
                Acciones Nacionales (Bolsa de Valores de Caracas - Bs.)
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {nacionales.map((ticker) => renderTickerCard(ticker))}
            </div>
          </div>
        )}

        {/* Sección: Empresas Internacionales */}
        {(filterCategory === 'all' || filterCategory === 'internacional') && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <Globe className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-slate-200">
                Empresas Internacionales (Acciones Tokenizadas Binance - $ USDT)
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {internacionales.map((ticker) => renderTickerCard(ticker))}
            </div>
          </div>
        )}

        {/* Agregar otra acción o activo */}
        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold text-slate-200">
                ¿Desea registrar otra empresa o activo?
              </span>
            </div>

            {/* Sugerencias Rápidas */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="text-slate-400 text-[10px]">Sugerencias:</span>
              {['SPYB/USDT', 'NVDAB/USDT', 'AAPL/USDT', 'TSLA/USDT', 'SVS', 'MPA'].map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => handleAddCustomTicker(sug)}
                  className="px-2 py-0.5 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 hover:border-slate-600 transition-all font-mono"
                >
                  +{sug}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={customType}
              onChange={(e) => setCustomType(e.target.value as any)}
              className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-medium text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="nacional">🇻🇪 Nacional (Bs.)</option>
              <option value="internacional">🌐 Internacional ($ USDT)</option>
            </select>

            <input
              type="text"
              placeholder={customType === 'internacional' ? "Ticker (ej. AAPL o AAPL/USDT)" : "Ticker (ej. SVS, MPA)"}
              value={customTicker}
              onChange={(e) => setCustomTicker(e.target.value)}
              className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 uppercase focus:outline-none focus:border-blue-500 min-w-[200px]"
            />

            <button
              type="button"
              onClick={() => handleAddCustomTicker()}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 text-xs font-semibold rounded-lg border border-slate-700 transition-all flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar a Formulario</span>
            </button>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleClear}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-semibold transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Limpiar Formulario</span>
            </button>

            <button
              type="button"
              onClick={onNavigateToHistory}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-xl text-xs font-semibold transition-all"
            >
              <span>Ver Historial</span>
            </button>
          </div>

          <button
            type="submit"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/25 transition-all transform active:scale-98"
          >
            <Save className="w-4 h-4" />
            <span>Guardar Registro en PRECIOS_CIERRE</span>
          </button>
        </div>

      </form>

    </div>
  );
};

