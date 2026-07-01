const fs = require('fs');
let s = fs.readFileSync('src/index.css', 'utf8');
const append = String.fromCharCode(10) + String.fromCharCode(10) +
"/* Plan E: respect prefers-reduced-motion and high contrast */" + String.fromCharCode(10) +
"@media (prefers-reduced-motion: reduce) {" + String.fromCharCode(10) +
"  *, *::before, *::after {" + String.fromCharCode(10) +
"    animation-duration: 0.001ms !important;" + String.fromCharCode(10) +
"    animation-iteration-count: 1 !important;" + String.fromCharCode(10) +
"    transition-duration: 0.001ms !important;" + String.fromCharCode(10) +
"    scroll-behavior: auto !important;" + String.fromCharCode(10) +
"  }" + String.fromCharCode(10) +
"}" + String.fromCharCode(10) +
"@media (prefers-contrast: more) {" + String.fromCharCode(10) +
"  .border-border\\/30 { border-width: 2px !important; }" + String.fromCharCode(10) +
"  button:focus-visible { outline: 3px solid currentColor !important; outline-offset: 2px !important; }" + String.fromCharCode(10) +
"}" + String.fromCharCode(10);
if (!s.includes('prefers-reduced-motion: reduce')) {
  fs.appendFileSync('src/index.css', append);
  console.log('appended');
} else {
  console.log('already present');
}
