import React, { useState } from 'react';
import { WhatsAppIcon } from './WhatsAppIcon';
import { HelpCircle, ChevronUp, ChevronDown } from 'lucide-react';

interface SupportCardProps {
  compact?: boolean;
}

export function SupportCard({ compact = false }: SupportCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const whatsappNumber = "3017085321";
  const message = "Hola, necesito ayuda con una estación/bicicleta de EnCicla.";
  const whatsappUrl = `https://wa.me/57${whatsappNumber}?text=${encodeURIComponent(message)}`;

  if (compact) {
    return (
      <a 
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center w-12 h-12 rounded-full bg-[#25D366] hover:bg-[#20ba5a] text-white shadow-xl transition-all duration-300 pointer-events-auto border-2 border-white dark:border-slate-800 scale-100 hover:scale-110 active:scale-95 group relative"
        title="Soporte EnCicla"
        aria-label="Abrir soporte de EnCicla por WhatsApp"
      >
        <WhatsAppIcon className="w-5 h-5 brightness-0 invert" />
        <span className="absolute right-14 bg-slate-900/90 text-white text-xs font-semibold px-2 py-1 rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-50">
          Soporte EnCicla
        </span>
      </a>
    );
  }

  return (
    <div className={`bg-card/95 backdrop-blur-md rounded-2xl shadow-xl border border-border transition-all duration-300 pointer-events-auto overflow-hidden ${isExpanded ? 'w-64 p-4' : 'w-48 p-3 cursor-pointer select-none hover:bg-card'}`}
      onClick={() => !isExpanded && setIsExpanded(true)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-100 dark:bg-blue-950/50 rounded-lg">
            <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <h4 className="text-sm font-bold text-foreground">Soporte EnCicla</h4>
        </div>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
        >
          {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500" /> : <ChevronUp className="w-4 h-4 text-slate-400 dark:text-slate-500" />}
        </button>
      </div>
      
      {isExpanded && (
        <div className="mt-3">
          <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">
            ¿Necesitas ayuda con una bicicleta o el estado de una estación?
          </p>

          <a 
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#25D366] hover:bg-[#20ba5a] text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow-md active:scale-95"
          >
            <WhatsAppIcon className="w-4 h-4 brightness-0 invert" />
            Escribir al 301 708 5321
          </a>
        </div>
      )}
    </div>
  );
}

