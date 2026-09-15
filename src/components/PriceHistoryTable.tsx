import React, { useState, useMemo } from 'react';
import { Search, ArrowUpDown, FileSpreadsheet, Plus, Globe, Building2, Layers } from 'lucide-react';
import { PrecioCierreRegistro } from '../types';
import { formatDateLatina, formatCurrencyByTicker, formatPercent, isInternationalTicker, normalizeTicker } from '../utils/formatters';
import { CompanyLogo } from './CompanyLogo';

interface PriceHistoryTableProps {
  registros: PrecioCierreRegistro[];
  onExportExcel: () => void;
  onRestoreDefaults: () => void;
  onNavigateToForm: () => void;
}

export const PriceHistoryTable: React.FC<PriceHistoryTableProps> = ({
  registros,
  onExportExcel,
  onRestoreDefaults,
  onNavigateToForm,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [activeCategory, setActiveCategory] = useState<'all' | 'nacional' | 'internacional'>('all');

  // Detectar dinámicamente todos los tickers presentes en el historial (excluyendo TICKER)
  const allTickers: string[] = useMemo(() => {
    const rawList = registros.flatMap((reg) => {
      const empKeys = reg.empresas ? Object.keys(reg.empresas) : [];
      if (empKeys.length > 0) return empKeys;
      return ['BNC', 'BPV', 'BVCC', 'RST-B', 'SPYB/USDT', 'NVDAB/USDT'];
    });

    const unique: string[] = [];
    rawList.forEach((t) => {
      const clean = normalizeTicker(t);
      if (clean && clean !== 'TICKER' && !unique.includes(clean)) {
        unique.push(clean);
      }
    });

    // Orden: Nacionales primero (BNC, BPV, BVCC, RST-B), luego Internacionales (SPYB, NVDAB...)
    const priorityOrder = ['BNC', 'BPV', 'BVCC', 'RST-B', 'SPYB/USDT', 'NVDAB/USDT'];
    unique.sort((a, b) => {
      const isInterA = isInternationalTicker(a);
      const isInterB = isInternationalTicker(b);
      if (isInterA !== isInterB) {
        return isInterA ? 1 : -1;
      }
      const indexA = priorityOrder.indexOf(a);
      const indexB = priorityOrder.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    });

    return unique;
  }, [registros]);

  // Filtrar tickers por categoría
  const displayedTickers = useMemo(() => {
    if (activeCategory === 'nacional') {
      return allTickers.filter((t) => !isInternationalTicker(t));
    }
    if (activeCategory === 'internacional') {
      return allTickers.filter((t) => isInternationalTicker(t));
    }
    return allTickers;
  }, [allTickers, activeCategory]);

  // Color de badge por ticker
  const getTickerColor = (ticker: string) => {
    if (isInternationalTicker(ticker)) return 'text-amber-400';
    if (ticker === 'BNC') return 'text-blue-400';
    if (ticker === 'BPV') return 'text-sky-400';
    if (ticker === 'BVCC') return 'text-emerald-400';
    if (ticker === 'RST-B') return 'text-amber-300';
    return 'text-cyan-400';
  };

  // Filtrado y Ordenamiento
  const filteredRegistros = registros
    .filter((reg) => {
      const dateLat = formatDateLatina(reg.fecha);
      const search = searchTerm.toLowerCase();
      return (
        reg.fecha.includes(search) ||
        dateLat.includes(search)
      );
    })
    .sort((a, b) => {
      const timeA = new Date(a.fecha).getTime();
      const timeB = new Date(b.fecha).getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* Controles y Acciones */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Buscador y Filtro de Categoría */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar por fecha (DD/MM/AAAA)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 ${
                activeCategory === 'all' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>Todos</span>
            </button>
            <button
              onClick={() => setActiveCategory('nacional')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 ${
                activeCategory === 'nacional' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Building2 className="w-3 h-3 text-blue-400" />
              <span>Nacionales</span>
            </button>
            <button
              onClick={() => setActiveCategory('internacional')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 ${
                activeCategory === 'internacional' ? 'bg-amber-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="w-3 h-3 text-amber-400" />
              <span>Internacionales</span>
            </button>
          </div>
        </div>

        {/* Botones */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-medium transition-all"
            title="Alternar orden cronológico"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-blue-400" />
            <span>{sortOrder === 'desc' ? 'Más recientes' : 'Más antiguas'}</span>
          </button>

          <button
            onClick={onExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md transition-all"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Descargar Excel</span>
          </button>

          <button
            onClick={onNavigateToForm}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuevo Registro</span>
          </button>
        </div>

      </div>

      {/* Tabla de Registros */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[750px]">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Fecha</th>
                {displayedTickers.map((ticker) => {
                  const isInter = isInternationalTicker(ticker);
                  return (
                    <React.Fragment key={ticker}>
                      <th className={`py-3.5 px-4 ${getTickerColor(ticker)}`}>
                        <div className="flex items-center gap-1.5">
                          <CompanyLogo ticker={ticker} size="sm" />
                          <span>{ticker} ({isInter ? '$ USDT' : 'Bs.'})</span>
                        </div>
                      </th>
                      <th className="py-3.5 px-3 text-slate-400 text-[10px]">
                        {ticker} Var %
                      </th>
                    </React.Fragment>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-xs text-slate-200">
              {filteredRegistros.length === 0 ? (
                <tr>
                  <td colSpan={displayedTickers.length * 2 + 1} className="py-12 text-center text-slate-500 space-y-3">
                    <p className="text-sm">No se encontraron registros de precios de cierre.</p>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={onRestoreDefaults}
                        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium border border-slate-700 transition-all"
                      >
                        Cargar Datos Iniciales de Ejemplo
                      </button>
                      <button
                        onClick={onNavigateToForm}
                        className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-medium transition-all"
                      >
                        Registrar Nuevos Precios
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRegistros.map((reg) => (
                  <tr key={reg.id} className="hover:bg-slate-850/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-200 whitespace-nowrap">
                      {formatDateLatina(reg.fecha)}
                    </td>

                    {displayedTickers.map((ticker) => {
                      const emp = reg.empresas?.[ticker] || (reg as any)[ticker.toLowerCase()] || { precio: 0 };
                      const precio = emp.precio || 0;
                      const varPct = emp.varDiaria;

                      return (
                        <React.Fragment key={ticker}>
                          <td className="py-3.5 px-4 font-mono font-medium text-slate-100 whitespace-nowrap">
                            {formatCurrencyByTicker(precio, ticker)}
                          </td>
                          <td className="py-3.5 px-3 font-mono text-[11px] whitespace-nowrap">
                            {varPct !== undefined ? (
                              <span
                                className={`px-1.5 py-0.5 rounded ${
                                  varPct > 0
                                    ? 'text-emerald-400 bg-emerald-950/60'
                                    : varPct < 0
                                    ? 'text-rose-400 bg-rose-950/60'
                                    : 'text-slate-400'
                                }`}
                              >
                                {formatPercent(varPct)}
                              </span>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-slate-950/80 px-4 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Mostrando {filteredRegistros.length} de {registros.length} registros totales ({displayedTickers.length} activos mostrados)</span>
          <button
            onClick={onRestoreDefaults}
            className="text-slate-500 hover:text-slate-300 underline text-[11px]"
          >
            Restablecer historial de ejemplo
          </button>
        </div>
      </div>

    </div>
  );
};
