const fs = require('fs');
const CRLF = String.fromCharCode(13, 10);
let orig = fs.readFileSync('src/App.tsx', 'utf8');
orig = orig.split(CRLF).join('\n');

// 1. Imports: add HonestyBadge + computeHonestyAssessment.
const importOld = "import { InstallBanner } from './components/InstallBanner';" + "\n" + "import { UpdateToast } from './components/UpdateToast';";
const importNew = "import { InstallBanner } from './components/InstallBanner';" + "\n" + "import { UpdateToast } from './components/UpdateToast';" + "\n" + "import { HonestyBadge } from './components/HonestyBadge';" + "\n" + "import { computeHonestyAssessment } from './lib/honesty';";
if (orig.indexOf(importOld) === -1) throw new Error('imports');
orig = orig.replace(importOld, importNew);

// 2. In the onRouteFound callback, compute the assessment and store it in state. Also gate routes
//    when level === no_verificada.
const blockOld = "      (newRoutes) => {" + "\n" + "        setRoutes(newRoutes);";
const blockNew =
  "      (newRoutes) => {" + "\n" +
  "        const assessment = computeHonestyAssessment(newRoutes as any);" + "\n" +
  "        setHonestyAssessment(assessment);" + "\n" +
  "        if (assessment.level === 'no_verificada') {" + "\n" +
  "          setPendingRoutes(newRoutes);" + "\n" +
  "          setRoutes([]);" + "\n" +
  "          const msg = 'No pude verificar ' + assessment.totalDegraded + ' parada(s) de bus en este recorrido. ' + 'Te recomiendo caminar o usar la opcion \"Ver de todos modos\" para revisar la ruta igual.';" + "\n" +
  "          setMessages(prev => [...prev, { role: 'assistant', content: msg }]);" + "\n" +
  "          return;" + "\n" +
  "        }" + "\n" +
  "        setRoutes(newRoutes);";
if (orig.indexOf(blockOld) === -1) throw new Error('onRouteFound block');
orig = orig.replace(blockOld, blockNew);

// 3. Add state hooks near the other useState calls. Anchor on the first `const [query, setQuery] = useState('');`.
const stateOld = "const [query, setQuery] = useState('');";
const stateNew =
  "const [query, setQuery] = useState('');" + "\n" + "  const [honestyAssessment, setHonestyAssessment] = useState<ReturnType<typeof computeHonestyAssessment> | null>(null);" + "\n" + "  const [pendingRoutes, setPendingRoutes] = useState<RouteOption[]>([]);";
if (orig.indexOf(stateOld) === -1) throw new Error('state');
orig = orig.replace(stateOld, stateNew);

// 4. Add a bypass button to the chat UI next to the disclaimer. Anchor on the assistant message after
//    the assistant reply is appended (we add a button in the rendered <AnimatePresence> for the
//    honesty block). Simpler: add a "Ver de todos modos" button next to the Rutas Sugeridas heading
//    if pendingRoutes.length > 0.
const headingOld = "<h3 className=\"text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1\">Rutas Sugeridas</h3>";
const headingNew =
  "<div className=\"flex items-center gap-2 flex-wrap px-1\">" + "\n" +
  "            <h3 className=\"text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider\">Rutas Sugeridas</h3>" + "\n" +
  "            {honestyAssessment && <HonestyBadge level={honestyAssessment.level} worstRatio={honestyAssessment.worstRatio} label={honestyAssessment.label} />}" + "\n" +
  "            {pendingRoutes.length > 0 && (" + "\n" +
  "              <button" + "\n" +
  "                type=\"button\"" + "\n" +
  "                onClick={() => { setRoutes(pendingRoutes); setPendingRoutes([]); }}" + "\n" +
  "                className=\"text-[11px] font-semibold rounded-full bg-rose-100 text-rose-800 hover:bg-rose-200 dark:bg-rose-900/40 dark:text-rose-200 px-2.5 py-1 cursor-pointer\"" + "\n" +
  "                aria-label=\"Ver rutas aunque no se pudieron verificar\"" + "\n" +
  "              >" + "\n" +
  "                Ver de todos modos" + "\n" +
  "              </button>" + "\n" +
  "            )}" + "\n" +
  "          </div>";
if (orig.indexOf(headingOld) === -1) throw new Error('heading');
orig = orig.replace(headingOld, headingNew);

orig = orig.split('\n').join(CRLF);
fs.writeFileSync('src/App.tsx', orig, 'utf8');
console.log('patched', orig.length);
