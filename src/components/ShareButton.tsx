import React, { useState } from 'react';
import { Share2, Check, X } from 'lucide-react';
import { Button } from './ui/button';
import { buildShareText, tryShare } from '../lib/share';
import type { RouteOption } from '../lib/routing';

interface ShareButtonProps {
  route: RouteOption;
  originName?: string | null;
  destName?: string | null;
  className?: string;
}

type Status = 'idle' | 'shared' | 'copied' | 'failed';

export function ShareButton({ route, originName, destName, className }: ShareButtonProps) {
  const [status, setStatus] = useState<Status>('idle');

  const handleClick = async () => {
    const text = buildShareText(route, originName, destName);
    const result = await tryShare(text, 'Ruta MetroBOT');
    setStatus(result);
    window.setTimeout(() => setStatus('idle'), 2400);
  };

  if (status === 'shared') {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Compartido"
        className={'rounded-full min-h-[40px] min-w-[40px] w-10 h-10 text-emerald-600 dark:text-emerald-400 bg-emerald-100/60 dark:bg-emerald-900/30 ' + (className || '')}
      >
        <Check className="w-5 h-5" />
      </Button>
    );
  }
  if (status === 'copied') {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Copiado al portapapeles"
        className={'rounded-full min-h-[40px] min-w-[40px] w-10 h-10 text-sitva-blue bg-sitva-blue/10 ' + (className || '')}
      >
        <Check className="w-5 h-5" />
      </Button>
    );
  }
  if (status === 'failed') {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="No se pudo compartir"
        className={'rounded-full min-h-[40px] min-w-[40px] w-10 h-10 text-rose-600 bg-rose-100/60 dark:bg-rose-900/30 ' + (className || '')}
      >
        <X className="w-5 h-5" />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Compartir ruta"
      title="Compartir ruta"
      onClick={handleClick}
      className={'rounded-full min-h-[40px] min-w-[40px] w-10 h-10 text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer ' + (className || '')}
    >
      <Share2 className="w-5 h-5" />
    </Button>
  );
}
