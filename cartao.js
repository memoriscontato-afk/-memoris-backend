const QRCode = require('qrcode');
const { createCanvas, loadImage, registerFont } = require('canvas');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const FONT_PATH = '/tmp/memoris-font.ttf';
const FONT_URL  = 'https://github.com/google/fonts/raw/main/ofl/playfairdisplay/PlayfairDisplay-Regular.ttf';

function baixarFonte() {
  return new Promise((resolve) => {
    if (fs.existsSync(FONT_PATH)) { resolve(); return; }
    const file = fs.createWriteStream(FONT_PATH);
    https.get(FONT_URL, res => {
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', () => resolve()); // se falhar, continua sem fonte
  });
}

async function gerarCartaoQR(url) {
  await baixarFonte();
  try { registerFont(FONT_PATH, { family: 'Playfair' }); } catch(e) {}

  const W = 600, H = 820;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  // fundo branco
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  // borda externa
  ctx.strokeStyle = '#E8E0D4';
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, W - 48, H - 48);

  // borda interna
  ctx.strokeStyle = '#F0E8DC';
  ctx.lineWidth = 1;
  ctx.strokeRect(32, 32, W - 64, H - 64);

  // título MEMORIS
  ctx.fillStyle = '#1A0F0A';
  ctx.font = 'bold 44px Playfair, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('M E M O R I S', W / 2, 116);

  // linha dourada topo
  ctx.strokeStyle = '#C8A87A';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 60, 136);
  ctx.lineTo(W / 2 + 60, 136);
  ctx.stroke();
  ctx.fillStyle = '#C8A87A';
  ctx.beginPath();
  ctx.arc(W / 2, 136, 3, 0, Math.PI * 2);
  ctx.fill();

  // QR Code
  const qrSize = 360, qrX = (W - qrSize) / 2, qrY = 162;
  const qrDataUrl = await QRCode.toDataURL(url, {
    width: qrSize, margin: 2,
    color: { dark: '#1A0F0A', light: '#FFFFFF' },
    errorCorrectionLevel: 'H'
  });
  ctx.drawImage(await loadImage(qrDataUrl), qrX, qrY, qrSize, qrSize);

  // linha dourada inferior
  ctx.strokeStyle = '#C8A87A';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 60, qrY + qrSize + 26);
  ctx.lineTo(W / 2 + 60, qrY + qrSize + 26);
  ctx.stroke();
  ctx.fillStyle = '#C8A87A';
  ctx.beginPath();
  ctx.arc(W / 2, qrY + qrSize + 26, 3, 0, Math.PI * 2);
  ctx.fill();

  // frase
  ctx.fillStyle = '#6B5040';
  ctx.font = '21px Playfair, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Escaneie para reviver essa historia', W / 2, qrY + qrSize + 64);

  // rodapé
  ctx.fillStyle = '#C8A87A';
  ctx.font = '13px sans-serif';
  ctx.fillText('memoris.com.br', W / 2, H - 40);

  return canvas.toBuffer('image/png');
}

module.exports = { gerarCartaoQR };
