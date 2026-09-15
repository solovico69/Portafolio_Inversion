import React, { useState, useEffect } from 'react';
import { PrecioCierreRegistro, PortfolioPosicion, PosicionInternacional, ToastMessage } from './types';
import {
  INITIAL_PRECIOS_CIERRE,
  INITIAL_PORTFOLIO_NACIONAL,
  INITIAL_PORTFOLIO_INTERNACIONAL,
} from './data/initialData';
import { exportToExcelSheet, normalizeRegistro, normalizeTicker } from './utils/formatters';
import { Header } from './components/Header';
import { PriceForm } from './components/PriceForm';
import { PriceHistoryTable } from './components/PriceHistoryTable';
import { PriceCharts } from './components/PriceCharts';
import { PortfolioSummary } from './components/PortfolioSummary';
import { InternationalPortfolio } from './components/InternationalPortfolio';
import { Toast } from './components/Toast';
import { GoogleSheetsSync } from './components/GoogleSheetsSync';
import { getAccessToken, appendRegistroToSheet } from './services/googleSheets';

export default function App() {
  // Pestaña activa: 'form' (Registrar Precios Diarios) por defecto
  const [activeTab, setActiveTab] = useState<'form' | 'portfolio' | 'international' | 'history' | 'charts'>('form');

  // Spreadsheet ID de Google Sheets
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(() => {
    return localStorage.getItem('google_spreadsheet_id');
  });

  // Cargar registros de historial del localStorage o datos iniciales
  const [registros, setRegistros] = useState<PrecioCierreRegistro[]>(() => {
    try {
      const saved = localStorage.getItem('precios_cierre_records');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(normalizeRegistro);
        }
      }
    } catch (e) {
      console.error('Error al cargar historial del localStorage', e);
    }
    return INITIAL_PRECIOS_CIERRE.map(normalizeRegistro);
  });

  // Cargar Portafolio Nacional (Casa de Bolsa MERCOSUR)
  const [portfolioNacional, setPortfolioNacional] = useState<PortfolioPosicion[]>(() => {
    try {
      const saved = localStorage.getItem('portfolio_nacional');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error al cargar portafolio nacional', e);
    }
    return INITIAL_PORTFOLIO_NACIONAL;
  });

  // Cargar Portafolio Internacional (Binance bStock / Cripto)
  const [portfolioInternacional, setPortfolioInternacional] = useState<PosicionInternacional[]>(() => {
    try {
      const saved = localStorage.getItem('portfolio_internacional');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((p) => ({ ...p, activo: normalizeTicker(p.activo) }));
        }
      }
    } catch (e) {
      console.error('Error al cargar portafolio internacional', e);
    }
    return INITIAL_PORTFOLIO_INTERNACIONAL;
  });

  // Notificaciones Toast
  const [toast, setToast] = useState<ToastMessage | null>(null);


  // Guardar historial en localStorage
  useEffect(() => {
    try {
      localStorage.setItem('precios_cierre_records', JSON.stringify(registros));
    } catch (e) {
      console.error('Error guardando registros en localStorage', e);
    }
  }, [registros]);

  // Guardar Portafolio Nacional en localStorage
  useEffect(() => {
    try {
      localStorage.setItem('portfolio_nacional', JSON.stringify(portfolioNacional));
    } catch (e) {
      console.error('Error guardando portafolio nacional en localStorage', e);
    }
  }, [portfolioNacional]);

  // Guardar Portafolio Internacional en localStorage
  useEffect(() => {
    try {
      localStorage.setItem('portfolio_internacional', JSON.stringify(portfolioInternacional));
    } catch (e) {
      console.error('Error guardando portafolio internacional en localStorage', e);
    }
  }, [portfolioInternacional]);

  // Obtener último registro ordenado por fecha
  const sortedRegistros = [...registros].sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  );
  const latestRegistro = sortedRegistros[0];
  const prevRegistro = sortedRegistros[1];

  // Guardar nuevo registro diario (Local + Google Sheets)
  const handleSaveRegistro = async (nuevoData: Omit<PrecioCierreRegistro, 'id'>) => {
    const indexExistente = registros.findIndex((r) => r.fecha === nuevoData.fecha);
    let nuevoHistorial: PrecioCierreRegistro[] = [];

    if (indexExistente >= 0) {
      const actualizados = [...registros];
      actualizados[indexExistente] = normalizeRegistro({
        ...nuevoData,
        id: registros[indexExistente].id,
      });
      nuevoHistorial = actualizados;
    } else {
      const nuevo: PrecioCierreRegistro = normalizeRegistro({
        ...nuevoData,
        id: `reg-${Date.now()}`,
      });
      nuevoHistorial = [nuevo, ...registros];
    }

    setRegistros(nuevoHistorial);

    // Si Google Sheets está conectado, guardar directamente en la pestaña PRECIOS_CIERRE
    const token = getAccessToken();
    if (token && spreadsheetId) {
      try {
        await appendRegistroToSheet(token, spreadsheetId, nuevoData);
        setToast({
          id: Date.now().toString(),
          type: 'success',
          title: 'Guardado en Google Sheets',
          message: `El registro para la fecha ${nuevoData.fecha} se guardó en PRECIOS_CIERRE de su Google Sheet.`,
        });
      } catch (err: any) {
        console.error('Error al guardar en Google Sheets:', err);
        setToast({
          id: Date.now().toString(),
          type: 'error',
          title: 'Guardado Localmente (Error Google Sheets)',
          message: `El registro se guardó localmente pero falló el envío a Google Sheets: ${err.message || 'Error de conexión'}.`,
        });
      }
    } else {
      setToast({
        id: Date.now().toString(),
        type: 'success',
        title: '¡Registro Guardado Con Éxito!',
        message: `Se añadieron los precios para la fecha ${nuevoData.fecha} al historial local.`,
      });
    }
  };

  // Cargar datos sincronizados desde Google Sheets
  const handleDataLoadedFromSheet = (
    sheetRegistros: PrecioCierreRegistro[],
    sheetNacional: PortfolioPosicion[],
    sheetInternacional: PosicionInternacional[]
  ) => {
    if (sheetRegistros && sheetRegistros.length > 0) {
      setRegistros((prev) => {
        const fechamap = new Map<string, PrecioCierreRegistro>();
        sheetRegistros.forEach((item) => fechamap.set(item.fecha, item));
        return Array.from(fechamap.values()).sort(
          (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
        );
      });
    }

    if (sheetNacional && sheetNacional.length > 0) {
      setPortfolioNacional(sheetNacional);
    }

    if (sheetInternacional && sheetInternacional.length > 0) {
      setPortfolioInternacional(sheetInternacional);
    }
  };

  // Restablecer a datos predeterminados
  const handleRestoreDefaults = () => {
    if (confirm('¿Desea restablecer los datos de sus portafolios a la configuración predeterminada?')) {
      setRegistros(INITIAL_PRECIOS_CIERRE);
      setPortfolioNacional(INITIAL_PORTFOLIO_NACIONAL);
      setPortfolioInternacional(INITIAL_PORTFOLIO_INTERNACIONAL);
      setToast({
        id: Date.now().toString(),
        type: 'info',
        title: 'Datos Restablecidos',
        message: 'Se restauraron los portafolios Nacional (BNC, BPV, BVCC, RST-B) e Internacional (SPYB/USDT).',
      });
    }
  };

  // Exportar Excel directo
  const handleExportExcel = () => {
    if (registros.length === 0) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'Sin Datos',
        message: 'No hay registros en el historial para exportar.',
      });
      return;
    }

    exportToExcelSheet(registros, 'Precios_Cierre_Portafolios.xlsx');

    setToast({
      id: Date.now().toString(),
      type: 'success',
      title: 'Excel Generado',
      message: 'El archivo Excel con la pestaña PRECIOS_CIERRE ha sido descargado.',
    });
  };

  // Modificar cantidad en Portafolio Nacional
  const handleUpdateNacionalQuantity = (id: string, cantidad: number) => {
    setPortfolioNacional((prev) =>
      prev.map((pos) => {
        if (pos.id === id) {
          const inversionTotal = cantidad * pos.precioCompra + pos.comisiones + pos.iva + pos.derRegistro;
          return {
            ...pos,
            cantidad,
            inversionTotal,
          };
        }
        return pos;
      })
    );
  };

  // Agregar lote en Portafolio Nacional
  const handleAddNacionalPosicion = (pos: Omit<PortfolioPosicion, 'id'>) => {
    const nueva: PortfolioPosicion = {
      ...pos,
      id: `pos-${Date.now()}`,
    };
    setPortfolioNacional([...portfolioNacional, nueva]);
    setToast({
      id: Date.now().toString(),
      type: 'success',
      title: 'Posición Agregada',
      message: `Se añadió la compra de ${pos.codigo} al Portafolio Nacional.`,
    });
  };

  // Eliminar lote en Portafolio Nacional
  const handleDeleteNacionalPosicion = (id: string) => {
    setPortfolioNacional(portfolioNacional.filter((p) => p.id !== id));
    setToast({
      id: Date.now().toString(),
      type: 'info',
      title: 'Posición Removida',
      message: 'Se eliminó la posición del Portafolio Nacional.',
    });
  };

  // Agregar activo internacional (Binance bStock / Cripto)
  const handleAddInternacionalPosicion = (pos: Omit<PosicionInternacional, 'id'>) => {
    const nueva: PosicionInternacional = {
      ...pos,
      id: `inter-${Date.now()}`,
    };
    setPortfolioInternacional([...portfolioInternacional, nueva]);
    setToast({
      id: Date.now().toString(),
      type: 'success',
      title: 'Activo Internacional Agregado',
      message: `Se añadió ${pos.activo} ($${pos.inversionUsdt} USDT) al Portafolio Internacional.`,
    });
  };

  // Modificar cantidad de tokens en Portafolio Internacional
  const handleUpdateInternacionalQuantity = (id: string, valorToken: number) => {
    setPortfolioInternacional(
      portfolioInternacional.map((pos) => {
        if (pos.id === id) {
          const invReal = pos.precioInicialCompra > 0 ? valorToken * pos.precioInicialCompra : pos.inversionUsdt;
          return {
            ...pos,
            valorToken,
            inversionUsdt: invReal,
          };
        }
        return pos;
      })
    );
    setToast({
      id: Date.now().toString(),
      type: 'info',
      title: 'Tokens Actualizados',
      message: 'Se actualizó la cantidad de tokens para el activo internacional.',
    });
  };

  // Eliminar activo internacional
  const handleDeleteInternacionalPosicion = (id: string) => {
    setPortfolioInternacional(portfolioInternacional.filter((p) => p.id !== id));
    setToast({
      id: Date.now().toString(),
      type: 'info',
      title: 'Activo Removido',
      message: 'Se eliminó la posición del Portafolio Internacional.',
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-blue-600 selection:text-white">
      
      {/* Header Principal */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        latestRegistro={latestRegistro}
        prevRegistro={prevRegistro}
        onExportExcel={handleExportExcel}
        totalRegistrosCount={registros.length}
      />

      {/* Contenido Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        
        {/* Componente de Sincronización con Google Sheets */}
        <GoogleSheetsSync
          onDataLoadedFromSheet={handleDataLoadedFromSheet}
          spreadsheetId={spreadsheetId}
          setSpreadsheetId={setSpreadsheetId}
          onToast={(type, title, message) =>
            setToast({
              id: Date.now().toString(),
              type,
              title,
              message,
            })
          }
        />

        {activeTab === 'portfolio' && (
          <PortfolioSummary
            latestRegistro={latestRegistro}
            portfolio={portfolioNacional}
            onUpdateQuantity={handleUpdateNacionalQuantity}
            onAddPosicion={handleAddNacionalPosicion}
            onDeletePosicion={handleDeleteNacionalPosicion}
          />
        )}

        {activeTab === 'international' && (
          <InternationalPortfolio
            latestRegistro={latestRegistro}
            portfolio={portfolioInternacional}
            onUpdateQuantity={handleUpdateInternacionalQuantity}
            onAddPosicion={handleAddInternacionalPosicion}
            onDeletePosicion={handleDeleteInternacionalPosicion}
          />
        )}

        {activeTab === 'form' && (
          <PriceForm
            onSave={handleSaveRegistro}
            latestRegistro={latestRegistro}
            onNavigateToHistory={() => setActiveTab('history')}
          />
        )}

        {activeTab === 'history' && (
          <PriceHistoryTable
            registros={registros}
            onExportExcel={handleExportExcel}
            onRestoreDefaults={handleRestoreDefaults}
            onNavigateToForm={() => setActiveTab('form')}
          />
        )}

        {activeTab === 'charts' && <PriceCharts registros={registros} />}

      </main>

      {/* Pie de página discreto */}
      <footer className="bg-slate-950 border-t border-slate-900 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© 2026 Control de Portafolios - MERCOSUR & Binance bStock</p>
          <p className="text-[11px] text-slate-600">Sincronización Dinámica con Google Sheets (PRECIOS_CIERRE & RESUMEN ACTUAL)</p>
        </div>
      </footer>

      {/* Toast Notification */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
