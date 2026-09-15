import React, { useState } from 'react';
import { PortfolioPosicion, PrecioCierreRegistro } from '../types';
import { formatBs, formatPercent } from '../utils/formatters';
import { PieChart, TrendingUp, DollarSign, Wallet, Target, Sparkles, Plus, Trash2 } from 'lucide-react';
import { CompanyLogo } from './CompanyLogo';

interface PortfolioSummaryProps {
  latestRegistro: PrecioCierreRegistro | undefined;
  portfolio: PortfolioPosicion[];
  onUpdateQuantity: (id: string, cantidad: number) => void;
  onAddPosicion: (pos: Omit<PortfolioPosicion, 'id'>) => void;
  onDeletePosicion: (id: string) => void;
}

export const PortfolioSummary: React.FC<PortfolioSummaryProps> = ({
  latestRegistro,
  portfolio,
  onUpdateQuantity,
  onAddPosicion,
  onDeletePosicion,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [precioCompra, setPrecioCompra] = useState('');
  const [comisiones, setComisiones] = useState('');
  const [iva, setIva] = useState('');
  const [derRegistro, setDerRegistro] = useState('');

  // Obtener el precio de cierre actual para cualquier ticker de forma dinámica
  const getPrecioActual = (ticker: string, fallbackPrice?: number): number => {
    if (!latestRegistro) return fallbackPrice || 0;
    
    // Primero buscar en empresas dinámicas
    const emp = latestRegistro.empresas?.[ticker.toUpperCase()];
    if (emp && emp.precio > 0) return emp.precio;

    // Fallback retrocompatible
    if (ticker.toUpperCase() === 'BNC') return latestRegistro.bnc?.precio || fallbackPrice || 0;
    if (ticker.toUpperCase() === 'BPV') return latestRegistro.bpv?.precio || fallbackPrice || 0;
    if (ticker.toUpperCase() === 'BVCC') return latestRegistro.bvcc?.precio || fallbackPrice || 0;

    return fallbackPrice || 0;
  };

  // Calcular métricas
  let totalInversion = 0;
  let totalValorActual = 0;

  const posicionesCalculadas = portfolio.map((pos) => {
    const precioActual = getPrecioActual(pos.codigo, pos.precioActual);
    const valorActual = pos.cantidad * (precioActual > 0 ? precioActual : (pos.precioPromedio || pos.precioCompra));
    const gananciaPerdida = valorActual - pos.inversionTotal;
    const rendimientoNeto =
      pos.inversionTotal > 0
        ? ((valorActual - pos.inversionTotal) / pos.inversionTotal) * 100
        : 0;

    const precioObjetivo = pos.precioObjetivo || (pos.precioPromedio || pos.precioCompra) * 1.5;
    const estatusMeta = precioActual >= precioObjetivo && precioActual > 0 ? '🎯 Meta Alcanzada' : (pos.estatusMeta || '⏳ En Progreso');

    totalInversion += pos.inversionTotal;
    totalValorActual += valorActual;

    return {
      ...pos,
      precioPromedio: pos.precioPromedio || pos.precioCompra,
      precioActual,
      valorActual,
      gananciaPerdida,
      rendimientoNeto,
      precioObjetivo,
      estatusMeta,
    };
  });

  const totalGananciaPerdida = totalValorActual - totalInversion;
  const rendimientoTotalNeto =
    totalInversion > 0
      ? (totalGananciaPerdida / totalInversion) * 100
      : 0;

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigo || !cantidad || !precioCompra) return;

    const cantNum = parseInt(cantidad, 10) || 0;
    const pCompraNum = parseFloat(precioCompra) || 0;
    const comNum = parseFloat(comisiones) || 0;
    const ivaNum = parseFloat(iva) || 0;
    const derNum = parseFloat(derRegistro) || 0;
    const invTotal = cantNum * pCompraNum + comNum + ivaNum + derNum;

    onAddPosicion({
      codigo: codigo.toUpperCase().trim(),
      nombre: nombre || `${codigo.toUpperCase()} (${cantNum} acc.)`,
      cantidad: cantNum,
      precioCompra: pCompraNum,
      comisiones: comNum,
      iva: ivaNum,
      derRegistro: derNum,
      inversionTotal: invTotal,
      estatusMeta: '⏳ En Progreso',
    });

    setCodigo('');
    setNombre('');
    setCantidad('');
    setPrecioCompra('');
    setComisiones('');
    setIva('');
    setDerRegistro('');
    setShowAddForm(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* Resumen Ejecutivo del Portafolio */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-blue-500/15 border border-blue-500/30 rounded-xl text-blue-400">
                <Wallet className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-bold text-white">Global de Acciones Nacionales MERCOSUR</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Consolidado global de tenencias por empresa (BVC / MERCOSUR), valorado automáticamente con el último precio de <strong className="text-emerald-400 font-mono">PRECIOS_CIERRE</strong> ({latestRegistro?.fecha ? `Fecha: ${latestRegistro.fecha}` : 'Sin registros aún'}).
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80">
            <div>
              <p className="text-slate-400">Inversión Total</p>
              <p className="font-mono font-bold text-slate-100 text-sm mt-0.5">
                {formatBs(totalInversion)}
              </p>
            </div>

            <div>
              <p className="text-slate-400">Valor Actual</p>
              <p className="font-mono font-bold text-emerald-400 text-sm mt-0.5">
                {formatBs(totalValorActual)}
              </p>
            </div>

            <div>
              <p className="text-slate-400">Ganancia / Pérdida</p>
              <p
                className={`font-mono font-bold text-sm mt-0.5 ${
                  totalGananciaPerdida >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {totalGananciaPerdida >= 0 ? '+' : ''}{formatBs(totalGananciaPerdida)}
              </p>
            </div>

            <div>
              <p className="text-slate-400">Rendimiento Neto</p>
              <p
                className={`font-mono font-bold text-sm mt-0.5 ${
                  rendimientoTotalNeto >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {formatPercent(rendimientoTotalNeto)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Formulario para agregar o ajustar acción en el Global */}
      {showAddForm && (
        <form onSubmit={handleAddSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-400" />
              <span>Agregar o Ajustar Acción en Global MERCOSUR</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Ticker / Código *</label>
              <input
                type="text"
                placeholder="ej. RST-B, BNC, SVS"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 font-mono uppercase focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Cantidad Global *</label>
              <input
                type="number"
                placeholder="ej. 18"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Precio Promedio Compra (Bs.) *</label>
              <input
                type="number"
                step="0.01"
                placeholder="ej. 600.55"
                value={precioCompra}
                onChange={(e) => setPrecioCompra(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Comisiones / Otros (Bs.)</label>
              <input
                type="number"
                step="0.01"
                placeholder="ej. 134.40"
                value={comisiones}
                onChange={(e) => setComisiones(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-all shadow-md"
            >
              Guardar en Global de Acciones
            </button>
          </div>
        </form>
      )}

      {/* Tabla Detallada de Acciones Nacionales */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-blue-400" />
            <span>GLOBAL DE ACCIONES NACIONALES MERCOSUR</span>
          </h3>

          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-xl text-xs font-semibold transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar Acción al Global</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Acción</th>
                <th className="py-3 px-4">Cantidad</th>
                <th className="py-3 px-4">Precio Promedio</th>
                <th className="py-3 px-4">Inversión Total</th>
                <th className="py-3 px-4 text-blue-400">Precio Actual</th>
                <th className="py-3 px-4 text-emerald-400">Valor Actual</th>
                <th className="py-3 px-4">Ganancia / Pérdida</th>
                <th className="py-3 px-4">Rendimiento Neto</th>
                <th className="py-3 px-4">Precio Objetivo (50%)</th>
                <th className="py-3 px-4">Estatus</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-xs text-slate-200 font-mono">
              {posicionesCalculadas.map((pos) => (
                <tr key={pos.id} className="hover:bg-slate-850/60 transition-colors">
                  {/* Código y Nombre */}
                  <td className="py-3.5 px-4 font-sans">
                    <CompanyLogo ticker={pos.codigo} size="sm" showName={true} />
                  </td>

                  {/* Cantidad con edición rápida */}
                  <td className="py-3.5 px-4">
                    <input
                      type="number"
                      min={1}
                      value={pos.cantidad}
                      onChange={(e) =>
                        onUpdateQuantity(
                          pos.id,
                          parseInt(e.target.value, 10) || 0
                        )
                      }
                      className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                    />
                  </td>

                  {/* Precio Promedio */}
                  <td className="py-3.5 px-4">{formatBs(pos.precioPromedio)}</td>

                  {/* Inversión Total */}
                  <td className="py-3.5 px-4 text-slate-300">
                    {formatBs(pos.inversionTotal)}
                  </td>

                  {/* Precio Actual (Cierre) */}
                  <td className="py-3.5 px-4 font-bold text-blue-400">
                    {formatBs(pos.precioActual)}
                  </td>

                  {/* Valor Actual */}
                  <td className="py-3.5 px-4 font-bold text-emerald-400">
                    {formatBs(pos.valorActual)}
                  </td>

                  {/* Ganancia / Pérdida en Bs. */}
                  <td className="py-3.5 px-4 font-bold">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                        pos.gananciaPerdida >= 0
                          ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-800/40'
                          : 'bg-rose-950/70 text-rose-400 border border-rose-800/40'
                      }`}
                    >
                      {pos.gananciaPerdida >= 0 ? '+' : ''}{formatBs(pos.gananciaPerdida)}
                    </span>
                  </td>

                  {/* Rendimiento Neto */}
                  <td className="py-3.5 px-4 font-bold">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] ${
                        pos.rendimientoNeto >= 0
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                          : 'bg-rose-950 text-rose-400 border border-rose-800/50'
                      }`}
                    >
                      {formatPercent(pos.rendimientoNeto)}
                    </span>
                  </td>

                  {/* Precio Objetivo */}
                  <td className="py-3.5 px-4 text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-amber-400" />
                      <span>{formatBs(pos.precioObjetivo)}</span>
                    </div>
                  </td>

                  {/* Estatus de Meta */}
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-sans font-medium ${
                        pos.estatusMeta.includes('Alcanzada')
                          ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-600/40'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {pos.estatusMeta}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => onDeletePosicion(pos.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                      title="Eliminar esta posición"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
