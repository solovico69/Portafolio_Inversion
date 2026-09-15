import * as XLSX from 'xlsx';
import { PrecioCierreRegistro } from '../types';

/**
 * Normaliza y limpia un ticker eliminando espacios alrededor de barras, colapsando espacios y convirtiendo a mayúsculas
 */
export function normalizeTicker(ticker: string | undefined): string {
  if (!ticker) return '';
  return ticker
    .toUpperCase()
    .trim()
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ');
}

/**
 * Normaliza un registro de precios de cierre para consolidar claves de empresas duplicadas con o sin espacios
 */
export function normalizeRegistro(reg: PrecioCierreRegistro): PrecioCierreRegistro {
  if (!reg || !reg.empresas) return reg;
  const normalizedEmpresas: Record<string, { precio: number; varDiaria?: number }> = {};
  for (const [key, val] of Object.entries(reg.empresas)) {
    const cleanKey = normalizeTicker(key);
    if (!cleanKey || cleanKey === 'TICKER') continue;
    if (normalizedEmpresas[cleanKey]) {
      normalizedEmpresas[cleanKey] = {
        precio: val.precio > 0 ? val.precio : normalizedEmpresas[cleanKey].precio,
        varDiaria: val.varDiaria !== undefined ? val.varDiaria : normalizedEmpresas[cleanKey].varDiaria,
      };
    } else {
      normalizedEmpresas[cleanKey] = { ...val };
    }
  }
  return {
    ...reg,
    empresas: normalizedEmpresas,
  };
}

/**
 * Determina si un ticker o activo corresponde al mercado internacional (USDT/USD)
 */
export function isInternationalTicker(ticker: string): boolean {
  if (!ticker) return false;
  const clean = normalizeTicker(ticker);
  return (
    clean.includes('USDT') ||
    clean.includes('USD') ||
    clean.includes('SPYB') ||
    clean.includes('NVDAB') ||
    clean.includes('AAPL') ||
    clean.includes('TSLA') ||
    clean.includes('BTC') ||
    clean.includes('ETH') ||
    clean.includes('/')
  );
}

/**
 * Parsea un string a número aceptando formatos venezolanos (con coma como decimal '465,00') o estándar ('465.00')
 */
export function parseNumberInput(value: string | number | undefined): number {
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  if (!value) return 0;
  
  // Limpiar espacios
  const clean = value.toString().trim();
  if (!clean) return 0;

  // Si tiene formato con puntos de miles y coma decimal (ej. 1.250,50)
  if (clean.includes(',') && clean.includes('.')) {
    if (clean.indexOf('.') < clean.indexOf(',')) {
      // 1.250,50 -> 1250.50
      const formatted = clean.replace(/\./g, '').replace(',', '.');
      return parseFloat(formatted) || 0;
    }
  }

  // Si sólo tiene coma (ej. 465,50)
  const normalized = clean.replace(',', '.');
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Formatea un número en formato moneda Venezolana (Bs. 1.234,56)
 */
export function formatBs(amount: number | undefined, decimals = 2): string {
  if (amount === undefined || isNaN(amount)) return 'Bs. 0,00';
  
  const formatted = amount.toLocaleString('es-VE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return `Bs. ${formatted}`;
}

/**
 * Formatea un número en formato USDT / USD ($ 778.01 USDT)
 */
export function formatUsdt(amount: number | undefined, decimals = 2): string {
  if (amount === undefined || isNaN(amount)) return '$ 0.00 USDT';

  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return `$ ${formatted} USDT`;
}

/**
 * Formatea cantidad de Tokens / Fracciones con precisión adecuada (ej. 0.005994)
 */
export function formatTokenQty(qty: number | undefined, maxDecimals = 6): string {
  if (qty === undefined || isNaN(qty)) return '0';
  if (qty === 0) return '0';
  
  // Si es un entero
  if (Number.isInteger(qty)) return qty.toString();

  // Para valores pequeños de tokens como 0.005994 o 0.037962
  return qty.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: maxDecimals,
  });
}

/**
 * Formatea moneda según el ticker (Bs. si es nacional, $ USDT si es internacional)
 */
export function formatCurrencyByTicker(amount: number | undefined, ticker: string, decimals = 2): string {
  if (isInternationalTicker(ticker)) {
    return formatUsdt(amount, decimals);
  }
  return formatBs(amount, decimals);
}

/**
 * Formatea porcentaje con signo + / -
 */
export function formatPercent(val: number): string {
  if (isNaN(val)) return '0.00%';
  const sign = val > 0 ? '+' : '';
  return `${sign}${val.toFixed(2)}%`;
}

/**
 * Formatea fecha ISO (YYYY-MM-DD) a formato latino (DD/MM/YYYY)
 */
export function formatDateLatina(isoDate: string): string {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoDate;
}

/**
 * Retorna la fecha de hoy en formato ISO (YYYY-MM-DD)
 */
export function getTodayISO(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Exporta el historial de precios a un archivo Excel (.xlsx) con la hoja PRECIOS_CIERRE
 */
export function exportToExcelSheet(registros: PrecioCierreRegistro[], filename = 'Precios_Cierre_Portafolios.xlsx') {
  // Extraer todos los tickers presentes dinámicamente
  const allTickers = Array.from(
    new Set(
      registros.flatMap((r) =>
        r.empresas ? Object.keys(r.empresas).filter((t) => t.toUpperCase() !== 'TICKER') : ['BNC', 'BPV', 'BVCC', 'RST-B']
      )
    )
  );

  // Construir filas para la hoja PRECIOS_CIERRE
  const dataForSheet = registros.map((reg) => {
    const row: Record<string, any> = {
      'Fecha (DD/MM/AAAA)': formatDateLatina(reg.fecha),
      'Fecha ISO': reg.fecha,
    };

    allTickers.forEach((ticker) => {
      const emp = reg.empresas?.[ticker] || (reg as any)[ticker.toLowerCase()] || { precio: 0 };
      const label = isInternationalTicker(ticker) ? `${ticker} - Precio (USDT)` : `${ticker} - Precio (Bs.)`;
      row[label] = emp.precio || 0;
      row[`${ticker} - Var %`] = emp.varDiaria !== undefined ? emp.varDiaria : '';
    });

    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
  const workbook = XLSX.utils.book_new();
  
  // Asignar el nombre exacto de la hoja: PRECIOS_CIERRE
  XLSX.utils.book_append_sheet(workbook, worksheet, 'PRECIOS_CIERRE');

  // Guardar archivo
  XLSX.writeFile(workbook, filename);
}

