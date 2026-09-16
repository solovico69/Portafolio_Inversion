/**
 * PROYECTO: Control de Precios de Cierre y Portafolio de Inversión
 * DESARROLLO & ARQUITECTURA: Victor Solorzano
 * ASISTENCIA TÉCNICA: Google AI Studio & Antigravity IDE
 * ROL: Componente de Control de Enlaces y Sincronización con Google Sheets & Apps Script
 */

import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, CheckCircle2, AlertCircle, RefreshCw, Link2, ExternalLink, Download, Key } from 'lucide-react';
import {
  fetchRegistrosFromSheet,
  fetchResumenFromSheet,
} from '../services/googleSheets';
import { PrecioCierreRegistro, PortfolioPosicion, PosicionInternacional } from '../types';

interface GoogleSheetsSyncProps {
  onDataLoadedFromSheet: (
    registros: PrecioCierreRegistro[],
    nacional: PortfolioPosicion[],
    internacional: PosicionInternacional[]
  ) => void;
  spreadsheetId: string | null;
  setSpreadsheetId: (id: string | null) => void;
  appsScriptUrl?: string | null;
  setAppsScriptUrl?: (url: string | null) => void;
  onToast: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

export const GoogleSheetsSync: React.FC<GoogleSheetsSyncProps> = ({
  onDataLoadedFromSheet,
  spreadsheetId,
  setSpreadsheetId,
  appsScriptUrl,
  setAppsScriptUrl,
  onToast,
}) => {
  const [loading, setLoading] = useState(false);
  const defaultSheet = spreadsheetId || localStorage.getItem('google_spreadsheet_id') || import.meta.env.VITE_GOOGLE_SPREADSHEET_ID || '';
  const defaultScript = appsScriptUrl || localStorage.getItem('apps_script_url') || import.meta.env.VITE_APPS_SCRIPT_URL || '';

  const [customInputId, setCustomInputId] = useState(defaultSheet);
  const [customScriptUrl, setCustomScriptUrl] = useState(defaultScript);
  const [showConfig, setShowConfig] = useState(!defaultSheet);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Sincronizar datos automáticamente al cargar si existe un spreadsheetId
  useEffect(() => {
    const activeId = spreadsheetId || defaultSheet;
    if (activeId) {
      if (!spreadsheetId) setSpreadsheetId(activeId);
      syncData(activeId, true);
    }
  }, [spreadsheetId]);

  // Sincronizar datos desde la hoja de cálculo de Google
  const syncData = async (id: string, isSilent = false) => {
    if (!id) return;
    setLoading(true);
    try {
      const registros = await fetchRegistrosFromSheet(id);
      const resumen = await fetchResumenFromSheet(id);

      if (registros.length > 0 || resumen.nacional.length > 0 || resumen.internacional.length > 0) {
        onDataLoadedFromSheet(registros, resumen.nacional, resumen.internacional);
        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setLastSyncTime(now);

        if (!isSilent) {
          onToast(
            'success',
            '¡Sincronización Exitosa!',
            `Se cargaron ${registros.length} registros del historial y posiciones del portafolio.`
          );
        }
      }
    } catch (err: any) {
      console.error(err);
      if (!isSilent) {
        onToast(
          'error',
          'Error de Sincronización',
          err.message || 'Asegúrese de compartir su hoja de Google Sheets con "Cualquier persona con el enlace puede ver".'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // Guardar y vincular hoja y WebApp URL
  const handleSaveConfig = async () => {
    let cleanId = customInputId.trim();
    if (cleanId.includes('/d/')) {
      const parts = cleanId.split('/d/');
      if (parts[1]) {
        cleanId = parts[1].split('/')[0];
      }
    }

    if (!cleanId) {
      onToast('error', 'Enlace Inválido', 'Ingrese un enlace válido de Google Sheets o su ID.');
      return;
    }

    setSpreadsheetId(cleanId);
    localStorage.setItem('google_spreadsheet_id', cleanId);

    if (customScriptUrl && setAppsScriptUrl) {
      setAppsScriptUrl(customScriptUrl.trim());
      localStorage.setItem('apps_script_url', customScriptUrl.trim());
    }

    await syncData(cleanId, false);
    setShowConfig(false);
  };

  const activeId = spreadsheetId || defaultSheet;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl mb-6 backdrop-blur-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        
        {/* Info & Status */}
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl border ${activeId ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-white">Sincronización Directa con Google Sheets & Apps Script</h3>
              {activeId ? (
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800/80 rounded-full font-medium">
                  <CheckCircle2 className="w-3 h-3" /> Hoja Conectada
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-amber-950/60 text-amber-400 border border-amber-800/60 rounded-full font-medium">
                  <AlertCircle className="w-3 h-3" /> Sin Hoja Vinculada
                </span>
              )}
              {customScriptUrl && (
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-blue-950 text-blue-400 border border-blue-800/80 rounded-full font-medium">
                  Apps Script Activo
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeId
                ? `Guarda y lee directo en Sheets ${lastSyncTime ? `• Última lectura: ${lastSyncTime}` : ''}`
                : 'Vincule su hoja de Google Sheets y Web App para leer y guardar automáticamente sus precios y portafolios.'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          {activeId && (
            <>
              <button
                onClick={() => syncData(activeId, false)}
                disabled={loading}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl text-xs transition-all shadow-lg flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>{loading ? 'Sincronizando...' : 'Sincronizar'}</span>
              </button>

              <a
                href={`https://docs.google.com/spreadsheets/d/${activeId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl text-xs font-medium border border-slate-700 transition-all flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Abrir Sheet</span>
              </a>
            </>
          )}

          <button
            onClick={() => setShowConfig(!showConfig)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium border border-slate-700 transition-all flex items-center gap-1.5"
          >
            <Link2 className="w-3.5 h-3.5 text-blue-400" />
            <span>{activeId ? 'Configurar Enlaces' : 'Vincular Hoja'}</span>
          </button>
        </div>
      </div>

      {/* Configuración de Enlaces */}
      {showConfig && (
        <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-3">
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-3">
            <div>
              <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5 mb-1">
                <Link2 className="w-4 h-4" /> Enlace o ID de su Google Sheet
              </h4>
              <p className="text-[11px] text-slate-400 mb-2">
                Pegue la URL completa de su hoja de cálculo (`https://docs.google.com/spreadsheets/d/.../edit`).
              </p>
              <input
                type="text"
                placeholder="https://docs.google.com/spreadsheets/d/1aBcDeFgHiJk..."
                value={customInputId}
                onChange={(e) => setCustomInputId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="pt-2 border-t border-slate-900">
              <h4 className="text-xs font-bold text-blue-400 flex items-center gap-1.5 mb-1">
                <Key className="w-4 h-4" /> URL de Apps Script WebApp (Script ejecutable)
              </h4>
              <p className="text-[11px] text-slate-400 mb-2">
                Pegue aquí la URL del ejecutable de su Web App de Google Apps Script (`https://script.google.com/macros/s/.../exec`).
              </p>
              <input
                type="text"
                placeholder="https://script.google.com/macros/s/.../exec"
                value={customScriptUrl}
                onChange={(e) => setCustomScriptUrl(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={handleSaveConfig}
                disabled={!customInputId && !activeId}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Guardar Enlaces y Sincronizar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
