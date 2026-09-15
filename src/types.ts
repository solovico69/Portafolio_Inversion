export interface EmpresaDatos {
  precio: number; // Precio de cierre (Bs. para nacionales, USDT para internacionales)
  varDiaria?: number; // Variación diaria en %
  volumen?: number;
  observacion?: string;
}

export interface PrecioCierreRegistro {
  id: string;
  fecha: string; // ISO String (YYYY-MM-DD)
  // Mapeo dinámico de acciones y tokens: { BNC: { precio: 476.50 }, 'SPYB/USDT': { precio: 778.01 }, ... }
  empresas: Record<string, EmpresaDatos>;
  // Propiedades directas para retrocompatibilidad
  bnc: EmpresaDatos;
  bpv: EmpresaDatos;
  bvcc: EmpresaDatos;
  notasGenerales?: string;
}

export interface PortfolioPosicion {
  id: string;
  codigo: string; // Ticker de la acción (ej. BNC, BPV, BVCC, RST-B)
  nombre: string;
  cantidad: number;
  precioCompra: number; // Precio promedio de compra (Bs.)
  precioPromedio?: number; // Precio promedio ponderado
  comisiones?: number;
  iva?: number;
  derRegistro?: number;
  inversionTotal: number;
  precioActual?: number;
  valorActual?: number;
  rendimientoNeto?: number;
  precioObjetivo?: number;
  gananciaPerdida?: number;
  estatusMeta?: string;
}

export interface PosicionInternacional {
  id: string;
  activo: string; // ej. SPYB/USDT, NVDAB/USDT
  nombre?: string;
  fechaInicio: string; // DD/MM/AAAA
  fechaFin: string; // DD/MM/AAAA
  inversionUsdt: number; // Inversión inicial total USDT
  valorToken: number; // Cantidad / Valor de Tokens comprados (ej. 0.005994)
  precioInicialCompra: number; // Precio inicial unitario de compra en USDT (ej. 771.61)
  precioActualUsdt?: number; // Precio actual en USDT (calculado dinámicamente o ingresado)
  notas?: string;
  estatusMeta?: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
}

