/**
 * PROYECTO: Control de Precios de Cierre y Portafolio de Inversión
 * DESARROLLO & ARQUITECTURA: Victor Solorzano
 * ASISTENCIA TÉCNICA: Google AI Studio & Antigravity IDE
 * ROL: Servicio de integración de APIs de Google Sheets y Firebase Auth
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { PrecioCierreRegistro, PortfolioPosicion, PosicionInternacional, EmpresaDatos } from '../types';
import { parseNumberInput, formatDateLatina, normalizeTicker, normalizeRegistro } from '../utils/formatters';

// Inicializar Firebase (Opcional)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');

let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Listener para el estado de autenticación (retrocompatibilidad)
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('No se pudo obtener el token de acceso de Google Auth');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Error al iniciar sesión con Google:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const logoutGoogle = async () => {
  try {
    await signOut(auth);
  } catch (e) {
    // Ignorar si no había sesión activa
  }
  cachedAccessToken = null;
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

// Parser robusto de CSV para hojas de Google Sheets públicas
const parseCsvRows = (text: string): string[][] => {
  const lines = text.split(/\r?\n/);
  const result: string[][] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const row: string[] = [];
    let insideQuote = false;
    let entry = '';
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (insideQuote && line[i + 1] === '"') {
          entry += '"';
          i++;
        } else {
          insideQuote = !insideQuote;
        }
      } else if ((char === ',' || char === ';') && !insideQuote) {
        row.push(entry.trim());
        entry = '';
      } else {
        entry += char;
      }
    }
    row.push(entry.trim());
    result.push(row);
  }
  return result;
};

// Intenta descargar el contenido CSV de una pestaña en una hoja compartida públicamente
const fetchCsvFromPublicSheet = async (spreadsheetId: string, sheetName: string): Promise<string[][] | null> => {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text.includes('<!DOCTYPE html>') || text.toLowerCase().includes('<html')) return null;
    const parsed = parseCsvRows(text);
    return parsed.length > 0 ? parsed : null;
  } catch (e) {
    return null;
  }
};

// Extrae el ticker de una cabecera de columna de Google Sheets
const extractTickerFromHeader = (headerStr: string): { ticker: string; isVar: boolean } => {
  const clean = headerStr.trim();
  const isVar = clean.toLowerCase().includes('var') || clean.includes('%');
  
  let rawTicker = clean
    .replace(/-?\s*Precio Cierre.*$/i, '')
    .replace(/-?\s*Precio.*$/i, '')
    .replace(/-?\s*Var.*$/i, '')
    .replace(/-?\s*%.*$/i, '')
    .replace(/\(Bs\.\)/i, '')
    .replace(/\(\$\s*USDT\)/i, '')
    .replace(/\(\$\)/i, '')
    .trim();

  const ticker = normalizeTicker(rawTicker);
  if (ticker.toUpperCase() === 'TICKER') return { ticker: '', isVar };
  return { ticker, isVar };
};

// Procesa filas bidimensionales de datos de PRECIOS_CIERRE
const processPreciosRows = (rows: any[][]): PrecioCierreRegistro[] => {
  if (rows.length === 0) return [];

  const headers = rows[0];
  const columnMapping: Array<{ colIndex: number; ticker: string; field: 'precio' | 'varDiaria' }> = [];

  for (let c = 1; c < headers.length; c++) {
    const headerText = String(headers[c] || '');
    if (!headerText.trim()) continue;

    const { ticker, isVar } = extractTickerFromHeader(headerText);
    if (!ticker || ticker.toUpperCase() === 'TICKER') continue;

    columnMapping.push({
      colIndex: c,
      ticker,
      field: isVar ? 'varDiaria' : 'precio',
    });
  }

  const registros: PrecioCierreRegistro[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    let fechaIso = row[0] ? String(row[0]).trim() : '';
    if (fechaIso.includes('/') && !fechaIso.includes('-')) {
      const parts = fechaIso.split('/');
      if (parts.length === 3) {
        fechaIso = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }

    if (!fechaIso) continue;

    const empresasMap: Record<string, EmpresaDatos> = {};

    columnMapping.forEach(({ colIndex, ticker, field }) => {
      if (!empresasMap[ticker]) {
        empresasMap[ticker] = { precio: 0 };
      }

      const rawVal = row[colIndex];
      if (rawVal !== undefined && rawVal !== '') {
        const parsed = parseNumberInput(rawVal);
        if (field === 'precio') {
          empresasMap[ticker].precio = parsed;
        } else if (field === 'varDiaria') {
          empresasMap[ticker].varDiaria = parsed;
        }
      }
    });

    const bnc = empresasMap['BNC'] || { precio: 0 };
    const bpv = empresasMap['BPV'] || { precio: 0 };
    const bvcc = empresasMap['BVCC'] || { precio: 0 };

    registros.push({
      id: `gsheet-${r}-${fechaIso}`,
      fecha: fechaIso,
      empresas: empresasMap,
      bnc,
      bpv,
      bvcc,
    });
  }

  return registros.map(normalizeRegistro);
};

// Leer de forma totalmente dinámica todos los precios e historial desde PRECIOS_CIERRE (Public CSV o API Token)
export const fetchRegistrosFromSheet = async (
  token: string | null,
  spreadsheetId: string
): Promise<PrecioCierreRegistro[]> => {
  // 1. Intentar lectura por exportación CSV pública (Sin requerir token / sin inicio de sesión)
  const publicRows = await fetchCsvFromPublicSheet(spreadsheetId, 'PRECIOS_CIERRE');
  if (publicRows && publicRows.length > 0) {
    return processPreciosRows(publicRows);
  }

  // 2. Si es privada y se provee token, usar API v4 de Google Sheets
  if (!token) {
    throw new Error('Para leer esta hoja privada, la hoja debe estar compartida como "Cualquier persona con el enlace puede ver" o bien requiere inicio de sesión.');
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/PRECIOS_CIERRE!A1:Z500`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('No se encontró la hoja de cálculo especificada.');
    }
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Error al leer datos de Google Sheets');
  }

  const data = await response.json();
  const rows: any[][] = data.values || [];
  return processPreciosRows(rows);
};

// Procesa filas de la pestaña RESUMEN ACTUAL
const processResumenRows = (rows: any[][]): { nacional: PortfolioPosicion[]; internacional: PosicionInternacional[] } => {
  const nacional: PortfolioPosicion[] = [];
  const internacional: PosicionInternacional[] = [];

  let modo: 'none' | 'nacional' | 'internacional' = 'none';

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const firstCell = String(row[0] || '').trim();

    if (
      (firstCell.toLowerCase().includes('global de acciones') || firstCell.toLowerCase().includes('global')) &&
      !firstCell.toLowerCase().includes('resumen actual')
    ) {
      modo = 'nacional';
      continue;
    }

    if (
      modo === 'none' &&
      firstCell.toLowerCase() === 'accion' &&
      row.some((c) => String(c).toLowerCase().includes('precio promedio'))
    ) {
      modo = 'nacional';
      continue;
    }

    if (
      firstCell.toLowerCase().includes('empresa / cripto') ||
      firstCell.toLowerCase().includes('empresa/cripto') ||
      firstCell.toLowerCase().includes('compra de acciones tockenizadas') ||
      firstCell.toLowerCase().includes('compra de acciones tokenizadas')
    ) {
      modo = 'internacional';
      continue;
    }

    if (modo === 'nacional') {
      if (!firstCell || firstCell.toLowerCase().includes('global') || firstCell.toLowerCase() === 'accion' || firstCell.toLowerCase().includes('totales')) {
        if (!firstCell) modo = 'none';
        continue;
      }

      const rawCodigo = firstCell;
      const codigo = normalizeTicker(rawCodigo);
      const cantidad = parseNumberInput(row[1] || 0);
      const precioPromedio = parseNumberInput(row[2] || 0);
      const inversionTotal = parseNumberInput(row[3] || 0);
      const precioActual = parseNumberInput(row[4] || 0);
      const valorActual = parseNumberInput(row[5] || 0);
      const precioObjetivo = parseNumberInput(row[7] || 0);
      const estatusMeta = row[8] ? String(row[8]).trim() : '⏳ En Progreso';
      const gananciaPerdida = parseNumberInput(row[10] || 0);

      if (codigo && (cantidad > 0 || inversionTotal > 0)) {
        nacional.push({
          id: `nac-global-${codigo}`,
          codigo,
          nombre: `${codigo} (${cantidad} acc.)`,
          cantidad,
          precioCompra: precioPromedio,
          precioPromedio,
          inversionTotal: inversionTotal > 0 ? inversionTotal : cantidad * precioPromedio,
          precioActual: precioActual > 0 ? precioActual : undefined,
          valorActual: valorActual > 0 ? valorActual : undefined,
          precioObjetivo: precioObjetivo > 0 ? precioObjetivo : precioPromedio * 1.5,
          gananciaPerdida,
          estatusMeta,
        });
      }
    } else if (modo === 'internacional') {
      if (!firstCell) {
        modo = 'none';
        continue;
      }

      const activo = firstCell;
      const fechaInicio = row[1] ? String(row[1]).trim() : '';
      const fechaFin = row[2] ? String(row[2]).trim() : '';
      const inversionUsdt = parseNumberInput(row[3] || 0);
      const valorToken = parseNumberInput(row[4] || 0);
      const precioInicialCompra = parseNumberInput(row[5] || 0);
      const precioActualUsdt = parseNumberInput(row[6] || 0);
      const notas = row[11] ? String(row[11]).trim() : 'Binance bStock';
      const estatusMeta = row[10] ? String(row[10]).trim() : '⏳ En Progreso';

      if (activo && (inversionUsdt > 0 || valorToken > 0)) {
        internacional.push({
          id: `inter-${i}-${activo}`,
          activo,
          fechaInicio,
          fechaFin,
          valorToken,
          precioInicialCompra,
          inversionUsdt: inversionUsdt > 0 ? inversionUsdt : valorToken * precioInicialCompra,
          precioActualUsdt: precioActualUsdt > 0 ? precioActualUsdt : precioInicialCompra,
          notas,
          estatusMeta,
        });
      }
    }
  }

  return { nacional, internacional };
};

// Leer los portafolios (Nacional e Internacional) dinámicamente desde la primera pestaña (RESUMEN ACTUAL / PORTAFOLIO)
export const fetchResumenFromSheet = async (
  token: string | null,
  spreadsheetId: string
): Promise<{ nacional: PortfolioPosicion[]; internacional: PosicionInternacional[] }> => {
  // 1. Intentar lectura mediante CSV público
  const publicRows = await fetchCsvFromPublicSheet(spreadsheetId, 'RESUMEN ACTUAL');
  if (publicRows && publicRows.length > 0) {
    return processResumenRows(publicRows);
  }

  // 2. Si no es pública y se provee token, usar API REST de Google Sheets
  if (!token) {
    return { nacional: [], internacional: [] };
  }

  const valuesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'RESUMEN ACTUAL'!A1:U100`;
  const valRes = await fetch(valuesUrl, { headers: { Authorization: `Bearer ${token}` } });

  if (!valRes.ok) {
    return { nacional: [], internacional: [] };
  }

  const valData = await valRes.json();
  const rows: any[][] = valData.values || [];
  return processResumenRows(rows);
};

// Guardar/Append fila en Google Sheets en PRECIOS_CIERRE
export const appendRegistroToSheet = async (
  token: string | null,
  spreadsheetId: string,
  registro: Omit<PrecioCierreRegistro, 'id'>,
  webAppUrl?: string | null
): Promise<void> => {
  // 1. Si existe URL de Google Apps Script Web App, intentar guardar directamente por la Web App
  if (webAppUrl && webAppUrl.trim().startsWith('http')) {
    try {
      const resp = await fetch(webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'appendPrecio', registro }),
      });
      if (resp.ok) return;
    } catch (e) {
      console.warn('Fallo el guardado mediante Apps Script WebApp, intentando con Google API:', e);
    }
  }

  // 2. Si no hay token de inicio de sesión de Google, requerir autenticación
  if (!token) {
    throw new Error('Para guardar directamente en Google Sheets, inicie sesión con Google o configure la URL de Apps Script WebApp.');
  }

  const headUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/PRECIOS_CIERRE!A1:Z1`;
  const headRes = await fetch(headUrl, { headers: { Authorization: `Bearer ${token}` } });

  let headers: string[] = [];
  if (headRes.ok) {
    const headData = await headRes.json();
    headers = headData.values?.[0] || [];
  }

  if (headers.length === 0) {
    headers = [
      'Fecha (DD/MM/AAAA)',
      'BNC - Precio Cierre (Bs.)',
      'BNC - Var %',
      'BPV - Precio Cierre (Bs.)',
      'BPV - Var %',
      'BVCC - Precio Cierre (Bs.)',
      'BVCC - Var %',
      'RST-B - Precio Cierre (Bs.)',
      'RST-B - Var %',
    ];
  }

  const rowValues: any[] = [];

  headers.forEach((h, idx) => {
    if (idx === 0) {
      rowValues.push(formatDateLatina(registro.fecha));
      return;
    }

    const { ticker, isVar } = extractTickerFromHeader(h);
    const empData = registro.empresas?.[ticker] || registro[ticker.toLowerCase() as keyof typeof registro] as EmpresaDatos || { precio: 0 };

    if (isVar) {
      rowValues.push(empData.varDiaria !== undefined ? empData.varDiaria : '');
    } else {
      rowValues.push(empData.precio || '');
    }
  });

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/PRECIOS_CIERRE!A:Z:append?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [rowValues],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Error al guardar en Google Sheets');
  }
};

// Actualizar posiciones de portafolios en RESUMEN ACTUAL sin tocar columnas con fórmulas nativas (Regla #2)
export const updateResumenInSheet = async (
  token: string | null,
  spreadsheetId: string,
  nacional: PortfolioPosicion[],
  internacional: PosicionInternacional[],
  webAppUrl?: string | null
): Promise<void> => {
  // 1. Si existe URL de Google Apps Script Web App, intentar enviar a la Web App
  if (webAppUrl && webAppUrl.trim().startsWith('http')) {
    try {
      const resp = await fetch(webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateResumen', nacional, internacional }),
      });
      if (resp.ok) return;
    } catch (e) {
      console.warn('Fallo actualización mediante Apps Script WebApp:', e);
    }
  }

  if (!token) {
    throw new Error('Para guardar los cambios de portafolio en su Google Sheet, inicie sesión con su cuenta de Google.');
  }

  // Leer primero las filas existentes de RESUMEN ACTUAL para mapear ubicaciones
  const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'RESUMEN ACTUAL'!A1:L60`;
  const getRes = await fetch(getUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (!getRes.ok) return;

  const getData = await getRes.json();
  const existingRows: any[][] = getData.values || [];

  // Mapear y actualizar únicamente columnas de entrada (Acción, Cantidad, Precio Promedio)
  const updatedRows = [...existingRows];

  let modo: 'none' | 'nacional' | 'internacional' = 'none';
  for (let i = 0; i < updatedRows.length; i++) {
    const row = updatedRows[i];
    if (!row || row.length === 0) continue;
    const firstCell = String(row[0] || '').trim();

    if (firstCell.toLowerCase().includes('global de acciones')) {
      modo = 'nacional';
      continue;
    }
    if (firstCell.toLowerCase().includes('empresa / cripto') || firstCell.toLowerCase().includes('compra de acciones tokenizadas')) {
      modo = 'internacional';
      continue;
    }

    if (modo === 'nacional' && firstCell && !firstCell.toLowerCase().includes('totales') && firstCell.toLowerCase() !== 'accion') {
      const ticker = normalizeTicker(firstCell);
      const pos = nacional.find((p) => normalizeTicker(p.codigo) === ticker);
      if (pos) {
        row[1] = pos.cantidad;
        row[2] = pos.precioPromedio || pos.precioCompra;
        // Ignorar de forma programática las columnas formuladas (Inversión Total, Precio Actual, Valor Actual, etc.)
      }
    } else if (modo === 'internacional' && firstCell && !firstCell.toLowerCase().includes('totales')) {
      const ticker = normalizeTicker(firstCell);
      const pos = internacional.find((p) => normalizeTicker(p.activo) === ticker);
      if (pos) {
        row[3] = pos.inversionUsdt;
        row[4] = pos.valorToken;
        row[5] = pos.precioInicialCompra;
      }
    }
  }

  const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'RESUMEN ACTUAL'!A1:L${updatedRows.length}?valueInputOption=USER_ENTERED`;
  await fetch(updateUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: updatedRows }),
  });
};

// Crear una hoja nueva de Google Spreadsheet
export const createPreciosSpreadsheet = async (token: string, title = 'Control de Portafolio MERCOSUR'): Promise<string> => {
  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title,
      },
      sheets: [
        { properties: { title: 'RESUMEN ACTUAL' } },
        { properties: { title: 'PRECIOS_CIERRE' } },
      ],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Error al crear la hoja en Google Sheets');
  }

  const data = await response.json();
  const spreadsheetId = data.spreadsheetId;

  const headerValues = [
    [
      'Fecha (DD/MM/AAAA)',
      'BNC - Precio Cierre (Bs.)',
      'BNC - Var %',
      'BPV - Precio Cierre (Bs.)',
      'BPV - Var %',
      'BVCC - Precio Cierre (Bs.)',
      'BVCC - Var %',
      'RST-B - Precio Cierre (Bs.)',
      'RST-B - Var %',
    ],
  ];

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/PRECIOS_CIERRE!A1:I1?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: headerValues,
    }),
  });

  return spreadsheetId;
};

// Buscar archivos en Google Drive
export const searchDriveSheets = async (token: string): Promise<Array<{ id: string; name: string }>> => {
  const q = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return data.files || [];
};
