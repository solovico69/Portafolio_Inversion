import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { FileSpreadsheet, CheckCircle2, AlertCircle, RefreshCw, LogOut, Plus, Search, ExternalLink, Link2 } from 'lucide-react';
import {
  googleSignIn,
  logoutGoogle,
  getAccessToken,
  createPreciosSpreadsheet,
  fetchRegistrosFromSheet,
  fetchResumenFromSheet,
  searchDriveSheets,
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
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getAccessToken());
  const [loading, setLoading] = useState(false);
  const [driveFiles, setDriveFiles] = useState<Array<{ id: string; name: string }>>([]);
  const [customInputId, setCustomInputId] = useState('');
  const [showSelector, setShowSelector] = useState(false);

  // Iniciar sesión con Google
  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
        onToast('success', 'Sesión iniciada', `Bienvenido ${res.user.displayName || res.user.email}`);
        
        // Cargar archivos de Drive
        const files = await searchDriveSheets(res.accessToken);
        setDriveFiles(files);

        // Si ya hay spreadsheetId guardado, cargar datos
        if (spreadsheetId) {
          syncData(res.accessToken, spreadsheetId);
        } else if (files.length > 0) {
          setShowSelector(true);
        }
      }
    } catch (err: any) {
      console.error(err);
      onToast('error', 'Error al autenticar', err.message || 'No se pudo iniciar sesión con Google.');
    } finally {
      setLoading(false);
    }
  };

  // Cerrar sesión
  const handleLogout = async () => {
    await logoutGoogle();
    setUser(null);
    setToken(null);
    onToast('info', 'Sesión cerrada', 'Se ha desconectado de Google Sheets.');
  };

  // Crear una nueva hoja de cálculo en Drive
  const handleCreateNewSheet = async () => {
    const currentToken = token || getAccessToken();
    if (!currentToken) {
      onToast('error', 'Inicie sesión', 'Debe iniciar sesión para crear una hoja en Google Drive.');
      return;
    }

    setLoading(true);
    try {
      const newId = await createPreciosSpreadsheet(currentToken, 'Control de Portafolio MERCOSUR');
      setSpreadsheetId(newId);
      localStorage.setItem('google_spreadsheet_id', newId);
      onToast('success', 'Hoja Creada', 'Se creó exitosamente la hoja "Control de Portafolio MERCOSUR" en su Google Drive.');
      
      // Sincronizar
      await syncData(currentToken, newId);
      setShowSelector(false);
    } catch (err: any) {
      console.error(err);
      onToast('error', 'Error al crear hoja', err.message || 'No se pudo crear la hoja en Google Drive.');
    } finally {
      setLoading(false);
    }
  };

  // Sincronizar datos desde Google Sheets (Historial + Portafolio Nacional + Portafolio Internacional)
  const syncData = async (currentToken: string, id: string) => {
    setLoading(true);
    try {
      const registros = await fetchRegistrosFromSheet(currentToken, id);
      const resumen = await fetchResumenFromSheet(currentToken, id);

      onDataLoadedFromSheet(registros, resumen.nacional, resumen.internacional);
      onToast(
        'success',
        'Sincronizado con Google Sheets',
        `Se obtuvieron ${registros.length} registros del historial, ${resumen.nacional.length} posiciones nacionales y ${resumen.internacional.length} internacionales.`
      );
    } catch (err: any) {
      console.error(err);
      onToast('error', 'Error al leer hoja', err.message || 'Verifique el acceso a su Google Sheet.');
    } finally {
      setLoading(false);
    }
  };

  // Conectar con ID existente o pegar URL
  const handleConnectExisting = async (idOrUrl: string) => {
    let cleanId = idOrUrl.trim();
    if (cleanId.includes('/d/')) {
      const parts = cleanId.split('/d/');
      if (parts[1]) {
        cleanId = parts[1].split('/')[0];
      }
    }

    if (!cleanId) return;

    const currentToken = token || getAccessToken();
    if (!currentToken) {
      onToast('error', 'Inicie sesión', 'Primero inicie sesión con Google.');
      return;
    }

    setSpreadsheetId(cleanId);
    localStorage.setItem('google_spreadsheet_id', cleanId);
    await syncData(currentToken, cleanId);
    setShowSelector(false);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl mb-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        
        {/* Info & Status */}
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl border ${token ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Sincronización Automática con Google Sheets</h3>
              {token ? (
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800/80 rounded-full font-medium">
                  <CheckCircle2 className="w-3 h-3" /> Conectado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-amber-950/60 text-amber-400 border border-amber-800/60 rounded-full font-medium">
                  <AlertCircle className="w-3 h-3" /> Desconectado
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {token && user
                ? `Cuenta: ${user.email} ${spreadsheetId ? `• Hoja vinculada: Google Drive` : '• Seleccione o cree una hoja'}`
                : 'Inicie sesión con su cuenta de Google para guardar directamente en su archivo de Google Drive.'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          {!token ? (
            <button
              onClick={handleLogin}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl text-xs transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032 s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2 C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.761H12.545z"/>
              </svg>
              <span>{loading ? 'Conectando...' : 'Iniciar Sesión con Google'}</span>
            </button>
          ) : (
            <>
              {spreadsheetId && (
                <>
                  <button
                    onClick={() => token && spreadsheetId && syncData(token, spreadsheetId)}
                    disabled={loading}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium border border-slate-700 transition-all flex items-center gap-1.5"
                    title="Obtener los últimos registros de Google Sheets"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : 'text-slate-400'}`} />
                    <span>Sincronizar Datos</span>
                  </button>

                  <a
                    href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl text-xs font-medium border border-slate-700 transition-all flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Abrir Google Sheet</span>
                  </a>
                </>
              )}

              <button
                onClick={() => setShowSelector(!showSelector)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium border border-slate-700 transition-all flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400" />
                <span>{spreadsheetId ? 'Cambiar Hoja' : 'Seleccionar Hoja'}</span>
              </button>

              <button
                onClick={handleLogout}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 rounded-xl border border-slate-700 transition-all"
                title="Cerrar Sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Selector de Hoja de Cálculo */}
      {token && (showSelector || !spreadsheetId) && (
        <div className="mt-4 pt-4 border-t border-slate-800 space-y-4">
          <p className="text-xs font-semibold text-slate-300">
            Elija la hoja de cálculo de Google vinculada a sus portafolios:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Opción 1: Crear Nueva Hoja */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3">
              <div>
                <h4 className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                  <Plus className="w-4 h-4" /> Crear Nueva Hoja en Google Drive
                </h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  Crea automáticamente una hoja con el título "Control de Portafolio MERCOSUR".
                </p>
              </div>
              <button
                onClick={handleCreateNewSheet}
                disabled={loading}
                className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
              >
                {loading ? 'Creando Hoja...' : 'Crear Hoja "Control de Portafolio MERCOSUR"'}
              </button>
            </div>

            {/* Opción 2: Vinculación con Link o ID */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3">
              <div>
                <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <Link2 className="w-4 h-4" /> Vincular mediante Link / URL de Google Sheet
                </h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  Pegue el enlace o ID de su archivo de Google Sheets existente.
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={customInputId}
                  onChange={(e) => setCustomInputId(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
                <button
                  onClick={() => handleConnectExisting(customInputId)}
                  disabled={!customInputId || loading}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                >
                  Vincular
                </button>
              </div>
            </div>
          </div>

          {/* Opción 3: Buscar en Drive */}
          {driveFiles.length > 0 && (
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <h4 className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-slate-400" /> Hojas de Cálculo encontradas en su Google Drive:
              </h4>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {driveFiles.map((file) => (
                  <div
                    key={file.id}
                    onClick={() => handleConnectExisting(file.id)}
                    className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                      spreadsheetId === file.id
                        ? 'bg-blue-950/80 text-blue-300 border border-blue-800'
                        : 'bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800'
                    }`}
                  >
                    <span className="font-medium truncate">{file.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{file.id.substring(0, 8)}...</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
