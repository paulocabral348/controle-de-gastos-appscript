/** Pix/dinheiro e dinheiro guardado. A aba "Caixa" é criada sozinha na primeira vez. */
function caixaSheet_() {
  const s = ss_();
  let sh = s.getSheetByName('Caixa');
  if (!sh) {
    sh = s.insertSheet('Caixa');
    sh.getRange(1, 1, 1, 4).setValues([['Data', 'Descrição', 'Valor (R$)', 'Tipo']]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange('A2:A').setNumberFormat('dd/mm/yy');
    sh.getRange('C2:C').setNumberFormat('#,##0.00');
    sh.setColumnWidth(2, 220);
  }
  return sh;
}
function mesAnt_(k) { return k % 100 === 1 ? (Math.floor(k / 100) - 1) * 100 + 12 : k - 1; }

/** Resumo do mês corrente (calendário): Pix gasto, guardado, total e sequência de meses na meta. */
function caixa_() {
  const s = ss_(), tz = s.getSpreadsheetTimeZone(), mt = s.getSheetByName('Metas');
  const sh = caixaSheet_();
  const n = Math.max(0, sh.getLastRow() - 1);
  const v = n ? sh.getRange(2, 1, n, 4).getValues() : [];
  const chave = (d) => Number(Utilities.formatDate(d, tz, 'yyyyMM'));
  const hoje = chave(new Date());
  const por = {};
  let total = 0, pixMes = 0;
  v.forEach((r) => {
    if (!(r[0] instanceof Date)) return;
    const val = num_(r[2]), k = chave(r[0]);
    if (r[3] === 'Guardei') { por[k] = (por[k] || 0) + val; total += val; }
    else if (k === hoje) pixMes += val;
  });
  const metaG = num_(mt.getRange('B5').getValue());
  let k = hoje;
  if ((por[k] || 0) < metaG) k = mesAnt_(k);      // mês corrente ainda aberto não quebra a sequência
  let seq = 0;
  while (metaG > 0 && (por[k] || 0) >= metaG && seq < 60) { seq++; k = mesAnt_(k); }
  const recentes = [];
  for (let i = v.length - 1; i >= 0 && recentes.length < 8; i--) {
    if (!(v[i][0] instanceof Date)) continue;
    recentes.push({ data: Utilities.formatDate(v[i][0], tz, 'dd/MM'), descricao: String(v[i][1]), valor: num_(v[i][2]), tipo: String(v[i][3]) });
  }
  return {
    pixMes: pixMes, pixMeta: num_(mt.getRange('B9').getValue()),
    guardadoMes: por[hoje] || 0, guardaMeta: metaG, guardadoTotal: total, sequencia: seq, recentes: recentes
  };
}

/** p: { valor, descricao, tipo: 'Pix' | 'Guardei', data: 'yyyy-mm-dd' } */
function addCaixa(p) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const valor = Number(p.valor);
    if (!isFinite(valor) || valor <= 0) throw new Error('Informe um valor maior que zero.');
    const tipo = p.tipo === 'Guardei' ? 'Guardei' : 'Pix';
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(p.data || '');
    if (!m) throw new Error('Data inválida.');
    let desc = String(p.descricao || '').trim() || (tipo === 'Guardei' ? 'Guardado' : 'Pix/dinheiro');
    if (desc.charAt(0) === '=') desc = "'" + desc;
    const sh = caixaSheet_();
    const linha = sh.getLastRow() + 1;
    sh.getRange(linha, 1, 1, 4).setValues([[serieMais_(+m[1], +m[2] - 1, +m[3], 0), desc.slice(0, 180), Math.round(valor * 100) / 100, tipo]]);
    sh.getRange(linha, 1).setNumberFormat('dd/mm/yy');
    sh.getRange(linha, 3).setNumberFormat('#,##0.00');
    SpreadsheetApp.flush();
    const props = PropertiesService.getUserProperties();
    props.setProperty('ULTIMA_CAIXA', String(linha));
    props.deleteProperty('ULTIMA_LINHA');
    props.deleteProperty('ULTIMA_QTD');
    return getData();
  } finally {
    lock.releaseLock();
  }
}
