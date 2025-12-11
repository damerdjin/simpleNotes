const fs = require('fs-extra');
const path = require('path');
const { minify } = require('html-minifier-terser');
const JavaScriptObfuscator = require('javascript-obfuscator');

const root = __dirname;
const srcIndex = path.join(root, 'index.html');
const srcTranslations = path.join(root, 'translations.js');
const srcStyles = path.join(root, 'styles.css');
const distDir = path.join(root, 'dist');

async function obfuscateJS(code) {
  const result = JavaScriptObfuscator.obfuscate(code, {
    compact: true,
    controlFlowFlattening: false,
    deadCodeInjection: false,
    debugProtection: false,
    disableConsoleOutput: true,
    identifierNamesGenerator: 'hexadecimal',
    renameGlobals: false,
    selfDefending: true,
    simplify: true,
    splitStrings: false,
    stringArray: true,
    stringArrayEncoding: ['rc4'],
    stringArrayThreshold: 0.3
  });
  return result.getObfuscatedCode();
}

async function build() {
  await fs.emptyDir(distDir);

  // Read index.html
  let html = await fs.readFile(srcIndex, 'utf8');

  // Obfuscate inline <script> blocks
  html = await (async () => {
    const scriptRegex = /<script>([\s\S]*?)<\/script>/gi;
    let match;
    const parts = [];
    let lastIndex = 0;
    while ((match = scriptRegex.exec(html)) !== null) {
      const [full, js] = match;
      const start = match.index;
      const end = start + full.length;
      parts.push(html.slice(lastIndex, start));
      const obf = await obfuscateJS(js);
      parts.push(`<script>${obf}</script>`);
      lastIndex = end;
    }
    parts.push(html.slice(lastIndex));
    return parts.join('');
  })();

  // Minify HTML (including inline CSS/JS attributes)
  const minified = await minify(html, {
    collapseWhitespace: true,
    removeComments: true,
    removeRedundantAttributes: true,
    removeEmptyAttributes: true,
    minifyCSS: true,
    minifyJS: true,
    keepClosingSlash: true
  });

  await fs.writeFile(path.join(distDir, 'index.html'), minified, 'utf8');

  // Obfuscate translations.js as external script if present
  if (await fs.pathExists(srcTranslations)) {
    const tr = await fs.readFile(srcTranslations, 'utf8');
    const obfTr = await obfuscateJS(tr);
    await fs.writeFile(path.join(distDir, 'translations.js'), obfTr, 'utf8');
  }

  // Copy styles.css (optionally could minify here)
  if (await fs.pathExists(srcStyles)) {
    const css = await fs.readFile(srcStyles, 'utf8');
    // simple minify: remove comments and whitespace
    const cssMin = css.replace(/\/\*[^*]*\*+([^/*][^*]*\*+)*\//g, '').replace(/\s+/g, ' ').trim();
    await fs.writeFile(path.join(distDir, 'styles.css'), cssMin, 'utf8');
  }

  console.log('Build complete. Output in ./dist');
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
