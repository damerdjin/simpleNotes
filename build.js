import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { minify } from 'html-minifier-terser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const root = __dirname;

const srcIndex = path.join(root, 'index.html');
const srcTranslations = path.join(root, 'translations.js');
const srcStyles = path.join(root, 'styles.css');
const distDir = path.join(root, 'dist');

async function build() {
  await fs.emptyDir(distDir);

  // Read index.html
  let html = await fs.readFile(srcIndex, 'utf8');

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

  // Copy translations.js as external script if present
  if (await fs.pathExists(srcTranslations)) {
    await fs.copy(srcTranslations, path.join(distDir, 'translations.js'));
  }

  // Copy styles.css (optionally could minify here)
  if (await fs.pathExists(srcStyles)) {
    const css = await fs.readFile(srcStyles, 'utf8');
    // simple minify: remove comments and whitespace
    const cssMin = css.replace(/\/\*[^*]*\*+([^/*][^*]*\*+)*\//g, '').replace(/\s+/g, ' ').trim();
    await fs.writeFile(path.join(distDir, 'styles.css'), cssMin, 'utf8');
  }

  // Copy favicon.ico if present
  const srcFavicon = path.join(root, 'favicon.ico');
  if (await fs.pathExists(srcFavicon)) {
    await fs.copy(srcFavicon, path.join(distDir, 'favicon.ico'));
  }

  // Copy remarks.engine.js if present
  const srcRemarksEngine = path.join(root, 'remarks.engine.js');
  if (await fs.pathExists(srcRemarksEngine)) {
    await fs.copy(srcRemarksEngine, path.join(distDir, 'remarks.engine.js'));
  }

  // Copy remarks.messages.js if present
  const srcRemarksMessages = path.join(root, 'remarks.messages.js');
  if (await fs.pathExists(srcRemarksMessages)) {
    await fs.copy(srcRemarksMessages, path.join(distDir, 'remarks.messages.js'));
  }

  // Copy src directory (recursively) to ensure modules are available
  const srcDir = path.join(root, 'src');
  if (await fs.pathExists(srcDir)) {
    await fs.copy(srcDir, path.join(distDir, 'src'));
  }

  // Copy login.html
  const srcLogin = path.join(root, 'login.html');
  if (await fs.pathExists(srcLogin)) {
    const html = await fs.readFile(srcLogin, 'utf8');
    const minified = await minify(html, {
        collapseWhitespace: true,
        removeComments: true,
        minifyCSS: true,
        minifyJS: true
    });
    await fs.writeFile(path.join(distDir, 'login.html'), minified, 'utf8');
  }

  // Copy register.html
  const srcRegister = path.join(root, 'register.html');
  if (await fs.pathExists(srcRegister)) {
     const html = await fs.readFile(srcRegister, 'utf8');
     const minified = await minify(html, {
         collapseWhitespace: true,
         removeComments: true,
         minifyCSS: true,
         minifyJS: true
     });
    await fs.writeFile(path.join(distDir, 'register.html'), minified, 'utf8');
  }

  // Copy student-dashboard.html
  const srcStudentDashboard = path.join(root, 'student-dashboard.html');
  if (await fs.pathExists(srcStudentDashboard)) {
     const html = await fs.readFile(srcStudentDashboard, 'utf8');
     const minified = await minify(html, {
         collapseWhitespace: true,
         removeComments: true,
         minifyCSS: true,
         minifyJS: true
     });
    await fs.writeFile(path.join(distDir, 'student-dashboard.html'), minified, 'utf8');
  }

  console.log('Build complete. Output in ./dist');
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
