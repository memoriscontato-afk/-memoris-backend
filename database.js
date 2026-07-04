const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || './memoris.db';
const db = new Database(path.resolve(DB_PATH));

// Ativa WAL mode para performance melhor
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── TABELAS ──────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS pedidos (
    id          TEXT PRIMARY KEY,
    nome_pai    TEXT NOT NULL,
    nome_filho  TEXT NOT NULL,
    data_inicio TEXT NOT NULL,
    musica      TEXT,
    mensagem    TEXT,
    mae_solo    INTEGER DEFAULT 0,
    total_fotos INTEGER DEFAULT 0,
    status      TEXT DEFAULT 'pendente',
    cakto_id    TEXT,
    email       TEXT,
    criado_em   TEXT NOT NULL,
    pago_em     TEXT
  );

  CREATE TABLE IF NOT EXISTS fotos (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id  TEXT NOT NULL REFERENCES pedidos(id),
    ordem      INTEGER NOT NULL,
    base64     TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS entregas (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id  TEXT NOT NULL REFERENCES pedidos(id),
    email      TEXT NOT NULL,
    qr_code    TEXT,
    enviado    INTEGER DEFAULT 0,
    enviado_em TEXT,
    erro       TEXT
  );
`);

// ── QUERIES ──────────────────────────────────────────────────────────────────

const queries = {

  // Salva o pedido (dados do quiz, sem fotos)
  criarPedido: db.prepare(`
    INSERT INTO pedidos (id, nome_pai, nome_filho, data_inicio, musica, mensagem, mae_solo, total_fotos, status, criado_em)
    VALUES (@id, @nome_pai, @nome_filho, @data_inicio, @musica, @mensagem, @mae_solo, @total_fotos, 'pendente', @criado_em)
  `),

  // Salva uma foto do pedido
  criarFoto: db.prepare(`
    INSERT INTO fotos (pedido_id, ordem, base64) VALUES (?, ?, ?)
  `),

  // Busca pedido pelo ID
  buscarPedido: db.prepare(`
    SELECT * FROM pedidos WHERE id = ?
  `),

  // Busca todas as fotos de um pedido
  buscarFotos: db.prepare(`
    SELECT ordem, base64 FROM fotos WHERE pedido_id = ? ORDER BY ordem
  `),

  // Atualiza pedido após pagamento confirmado pela Cakto
  confirmarPagamento: db.prepare(`
    UPDATE pedidos
    SET status = 'pago', cakto_id = @cakto_id, email = @email, pago_em = @pago_em
    WHERE id = @id
  `),

  // Marca entrega como enviada
  registrarEntrega: db.prepare(`
    INSERT INTO entregas (pedido_id, email, qr_code, enviado, enviado_em)
    VALUES (@pedido_id, @email, @qr_code, 1, @enviado_em)
  `),

  // Lista pedidos pendentes de entrega
  pedidosPendentes: db.prepare(`
    SELECT p.* FROM pedidos p
    LEFT JOIN entregas e ON e.pedido_id = p.id
    WHERE p.status = 'pago' AND e.id IS NULL
  `)
};

// Transaction: cria pedido + fotos de uma vez
const criarPedidoCompleto = db.transaction((pedido, fotos) => {
  queries.criarPedido.run(pedido);
  fotos.forEach((base64, i) => {
    queries.criarFoto.run(pedido.id, i + 1, base64);
  });
});

module.exports = { db, queries, criarPedidoCompleto };
