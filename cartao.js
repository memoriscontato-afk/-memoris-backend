const QRCode = require('qrcode');
const { createCanvas, loadImage } = require('canvas');

async function svgTexto(texto, largura, altura, fontSize, cor, negrito = false, align = 'center') {
  const peso = negrito ? '700' : '400';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}">
    <text
      x="${align === 'center' ? largura / 2 : align === 'left' ? 0 : largura}"
      y="${altura * 0.75}"
      font-family="Georgia, serif"
      font-size="${fontSize}"
      font-weight="${peso}"
      fill="${cor}"
      text-anchor="${align === 'center' ? 'middle' : align === 'left' ? 'start' : 'end'}"
    >${texto}</text>
  </svg>`;
  const buf = Buffer.from(svg);
  return await loadImage(buf);
}

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

  // linha dourada helper
  function linhaDourada(y) {
    ctx.strokeStyle = '#C8A87A'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(W/2-70, y); ctx.lineTo(W/2+70, y); ctx.stroke();
    ctx.fillStyle = '#C8A87A';
    ctx.beginPath(); ctx.arc(W/2, y, 3, 0, Math.PI*2); ctx.fill();
  }

  // MEMORIS
  const imgTitulo = await svgTexto('M E M O R I S', W, 60, 40, '#1A0F0A', true);
  ctx.drawImage(imgTitulo, 0, 60);

  linhaDourada(130);

  // nomes
  if (nomePai && nomeFilho) {
    const imgNomes = await svgTexto(`${nomePai} & ${nomeFilho}`, W, 40, 20, '#6B5040');
    ctx.drawImage(imgNomes, 0, 140);
  }

  // QR Code
  const qrSize = 340, qrX = (W - qrSize) / 2;
  const qrY = (nomePai && nomeFilho) ? 188 : 155;
  const qrDataUrl = await QRCode.toDataURL(url, {
    width: qrSize, margin: 2,
    color: { dark: '#1A0F0A', light: '#FFFFFF' },
    errorCorrectionLevel: 'H'
  });
  ctx.drawImage(await loadImage(qrDataUrl), qrX, qrY, qrSize, qrSize);

  linhaDourada(qrY + qrSize + 22);

  let posY = qrY + qrSize + 28;

  // dias
  if (dias) {
    const imgDias = await svgTexto(String(dias), W, 56, 42, '#1A0F0A', true);
    ctx.drawImage(imgDias, 0, posY);
    posY += 52;
    const imgLabel = await svgTexto('DIAS SENDO MEU HEROI', W, 28, 13, '#999999');
    ctx.drawImage(imgLabel, 0, posY);
    posY += 32;
  }

  // mensagem personalizada (quebra em linhas)
  const fraseTexto = mensagem || 'Escaneie para reviver essa historia';
  const palavras = fraseTexto.split(' ');
  const linhas = [];
  let linha = '';
  const maxChars = 38;
  palavras.forEach(p => {
    const teste = linha ? linha + ' ' + p : p;
    if (teste.length > maxChars && linha) { linhas.push(linha); linha = p; }
    else { linha = teste; }
  });
  if (linha) linhas.push(linha);

  posY += 14;
  for (const l of linhas) {
    const imgLinha = await svgTexto(l, W, 34, 18, '#6B5040');
    ctx.drawImage(imgLinha, 0, posY);
    posY += 28;
  }

  // rodapé
  const imgRodape = await svgTexto('memoris.com.br', W, 30, 13, '#C8A87A');
  ctx.drawImage(imgRodape, 0, H - 50);

  return canvas.toBuffer('image/png');
}

module.exports = { gerarCartaoQR };
