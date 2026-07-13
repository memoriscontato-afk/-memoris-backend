require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
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

// ── GET /api/pedidos/:id/publico ─────────────────────────────────────────────
// Versão pública dos dados (sem e-mail/dados sensíveis) para a página de homenagem
// Só retorna dados se o pedido estiver pago — protege pedidos não confirmados

app.get('/api/pedidos/:id/publico', (req, res) => {
  try {
    const pedido = queries.buscarPedido.get(req.params.id);
    if (!pedido) return res.status(404).json({ erro: 'Homenagem não encontrada.' });
    if (pedido.status !== 'pago') return res.status(403).json({ erro: 'Pagamento ainda não confirmado.' });

    const fotos = queries.buscarFotos.all(req.params.id);

    res.json({
      nomePai:    pedido.nome_pai,
      nomeFilho:  pedido.nome_filho,
      dataInicio: pedido.data_inicio,
      musica:     pedido.musica,
      mensagem:   pedido.mensagem,
      maeSolo:    pedido.mae_solo === 1,
      fotos:      fotos.map(f => f.base64)
    });
  } catch (err) {
    console.error('[ERRO] GET /api/pedidos/:id/publico:', err.message);
    res.status(500).json({ erro: 'Erro interno.' });
  }
});

// ── GET /homenagem/:id ────────────────────────────────────────────────────────
// Serve a página que o pai vê ao escanear o QR Code

app.get('/homenagem/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'homenagem.html'));
});

// ── POST /api/webhook/cakto ──────────────────────────────────────────────────
// Recebe confirmação de pagamento da Cakto e dispara a entrega

app.post('/api/webhook/cakto', async (req, res) => {
  try {
    const evento = req.body;
    console.log('[WEBHOOK] Cakto recebido:', JSON.stringify(evento));

    // Estrutura real da Cakto: { secret, event, data: {...} }
    const data = evento?.data || evento; // fallback caso mude no futuro

    // Status do pagamento
    const status = data?.status || evento?.event;
    const statusOk = ['paid', 'approved', 'complete', 'completed', 'purchase_approved']
      .includes(String(status).toLowerCase());

    if (!statusOk) {
      return res.json({ ignorado: true, motivo: `Status não é pagamento: ${status}` });
    }

    // O ID do NOSSO pedido foi passado como ?ref=ID na URL do checkout da Cakto.
    // A Cakto devolve essa URL completa em data.checkoutUrl — extraímos o ref de lá.
    let pedidoId = null;
    if (data?.checkoutUrl) {
      try {
        const url = new URL(data.checkoutUrl);
        pedidoId = url.searchParams.get('ref');
      } catch (_) {}
    }
    // Fallbacks para outras possíveis estruturas
    pedidoId = pedidoId
      || data?.metadata?.ref
      || data?.custom_fields?.ref
      || data?.ref;

    if (!pedidoId) {
      console.warn('[WEBHOOK] ref não encontrado no payload. checkoutUrl:', data?.checkoutUrl);
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

    // E-mail do cliente: data.customer.email
    const emailCliente = data?.customer?.email
      || data?.buyer?.email
      || data?.email;

    if (!emailCliente) {
      console.warn('[WEBHOOK] E-mail do cliente não encontrado no payload.');
      return res.status(400).json({ erro: 'E-mail do cliente não encontrado.' });
    }

    // Atualiza status no banco
    queries.confirmarPagamento.run({
      id:       pedidoId,
      cakto_id: data?.id || null,
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
