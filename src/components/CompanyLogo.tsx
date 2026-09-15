import React from 'react';
import { Building2, Landmark, TrendingUp, ShieldCheck, Award, DollarSign } from 'lucide-react';
import { normalizeTicker } from '../utils/formatters';

interface CompanyLogoProps {
  ticker: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showName?: boolean;
}

export const CompanyLogo: React.FC<CompanyLogoProps> = ({
  ticker,
  size = 'md',
  className = '',
  showName = false,
}) => {
  const cleanTicker = normalizeTicker(ticker);

  // Dimensión de contenedor
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
  }[size];

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4.5 h-4.5',
    lg: 'w-5.5 h-5.5',
  }[size];

  // Configuración de identidades de marca para cada empresa
  const companyBrands: Record<
    string,
    {
      name: string;
      fullName: string;
      bgGradient: string;
      borderColor: string;
      textColor: string;
      renderIcon: (iconClass: string) => React.ReactNode;
    }
  > = {
    BNC: {
      name: 'BNC',
      fullName: 'Banco Nacional de Crédito',
      bgGradient: 'from-blue-900 via-indigo-900 to-slate-900',
      borderColor: 'border-amber-500/40',
      textColor: 'text-amber-400',
      renderIcon: (ic) => (
        <svg className={`${ic} text-amber-400`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 21h18M3 10h18M5 10v11M9 10v11M13 10v11M17 10v11M12 3L2 10h20L12 3z" fill="currentColor" fillOpacity="0.15" />
        </svg>
      ),
    },
    BPV: {
      name: 'BPV',
      fullName: 'BBVA Banco Provincial',
      bgGradient: 'from-blue-800 via-sky-900 to-slate-900',
      borderColor: 'border-sky-400/40',
      textColor: 'text-sky-300',
      renderIcon: (ic) => (
        <svg className={`${ic} text-sky-300`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M12 2L2 12l10 10 10-10L12 2z" fill="currentColor" fillOpacity="0.2" />
          <path d="M12 6l-6 6 6 6 6-6-6-6z" />
        </svg>
      ),
    },
    BVCC: {
      name: 'BVCC',
      fullName: 'Bolsa de Valores de Caracas',
      bgGradient: 'from-emerald-950 via-teal-900 to-slate-900',
      borderColor: 'border-emerald-500/40',
      textColor: 'text-emerald-400',
      renderIcon: (ic) => (
        <svg className={`${ic} text-emerald-400`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3v18h18" />
          <path d="M18 9l-5 5-4-4-5 5" />
          <polyline points="14 9 18 9 18 13" />
        </svg>
      ),
    },
    'RST-B': {
      name: 'RST-B',
      fullName: 'Ron Santa Teresa (Clase B)',
      bgGradient: 'from-amber-950 via-amber-900 to-stone-900',
      borderColor: 'border-amber-500/50',
      textColor: 'text-amber-300',
      renderIcon: (ic) => (
        <svg className={`${ic} text-amber-300`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 15a7 7 0 0014 0V5H5v10z" fill="currentColor" fillOpacity="0.2" />
          <path d="M4 5h16M12 2v3M9 10h6" />
        </svg>
      ),
    },
    'SPYB': {
      name: 'SPYB/USDT',
      fullName: 'SPDR S&P 500 ETF (Binance Token)',
      bgGradient: 'from-blue-950 via-slate-900 to-indigo-900',
      borderColor: 'border-blue-500/50',
      textColor: 'text-blue-400',
      renderIcon: (ic) => (
        <svg className={`${ic} text-blue-400`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.15" />
          <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity="0.3" />
        </svg>
      ),
    },
    'SPYB/USDT': {
      name: 'SPYB/USDT',
      fullName: 'SPDR S&P 500 ETF (Binance Token)',
      bgGradient: 'from-blue-950 via-slate-900 to-indigo-900',
      borderColor: 'border-blue-500/50',
      textColor: 'text-blue-400',
      renderIcon: (ic) => (
        <svg className={`${ic} text-blue-400`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.15" />
          <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity="0.3" />
        </svg>
      ),
    },
    'NVDAB': {
      name: 'NVDAB/USDT',
      fullName: 'NVIDIA Corp (Binance Token)',
      bgGradient: 'from-emerald-950 via-slate-900 to-teal-950',
      borderColor: 'border-emerald-500/50',
      textColor: 'text-emerald-400',
      renderIcon: (ic) => (
        <svg className={`${ic} text-emerald-400`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="4" width="16" height="16" rx="3" fill="currentColor" fillOpacity="0.2" />
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
          <path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" strokeLinecap="round" />
        </svg>
      ),
    },
    'NVDAB/USDT': {
      name: 'NVDAB/USDT',
      fullName: 'NVIDIA Corp (Binance Token)',
      bgGradient: 'from-emerald-950 via-slate-900 to-teal-950',
      borderColor: 'border-emerald-500/50',
      textColor: 'text-emerald-400',
      renderIcon: (ic) => (
        <svg className={`${ic} text-emerald-400`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="4" width="16" height="16" rx="3" fill="currentColor" fillOpacity="0.2" />
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
          <path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" strokeLinecap="round" />
        </svg>
      ),
    },
  };

  const brand = companyBrands[cleanTicker] || {
    name: cleanTicker,
    fullName: cleanTicker,
    bgGradient: 'from-slate-800 to-slate-900',
    borderColor: 'border-slate-700',
    textColor: 'text-slate-200',
    renderIcon: (ic) => <TrendingUp className={`${ic} text-blue-400`} />,
  };

  return (
    <div className="inline-flex items-center gap-2">
      <div
        className={`${sizeClasses} rounded-xl bg-gradient-to-br ${brand.bgGradient} border ${brand.borderColor} flex items-center justify-center shadow-md shadow-black/40 shrink-0 ${className}`}
        title={`${brand.name} - ${brand.fullName}`}
      >
        {brand.renderIcon(iconSizes)}
      </div>

      {showName && (
        <div className="flex flex-col">
          <span className="font-bold text-slate-100 text-xs tracking-wide">{brand.name}</span>
          <span className="text-[10px] text-slate-400 truncate max-w-[140px]">{brand.fullName}</span>
        </div>
      )}
    </div>
  );
};
