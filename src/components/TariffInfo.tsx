import React from 'react';
import { CreditCard, User, GraduationCap, Accessibility, Users } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';

export function TariffInfo() {
  const tariffs = [
    { category: 'Frecuente', price: '$3.820', icon: <User className="w-3.5 h-3.5" />, color: 'bg-blue-100 text-blue-700' },
    { category: 'Adulto Mayor', price: '$3.330', icon: <Users className="w-3.5 h-3.5" />, color: 'bg-green-100 text-green-700' },
    { category: 'Estudiantil', price: '$1.600', icon: <GraduationCap className="w-3.5 h-3.5" />, color: 'bg-purple-100 text-purple-700' },
    { category: 'PcD (Discapacidad)', price: '$2.720', icon: <Accessibility className="w-3.5 h-3.5" />, color: 'bg-orange-100 text-orange-700' },
    { category: 'Al Portador', price: '$4.400', icon: <CreditCard className="w-3.5 h-3.5" />, color: 'bg-slate-100 text-slate-700' },
  ];

  return (
    <Card className="border-border/30 bg-card shadow-lg overflow-hidden mt-4">
      <CardHeader className="bg-slate-100/50 dark:bg-slate-800/50 pb-3 border-b border-border/10">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-slate-500" />
          Tarifas SITVA 2026
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-1 gap-3">
          {tariffs.map((t, idx) => (
            <div key={idx} className="flex items-center justify-between p-2 rounded-xl border border-border/5 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${t.color}`}>
                  {t.icon}
                </div>
                <span className="text-[13px] font-medium text-foreground">{t.category}</span>
              </div>
              <span className="text-[14px] font-bold text-foreground">{t.price}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[12px] text-slate-600 dark:text-slate-300 leading-snug italic border-t border-border/10 pt-3">
          * Los transbordos entre Metro, Tranvía, Metroplús y Cables (excepto Arví) son gratuitos si se realizan en un tiempo menor a 90 minutos.
        </p>
      </CardContent>
    </Card>
  );
}
