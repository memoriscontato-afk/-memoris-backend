require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { criarPedidoCompleto, queries } = require('./database');
const { enviarQRCode } = require('./email');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── MIDDLEWARES ──────────────────────────────────────────────────────────────

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json({ limit: '50mb' })); // aceita fotos em base64

// ── ROTA DE HEALTH CHECK ─────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.json({ status: 'ok', servico: 'Memoris Backend', versao: '1.0.0' });
});

// ── POST /api/pedidos ────────────────────────────────────────────────────────
// Recebe os dados do quiz e salva no banco antes de redirecionar para a Cakto

app.post('/api/pedidos', (req, res) => {
  try {
    const {
      id,
      nomePai,
      nomeFilho,
      dataInicio,
      musica,
      mensagem,
      maeSolo,
      fotos = []   // array de strings base64
    } = req.body;

    // Validações básicas
    if (!id || !nomePai || !nomeFilho || !dataInicio) {
      return res.status(400).json({ erro: 'Campos obrigatórios: id, nomePai, nomeFilho, dataInicio' });
    }
    if (fotos.length < 3) {
      return res.status(400).json({ erro: 'Mínimo de 3 fotos obrigatório.' });
    }
    if (fotos.length > 15) {
      return res.status(400).json({ erro: 'Máximo de 15 fotos.' });
    }

    // Salva pedido + fotos (transação)
    criarPedidoCompleto(
      {
        id,
        nome_pai:    nomePai,
        nome_filho:  nomeFilho,
        data_inicio: dataInicio,
        musica:      musica || null,
        mensagem:    mensagem || null,
        mae_solo:    maeSolo ? 1 : 0,
        total_fotos: fotos.length,
        criado_em:   new Date().toISOString()
      },
      fotos
    );

    console.log(`[PEDIDO] Salvo: ${id} — ${nomePai} & ${nomeFilho} (${fotos.length} fotos)`);

    res.status(201).json({
      sucesso: true,
      id,
      redirectUrl: `https://pay.cakto.com.br/33bsujg_952281?ref=${id}`
    });

  } catch (err) {
    console.error('[ERRO] POST /api/pedidos:', err.message);

    // ID duplicado
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ erro: 'Pedido com esse ID já existe.' });
    }
    res.status(500).json({ erro: 'Erro interno ao salvar pedido.' });
  }
});

// ── GET /api/pedidos/:id ─────────────────────────────────────────────────────
// Busca um pedido pelo ID (usado internamente / debug)

app.get('/api/pedidos/:id', (req, res) => {
  try {
    const pedido = queries.buscarPedido.get(req.params.id);
    if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado.' });

    const fotos = queries.buscarFotos.all(req.params.id);
    res.json({ ...pedido, fotos: fotos.map(f => f.base64) });
  } catch (err) {
    console.error('[ERRO] GET /api/pedidos:', err.message);
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

// ── POST /api/webhook/cakto ──────────────────────────────────────────────────
// Recebe confirmação de pagamento da Cakto e dispara a entrega

app.post('/api/webhook/cakto', async (req, res) => {
  try {
    const evento = req.body;
    console.log('[WEBHOOK] Cakto recebido:', JSON.stringify(evento, null, 2));

    // Validação básica do webhook
    // Em produção: validar assinatura HMAC com CAKTO_WEBHOOK_SECRET
    const status = evento?.status || evento?.payment_status;
    if (!['paid', 'approved', 'complete', 'completed'].includes(status?.toLowerCase())) {
      return res.json({ ignorado: true, motivo: `Status não é pagamento: ${status}` });
    }

    // Extrai o ID do pedido que passamos na URL da Cakto (?ref=ID)
    const pedidoId = evento?.metadata?.ref
      || evento?.custom_fields?.ref
      || evento?.order?.ref
      || evento?.ref;

    if (!pedidoId) {
      console.warn('[WEBHOOK] ref não encontrado no payload:', evento);
      return res.status(400).json({ erro: 'ref do pedido não encontrado no webhook.' });
    }

    // Busca o pedido no banco
    const pedido = queries.buscarPedido.get(pedidoId);
    if (!pedido) {
      console.warn('[WEBHOOK] Pedido não encontrado:', pedidoId);
      return res.status(404).json({ erro: 'Pedido não encontrado.' });
    }

    if (pedido.status === 'pago') {
      return res.json({ ignorado: true, motivo: 'Pedido já processado.' });
    }

    // E-mail do cliente vem da Cakto
    const emailCliente = evento?.customer?.email
      || evento?.buyer?.email
      || evento?.email;

    if (!emailCliente) {
      console.warn('[WEBHOOK] E-mail do cliente não encontrado no payload.');
      return res.status(400).json({ erro: 'E-mail do cliente não encontrado.' });
    }

    // Atualiza status no banco
    queries.confirmarPagamento.run({
      id:       pedidoId,
      cakto_id: evento?.id || evento?.transaction_id || null,
      email:    emailCliente,
      pago_em:  new Date().toISOString()
    });

    console.log(`[WEBHOOK] Pagamento confirmado: ${pedidoId} → ${emailCliente}`);

    // Busca fotos e dispara envio do QR Code por e-mail
    const fotos = queries.buscarFotos.all(pedidoId);
    await enviarQRCode({ pedido: { ...pedido, email: emailCliente }, fotos });

    res.json({ sucesso: true, pedidoId, email: emailCliente });

  } catch (err) {
    console.error('[ERRO] POST /api/webhook/cakto:', err.message);
    res.status(500).json({ erro: 'Erro interno no webhook.' });
  }
});

// ── INICIA SERVIDOR ──────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🚀 Memoris Backend rodando na porta ${PORT}`);
  console.log(`   Acesse: http://localhost:${PORT}\n`);
});
