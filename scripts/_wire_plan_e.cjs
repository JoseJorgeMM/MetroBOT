const fs = require('fs');
const CRLF = String.fromCharCode(13, 10);
let orig = fs.readFileSync('src/App.tsx', 'utf8');
orig = orig.split(CRLF).join('\n');

const importOld = "import { InstallBanner } from './components/InstallBanner';" + "\n" + "import { UpdateToast } from './components/UpdateToast';" + "\n" + "import { HonestyBadge } from './components/HonestyBadge';" + "\n" + "import { computeHonestyAssessment } from './lib/honesty';";
const importNew = "import { InstallBanner } from './components/InstallBanner';" + "\n" + "import { UpdateToast } from './components/UpdateToast';" + "\n" + "import { HonestyBadge } from './components/HonestyBadge';" + "\n" + "import { computeHonestyAssessment } from './lib/honesty';" + "\n" + "import { useSheetDrag } from './hooks/useSheetDrag';" + "\n" + "import { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion';" + "\n" + "import { SkipLink } from './components/SkipLink';";
if (orig.indexOf(importOld) === -1) throw new Error('imports');
orig = orig.replace(importOld, importNew);

const stateOld = "const [query, setQuery] = useState('');";
const stateNew =
  "const [query, setQuery] = useState('');" + "\n" +
  "  const sheetHandleRef = useRef<HTMLButtonElement>(null);" + "\n" +
  "  const sheet = useSheetDrag(sheetHandleRef, [72, 320, 720], 1);" + "\n" +
  "  const reducedMotion = usePrefersReducedMotion();" + "\n" +
  "  const sheetHeightClass = sheet.currentSnap === 0 ? 'h-[72px]' : sheet.currentSnap === 1 ? 'h-[min(58dvh,560px)]' : 'h-[92dvh]';";
if (orig.indexOf(stateOld) === -1) throw new Error('state');
orig = orig.replace(stateOld, stateNew);

const rootOld = "    <div className=\"relative w-full h-[100dvh] overflow-hidden bg-background text-foreground flex flex-col lg:flex-row " + "\nfont-sans transition-colors duration-300\">";
const rootNew = "    <SkipLink />" + "\n" + "    <div className=\"relative w-full h-[100dvh] overflow-hidden bg-background text-foreground flex flex-col lg:flex-row " + "\nfont-sans transition-colors duration-300\">";
if (orig.indexOf(rootOld) === -1) throw new Error('root');
orig = orig.replace(rootOld, rootNew);

const mapOld = "<div className=\"absolute inset-0 z-0 lg:relative lg:flex-1 h-full\">";
const mapNew = "<div id=\"map-region\" className=\"absolute inset-0 z-0 lg:relative lg:flex-1 h-full\">";
if (orig.indexOf(mapOld) === -1) throw new Error('map');
orig = orig.replace(mapOld, mapNew);

const handleOld = "<div className=\"w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mb-1.5\" />";
const handleNew = "<button" + "\n" + "          ref={sheetHandleRef}" + "\n" + "          type=\"button\"" + "\n" + "          aria-label=\"Arrastrar para ajustar el panel\"" + "\n" + "          aria-controls=\"chat-sheet\"" + "\n" + "          aria-expanded={sheet.currentSnap > 0}" + "\n" + "          onPointerDown={sheet.onPointerDown}" + "\n" + "          onPointerMove={sheet.onPointerMove}" + "\n" + "          onPointerUp={sheet.onPointerUp}" + "\n" + "          onPointerCancel={sheet.onPointerCancel}" + "\n" + "          className=\"cursor-grab active:cursor-grabbing w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mb-1.5 touch-none focus:outline-none focus:ring-2 focus:ring-sitva-green/50\"" + "\n" + "        />";
if (orig.indexOf(handleOld) === -1) throw new Error('handle');
orig = orig.replace(handleOld, handleNew);

orig = orig.split('\n').join(CRLF);
fs.writeFileSync('src/App.tsx', orig, 'utf8');
console.log('patched', orig.length);
