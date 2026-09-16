/**
 * PROYECTO: Control de Precios de Cierre y Portafolio de Inversión
 * DESARROLLO & ARQUITECTURA: Victor Solorzano
 * ASISTENCIA TÉCNICA: Google AI Studio & Antigravity IDE
 * ROL: Servicio de integración de Google Sheets y Google Apps Script (GAS WebApp)
 */

import { PrecioCierreRegistro, PortfolioPosicion, PosicionInternacional, EmpresaDatos } from '../types';
import { parseNumberInput, formatDateLatina, normalizeTicker, normalizeRegistro } from '../utils/formatters';

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

// Leer de forma totalmente dinámica todos los precios e historial desde PRECIOS_CIERRE (Public CSV)
export const fetchRegistrosFromSheet = async (
  spreadsheetId: string
): Promise<PrecioCierreRegistro[]> => {
  const publicRows = await fetchCsvFromPublicSheet(spreadsheetId, 'PRECIOS_CIERRE');
  if (publicRows && publicRows.length > 0) {
    return processPreciosRows(publicRows);
  }
  return [];
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

// Leer los portafolios (Nacional e Internacional) dinámicamente desde RESUMEN ACTUAL
export const fetchResumenFromSheet = async (
  spreadsheetId: string
): Promise<{ nacional: PortfolioPosicion[]; internacional: PosicionInternacional[] }> => {
  const publicRows = await fetchCsvFromPublicSheet(spreadsheetId, 'RESUMEN ACTUAL');
  if (publicRows && publicRows.length > 0) {
    return processResumenRows(publicRows);
  }
  return { nacional: [], internacional: [] };
};

// Guardar fila en Google Sheets (PRECIOS_CIERRE) mediante la Web App de Apps Script
export const appendRegistroToSheet = async (
  spreadsheetId: string,
  registro: Omit<PrecioCierreRegistro, 'id'>,
  webAppUrl?: string | null
): Promise<void> => {
  const targetUrl = webAppUrl || import.meta.env.VITE_APPS_SCRIPT_URL;

  if (!targetUrl || !targetUrl.trim().startsWith('http')) {
    throw new Error('No se ha configurado la URL de Apps Script WebApp. Pegue la URL del ejecutable de su Web App para guardar.');
  }

  const response = await fetch(targetUrl.trim(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // Usar text/plain para evitar errores de preflight CORS en Apps Script
    body: JSON.stringify({ action: 'appendPrecio', registro }),
  });

  if (!response.ok) {
    throw new Error('Error al comunicar con la Web App de Apps Script.');
  }

  const resData = await response.json().catch(() => ({ success: true }));
  if (resData.success === false) {
    throw new Error(resData.error || 'Error al procesar el guardado en Apps Script.');
  }
};

// Actualizar posiciones de portafolios en RESUMEN ACTUAL mediante la Web App de Apps Script (Preservando fórmulas)
export const updateResumenInSheet = async (
  spreadsheetId: string,
  nacional: PortfolioPosicion[],
  internacional: PosicionInternacional[],
  webAppUrl?: string | null
): Promise<void> => {
  const targetUrl = webAppUrl || import.meta.env.VITE_APPS_SCRIPT_URL;

  if (!targetUrl || !targetUrl.trim().startsWith('http')) {
    return;
  }

  const response = await fetch(targetUrl.trim(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'updateResumen', nacional, internacional }),
  });

  if (!response.ok) {
    console.error('Error al enviar actualización a la Web App de Apps Script.');
  }
};
