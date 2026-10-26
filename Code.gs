/**
 * Meus gastos - telinha de lançamento + painel
 * Script vinculado à planilha "Controle de Gastos 2026" (aberta no Google Sheets).
 * Lê os números já calculados nas abas Resumo e Apoio e grava gastos na aba Lançamentos.
 *
 * Novidades desta versão:
 *  - Rótulos de fatura ("Nov/26") sempre gravados como TEXTO (não viram mais data).
 *  - Lançamento parcelado: gera uma linha por parcela, cada uma na sua fatura.
 *  - getData devolve as parcelas em aberto e o que já está comprometido nas próximas faturas.
 */
const LAST_ROW = 1500;          // as fórmulas da planilha vão até a linha 1500
const PESSOAS = ['Eu', 'Irmã', 'Pai'];
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
// "Loja - Parcela 2/3", "iFood - NuPay - 2/2", "Parcelamento de Compra - Loja - 1/4"
const RE_PARCELA = /^(.*?)(?:\s*[-–]\s*)?(?:parcela\s*)?(\d{1,2})\s*\/\s*(\d{1,2})\s*$/i;

function doGet() {
  // Index.html continua igual; o parcelamento é inserido aqui (veja Parcelas.gs)
  const html = aplicarParcelas_(HtmlService.createHtmlOutputFromFile('Index').getContent());
  return HtmlService.createHtmlOutput(html)
    .setTitle('Meus gastos')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}
function ss_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}
function num_(v) {
  return Number(v) || 0;
}
/** 202611 -> "Nov/26" */
function rotulo_(chave) {
  return MESES[(chave % 100) - 1] + '/' + String(Math.floor(chave / 100)).slice(2);
}

/** Deixa o seletor de fatura do Resumo na fatura atual (fecha dia 10, vence dia 18). */
function syncFatura_() {
  const s = ss_();
  const rs = s.getSheetByName('Resumo');
  const ap = s.getSheetByName('Apoio');
  const tz = s.getSpreadsheetTimeZone();

  // 1) Lista de faturas SEMPRE como texto. Sem isso o Sheets lê "Nov/26" como 26 de novembro.
  const chaves = ap.getRange('B2:B13').getValues().flat();
  const rotulos = chaves.map(rotulo_);
  const atuais = ap.getRange('A2:A13').getDisplayValues().flat();
  if (rotulos.join('|') !== atuais.join('|')) {
    ap.getRange('A2:A13').setNumberFormat('@').setValues(rotulos.map((r) => [r]));
  }

  // 2) Seletor também como texto, e na fatura atual.
  const agora = new Date();
  const dia = Number(Utilities.formatDate(agora, tz, 'd'));
  let mes = Number(Utilities.formatDate(agora, tz, 'M')) - 1;
  let ano = Number(Utilities.formatDate(agora, tz, 'yyyy'));
  if (dia >= 11) {
    mes += 1;
    if (mes > 11) { mes = 0; ano += 1; }
  }
  const rotulo = MESES[mes] + '/' + String(ano).slice(2);
  const b4 = rs.getRange('B4');
  b4.setNumberFormat('@');
  if (rotulos.indexOf(rotulo) >= 0 && b4.getDisplayValue() !== rotulo) {
    b4.setValue(rotulo);
    SpreadsheetApp.flush();
  }
}

/** Parcelas em aberto + o que já está comprometido nas próximas faturas (só "Eu"). */
function parcelas_(col, chaveSel) {
  const idx = (c) => Math.floor(c / 100) * 12 + (c % 100);   // índice de mês, atravessa a virada do ano
  const grupos = {};
  col.forEach((r) => {
    if (r[0] === '') return;
    const chave = Number(r[5]) || 0;
    const m = RE_PARCELA.exec(String(r[1]).trim());
    if (!m || !chave) return;
    const k = Number(m[2]), n = Number(m[3]);
    if (n < 2 || n > 60 || k < 1 || k > n) return;
    const base = (m[1] || 'Compra').trim();
    // parcelas da mesma compra têm o mesmo (mês da fatura - número da parcela)
    const id = base + '|' + n + '|' + r[4] + '|' + (idx(chave) - k);
    if (!grupos[id]) grupos[id] = { nome: base, n: n, quem: String(r[4]), itens: [] };
    grupos[id].itens.push({ k: k, chave: chave, valor: num_(r[2]) });
  });

  const lista = [];
  const futuro = {};
  Object.keys(grupos).forEach((id) => {
    const g = grupos[id];
    const aPartir = g.itens.filter((i) => i.chave >= chaveSel).sort((a, b) => a.chave - b.chave);
    if (!aPartir.length) return;
    const depois = aPartir.filter((i) => i.chave > chaveSel);
    const ultima = g.itens.reduce((mx, i) => Math.max(mx, i.chave), 0);
    lista.push({
      nome: g.nome, quem: g.quem, k: aPartir[0].k, n: g.n, valor: aPartir[0].valor,
      restam: depois.length,
      restanteTotal: depois.reduce((s, i) => s + i.valor, 0),
      ultima: rotulo_(ultima)
    });
    if (g.quem === 'Eu') depois.forEach((i) => { futuro[i.chave] = (futuro[i.chave] || 0) + i.valor; });
  });
  lista.sort((a, b) => b.restanteTotal - a.restanteTotal || b.valor - a.valor);
  const comprometido = Object.keys(futuro).map(Number).sort((a, b) => a - b).slice(0, 6)
    .map((c) => ({ mes: rotulo_(c), total: futuro[c] }));
  return { parcelamentos: lista, comprometido: comprometido };
}

/** Tudo que a tela precisa, em um objeto só. */
function getData() {
  syncFatura_();
  const s = ss_();
  const tz = s.getSpreadsheetTimeZone();
  const rs = s.getSheetByName('Resumo');
  const ap = s.getSheetByName('Apoio');
  const mt = s.getSheetByName('Metas');
  const lc = s.getSheetByName('Lançamentos');
  const k = rs.getRange('B13:B23').getValues().flat();
  if (k.length < 11) throw new Error('Aba Resumo fora do formato esperado (B13:B23). Verifique se linhas foram apagadas.');
  const num = num_;
  const categorias = rs.getRange('A50:F62').getValues().map((r) => ({
    nome: r[0], real: num(r[1]), meta: num(r[2]), pct: num(r[5])
  }));
  const semanas = rs.getRange('A41:F45').getValues()
    .filter((r) => r[0] !== '')
    .map((r) => ({
      nome: String(r[0]).replace(' ◄ hoje', ''),
      hoje: String(r[0]).indexOf('hoje') >= 0,
      periodo: String(r[1]),
      pode: num(r[2]),
      gastou: num(r[3])
    }));
  const evolucao = rs.getRange('A68:F79').getValues().map((r) => ({
    mes: String(r[0]), gasto: num(r[1]), situacao: String(r[4]), resultado: String(r[5])
  }));
  // lançamentos (colunas A a F; F é a chave da fatura, calculada pela planilha)
  const col = lc.getRange(2, 1, LAST_ROW - 1, 6).getValues();
  let ultimo = -1;
  for (let i = col.length - 1; i >= 0; i--) {
    if (col[i][0] !== '') { ultimo = i; break; }
  }
  const recentes = [];
  for (let i = ultimo; i >= 0 && recentes.length < 20; i--) {
    const r = col[i];
    recentes.push({
      linha: i + 2,
      data: r[0] instanceof Date ? Utilities.formatDate(r[0], tz, 'dd/MM') : String(r[0]),
      descricao: String(r[1]),
      valor: num(r[2]),
      categoria: String(r[3]),
      quem: String(r[4])
    });
  }
  const par = parcelas_(col, num(ap.getRange('D2').getValue()));
  const fim = ap.getRange('D10').getValue();
  const ini = ap.getRange('D9').getValue();
  return {
    fatura: rs.getRange('B4').getDisplayValue(),   // texto, nunca Date (Date quebra o google.script.run)
    estado: String(rs.getRange('G4').getValue()),
    meta: num(k[1]),
    gasto: num(k[2]),
    falta: num(k[4]),
    diasRestantes: num(k[5]),
    porSemana: num(k[6]),
    pctMeta: num(k[8]),
    pctMes: num(rs.getRange('C21').getValue()),
    terceiros: num(ap.getRange('D24').getValue()),
    fimFatura: fim instanceof Date ? Utilities.formatDate(fim, tz, 'dd/MM') : '',
    inicioFatura: ini instanceof Date ? Utilities.formatDate(ini, tz, 'dd/MM') : '',
    diasPassados: num(ap.getRange('D13').getValue()),
    categorias: categorias,
    semanas: semanas,
    evolucao: evolucao,
    recentes: recentes,
    parcelamentos: par.parcelamentos,
    comprometido: par.comprometido,
    caixa: caixa_(),
    listaCategorias: mt.getRange('A11:A23').getValues().flat(),
    pessoas: PESSOAS,
    desfazerLinha: Number(PropertiesService.getUserProperties().getProperty('ULTIMA_LINHA')) || 0
  };
}

/** Série de data (Sheets) de y/m/d + i meses, sem depender de fuso. Dia 31 vira o último dia do mês. */
function serieMais_(y, m0, d, i) {
  const alvo = new Date(Date.UTC(y, m0 + i, 1));
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  const t = Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth(), Math.min(d, ultimoDia));
  return Math.round((t - Date.UTC(1899, 11, 30)) / 86400000);
}

/**
 * Grava o gasto na primeira linha vazia da aba Lançamentos.
 * p.parcelas (1 a 60) e p.modo ('total' divide o valor; 'parcela' repete o valor em cada parcela).
 * Parcelado: uma linha por parcela, "Descrição - Parcela k/N", uma data por mês.
 */
function addExpense(p) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const s = ss_();
    const lc = s.getSheetByName('Lançamentos');
    const mt = s.getSheetByName('Metas');
    const valor = Number(p.valor);
    if (!isFinite(valor) || valor === 0) throw new Error('Informe um valor diferente de zero.');
    const categorias = mt.getRange('A11:A23').getValues().flat();
    if (categorias.indexOf(p.categoria) < 0) throw new Error('Escolha uma categoria.');
    const quem = PESSOAS.indexOf(p.quem) >= 0 ? p.quem : 'Eu';
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(p.data || '');
    if (!m) throw new Error('Data inválida.');
    let n = Math.round(Number(p.parcelas) || 1);
    n = Math.max(1, Math.min(60, n));
    if (n > 1 && valor < 0) throw new Error('Estorno não pode ser parcelado.');

    // valores por parcela, em centavos (a diferença de centavos fica na 1ª parcela, como no Nubank)
    let cents;
    if (n === 1) {
      cents = [Math.round(valor * 100)];
    } else if (p.modo === 'parcela') {
      cents = Array(n).fill(Math.round(valor * 100));
    } else {
      const total = Math.round(valor * 100);
      const base = Math.floor(total / n);
      cents = Array(n).fill(base);
      cents[0] += total - base * n;
    }

    const colA = lc.getRange(2, 1, LAST_ROW - 1, 1).getValues();
    let ultimo = -1;
    for (let i = colA.length - 1; i >= 0; i--) {
      if (colA[i][0] !== '') { ultimo = i; break; }
    }
    const linha = ultimo + 3;
    if (linha + n - 1 > LAST_ROW) throw new Error('A aba Lançamentos chegou na linha ' + LAST_ROW + '. Estenda as fórmulas.');

    let descricao = String(p.descricao || '').trim() || p.categoria;
    if (descricao.charAt(0) === '=') descricao = "'" + descricao;
    if (descricao.length > 180) descricao = descricao.slice(0, 180);

    const linhas = [];
    for (let i = 0; i < n; i++) {
      linhas.push([
        serieMais_(+m[1], +m[2] - 1, +m[3], i),
        n > 1 ? descricao + ' - Parcela ' + (i + 1) + '/' + n : descricao,
        cents[i] / 100,
        p.categoria,
        quem
      ]);
    }
    lc.getRange(linha, 1, n, 5).setValues(linhas);
    lc.getRange(linha, 1, n, 1).setNumberFormat('dd/mm/yy');
    lc.getRange(linha, 3, n, 1).setNumberFormat('#,##0.00;[Red]-#,##0.00');
    SpreadsheetApp.flush();
    const props = PropertiesService.getUserProperties();
    props.setProperty('ULTIMA_LINHA', String(linha));
    props.setProperty('ULTIMA_QTD', String(n));
    props.deleteProperty('ULTIMA_CAIXA');
    return getData();
  } finally {
    lock.releaseLock();
  }
}

/** Desfaz o último gasto lançado por esta telinha (todas as parcelas dele). */
function deleteLast() {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const props = PropertiesService.getUserProperties();
    const lcx = Number(props.getProperty('ULTIMA_CAIXA'));
    if (lcx) {
      caixaSheet_().getRange(lcx, 1, 1, 4).clearContent();
      props.deleteProperty('ULTIMA_CAIXA');
      SpreadsheetApp.flush();
      return getData();
    }
    const linha = Number(props.getProperty('ULTIMA_LINHA'));
    const qtd = Number(props.getProperty('ULTIMA_QTD')) || 1;
    if (!linha) throw new Error('Não há nada para desfazer.');
    ss_().getSheetByName('Lançamentos').getRange(linha, 1, qtd, 5).clearContent();
    props.deleteProperty('ULTIMA_LINHA');
    props.deleteProperty('ULTIMA_QTD');
    SpreadsheetApp.flush();
    return getData();
  } finally {
    lock.releaseLock();
  }
}
