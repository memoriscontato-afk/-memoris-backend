const { Resend }        = require('resend');
const { queries }       = require('./database');
const { gerarCartaoQR } = require('./cartao');

const resend = new Resend(process.env.RESEND_API_KEY);

function gerarUrlPagina(pedidoId) {
  const base = process.env.FRONTEND_URL || 'https://memoris.com.br';
  return `${base}/homenagem/${pedidoId}`;
}

function templateEmail({ nomePai, nomeFilho, urlPagina, maeSolo }) {
  const ele = maeSolo ? 'ela' : 'ele';
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4EFE3;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:40px 20px;">
  <div style="text-align:center;margin-bottom:32px;">
    <span style="font-family:Georgia,serif;font-style:italic;font-size:28px;color:#9A4B2F;letter-spacing:.1em;">Memoris</span>
  </div>
  <div style="background:#fff;border-radius:16px;padding:36px 32px;box-shadow:0 4px 20px rgba(59,42,32,.08);">
    <h1 style="font-family:Georgia,serif;font-weight:700;font-size:24px;color:#3B2A20;margin:0 0 10px;text-align:center;">
      Sua homenagem está pronta ❤️
    </h1>
    <p style="color:rgba(59,42,32,.6);font-size:15px;text-align:center;margin:0 0 24px;line-height:1.6;">
      Olá, <strong>${nomeFilho}</strong>! A homenagem para <strong>${nomePai}</strong> foi criada com sucesso.
    </p>
    <div style="background:#F6E9DA;border-radius:12px;padding:20px 24px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 6px;font-size:14px;color:rgba(59,42,32,.7);font-weight:600;">Seu Cartão de Memórias está em anexo.</p>
      <p style="margin:0 0 16px;font-size:13px;color:rgba(59,42,32,.55);">Imprima, cole num porta-retrato ou envie pelo celular.</p>
      <a href="${urlPagina}" style="display:inline-block;background:linear-gradient(135deg,#9A4B2F,#6E3520);color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:999px;">
        Abrir homenagem de ${nomePai}
      </a>
      <p style="margin:12px 0 0;font-size:11px;color:rgba(59,42,32,.4);word-break:break-all;">${urlPagina}</p>
    </div>
    <h2 style="font-size:14px;font-weight:700;color:#3B2A20;margin:0 0 12px;">Como usar o Cartão de Memórias:</h2>
    ${['📱 Escaneie o QR Code — a homenagem abre na hora, sem baixar nada.',
       '🖨️ Imprima e cole dentro de um porta-retrato com a foto favorita de vocês.',
       '💳 Recorte no tamanho de um cartão e coloque dentro do presente.',
       '🔑 Peça um chaveiro acrílico numa gráfica — presente pra vida toda.']
      .map(t => `<p style="margin:0 0 8px;font-size:13px;color:rgba(59,42,32,.7);padding:8px 12px;background:#F9F5EE;border-radius:8px;">${t}</p>`).join('')}
  </div>
  <div style="text-align:center;margin-top:24px;color:rgba(59,42,32,.4);font-size:12px;line-height:1.7;">
    <p style="margin:0 0 4px;">Esta página nunca expira — ${nomePai} pode acessar quando quiser.</p>
    <p style="margin:0;">Dúvidas? <a href="mailto:suporte@memoris.com.br" style="color:#9A4B2F;">suporte@memoris.com.br</a></p>
    <p style="margin:12px 0 0;color:rgba(59,42,32,.25);">Memoris © 2026 · Dia dos Pais</p>
  </div>
</div>
</body>
</html>`;
}

async function enviarQRCode({ pedido, fotos }) {
  try {
    const urlPagina = gerarUrlPagina(pedido.id);
    const cartaoPng = await gerarCartaoQR(urlPagina);
    const html      = templateEmail({
      nomePai:   pedido.nome_pai,
      nomeFilho: pedido.nome_filho,
      urlPagina,
      maeSolo:   pedido.mae_solo === 1
    });

    const { error } = await resend.emails.send({
      from:        'Memoris <onboarding@resend.dev>',
      to:          pedido.email,
      subject:     `❤️ Seu Cartão de Memórias está pronto — ${pedido.nome_pai}`,
      html,
      attachments: [{
        filename: 'cartao-memoris.png',
        content:  cartaoPng.toString('base64')
      }]
    });

    if (error) throw new Error(error.message);

    queries.registrarEntrega.run({
      pedido_id:  pedido.id,
      email:      pedido.email,
      qr_code:    urlPagina,
      enviado_em: new Date().toISOString()
    });

    console.log(`[E-MAIL] Cartão enviado para ${pedido.email}`);
    return { sucesso: true };

  } catch (err) {
    console.error('[ERRO] Envio de e-mail:', err.message);
    try {
      queries.registrarEntrega.run({
        pedido_id: pedido.id, email: pedido.email, qr_code: null, enviado_em: null
      });
    } catch (_) {}
    throw err;
  }
}

module.exports = { enviarQRCode, gerarUrlPagina };
