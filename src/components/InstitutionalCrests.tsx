import React from 'react';

interface InstitutionalCrestsProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showTooltips?: boolean;
}

export const InstitutionalCrests: React.FC<InstitutionalCrestsProps> = ({
  className = '',
  size = 'md',
  showTooltips = true,
}) => {
  const sizeClasses = {
    xs: 'w-8 h-8',
    sm: 'w-10 h-10',
    md: 'w-14 h-14 sm:w-16 sm:h-16',
    lg: 'w-20 h-20 sm:w-24 sm:h-24',
  }[size];

  return (
    <div className={`inline-flex items-center gap-3 sm:gap-4 select-none ${className}`}>
      {/* 1. TRINITY UNIVERSITY OF ASIA (TUA) SEAL */}
      <div className="relative group cursor-pointer" title="Trinity University of Asia">
        <div
          className={`${sizeClasses} relative flex items-center justify-center transition-all duration-300 group-hover:scale-105 drop-shadow-[0_6px_16px_rgba(4,120,87,0.35)]`}
        >
          <img
            src="/assets/trinity.webp"
            alt="Trinity University of Asia"
            className="w-full h-full object-contain filter drop-shadow-md select-none pointer-events-none"
            loading="eager"
          />
        </div>

        {/* Tooltip Label */}
        {showTooltips && (
          <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-30">
            <span className="text-[10px] font-semibold tracking-wider text-emerald-300 bg-slate-950/90 border border-emerald-500/30 px-2 py-0.5 rounded-full shadow-md">
              Trinity University of Asia
            </span>
          </div>
        )}
      </div>

      {/* 2. ST. LUKE'S COLLEGE OF NURSING (SLCN) MALTESE SEAL */}
      <div className="relative group cursor-pointer" title="St. Luke's College of Nursing">
        <div
          className={`${sizeClasses} relative flex items-center justify-center transition-all duration-300 group-hover:scale-105 drop-shadow-[0_6px_16px_rgba(217,119,6,0.35)]`}
        >
          <img
            src="/assets/college-of-nursing.webp"
            alt="St. Luke's College of Nursing"
            className="w-full h-full object-contain filter drop-shadow-md select-none pointer-events-none"
            loading="eager"
          />
        </div>

        {/* Tooltip Label */}
        {showTooltips && (
          <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-30">
            <span className="text-[10px] font-semibold tracking-wider text-amber-300 bg-slate-950/90 border border-amber-500/30 px-2 py-0.5 rounded-full shadow-md">
              St. Luke's College of Nursing
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
