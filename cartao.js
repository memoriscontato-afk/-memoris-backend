const QRCode = require('qrcode');
const { createCanvas, loadImage } = require('canvas');

async function gerarCartaoQR(url, opcoes = {}) {
  const { nomePai = '', nomeFilho = '', dias = '', mensagem = '' } = opcoes;

  const W = 600, H = 920;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // fundo branco
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  // bordas
  ctx.strokeStyle = '#E8E0D4'; ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, W - 48, H - 48);
  ctx.strokeStyle = '#F0E8DC'; ctx.lineWidth = 1;
  ctx.strokeRect(32, 32, W - 64, H - 64);

  function linhaDourada(y) {
    ctx.strokeStyle = '#C8A87A'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(W/2-70, y); ctx.lineTo(W/2+70, y); ctx.stroke();
    ctx.fillStyle = '#C8A87A';
    ctx.beginPath(); ctx.arc(W/2, y, 3, 0, Math.PI*2); ctx.fill();
  }

  // título MEMORIS
  ctx.fillStyle = '#1A0F0A';
  ctx.font = 'bold 40px "DejaVu Sans", "Liberation Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('M E M O R I S', W / 2, 108);

  linhaDourada(130);

  let posY = 130;

  // nomes
  if (nomePai && nomeFilho) {
    ctx.fillStyle = '#6B5040';
    ctx.font = '20px "DejaVu Sans", "Liberation Sans", sans-serif';
    ctx.fillText(`${nomePai} & ${nomeFilho}`, W / 2, posY + 32);
    posY += 40;
  }

  // QR Code
  const qrSize = 340, qrX = (W - qrSize) / 2;
  const qrY = posY + 20;
  const qrDataUrl = await QRCode.toDataURL(url, {
    width: qrSize, margin: 2,
    color: { dark: '#1A0F0A', light: '#FFFFFF' },
    errorCorrectionLevel: 'H'
  });
  ctx.drawImage(await loadImage(qrDataUrl), qrX, qrY, qrSize, qrSize);

  linhaDourada(qrY + qrSize + 22);
  posY = qrY + qrSize + 28;

  // dias
  if (dias) {
    ctx.fillStyle = '#1A0F0A';
    ctx.font = 'bold 40px "DejaVu Sans", "Liberation Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(dias), W / 2, posY + 38);
    posY += 46;

    ctx.fillStyle = '#999999';
    ctx.font = '13px "DejaVu Sans", "Liberation Sans", sans-serif';
    ctx.fillText('DIAS SENDO MEU HEROI', W / 2, posY + 14);
    posY += 34;
  }

  // mensagem personalizada (quebra em linhas)
  const fraseTexto = mensagem || 'Escaneie para reviver essa historia';
  ctx.fillStyle = '#6B5040';
  ctx.font = '18px "DejaVu Sans", "Liberation Sans", sans-serif';
  ctx.textAlign = 'center';

  const palavras = fraseTexto.split(' ');
  const linhas = [];
  let linha = '';
  palavras.forEach(p => {
    const teste = linha ? linha + ' ' + p : p;
    if (ctx.measureText(teste).width > 480 && linha) { linhas.push(linha); linha = p; }
    else { linha = teste; }
  });
  if (linha) linhas.push(linha);

  posY += 20;
  linhas.forEach((l, i) => {
    ctx.fillText(l, W / 2, posY + i * 26);
  });

  // rodapé
  ctx.fillStyle = '#C8A87A';
  ctx.font = '13px "DejaVu Sans", "Liberation Sans", sans-serif';
  ctx.fillText('memoris.com.br', W / 2, H - 40);

  return canvas.toBuffer('image/png');
}

module.exports = { gerarCartaoQR };
