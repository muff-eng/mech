// Bundles src/ into the single self contained mech-forge.html
// Usage: node build.js
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const read = (p) => fs.readFileSync(path.join(dir, p), 'utf8');
const js = fs.readdirSync(path.join(dir, 'src/js')).filter((f) => f.endsWith('.js')).sort().map((f) => read('src/js/' + f)).join('\n');
let html = read('src/shell.html');
// function replacers so "$" sequences in the sources are kept literally
html = html.replace('/*STYLE*/', () => read('src/style.css'));
html = html.replace('/*THREE*/', () => read('vendor/three.min.js'));
html = html.replace('/*GAME*/', () => js);
fs.writeFileSync(path.join(dir, 'mech-forge.html'), html);
console.log('mech-forge.html', (html.length / 1024).toFixed(0) + ' KB');
