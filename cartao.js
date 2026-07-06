const QRCode = require('qrcode');
const { createCanvas, loadImage } = require('canvas');

async function gerarCartaoQR(url) {
  const W = 600, H = 820;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // fundo branco
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  // borda fina
  ctx.strokeStyle = '#E8E0D4';
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, W - 48, H - 48);

  // borda interna decorativa
  ctx.strokeStyle = '#F0E8DC';
  ctx.lineWidth = 1;
  ctx.strokeRect(32, 32, W - 64, H - 64);

  // título MEMORIS — letra a letra com espaçamento
  ctx.fillStyle = '#1A0F0A';
  ctx.font = 'bold 46px sans-serif';
  ctx.textAlign = 'center';
  const titulo = 'M E M O R I S';
  ctx.fillText(titulo, W / 2, 120);

  // linha decorativa dourada
  ctx.strokeStyle = '#C8A87A';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 60, 140);
  ctx.lineTo(W / 2 + 60, 140);
  ctx.stroke();

  // pequeno ornamento central
  ctx.fillStyle = '#C8A87A';
  ctx.beginPath();
  ctx.arc(W / 2, 140, 3, 0, Math.PI * 2);
  ctx.fill();

  // QR Code
  const qrSize = 360;
  const qrX = (W - qrSize) / 2;
  const qrY = 165;

  const qrDataUrl = await QRCode.toDataURL(url, {
    width: qrSize,
    margin: 2,
    color: { dark: '#1A0F0A', light: '#FFFFFF' },
    errorCorrectionLevel: 'H'
  });

  const qrImg = await loadImage(qrDataUrl);
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

  // linha decorativa dourada inferior
  ctx.strokeStyle = '#C8A87A';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 60, qrY + qrSize + 28);
  ctx.lineTo(W / 2 + 60, qrY + qrSize + 28);
  ctx.stroke();

  // ornamento central inferior
  ctx.fillStyle = '#C8A87A';
  ctx.beginPath();
  ctx.arc(W / 2, qrY + qrSize + 28, 3, 0, Math.PI * 2);
  ctx.fill();

  // frase
  ctx.fillStyle = '#6B5040';
  ctx.font = '22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Escaneie para reviver essa historia', W / 2, qrY + qrSize + 68);

  // URL rodapé discreta
  ctx.fillStyle = '#C8A87A';
  ctx.font = '13px sans-serif';
  ctx.fillText('memoris.com.br', W / 2, H - 42);

  return canvas.toBuffer('image/png');
}

module.exports = { gerarCartaoQR };
