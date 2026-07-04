const nodemailer = require('nodemailer');
const { queries }  = require('./database');

// ── TRANSPORTER ──────────────────────────────────────────────────────────────

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT || '465'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// ── GERAR QR CODE SIMPLES (texto URL) ────────────────────────────────────────
// Em produção: substituir por geração real de imagem QR (lib: qrcode)
// Por agora, a URL da página do pai é o "QR Code" — basta apontar câmera

function gerarUrlPagina(pedidoId) {
  const base = process.env.FRONTEND_URL || 'https://memoris.com.br';
  return `${base}/homenagem/${pedidoId}`;
}

// ── TEMPLATE DO E-MAIL ────────────────────────────────────────────────────────

function templateEmail({ nomePai, nomeFilho, urlPagina, maeSolo }) {
  const heroi = maeSolo ? 'heroína' : 'herói';
  const ele   = maeSolo ? 'ela' : 'ele';

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sua homenagem está pronta — Memoris</title>
</head>
<body style="margin:0; padding:0; background:#F4EFE3; font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:560px; margin:0 auto; padding:40px 20px;">

    <!-- Logo -->
    <div style="text-align:center; margin-bottom:32px;">
      <span style="font-family:Georgia,serif; font-style:italic; font-size:28px; color:#9A4B2F;">Memoris</span>
    </div>

    <!-- Card principal -->
    <div style="background:#fff; border-radius:16px; padding:36px 32px; box-shadow:0 4px 20px rgba(59,42,32,.08);">
      <h1 style="font-family:Georgia,serif; font-weight:700; font-size:24px; color:#3B2A20; margin:0 0 10px; text-align:center;">
        Sua homenagem está pronta ❤️
      </h1>
      <p style="color:rgba(59,42,32,.6); font-size:15px; text-align:center; margin:0 0 28px; line-height:1.6;">
        Olá, <strong>${nomeFilho}</strong>! A página exclusiva para <strong>${nomePai}</strong> foi criada com sucesso.
      </p>

      <!-- Instrução principal -->
      <div style="background:#F6E9DA; border-radius:12px; padding:20px 24px; margin-bottom:24px; text-align:center;">
        <p style="margin:0 0 12px; font-size:14px; color:rgba(59,42,32,.7);">
          Aponte a câmera do celular para o QR Code abaixo ou acesse o link:
        </p>
        <a href="${urlPagina}"
           style="display:inline-block; background:linear-gradient(135deg,#9A4B2F,#6E3520); color:#fff;
                  text-decoration:none; font-weight:700; font-size:15px; padding:14px 28px;
                  border-radius:999px; margin-bottom:12px;">
          Abrir homenagem de ${nomePai}
        </a>
        <p style="margin:8px 0 0; font-size:12px; color:rgba(59,42,32,.4); word-break:break-all;">
          ${urlPagina}
        </p>
      </div>

      <!-- Como entregar -->
      <h2 style="font-size:15px; font-weight:700; color:#3B2A20; margin:0 0 12px;">Como entregar o presente:</h2>
      <div style="display:flex; flex-direction:column; gap:10px;">
        ${['📲 Envie o link acima pelo WhatsApp direto para o celular de ' + nomePai + '.',
           '🖨️ Imprima o QR Code e cole dentro de um cartão ou porta-retrato.',
           '📧 Encaminhe este e-mail para ' + ele + ' abrir quando quiser.']
          .map(t => `<p style="margin:0; font-size:13.5px; color:rgba(59,42,32,.7); padding:8px 12px; background:#F9F5EE; border-radius:8px;">${t}</p>`)
          .join('')}
      </div>
    </div>

    <!-- Rodapé -->
    <div style="text-align:center; margin-top:28px; color:rgba(59,42,32,.4); font-size:12px; line-height:1.6;">
      <p style="margin:0 0 6px;">
        Esta página nunca expira — ${nomePai} pode acessar a qualquer momento.
      </p>
      <p style="margin:0;">
        Dúvidas? Fale com a gente: <a href="mailto:suporte@memoris.com.br" style="color:#9A4B2F;">suporte@memoris.com.br</a>
      </p>
      <p style="margin:12px 0 0; color:rgba(59,42,32,.25);">Memoris © 2026 · Dia dos Pais</p>
    </div>

  </div>
</body>
</html>`;
}

// ── FUNÇÃO PRINCIPAL ──────────────────────────────────────────────────────────

async function enviarQRCode({ pedido, fotos }) {
  try {
    const urlPagina = gerarUrlPagina(pedido.id);

    const html = templateEmail({
      nomePai:   pedido.nome_pai,
      nomeFilho: pedido.nome_filho,
      urlPagina,
      maeSolo:   pedido.mae_solo === 1
    });

    const info = await transporter.sendMail({
      from:    process.env.EMAIL_FROM || 'Memoris <noreply@memoris.com.br>',
      to:      pedido.email,
      subject: `❤️ A homenagem de ${pedido.nome_pai} está pronta — Memoris`,
      html
    });

    // Registra entrega no banco
    queries.registrarEntrega.run({
      pedido_id:  pedido.id,
      email:      pedido.email,
      qr_code:    urlPagina,
      enviado_em: new Date().toISOString()
    });

    console.log(`[E-MAIL] Enviado para ${pedido.email} — Message ID: ${info.messageId}`);
    return { sucesso: true, messageId: info.messageId };

  } catch (err) {
    console.error('[ERRO] Envio de e-mail:', err.message);

    // Registra erro no banco para retentar depois
    try {
      queries.registrarEntrega.run({
        pedido_id:  pedido.id,
        email:      pedido.email,
        qr_code:    null,
        enviado_em: null
      });
    } catch (_) {}

    throw err;
  }
}

module.exports = { enviarQRCode, gerarUrlPagina };
