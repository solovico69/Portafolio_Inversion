/**
 * PROYECTO: Control de Precios de Cierre y Portafolio de Inversión
 * DESARROLLO & ARQUITECTURA: Victor Solorzano
 * ASISTENCIA TÉCNICA: Google AI Studio & Antigravity IDE
 * ROL: Controlador Principal de Estado y Vista (App.tsx)
 */

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
import { getAccessToken, appendRegistroToSheet, updateResumenInSheet, initAuth } from './services/googleSheets';

export default function App() {
  // Pestaña activa: 'form' (Registrar Precios Diarios) por defecto
  const [activeTab, setActiveTab] = useState<'form' | 'portfolio' | 'international' | 'history' | 'charts'>('form');

  // Spreadsheet ID & Apps Script Web App URL de Google Sheets
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(() => {
    return localStorage.getItem('google_spreadsheet_id');
  });

  const [appsScriptUrl, setAppsScriptUrl] = useState<string | null>(() => {
    return localStorage.getItem('apps_script_url');
  });

  // Estado de registros de historial (Solo en memoria / sincronizado desde Google Sheets)
  const [registros, setRegistros] = useState<PrecioCierreRegistro[]>(
    INITIAL_PRECIOS_CIERRE.map(normalizeRegistro)
  );

  // Estado de Portafolio Nacional (Casa de Bolsa MERCOSUR)
  const [portfolioNacional, setPortfolioNacional] = useState<PortfolioPosicion[]>(
    INITIAL_PORTFOLIO_NACIONAL
  );

  // Estado de Portafolio Internacional (Binance bStock / Cripto)
  const [portfolioInternacional, setPortfolioInternacional] = useState<PosicionInternacional[]>(
    INITIAL_PORTFOLIO_INTERNACIONAL
  );

  // Notificaciones Toast
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Inicializar listener de Firebase Auth
  useEffect(() => {
    initAuth();
  }, []);

  // Obtener último registro ordenado por fecha
  const sortedRegistros = [...registros].sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  );
  const latestRegistro = sortedRegistros[0];
  const prevRegistro = sortedRegistros[1];

  // Guardar nuevo registro diario (Envío directo a Google Sheets PRECIOS_CIERRE)
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

    if (spreadsheetId) {
      const token = getAccessToken();
      try {
        await appendRegistroToSheet(token, spreadsheetId, nuevoData, appsScriptUrl);
        setToast({
          id: Date.now().toString(),
          type: 'success',
          title: 'Guardado en Google Sheets',
          message: `El registro para la fecha ${nuevoData.fecha} se guardó directamente en la pestaña PRECIOS_CIERRE.`,
        });
      } catch (err: any) {
        console.error('Error al guardar en Google Sheets:', err);
        setToast({
          id: Date.now().toString(),
          type: 'error',
          title: 'Error de Envío a Google Sheets',
          message: `${err.message || 'Por favor inicie sesión con Google para permitir la escritura en la hoja.'}`,
        });
      }
    } else {
      setToast({
        id: Date.now().toString(),
        type: 'info',
        title: 'Sin Hoja Vinculada',
        message: 'Para guardar directamente en Google Sheets, primero vincule el enlace de su archivo de Google Sheets.',
      });
    }
  };

  // Sincronizar cambios de Portafolio en RESUMEN ACTUAL
  const syncResumenToSheet = async (
    nac: PortfolioPosicion[],
    inter: PosicionInternacional[]
  ) => {
    if (spreadsheetId) {
      const token = getAccessToken();
      try {
        await updateResumenInSheet(token, spreadsheetId, nac, inter, appsScriptUrl);
      } catch (err: any) {
        console.error('Error sincronizando RESUMEN ACTUAL:', err);
      }
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
    if (confirm('¿Desea restablecer las posiciones a los valores iniciales predeterminados?')) {
      setRegistros(INITIAL_PRECIOS_CIERRE);
      setPortfolioNacional(INITIAL_PORTFOLIO_NACIONAL);
      setPortfolioInternacional(INITIAL_PORTFOLIO_INTERNACIONAL);
      setToast({
        id: Date.now().toString(),
        type: 'info',
        title: 'Datos Restablecidos',
        message: 'Se restauraron los portafolios a la configuración base.',
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
    const updated = portfolioNacional.map((pos) => {
      if (pos.id === id) {
        const inversionTotal = cantidad * pos.precioCompra + pos.comisiones + pos.iva + pos.derRegistro;
        return {
          ...pos,
          cantidad,
          inversionTotal,
        };
      }
      return pos;
    });

    setPortfolioNacional(updated);
    syncResumenToSheet(updated, portfolioInternacional);
  };

  // Agregar lote en Portafolio Nacional
  const handleAddNacionalPosicion = (pos: Omit<PortfolioPosicion, 'id'>) => {
    const nueva: PortfolioPosicion = {
      ...pos,
      id: `pos-${Date.now()}`,
    };
    const updated = [...portfolioNacional, nueva];
    setPortfolioNacional(updated);
    syncResumenToSheet(updated, portfolioInternacional);

    setToast({
      id: Date.now().toString(),
      type: 'success',
      title: 'Posición Agregada',
      message: `Se añadió ${pos.codigo} al Portafolio Nacional y se actualizó en Google Sheets.`,
    });
  };

  // Eliminar lote en Portafolio Nacional
  const handleDeleteNacionalPosicion = (id: string) => {
    const updated = portfolioNacional.filter((p) => p.id !== id);
    setPortfolioNacional(updated);
    syncResumenToSheet(updated, portfolioInternacional);

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
    const updated = [...portfolioInternacional, nueva];
    setPortfolioInternacional(updated);
    syncResumenToSheet(portfolioNacional, updated);

    setToast({
      id: Date.now().toString(),
      type: 'success',
      title: 'Activo Internacional Agregado',
      message: `Se añadió ${pos.activo} ($${pos.inversionUsdt} USDT) y se actualizó en Google Sheets.`,
    });
  };

  // Modificar cantidad de tokens en Portafolio Internacional
  const handleUpdateInternacionalQuantity = (id: string, valorToken: number) => {
    const updated = portfolioInternacional.map((pos) => {
      if (pos.id === id) {
        const invReal = pos.precioInicialCompra > 0 ? valorToken * pos.precioInicialCompra : pos.inversionUsdt;
        return {
          ...pos,
          valorToken,
          inversionUsdt: invReal,
        };
      }
      return pos;
    });

    setPortfolioInternacional(updated);
    syncResumenToSheet(portfolioNacional, updated);

    setToast({
      id: Date.now().toString(),
      type: 'info',
      title: 'Tokens Actualizados',
      message: 'Se actualizó la cantidad de tokens para el activo internacional.',
    });
  };

  // Eliminar activo internacional
  const handleDeleteInternacionalPosicion = (id: string) => {
    const updated = portfolioInternacional.filter((p) => p.id !== id);
    setPortfolioInternacional(updated);
    syncResumenToSheet(portfolioNacional, updated);

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
          appsScriptUrl={appsScriptUrl}
          setAppsScriptUrl={setAppsScriptUrl}
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
          <p className="text-[11px] text-slate-600">Sincronización Dinámica Directa con Google Sheets (PRECIOS_CIERRE & RESUMEN ACTUAL)</p>
        </div>
      </footer>

      {/* Toast Notification */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
