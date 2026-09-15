import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, CheckCircle2, AlertCircle, RefreshCw, Link2, ExternalLink, Download } from 'lucide-react';
import {
  fetchRegistrosFromSheet,
  fetchResumenFromSheet,
  getAccessToken,
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
  onToast: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

export const GoogleSheetsSync: React.FC<GoogleSheetsSyncProps> = ({
  onDataLoadedFromSheet,
  spreadsheetId,
  setSpreadsheetId,
  onToast,
}) => {
  const [loading, setLoading] = useState(false);
  const [customInputId, setCustomInputId] = useState('');
  const [showConfig, setShowConfig] = useState(!spreadsheetId);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Sincronizar datos automáticamente al cargar si existe un spreadsheetId
  useEffect(() => {
    if (spreadsheetId) {
      syncData(spreadsheetId, true);
    }
  }, [spreadsheetId]);

  // Sincronizar datos desde la hoja de cálculo de Google
  const syncData = async (id: string, isSilent = false) => {
    setLoading(true);
    try {
      const token = getAccessToken();
      const registros = await fetchRegistrosFromSheet(token, id);
      const resumen = await fetchResumenFromSheet(token, id);

      if (registros.length > 0 || resumen.nacional.length > 0 || resumen.internacional.length > 0) {
        onDataLoadedFromSheet(registros, resumen.nacional, resumen.internacional);
        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setLastSyncTime(now);

        if (!isSilent) {
          onToast(
            'success',
            '¡Sincronización Exitosa!',
            `Se actualizaron ${registros.length} registros del historial y posiciones del portafolio.`
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

  // Vincular hoja mediante Enlace URL o ID
  const handleConnectSheet = async (idOrUrl: string) => {
    let cleanId = idOrUrl.trim();
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
    await syncData(cleanId, false);
    setShowConfig(false);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl mb-6 backdrop-blur-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        
        {/* Info & Status */}
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl border ${spreadsheetId ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Sincronización Automática con Google Sheets</h3>
              {spreadsheetId ? (
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800/80 rounded-full font-medium">
                  <CheckCircle2 className="w-3 h-3" /> Conectado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-amber-950/60 text-amber-400 border border-amber-800/60 rounded-full font-medium">
                  <AlertCircle className="w-3 h-3" /> Sin Hoja Vinculada
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {spreadsheetId
                ? `Hoja vinculada activamente ${lastSyncTime ? `• Última actualización: ${lastSyncTime}` : ''}`
                : 'Vincule su hoja de Google Sheets para mantener sus precios y portafolios sincronizados automáticamente.'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          {spreadsheetId && (
            <>
              <button
                onClick={() => syncData(spreadsheetId, false)}
                disabled={loading}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl text-xs transition-all shadow-lg flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>{loading ? 'Sincronizando...' : 'Sincronizar Ahora'}</span>
              </button>

              <a
                href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl text-xs font-medium border border-slate-700 transition-all flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Abrir Hoja</span>
              </a>
            </>
          )}

          <button
            onClick={() => setShowConfig(!showConfig)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium border border-slate-700 transition-all flex items-center gap-1.5"
          >
            <Link2 className="w-3.5 h-3.5 text-blue-400" />
            <span>{spreadsheetId ? 'Cambiar Enlace' : 'Vincular Hoja'}</span>
          </button>
        </div>
      </div>

      {/* Configuración de Enlace */}
      {showConfig && (
        <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-3">
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
            <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5 mb-1">
              <Link2 className="w-4 h-4" /> Enlace o ID de su Google Sheet
            </h4>
            <p className="text-[11px] text-slate-400 mb-3">
              Pegue la URL completa de su hoja de cálculo. Asegúrese de configurar el acceso de la hoja en Google Drive como <span className="text-emerald-400 font-semibold">"Cualquier persona con el enlace puede ver"</span> para sincronizar automáticamente sin ventanas emergentes de inicio de sesión.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="https://docs.google.com/spreadsheets/d/1aBcDeFgHiJk..."
                value={customInputId}
                onChange={(e) => setCustomInputId(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={() => handleConnectSheet(customInputId)}
                disabled={!customInputId || loading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Guardar y Sincronizar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
