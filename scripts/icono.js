// Genera los iconos de la app (pintadera, gama «Bandera») en assets/.
// Uso: node scripts/icono.js
// Dibuja con pngjs (ya viene con Expo) y suavizado 4×4; no necesita nada más.
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const C = { bg: '#0B1B2B', frame: '#3F8FD2', a: '#FFCC00', b: '#F4F6F8' };

// Diseño en una rejilla de 512: marco redondeado y cuatro cuadros partidos en dos triángulos.
const T = (pts, color) => ({ pts, color });
const TRIANGLES = [
  T([[126, 126], [250, 126], [126, 250]], 'a'),
  T([[250, 126], [250, 250], [126, 250]], 'b'),
  T([[262, 126], [386, 126], [386, 250]], 'b'),
  T([[262, 126], [386, 250], [262, 250]], 'a'),
  T([[126, 262], [250, 262], [126, 386]], 'b'),
  T([[250, 262], [250, 386], [126, 386]], 'a'),
  T([[262, 262], [386, 262], [386, 386]], 'a'),
  T([[262, 262], [386, 386], [262, 386]], 'b'),
];

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

function inTriangle([x, y], [a, b, c]) {
  const s = (p, q) => (x - q[0]) * (p[1] - q[1]) - (p[0] - q[0]) * (y - q[1]);
  const d1 = s(a, b);
  const d2 = s(b, c);
  const d3 = s(c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

/** Distancia con signo a un rectángulo redondeado centrado en (256, 256). */
function roundRect(x, y, half, r) {
  const qx = Math.abs(x - 256) - (half - r);
  const qy = Math.abs(y - 256) - (half - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

/** Color del diseño en un punto de la rejilla de 512, o null si ahí no hay dibujo. */
function motif(x, y, mono) {
  for (const t of TRIANGLES) {
    if (inTriangle([x, y], t.pts)) return mono ? (t.color === 'a' ? '#FFFFFF' : null) : C[t.color];
  }
  if (Math.abs(roundRect(x, y, 168, 28)) <= 9) return mono ? '#FFFFFF' : C.frame;
  return null;
}

/**
 * @param size   lado en píxeles
 * @param scale  tamaño del dibujo respecto al lienzo (1 = el diseño de 512 ocupa todo)
 * @param bg     'full' fondo a sangre, 'round' fondo con esquinas redondeadas, 'none' transparente
 */
function render(file, { size, scale = 1, bg = 'full', mono = false, draw = true }) {
  const png = new PNG({ width: size, height: size });
  const N = 4;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < N; sy++) {
        for (let sx = 0; sx < N; sx++) {
          // Píxel → rejilla de 512, con el dibujo escalado alrededor del centro.
          const u = ((px + (sx + 0.5) / N) / size) * 512;
          const v = ((py + (sy + 0.5) / N) / size) * 512;
          let color = draw ? motif(256 + (u - 256) / scale, 256 + (v - 256) / scale, mono) : null;
          if (!color && (bg === 'full' || (bg === 'round' && roundRect(u, v, 256, 112) <= 0))) color = C.bg;
          if (!color) continue;
          const c = rgb(color);
          r += c[0]; g += c[1]; b += c[2]; a += 1;
        }
      }
      const i = (py * size + px) * 4;
      if (a > 0) {
        png.data[i] = Math.round(r / a);
        png.data[i + 1] = Math.round(g / a);
        png.data[i + 2] = Math.round(b / a);
      }
      png.data[i + 3] = Math.round((a / (N * N)) * 255);
    }
  }
  fs.writeFileSync(path.join(__dirname, '..', 'assets', file), PNG.sync.write(png));
  console.log(file);
}

render('icon.png', { size: 1024 });
// Icono adaptable de Android: el sistema recorta el borde, así que el dibujo va en el 60 % central.
render('android-icon-foreground.png', { size: 1024, scale: 0.86, bg: 'none' });
render('android-icon-background.png', { size: 1024, draw: false });
render('android-icon-monochrome.png', { size: 1024, scale: 0.86, bg: 'none', mono: true });
render('splash-icon.png', { size: 1024, scale: 0.86, bg: 'none' });
render('favicon.png', { size: 48, bg: 'round' });
