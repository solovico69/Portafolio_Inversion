/**
 * PROYECTO: Control de Precios de Cierre y Portafolio de Inversión
 * DESARROLLO & ARQUITECTURA: Victor Solorzano
 * ASISTENCIA TÉCNICA: Google AI Studio & Antigravity IDE
 * ROL: Script de Google Apps Script (Web App Backend para Google Sheets)
 */

function normalizeTicker(ticker) {
  if (!ticker) return '';
  return String(ticker)
    .toUpperCase()
    .trim()
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ');
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (data.action === 'appendPrecio') {
      const sheet = ss.getSheetByName('PRECIOS_CIERRE');
      if (!sheet) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Pestaña PRECIOS_CIERRE no encontrada' }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const newRow = new Array(headers.length).fill('');
      
      const registro = data.registro;
      newRow[0] = registro.fecha; // DD/MM/AAAA o ISO

      headers.forEach(function(h, idx) {
        if (idx === 0) return;
        const cleanHeader = normalizeTicker(h);
        for (var rawTicker in registro.empresas) {
          const ticker = normalizeTicker(rawTicker);
          if (!ticker) continue;
          
          const isMatch = cleanHeader.indexOf(ticker) !== -1 ||
            (ticker.indexOf('SPY') !== -1 && cleanHeader.indexOf('SPY') !== -1) ||
            (ticker.indexOf('NVDA') !== -1 && cleanHeader.indexOf('NVDA') !== -1);

          if (isMatch) {
            if (cleanHeader.indexOf('VAR') !== -1 || cleanHeader.indexOf('%') !== -1) {
              if (registro.empresas[rawTicker].varDiaria !== undefined) {
                newRow[idx] = registro.empresas[rawTicker].varDiaria;
              }
            } else {
              if (registro.empresas[rawTicker].precio !== undefined) {
                newRow[idx] = registro.empresas[rawTicker].precio;
              }
            }
          }
        }
      });

      sheet.appendRow(newRow);
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: 'Precio registrado en PRECIOS_CIERRE' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === 'updateResumen') {
      const sheet = ss.getSheetByName('RESUMEN ACTUAL');
      if (!sheet) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Pestaña RESUMEN ACTUAL no encontrada' }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      const nacional = data.nacional || [];
      const internacional = data.internacional || [];

      const lastRow = sheet.getLastRow();
      if (lastRow > 0) {
        const range = sheet.getRange(1, 1, lastRow, sheet.getLastColumn());
        const values = range.getValues();

        let modo = 'none';
        for (var i = 0; i < values.length; i++) {
          var firstCell = String(values[i][0] || '').trim().toLowerCase();
          if (firstCell.indexOf('global de acciones') !== -1) {
            modo = 'nacional';
            continue;
          }
          if (firstCell.indexOf('empresa / cripto') !== -1 || firstCell.indexOf('compra de acciones tokenizadas') !== -1 || firstCell.indexOf('tockenizadas') !== -1) {
            modo = 'internacional';
            continue;
          }

          if (modo === 'nacional' && firstCell && firstCell !== 'accion' && firstCell.indexOf('totales') === -1) {
            for (var n = 0; n < nacional.length; n++) {
              if (normalizeTicker(nacional[n].codigo) === normalizeTicker(firstCell)) {
                sheet.getRange(i + 1, 2).setValue(nacional[n].cantidad); // Col B: Cantidad
                if (nacional[n].precioPromedio) {
                  sheet.getRange(i + 1, 3).setValue(nacional[n].precioPromedio); // Col C: Precio Promedio
                }
                break;
              }
            }
          } else if (modo === 'internacional' && firstCell && firstCell.indexOf('totales') === -1 && firstCell.indexOf('empresa') === -1) {
            for (var k = 0; k < internacional.length; k++) {
              var targetActivo = normalizeTicker(internacional[k].activo);
              var cellActivo = normalizeTicker(firstCell);
              if (targetActivo === cellActivo || (targetActivo.indexOf('SPY') !== -1 && cellActivo.indexOf('SPY') !== -1) || (targetActivo.indexOf('NVDA') !== -1 && cellActivo.indexOf('NVDA') !== -1)) {
                sheet.getRange(i + 1, 4).setValue(internacional[k].inversionUsdt); // Col D: Inversión USDT
                sheet.getRange(i + 1, 5).setValue(internacional[k].valorToken); // Col E: Tokens
                sheet.getRange(i + 1, 6).setValue(internacional[k].precioInicialCompra); // Col F: Precio Inicial
                break;
              }
            }
          }
        }
      }

      return ContentService.createTextOutput(JSON.stringify({ success: true, message: 'RESUMEN ACTUAL actualizado preservando fórmulas' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Acción desconocida' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("Web App activa para Control de Precios de Cierre & Portafolios.");
}
