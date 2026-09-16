/**
 * PROYECTO: Control de Precios de Cierre y Portafolio de Inversión
 * DESARROLLO & ARQUITECTURA: Victor Solorzano
 * ASISTENCIA TÉCNICA: Google AI Studio & Antigravity IDE
 * ROL: Componente de Cabecera y Navegación Principal
 */

import React from 'react';
import { TrendingUp, FileSpreadsheet, PlusCircle, Table, BarChart3, PieChart, Globe, Sparkles } from 'lucide-react';
import { PrecioCierreRegistro } from '../types';
import { formatBs, formatPercent, formatCurrencyByTicker, normalizeTicker } from '../utils/formatters';
import { CompanyLogo } from './CompanyLogo';

interface HeaderProps {
  activeTab: 'form' | 'history' | 'charts' | 'portfolio' | 'international';
  setActiveTab: (tab: 'form' | 'history' | 'charts' | 'portfolio' | 'international') => void;
  latestRegistro: PrecioCierreRegistro | undefined;
  prevRegistro: PrecioCierreRegistro | undefined;
  onExportExcel: () => void;
  totalRegistrosCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  latestRegistro,
  prevRegistro,
  onExportExcel,
  totalRegistrosCount,
}) => {
  const getTickerPrice = (reg: PrecioCierreRegistro | undefined, ticker: string) => {
    if (!reg) return 0;
    const clean = normalizeTicker(ticker);
    const emp = reg.empresas?.[clean] || reg.empresas?.[ticker] || (reg as any)[ticker.toLowerCase()];
    return emp?.precio || 0;
  };

  const getTickerVar = (reg: PrecioCierreRegistro | undefined, ticker: string, prevReg: PrecioCierreRegistro | undefined) => {
    if (!reg) return 0;
    const clean = normalizeTicker(ticker);
    const emp = reg.empresas?.[clean] || reg.empresas?.[ticker] || (reg as any)[ticker.toLowerCase()];
    if (emp && emp.varDiaria !== undefined) return emp.varDiaria;

    const currP = emp?.precio || 0;
    const prevP = getTickerPrice(prevReg, ticker);
    if (currP > 0 && prevP > 0) {
      return ((currP - prevP) / prevP) * 100;
    }
    return 0;
  };

  // Tickers preferenciales fijos incluyendo Nacionales y Tokens Internacionales
  const PREFERRED_TICKERS = ['BNC', 'BPV', 'BVCC', 'RST-B', 'SPYB/USDT', 'NVDAB/USDT'];

  // Extraer tickers activos para las tarjetas rápidas del Header
  const topTickers = React.useMemo(() => {
    const rawList = latestRegistro?.empresas
      ? Object.keys(latestRegistro.empresas)
      : PREFERRED_TICKERS;

    const combined = Array.from(new Set([...PREFERRED_TICKERS, ...rawList]));

    return combined
      .map((t) => normalizeTicker(t))
      .filter((ticker) => {
        const clean = ticker.toUpperCase().trim();
        if (!clean || clean === 'TICKER') return false;
        const price = getTickerPrice(latestRegistro, ticker);
        return price > 0;
      });
  }, [latestRegistro]);

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 shadow-lg sticky top-0 z-30">
      {/* Barra superior */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          
          {/* Logo y Título */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">Control de Portafolios</h1>
                <span className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full">
                  GOOGLE SHEETS SYNC
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Portafolio <strong className="text-slate-200">Nacional (MERCOSUR)</strong> & <strong className="text-amber-400">Internacional (Binance bStock)</strong>
              </p>
            </div>
          </div>

          {/* Tarjetas rápidas de cotización actual */}
          {latestRegistro && topTickers.length > 0 && (
            <div className="flex flex-wrap gap-2 sm:gap-3 bg-slate-950/80 p-2 rounded-xl border border-slate-800 text-xs overflow-x-auto">
              {topTickers.map((ticker) => {
                const price = getTickerPrice(latestRegistro, ticker);
                const varPct = getTickerVar(latestRegistro, ticker, prevRegistro);

                return (
                  <div key={ticker} className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 shrink-0 min-w-[105px] flex items-center gap-2">
                    <CompanyLogo ticker={ticker} size="sm" />
                    <div>
                      <div className="flex items-center gap-1.5 text-[10px]">
                        <span className="font-bold text-slate-200">{ticker}</span>
                        <span className={`font-mono text-[9px] ${varPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {formatPercent(varPct)}
                        </span>
                      </div>
                      <div className="font-mono font-semibold text-slate-100 text-xs">
                        {formatCurrencyByTicker(price, ticker)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Botón de Exportar a Excel */}
          <div className="flex items-center gap-2 self-start lg:self-auto shrink-0">
            <button
              onClick={onExportExcel}
              className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-xl shadow-md transition-all active:scale-95"
              title="Descargar archivo Excel con los datos del portafolio"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Exportar Excel</span>
            </button>
          </div>

        </div>
      </div>

      {/* Navegación por Pestañas */}
      <div className="bg-slate-950/60 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-2 sm:space-x-3 overflow-x-auto py-2 scrollbar-none" aria-label="Tabs">
            
            {/* Nuevo Registro Diario */}
            <button
              onClick={() => setActiveTab('form')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === 'form'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>Registrar Precios Diarios</span>
            </button>

            {/* Portafolio Nacional */}
            <button
              onClick={() => setActiveTab('portfolio')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === 'portfolio'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <PieChart className="w-4 h-4 text-blue-400" />
              <span>Portafolio Nacional (MERCOSUR)</span>
              <Sparkles className="w-3 h-3 text-amber-400" />
            </button>

            {/* Portafolio Internacional */}
            <button
              onClick={() => setActiveTab('international')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === 'international'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Globe className="w-4 h-4 text-amber-400" />
              <span>Portafolio Internacional (Binance)</span>
            </button>

            {/* Ver Historial PRECIOS_CIERRE */}
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === 'history'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Table className="w-4 h-4" />
              <span>Ver Historial PRECIOS_CIERRE</span>
              <span className="px-1.5 py-0.2 text-[10px] bg-slate-700 text-slate-300 rounded-full font-mono">
                {totalRegistrosCount}
              </span>
            </button>

            {/* Gráficos */}
            <button
              onClick={() => setActiveTab('charts')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === 'charts'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Gráficos y Tendencias</span>
            </button>

          </nav>
        </div>
      </div>
    </header>
  );
};
