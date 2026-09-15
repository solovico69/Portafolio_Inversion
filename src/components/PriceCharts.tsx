import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  ReferenceLine,
} from 'recharts';
import { PrecioCierreRegistro } from '../types';
import { formatDateLatina, formatBs, formatUsdt, formatPercent, isInternationalTicker, formatCurrencyByTicker, normalizeTicker } from '../utils/formatters';
import { TrendingUp, BarChart2, Activity, Calendar, Filter, Layers, Globe, Building2 } from 'lucide-react';
import { CompanyLogo } from './CompanyLogo';

interface PriceChartsProps {
  registros: PrecioCierreRegistro[];
}

const COLOR_PALETTE = ['#3b82f6', '#f59e0b', '#10b981', '#a855f7', '#ec4899', '#06b6d4', '#f97316', '#6366f1'];

const formatMonthLabel = (yyyyMm: string) => {
  if (!yyyyMm || yyyyMm.length < 7) return yyyyMm;
  const [year, month] = yyyyMm.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  const monthName = date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
  return monthName.charAt(0).toUpperCase() + monthName.slice(1);
};

export const PriceCharts: React.FC<PriceChartsProps> = ({ registros }) => {
  const [marketCategory, setMarketCategory] = useState<'nacional' | 'internacional' | 'all'>('nacional');
  const [selectedTickerFilter, setSelectedTickerFilter] = useState<string>('ALL');
  const [timeGrouping, setTimeGrouping] = useState<'diario' | 'mensual'>('diario');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');

  // Detectar dinámicamente todos los tickers (excluyendo TICKER)
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

    const priorityOrder = ['BNC', 'BPV', 'BVCC', 'RST-B', 'SPYB/USDT', 'NVDAB/USDT'];
    unique.sort((a, b) => {
      const isInterA = isInternationalTicker(a);
      const isInterB = isInternationalTicker(b);
      if (isInterA !== isInterB) return isInterA ? 1 : -1;
      const indexA = priorityOrder.indexOf(a);
      const indexB = priorityOrder.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    });

    return unique;
  }, [registros]);

  // Tickers filtrados por mercado (Nacional / Internacional / Todos)
  const marketTickers = useMemo(() => {
    if (marketCategory === 'nacional') {
      return allTickers.filter((t) => !isInternationalTicker(t));
    }
    if (marketCategory === 'internacional') {
      return allTickers.filter((t) => isInternationalTicker(t));
    }
    return allTickers;
  }, [allTickers, marketCategory]);

  // Ordenar cronológicamente
  const sortedChronological = useMemo(() => {
    return [...registros].sort(
      (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
    );
  }, [registros]);

  // Extraer meses únicos disponibles (YYYY-MM)
  const availableMonths = useMemo(() => {
    return Array.from(
      new Set(
        sortedChronological
          .map((r) => r.fecha?.slice(0, 7))
          .filter((m): m is string => Boolean(m && m.length === 7))
      )
    ).sort();
  }, [sortedChronological]);

  // Filtrar por mes seleccionado (si no es 'ALL')
  const filteredRegistros = useMemo(() => {
    return sortedChronological.filter((reg) => {
      if (selectedMonth === 'ALL') return true;
      return reg.fecha.startsWith(selectedMonth);
    });
  }, [sortedChronological, selectedMonth]);

  // Generar los datos para los gráficos según la agrupación elegida (diario o mensual)
  const chartData = useMemo(() => {
    if (timeGrouping === 'diario') {
      return filteredRegistros.map((reg, index) => {
        // Formato de etiqueta horizontal limpio
        let xLabel = formatDateLatina(reg.fecha);
        if (selectedMonth !== 'ALL') {
          // Si está filtrado por mes, mostrar el día concreto ej. "Día 15" o "15/01"
          const dayPart = reg.fecha.split('-')[2] || reg.fecha;
          xLabel = `Día ${dayPart}`;
        }

        const item: Record<string, any> = {
          fecha: xLabel,
          fechaCompleta: formatDateLatina(reg.fecha),
          fechaISO: reg.fecha,
        };

        allTickers.forEach((ticker) => {
          const emp = reg.empresas?.[ticker] || (reg as any)[ticker.toLowerCase()] || { precio: 0 };
          const precio = emp.precio || 0;
          item[`${ticker}_Precio`] = precio;

          // Variación % diaria
          let varPct = emp.varDiaria;
          if (varPct === undefined && index > 0) {
            const prevReg = filteredRegistros[index - 1];
            const prevEmp = prevReg.empresas?.[ticker] || (prevReg as any)[ticker.toLowerCase()];
            const prevP = prevEmp?.precio || 0;
            if (prevP > 0 && precio > 0) {
              varPct = ((precio - prevP) / prevP) * 100;
            }
          }
          item[`${ticker}_Var`] = Number((varPct ?? 0).toFixed(2));
        });

        return item;
      });
    } else {
      // Agrupación mensual: un único punto por mes (Tomando el Cierre del Mes)
      const monthGroups: Record<string, PrecioCierreRegistro[]> = {};

      filteredRegistros.forEach((reg) => {
        const yyyyMm = reg.fecha.slice(0, 7);
        if (!monthGroups[yyyyMm]) monthGroups[yyyyMm] = [];
        monthGroups[yyyyMm].push(reg);
      });

      const monthKeys = Object.keys(monthGroups).sort();

      return monthKeys.map((yyyyMm, mIndex) => {
        const regsOfMonth = monthGroups[yyyyMm];
        // El registro más reciente del mes (Cierre de mes)
        const lastRegOfMonth = regsOfMonth[regsOfMonth.length - 1];
        const firstRegOfMonth = regsOfMonth[0];

        const item: Record<string, any> = {
          fecha: formatMonthLabel(yyyyMm),
          fechaCompleta: formatMonthLabel(yyyyMm),
          fechaISO: yyyyMm,
        };

        allTickers.forEach((ticker) => {
          const empLast = lastRegOfMonth.empresas?.[ticker] || (lastRegOfMonth as any)[ticker.toLowerCase()];
          const precioCierreMes = empLast?.precio || 0;
          item[`${ticker}_Precio`] = precioCierreMes;

          // Variación mensual: comparar cierre de este mes contra el cierre del mes anterior o el inicio del mes
          let varMensual = 0;
          if (mIndex > 0) {
            const prevMonthKey = monthKeys[mIndex - 1];
            const prevRegs = monthGroups[prevMonthKey];
            const prevLastReg = prevRegs[prevRegs.length - 1];
            const prevEmp = prevLastReg.empresas?.[ticker] || (prevLastReg as any)[ticker.toLowerCase()];
            const prevP = prevEmp?.precio || 0;
            if (prevP > 0 && precioCierreMes > 0) {
              varMensual = ((precioCierreMes - prevP) / prevP) * 100;
            }
          } else if (firstRegOfMonth) {
            const empFirst = firstRegOfMonth.empresas?.[ticker] || (firstRegOfMonth as any)[ticker.toLowerCase()];
            const startP = empFirst?.precio || 0;
            if (startP > 0 && precioCierreMes > 0) {
              varMensual = ((precioCierreMes - startP) / startP) * 100;
            }
          }

          item[`${ticker}_Var`] = Number(varMensual.toFixed(2));
        });

        return item;
      });
    }
  }, [allTickers, filteredRegistros, timeGrouping, selectedMonth]);

  // Lista de tickers a renderizar en las líneas/barras
  const activeChartTickers = useMemo(() => {
    return marketTickers.filter(
      (t) => selectedTickerFilter === 'ALL' || selectedTickerFilter === t
    );
  }, [marketTickers, selectedTickerFilter]);

  // Unidad de moneda para eje Y
  const currencyUnit = marketCategory === 'internacional' ? '$ USDT' : marketCategory === 'nacional' ? 'Bs.' : 'Precio';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* Panel Superior de Controles y Filtros */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        
        {/* Fila 1: Título y Categoría de Mercado */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-blue-400" />
            <div>
              <h2 className="text-sm font-bold text-slate-100">Gráficos de Tendencia y Precios de Cierre</h2>
              <p className="text-[11px] text-slate-400">Analice la evolución por día, por mes o por mercado.</p>
            </div>
          </div>

          {/* Selector de Mercado (Nacional vs Internacional) */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => {
                setMarketCategory('nacional');
                setSelectedTickerFilter('ALL');
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                marketCategory === 'nacional'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Nacionales (Bs.)</span>
            </button>

            <button
              onClick={() => {
                setMarketCategory('internacional');
                setSelectedTickerFilter('ALL');
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                marketCategory === 'internacional'
                  ? 'bg-amber-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Internacionales ($ USDT)</span>
            </button>

            <button
              onClick={() => {
                setMarketCategory('all');
                setSelectedTickerFilter('ALL');
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                marketCategory === 'all'
                  ? 'bg-slate-700 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Todos</span>
            </button>
          </div>
        </div>

        {/* Fila 2: Agrupación Temporal y Filtros por Mes */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Agrupación temporal */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setTimeGrouping('diario')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  timeGrouping === 'diario'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                📅 Días del Mes
              </button>
              <button
                onClick={() => setTimeGrouping('mensual')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  timeGrouping === 'mensual'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                📊 Agrupado por Mes
              </button>
            </div>

            {/* Filtro de Mes Específico */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                Mes:
              </span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-semibold cursor-pointer"
              >
                <option value="ALL">🗓️ Todos los Meses ({availableMonths.length})</option>
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthLabel(m)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Filtro de Ticker / Empresa */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-400 font-medium flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5 text-emerald-400" />
              Activo:
            </span>
            <button
              onClick={() => setSelectedTickerFilter('ALL')}
              className={`px-2.5 py-1 rounded-xl font-semibold transition-all text-xs ${
                selectedTickerFilter === 'ALL'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Todos ({marketTickers.length})
            </button>
            {marketTickers.map((ticker) => (
              <button
                key={ticker}
                onClick={() => setSelectedTickerFilter(ticker)}
                className={`px-2.5 py-1 rounded-xl font-semibold transition-all inline-flex items-center gap-1 text-xs ${
                  selectedTickerFilter === ticker
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <CompanyLogo ticker={ticker} size="sm" />
                <span>{ticker}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Gráfico 1: Evolución de Precios de Cierre */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>
                Evolución de Precios ({timeGrouping === 'mensual' ? 'Cierres Mensuales' : selectedMonth !== 'ALL' ? `Días de ${formatMonthLabel(selectedMonth)}` : 'Historial Diario'}) ({currencyUnit})
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {timeGrouping === 'mensual'
                ? 'Tendencias consolidadas por cada mes para visualizar la trayectoria a mediano y largo plazo'
                : 'Puntos por los días de cada mes en el eje horizontal'}
            </p>
          </div>
          {chartData.length > 0 && (
            <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 self-start sm:self-auto">
              {chartData.length} {timeGrouping === 'mensual' ? 'meses' : 'puntos'}
            </span>
          )}
        </div>

        <div className="h-80 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="fecha"
                stroke="#64748b"
                tick={{ fontSize: 11 }}
                interval={timeGrouping === 'diario' && selectedMonth === 'ALL' && chartData.length > 15 ? 'preserveStartEnd' : 0}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fontSize: 11 }}
                domain={['auto', 'auto']}
                unit={marketCategory === 'internacional' ? '$' : ''}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fechaCompleta || ''}
                formatter={(val: any, name: any) => {
                  const ticker = String(name).split(' ')[0];
                  return [formatCurrencyByTicker(Number(val), ticker), name];
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />

              {activeChartTickers.map((ticker, idx) => (
                <Line
                  key={ticker}
                  type="monotone"
                  dataKey={`${ticker}_Precio`}
                  name={`${ticker} (${isInternationalTicker(ticker) ? '$ USDT' : 'Bs.'})`}
                  stroke={COLOR_PALETTE[idx % COLOR_PALETTE.length]}
                  strokeWidth={2.5}
                  dot={{ r: timeGrouping === 'mensual' ? 5 : 3 }}
                  activeDot={{ r: 7 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gráfico 2: Variación Porcentual (%) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-blue-400" />
              <span>
                Variación {timeGrouping === 'mensual' ? 'Mensual' : 'Diaria'} (%) por Acción
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {timeGrouping === 'mensual'
                ? 'Rendimiento porcentual de cada mes consolidado'
                : 'Porcentaje de fluctuación respecto a la jornada anterior'}
            </p>
          </div>
        </div>

        <div className="h-72 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 30, left: 15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="fecha"
                stroke="#64748b"
                tick={{ fontSize: 11 }}
                interval={timeGrouping === 'diario' && selectedMonth === 'ALL' && chartData.length > 15 ? 'preserveStartEnd' : 0}
              />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} unit="%" />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fechaCompleta || ''}
                formatter={(val: any) => [`${formatPercent(Number(val))}`, 'Variación']}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <ReferenceLine y={0} stroke="#475569" strokeDasharray="2 2" />

              {activeChartTickers.map((ticker, idx) => (
                <Bar
                  key={ticker}
                  dataKey={`${ticker}_Var`}
                  name={`${ticker} Var %`}
                  fill={COLOR_PALETTE[idx % COLOR_PALETTE.length]}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
};
