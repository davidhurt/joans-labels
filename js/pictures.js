// Little pictures for labels (drawn from the Mac's built-in emoji),
// and helpers to shrink photos so they save quickly.

export const CLIPART = [
  { group: 'Holidays', items: ['🎄', '⛄', '❄️', '🎅', '🎁', '🕎', '🐰', '🥚', '🎃', '🦃', '🇺🇸', '🎆'] },
  { group: 'Love & family', items: ['❤️', '💕', '🌹', '💐', '🏠', '👪', '💒', '👶', '🎂', '🎈', '🎉', '✨'] },
  { group: 'Nature', items: ['🌸', '🌻', '🌷', '🍀', '🌿', '🍁', '☀️', '🌙', '⭐', '🦋', '🐦', '🐾'] },
  { group: 'Kitchen & home', items: ['🍓', '🍎', '🍑', '🍒', '🍯', '🥧', '🍪', '☕', '🫙', '🧁', '📚', '✉️'] },
];

const cache = new Map();
/** Turn an emoji into a PNG picture (data URL). */
export function emojiPng(emoji, px = 256) {
  if (cache.has(emoji)) return cache.get(emoji);
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const ctx = c.getContext('2d');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${px * 0.8}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.fillText(emoji, px / 2, px / 2 + px * 0.05);
  const url = c.toDataURL('image/png');
  cache.set(emoji, url);
  return url;
}

/** Read a photo file, shrink it, return {src, ar}. */
export function readPhoto(file, maxPx = 1400) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(fr.error);
    fr.onload = () => {
      const im = new Image();
      im.onerror = () => reject(new Error(/hei[cf]/i.test(file.type + file.name)
        ? 'This photo is in Apple’s HEIC format, which Chrome can’t open. Instead, open the Photos app and drag the photo straight onto your letter.'
        : 'That file is not a picture this app can use.'));
      im.onload = () => {
        const k = Math.min(1, maxPx / Math.max(im.width, im.height));
        const w = Math.round(im.width * k), h = Math.round(im.height * k);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        const png = /png|gif|svg/i.test(file.type);
        if (!png) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
        ctx.drawImage(im, 0, 0, w, h);
        resolve({ src: png ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.88), ar: w / h });
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
