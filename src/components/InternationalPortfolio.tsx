import React, { useState } from 'react';
import { PosicionInternacional, PrecioCierreRegistro } from '../types';
import { formatUsdt, formatPercent, formatTokenQty, parseNumberInput, normalizeTicker } from '../utils/formatters';
import { Globe, Plus, Trash2, Calendar, DollarSign, Sparkles, TrendingUp, Target, Edit2, Check, X, ShieldAlert } from 'lucide-react';
import { CompanyLogo } from './CompanyLogo';

interface InternationalPortfolioProps {
  latestRegistro: PrecioCierreRegistro | undefined;
  portfolio: PosicionInternacional[];
  onUpdateQuantity?: (id: string, valorToken: number) => void;
  onAddPosicion: (posicion: Omit<PosicionInternacional, 'id'>) => void;
  onDeletePosicion: (id: string) => void;
}

export const InternationalPortfolio: React.FC<InternationalPortfolioProps> = ({
  latestRegistro,
  portfolio,
  onUpdateQuantity,
  onAddPosicion,
  onDeletePosicion,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [activo, setActivo] = useState('SPYB/USDT');
  const [nombre, setNombre] = useState('SPDR S&P 500 ETF Tokenized');
  const [fechaInicio, setFechaInicio] = useState('28/07/2026');
  const [fechaFin, setFechaFin] = useState('28/01/2027');
  const [valorToken, setValorToken] = useState('0.005994');
  const [precioInicialCompra, setPrecioInicialCompra] = useState('771.61');
  const [inversionUsdt, setInversionUsdt] = useState('4.62503');
  const [notas, setNotas] = useState('Binance bStock');

  // Estado para edición en línea de cantidad de tokens
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQtyValue, setEditQtyValue] = useState<string>('');

  // Obtener el precio actual en USDT desde PRECIOS_CIERRE dinámicamente
  const getPrecioActualUsdt = (pos: PosicionInternacional): number => {
    if (!latestRegistro) return pos.precioActualUsdt || pos.precioInicialCompra || 0;

    const clean = normalizeTicker(pos.activo);
    // Buscar en el mapa dinámico de empresas
    if (latestRegistro.empresas) {
      if (latestRegistro.empresas[clean]?.precio > 0) {
        return latestRegistro.empresas[clean].precio;
      }
      for (const [key, val] of Object.entries(latestRegistro.empresas) as [string, { precio: number }][]) {
        if (normalizeTicker(key) === clean && val && val.precio > 0) {
          return val.precio;
        }
      }
      // Probar variaciones ej. SPYB vs SPYB/USDT
      const base = clean.replace('/USDT', '').replace('USDT', '').trim();
      if (latestRegistro.empresas[base]?.precio > 0) {
        return latestRegistro.empresas[base].precio;
      }
    }

    return pos.precioActualUsdt || pos.precioInicialCompra || 0;
  };

  // Auto-calcular inversión total al escribir cantidad o precio de compra
  const handleTokenQtyChange = (val: string) => {
    setValorToken(val);
    const qty = parseNumberInput(val);
    const price = parseNumberInput(precioInicialCompra);
    if (qty > 0 && price > 0) {
      setInversionUsdt((qty * price).toFixed(5));
    }
  };

  const handlePriceCompraChange = (val: string) => {
    setPrecioInicialCompra(val);
    const qty = parseNumberInput(valorToken);
    const price = parseNumberInput(val);
    if (qty > 0 && price > 0) {
      setInversionUsdt((qty * price).toFixed(5));
    }
  };

  // Calcular métricas completas para cada posición
  let totalInversionUsdt = 0;
  let totalValorActualUsdt = 0;

  const posicionesCalculadas = portfolio.map((pos) => {
    const precioActual = getPrecioActualUsdt(pos);
    const vToken = pos.valorToken > 0 ? pos.valorToken : (pos.precioInicialCompra > 0 ? pos.inversionUsdt / pos.precioInicialCompra : 0);
    const valorActualMercado = vToken * precioActual;
    const invTotal = pos.inversionUsdt > 0 ? pos.inversionUsdt : vToken * pos.precioInicialCompra;
    const pnlUsdt = valorActualMercado - invTotal;
    const rendimientoPct = invTotal > 0 ? (pnlUsdt / invTotal) * 100 : 0;
    const precioObjetivo = (pos.precioInicialCompra || precioActual) * 1.4; // Meta +40%

    totalInversionUsdt += invTotal;
    totalValorActualUsdt += valorActualMercado;

    return {
      ...pos,
      valorTokenCalc: vToken,
      precioActual,
      valorActualMercado,
      pnlUsdt,
      rendimientoPct,
      precioObjetivo,
      inversionTotalReal: invTotal,
    };
  });

  const totalPnlUsdt = totalValorActualUsdt - totalInversionUsdt;
  const totalRendimientoPct = totalInversionUsdt > 0 ? (totalPnlUsdt / totalInversionUsdt) * 100 : 0;

  const handleStartEdit = (pos: PosicionInternacional) => {
    setEditingId(pos.id);
    setEditQtyValue(pos.valorToken?.toString() || '0');
  };

  const handleSaveEdit = (id: string) => {
    const newQty = parseNumberInput(editQtyValue);
    if (newQty >= 0 && onUpdateQuantity) {
      onUpdateQuantity(id, newQty);
    }
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activo) return;

    const qtyNum = parseNumberInput(valorToken);
    const pCompraNum = parseNumberInput(precioInicialCompra);
    let invNum = parseNumberInput(inversionUsdt);

    if (invNum <= 0 && qtyNum > 0 && pCompraNum > 0) {
      invNum = qtyNum * pCompraNum;
    }

    onAddPosicion({
      activo: activo.toUpperCase().trim(),
      nombre: nombre || activo.toUpperCase().trim(),
      fechaInicio: fechaInicio || new Date().toLocaleDateString('es-VE'),
      fechaFin: fechaFin || '',
      valorToken: qtyNum,
      precioInicialCompra: pCompraNum,
      inversionUsdt: invNum,
      precioActualUsdt: pCompraNum,
      notas,
      estatusMeta: '⏳ En Progreso',
    });

    setActivo('SPYB/USDT');
    setNombre('SPDR S&P 500 ETF Tokenized');
    setValorToken('0.005994');
    setPrecioInicialCompra('771.61');
    setInversionUsdt('4.62503');
    setShowAddForm(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* Banner Resumen Ejecutivo estilo Portafolio Nacional */}
      <div className="bg-gradient-to-br from-amber-950/70 via-slate-900 to-slate-950 border border-amber-800/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-400 shadow-md">
                <Globe className="w-6 h-6" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    Portafolio Internacional (Binance bStock / Tokenized)
                  </h2>
                  <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">
                    USDT VALUATION
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                  Compra de acciones tokenizadas de EEUU por Binance. Valoración en tiempo real sincronizada con la hoja <strong className="text-emerald-400 font-mono">PRECIOS_CIERRE</strong> ({latestRegistro?.fecha ? `Fecha: ${latestRegistro.fecha}` : 'Sin registros aún'}).
                </p>
              </div>
            </div>
          </div>

          {/* Tarjetas de Métricas Principales */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/85 p-3.5 rounded-2xl border border-slate-800/90 shadow-lg text-xs">
            <div>
              <p className="text-slate-400 text-[11px] font-medium">Inversión Inicial</p>
              <p className="font-mono font-bold text-slate-100 text-sm mt-0.5">
                {formatUsdt(totalInversionUsdt, 2)}
              </p>
            </div>

            <div>
              <p className="text-slate-400 text-[11px] font-medium">Valor Actual Mercado</p>
              <p className="font-mono font-bold text-amber-400 text-sm mt-0.5">
                {formatUsdt(totalValorActualUsdt, 2)}
              </p>
            </div>

            <div>
              <p className="text-slate-400 text-[11px] font-medium">Ganancia / PnL USDT</p>
              <p className={`font-mono font-bold text-sm mt-0.5 ${totalPnlUsdt >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {totalPnlUsdt >= 0 ? '+' : ''}${totalPnlUsdt.toFixed(4)} USDT
              </p>
            </div>

            <div>
              <p className="text-slate-400 text-[11px] font-medium">Rendimiento (%)</p>
              <p className={`font-mono font-bold text-sm mt-0.5 ${totalRendimientoPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatPercent(totalRendimientoPct)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Formulario de Agregar Nuevo Activo Internacional */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Plus className="w-4 h-4 text-amber-400" />
              <span>Agregar Nueva Acción Tokenizada Internacional (Binance)</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs text-slate-400 hover:text-slate-200 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Empresa / Cripto (Ticker) *</label>
              <input
                type="text"
                placeholder="ej. SPYB/USDT o NVDAB/USDT"
                value={activo}
                onChange={(e) => setActivo(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 font-mono uppercase focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre / Descripción</label>
              <input
                type="text"
                placeholder="ej. SPDR S&P 500 ETF Tokenized"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Fecha Inicio (DD/MM/AAAA)</label>
              <input
                type="text"
                placeholder="ej. 28/07/2026"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Fecha Fin (DD/MM/AAAA)</label>
              <input
                type="text"
                placeholder="ej. 28/01/2027"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Cantidad / Valor Token *</label>
              <input
                type="text"
                placeholder="ej. 0.005994"
                value={valorToken}
                onChange={(e) => handleTokenQtyChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Precio Inicial de Compra ($ USDT) *</label>
              <input
                type="text"
                placeholder="ej. 771.61"
                value={precioInicialCompra}
                onChange={(e) => handlePriceCompraChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Inversión Inicial Total USDT *</label>
              <input
                type="text"
                placeholder="ej. 4.62503"
                value={inversionUsdt}
                onChange={(e) => setInversionUsdt(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Plataforma / Notas</label>
              <input
                type="text"
                placeholder="ej. Binance bStock"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs transition-all shadow-md"
            >
              Guardar en Portafolio Internacional
            </button>
          </div>
        </form>
      )}

      {/* Tabla Completa de Posiciones Internacionales con todas las columnas */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-amber-400" />
              <span>Detalle de Acciones Tokenizadas de EEUU por Binance</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Valores calculados dinámicamente con base en los cierres diarios.
            </p>
          </div>

          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all shadow-md self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar Posición</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-950/90 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Empresa / Cripto</th>
                <th className="py-3.5 px-3">Fecha Inicio / Fin</th>
                <th className="py-3.5 px-3 text-right">Valor Token</th>
                <th className="py-3.5 px-3 text-right">Precio Inicial Compra</th>
                <th className="py-3.5 px-3 text-right text-slate-300">Inversión Inicial USDT</th>
                <th className="py-3.5 px-3 text-right text-amber-400">Precio Actual USDT</th>
                <th className="py-3.5 px-3 text-right text-amber-300">Valor Actual Mercado</th>
                <th className="py-3.5 px-3 text-right">PnL (USDT)</th>
                <th className="py-3.5 px-3 text-right">Rendimiento (%)</th>
                <th className="py-3.5 px-3 text-center">Meta (+40%)</th>
                <th className="py-3.5 px-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-xs text-slate-200 font-mono">
              {posicionesCalculadas.map((pos) => {
                const isEditing = editingId === pos.id;
                const isProfitable = pos.pnlUsdt >= 0;

                return (
                  <tr key={pos.id} className="hover:bg-slate-850/60 transition-colors">
                    {/* Empresa / Cripto */}
                    <td className="py-3.5 px-4 font-sans font-bold">
                      <div className="flex items-center gap-2.5">
                        <CompanyLogo ticker={pos.activo} size="sm" />
                        <div>
                          <div className="text-slate-100 font-mono font-bold text-xs">{pos.activo}</div>
                          <div className="text-[10px] text-slate-400 font-normal font-sans truncate max-w-[130px]">
                            {pos.nombre || pos.notas || 'Binance bStock'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Fechas */}
                    <td className="py-3.5 px-3 text-slate-300 font-sans text-[11px]">
                      <div className="flex flex-col">
                        <span className="text-slate-300 font-mono">{pos.fechaInicio}</span>
                        <span className="text-slate-500 text-[10px] font-mono">{pos.fechaFin || '6 meses'}</span>
                      </div>
                    </td>

                    {/* Valor Token / Cantidad */}
                    <td className="py-3.5 px-3 text-right font-mono">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="text"
                            value={editQtyValue}
                            onChange={(e) => setEditQtyValue(e.target.value)}
                            className="w-20 px-1.5 py-0.5 bg-slate-950 border border-amber-500 rounded text-right font-mono text-xs text-amber-300"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveEdit(pos.id)}
                            className="p-1 text-emerald-400 hover:text-emerald-300"
                            title="Guardar"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5 group">
                          <span className="font-semibold text-slate-100">{formatTokenQty(pos.valorTokenCalc, 6)}</span>
                          <button
                            onClick={() => handleStartEdit(pos)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-amber-400 transition-opacity"
                            title="Editar cantidad de tokens"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Precio Inicial Compra */}
                    <td className="py-3.5 px-3 text-right font-mono text-slate-300">
                      ${pos.precioInicialCompra.toFixed(2)}
                    </td>

                    {/* Inversión Inicial USDT */}
                    <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-200">
                      ${pos.inversionTotalReal.toFixed(5)}
                    </td>

                    {/* Precio Actual USDT */}
                    <td className="py-3.5 px-3 text-right font-mono font-bold text-amber-400">
                      ${pos.precioActual.toFixed(2)}
                    </td>

                    {/* Valor Actual Mercado */}
                    <td className="py-3.5 px-3 text-right font-mono font-bold text-amber-300 bg-amber-950/15">
                      ${pos.valorActualMercado.toFixed(5)}
                    </td>

                    {/* Ganancia / Pérdida USDT (PnL) */}
                    <td className="py-3.5 px-3 text-right font-mono font-semibold">
                      <span className={isProfitable ? 'text-emerald-400' : 'text-rose-400'}>
                        {isProfitable ? '+' : ''}${pos.pnlUsdt.toFixed(5)}
                      </span>
                    </td>

                    {/* Rendimiento Porcentual (%) */}
                    <td className="py-3.5 px-3 text-right font-mono font-bold">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[11px] ${
                          isProfitable
                            ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                            : 'bg-rose-950/80 text-rose-400 border border-rose-800/60'
                        }`}
                      >
                        {formatPercent(pos.rendimientoPct)}
                      </span>
                    </td>

                    {/* Precio Objetivo (+40%) */}
                    <td className="py-3.5 px-3 text-center font-mono text-[11px] text-slate-400">
                      <div className="flex flex-col items-center">
                        <span className="text-blue-400 font-semibold">${pos.precioObjetivo.toFixed(2)}</span>
                        <span className="text-[9px] text-slate-500">⏳ En Progreso</span>
                      </div>
                    </td>

                    {/* Acciones */}
                    <td className="py-3.5 px-3 text-right">
                      <button
                        onClick={() => onDeletePosicion(pos.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-all"
                        title="Eliminar activo del portafolio"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {posicionesCalculadas.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-slate-500 text-xs font-sans">
                    No hay activos internacionales registrados. Haga clic en "Agregar Posición" o conecte su Google Sheet.
                  </td>
                </tr>
              )}
            </tbody>

            {/* Fila de Totales */}
            {posicionesCalculadas.length > 0 && (
              <tfoot>
                <tr className="bg-slate-950 border-t-2 border-slate-800 font-mono text-xs font-bold">
                  <td colSpan={4} className="py-3.5 px-4 font-sans text-slate-300">
                    TOTALES PORTAFOLIO INTERNACIONAL ({posicionesCalculadas.length} Activos)
                  </td>
                  <td className="py-3.5 px-3 text-right text-slate-100">
                    ${totalInversionUsdt.toFixed(5)} USDT
                  </td>
                  <td className="py-3.5 px-3 text-right text-slate-400">-</td>
                  <td className="py-3.5 px-3 text-right text-amber-400 text-sm">
                    ${totalValorActualUsdt.toFixed(5)} USDT
                  </td>
                  <td className={`py-3.5 px-3 text-right ${totalPnlUsdt >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {totalPnlUsdt >= 0 ? '+' : ''}${totalPnlUsdt.toFixed(5)} USDT
                  </td>
                  <td className={`py-3.5 px-3 text-right ${totalRendimientoPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatPercent(totalRendimientoPct)}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Nota Explicativa y Leyenda */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 text-xs text-slate-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            Los precios de cierre en USDT de las acciones tokenizadas se actualizan automáticamente al registrar la jornada en la pestaña <strong className="text-slate-200">Registrar Precios Diarios</strong>.
          </span>
        </div>
      </div>

    </div>
  );
};
