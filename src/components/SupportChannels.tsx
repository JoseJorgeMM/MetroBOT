import React from 'react';
import { Phone, Mail, MessageCircle, MapPin, ExternalLink, Clock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';

export function SupportChannels() {
  return (
    <Card className="border-border/30 bg-card shadow-lg overflow-hidden">
      <CardHeader className="bg-sitva-green/10 pb-3 border-b border-sitva-green/10">
        <CardTitle className="text-sm font-bold flex items-center gap-2 text-sitva-green">
          <MessageCircle className="w-4 h-4" />
          Canales de Atención SITVA
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* Physical Attention PAC */}
        <div className="space-y-2">
          <h4 className="text-[12px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            Puntos de Atención (PAC)
          </h4>
          <p className="text-[13px] text-foreground leading-relaxed">
            Tramita tu Cívica en: <span className="font-semibold">Niquía, Acevedo, San Javier, San Antonio e Itagüí.</span>
          </p>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 font-medium">
            <Clock className="w-3 h-3" />
            Lun - Vie: 9:30 AM - 6:30 PM
          </div>
        </div>

        {/* Digital Channels */}
        <div className="space-y-2 pt-2 border-t border-border/10">
          <h4 className="text-[12px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <ExternalLink className="w-3.5 h-3.5" />
            Canales Digitales
          </h4>
          <div className="grid grid-cols-1 gap-2">
            <a 
              href="tel:+576044449598" 
              className="flex items-center gap-2 text-[13px] text-foreground hover:text-sitva-green transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Phone className="w-3.5 h-3.5" />
              </div>
              Línea Hola Metro: (604) 444 95 98
            </a>
            <a 
              href="mailto:contactenos@metrodemedellin.gov.co" 
              className="flex items-center gap-2 text-[13px] text-foreground hover:text-sitva-green transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Mail className="w-3.5 h-3.5" />
              </div>
              contactenos@metrodemedellin.gov.co
            </a>
            <a 
              href="https://www.metrodemedellin.gov.co" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[13px] text-foreground hover:text-sitva-green transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <ExternalLink className="w-3.5 h-3.5" />
              </div>
              Chat con Asesor (Sitio Web)
            </a>
          </div>
        </div>

        {/* Cívica App */}
        <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-border/20">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center italic">
            "Recuerda que puedes usar el código QR de la App Cívica para viajar sin tarjeta física."
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
