const QRCode   = require('qrcode');
const { createCanvas, loadImage } = require('canvas');

/**
 * Gera o cartão Memoris com QR Code como Buffer PNG
 * Estilo: fundo branco, MEMORIS em cima, QR Code no meio, frase embaixo
 */
async function gerarCartaoQR(url) {
  const W = 600, H = 800;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  // fundo branco
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  // borda fina
  ctx.strokeStyle = '#E8E0D4';
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, W - 40, H - 40);

  // título MEMORIS com espaçamento manual
  ctx.fillStyle = '#2C1E14';
  ctx.font = 'bold 50px Georgia, serif';
  ctx.textAlign = 'center';
  const titulo  = 'MEMORIS';
  const sp      = 8;
  let totalW    = titulo.split('').reduce((a, c) => a + ctx.measureText(c).width + sp, 0) - sp;
  let cx        = (W - totalW) / 2;
  titulo.split('').forEach(c => {
    const cw = ctx.measureText(c).width;
    ctx.fillText(c, cx + cw / 2, 128);
    cx += cw + sp;
  });

  // linha decorativa topo
  ctx.strokeStyle = '#C8B89A'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(W/2 - 55, 152); ctx.lineTo(W/2 + 55, 152); ctx.stroke();

  // QR Code
  const qrSize = 340, qrX = (W - qrSize) / 2, qrY = 188;
  const qrDataUrl = await QRCode.toDataURL(url, {
    width: qrSize, margin: 2,
    color: { dark: '#1A0F0A', light: '#FFFFFF' },
    errorCorrectionLevel: 'H'
  });
  const qrImg = await loadImage(qrDataUrl);
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

  // linha decorativa inferior
  ctx.strokeStyle = '#C8B89A'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(W/2 - 55, qrY + qrSize + 28); ctx.lineTo(W/2 + 55, qrY + qrSize + 28); ctx.stroke();

  // frase
  ctx.fillStyle = '#6B5744';
  ctx.font = '22px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('Escaneie para reviver essa história', W/2, qrY + qrSize + 68);

  // URL rodapé
  ctx.fillStyle = '#C8B89A';
  ctx.font = '13px sans-serif';
  ctx.fillText('memoris.com.br', W/2, H - 38);

  return canvas.toBuffer('image/png');
}

module.exports = { gerarCartaoQR };
