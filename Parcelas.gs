/**
 * Insere o parcelamento no Index.html em tempo de execução.
 * O Index.html NÃO precisa ser editado. Se algum trecho não for encontrado,
 * ele é ignorado e aparece em Execuções > Registros.
 */
function aplicarParcelas_(html) {
  const P = [];
  const troca = (achar, por) => P.push([achar, por]);

  // 1. CSS
  troca('.go { position: relative;', `.inst { display: flex; flex-wrap: wrap; gap: 8px; }
  .inst button { padding: 9px 14px; border: 1.5px solid var(--line); border-radius: 999px; background: var(--card); font-weight: 500; }
  .inst button[aria-pressed="true"] { background: var(--navy-900); border-color: var(--navy-900); color: #fff; font-weight: 800; }
  @media (prefers-color-scheme: dark) { .inst button[aria-pressed="true"] { background: var(--blue); border-color: var(--blue); } }
  .inst-extra { display: none; margin-top: 10px; }
  .inst-extra.on { display: block; }
  .who[hidden] { display: none; }
  .go { position: relative;`);

  // 2. Formulário
  troca('<div class="chips" id="chips" role="group" aria-label="Categoria"></div>', `<div class="chips" id="chips" role="group" aria-label="Categoria"></div>
      <p class="label" id="lblParc">Parcelas</p>
      <div class="inst" id="inst" role="group" aria-label="Parcelas"></div>
      <div class="inst-extra" id="instExtra"><input class="field" id="instN" type="number" inputmode="numeric" min="2" max="60" placeholder="Quantas parcelas?" aria-label="Número de parcelas"></div>
      <div class="who" id="modo" hidden>
        <button type="button" data-m="total" aria-pressed="true">Valor total</button>
        <button type="button" data-m="parcela" aria-pressed="false">Valor da parcela</button>
      </div>`);

  // 3. Aba Resumo
  troca('<div id="weeks"></div>', `<div id="weeks"></div>
    <h2>Parcelas</h2>
    <p class="hint">Compras parceladas que ainda têm parcelas a pagar.</p>
    <div id="parcList"></div>
    <h2>Já comprometido nas próximas faturas</h2>
    <p class="hint">Só parcelas suas (sem pai e irmã).</p>
    <div id="comprom"></div>`);

  // 4. Estado e funções
  troca("var shown = { big: 0, meta: 0, rest: 0, dias: 0 };", `var shown = { big: 0, meta: 0, rest: 0, dias: 0 };
  var parc = 1, modoValor = 'total';
  function nParc() { var n = parc === 0 ? parseInt($('#instN').value, 10) : parc; return (isFinite(n) && n >= 1) ? Math.min(60, n) : 1; }
  function syncModo() { $('#modo').hidden = nParc() < 2; }
  function pickParc(n) {
    parc = n;
    $$('#inst button').forEach(function (x) { x.setAttribute('aria-pressed', String(+x.dataset.n === n)); });
    $('#instExtra').classList.toggle('on', n === 0);
    syncModo(); previewValor();
  }
  function buildParc() {
    var box = $('#inst');
    if (box.children.length) return;
    [[1, 'À vista'], [2, '2x'], [3, '3x'], [4, '4x'], [6, '6x'], [10, '10x'], [12, '12x'], [0, 'Outro']].forEach(function (o) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = o[1]; b.dataset.n = o[0]; b.setAttribute('aria-pressed', o[0] === 1 ? 'true' : 'false');
      b.addEventListener('click', function () { buzz(8); pickParc(o[0]); });
      box.appendChild(b);
    });
    $$('#modo button').forEach(function (b) {
      b.addEventListener('click', function () {
        modoValor = b.dataset.m; buzz(8);
        $$('#modo button').forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.m === modoValor ? 'true' : 'false'); });
        previewValor();
      });
    });
  }
  function renderParcelas(d) {
    var ps = d.parcelamentos || [], cm = d.comprometido || [], mx = 1;
    $('#parcList').innerHTML = ps.length ? ps.map(function (x) {
      var pc = x.n ? Math.round(x.k / x.n * 100) : 0;
      return '<div class="row"><div class="row-head"><b>' + esc(x.nome) + (x.quem !== 'Eu' ? '<span class="tag">' + esc(x.quem) + '</span>' : '') + '</b><span class="num">' + BRL.format(x.valor) + '</span></div>' +
        '<div class="row-head" style="margin-top:4px"><span>Parcela ' + x.k + ' de ' + x.n + (x.restam > 0 ? ' · restam ' + BRL0.format(x.restanteTotal) + ' até ' + esc(x.ultima) : ' · última parcela') + '</span></div>' +
        '<div class="bar"><div class="v" style="width:' + pc + '%"></div></div></div>';
    }).join('') : '<p class="empty">Nenhuma parcela em aberto.</p>';
    cm.forEach(function (c) { mx = Math.max(mx, c.total); });
    $('#comprom').innerHTML = cm.length ? cm.map(function (c) {
      return '<div class="row"><div class="row-head"><b>' + esc(c.mes) + '</b><span class="num">' + BRL0.format(c.total) + '</span></div>' +
        '<div class="bar"><div class="v" style="width:' + (c.total / mx * 100) + '%"></div></div></div>';
    }).join('') : '<p class="empty">Nada comprometido nas próximas faturas.</p>';
  }`);

  // 5. Desenhar parcelas a cada render
  troca('renderResumo(d);', 'renderResumo(d); renderParcelas(d); renderCaixa(d);');

  // 6. Montar botões
  troca("if (!$('#data').value) $('#data').value = today();", "if (!$('#data').value) $('#data').value = today(); buildParc(); buildTipo();");

  // 7. Nova prévia (a antiga vira função sem uso)
  troca('function previewValor() {', `function previewValor() {
    var p = $('#prev'), v = parseValor($('#valor').value), n = nParc();
    if (tipo !== 'cartao') { p.className = 'preview'; p.textContent = ''; return; }
    if (!D || !isFinite(v) || v === 0) { p.textContent = ''; p.className = 'preview'; return; }
    var total = (n > 1 && modoValor === 'parcela') ? v * n : v;
    var par = n > 1 ? total / n : v;
    var pre = n > 1 ? n + 'x de ' + BRL.format(par) + ' (total ' + BRL.format(total) + '). Só a 1ª parcela entra na fatura. ' : '';
    if (!D.meta) { p.className = 'preview'; p.textContent = pre + 'Com este gasto, a fatura vai para ' + BRL0.format(D.gasto + par) + '. Meta não definida.'; return; }
    var novo = D.gasto + par, falta = D.meta - novo, ratio = novo / D.meta;
    var msg = falta < 0 ? 'Com este gasto, a fatura passa da meta em ' + BRL0.format(-falta) + '.'
                        : 'Com este gasto, a fatura vai para ' + BRL0.format(novo) + ' (' + pct(ratio) + ' da meta).';
    p.className = 'preview' + (falta < 0 ? ' bad' : ratio >= 0.7 ? ' warn' : '');
    p.textContent = pre + msg;
  }
  function previewValorAntigo_() {`);

  // 8. Envio
  troca("var cat = chosenCat, sendBtn = $('#go');", "var cat = chosenCat, sendBtn = $('#go'), np = nParc(), md = modoValor;");
  troca("$$('#chips .chip').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });", "$$('#chips .chip').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); pickParc(1); $('#instN').value = '';");
  troca("floatDelta('+' + BRL.format(valor));", "floatDelta('+' + BRL.format(np > 1 && md === 'total' ? valor / np : valor));");
  troca("toast('Lançado: ' + BRL.format(valor) + ' em '", "toast('Lançado: ' + (np > 1 ? np + 'x de ' + BRL.format(md === 'total' ? valor / np : valor) : BRL.format(valor)) + ' em '");
  troca("data: $('#data').value })", "data: $('#data').value, parcelas: np, modo: md })");

  // 9. Campo "Outro"
  troca("$('#hero').addEventListener('pointermove', onTilt);", "$('#instN').addEventListener('input', function () { syncModo(); previewValor(); });\n  $('#hero').addEventListener('pointermove', onTilt);");

  // 10. Pix/dinheiro e Guardei
  troca('<label class="amount">', `<div class="who" id="modoLanc">
        <button type="button" data-t="cartao" aria-pressed="true">Cartão</button>
        <button type="button" data-t="Pix" aria-pressed="false">Pix/Dinheiro</button>
        <button type="button" data-t="Guardei" aria-pressed="false">Guardei</button>
      </div>
      <label class="amount">`);
  troca('<p class="label">Em que foi?</p>', '<p class="label" id="lblCat">Em que foi?</p>');
  troca('<h2>Para onde foi o dinheiro</h2>', '<h2>Pix e guardado</h2>\n    <div id="caixaBox"></div>\n    <h2>Para onde foi o dinheiro</h2>');
  troca('function refreshGo() {', `function refreshGo() { var v = parseValor($('#valor').value); $('#go').disabled = !(isFinite(v) && v !== 0 && (tipo !== 'cartao' || chosenCat)); }
  function refreshGoAntigo_() {`);
  troca("var parc = 1, modoValor = 'total';", `var parc = 1, modoValor = 'total', tipo = 'cartao';
  function rotuloGo() { return tipo === 'Guardei' ? 'Guardei' : 'Lançar gasto'; }
  function setTipo(t) {
    tipo = t;
    $$('#modoLanc button').forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.t === t ? 'true' : 'false'); });
    ['#lblCat', '#chips', '#lblParc', '#inst', '#instExtra', '#modo', '#who'].forEach(function (s) { var el = $(s); if (el) el.style.display = t === 'cartao' ? '' : 'none'; });
    $('#go').textContent = rotuloGo();
    refreshGo(); previewValor();
  }
  function buildTipo() {
    if (buildTipo.ok) return; buildTipo.ok = true;
    $$('#modoLanc button').forEach(function (b) { b.addEventListener('click', function () { buzz(8); setTipo(b.dataset.t); }); });
  }
  function renderCaixa(d) {
    var c = d.caixa; if (!c) return;
    function linha(nome, v, m, red) {
      var w = m > 0 ? Math.min(100, v / m * 100) : 0;
      return '<div class="row"><div class="row-head"><b>' + nome + '</b><span class="num ' + (red && v > m ? 'bad' : '') + '">' + BRL0.format(v) + ' de ' + BRL0.format(m) + '</span></div><div class="bar"><div class="v' + (red && v > m ? ' over' : '') + '" style="width:' + w + '%"></div></div></div>';
    }
    var rec = c.recentes.map(function (x) {
      return '<div class="item"><span class="dt num">' + esc(x.data) + '</span><span class="ds"><b>' + esc(x.descricao) + '</b><small>' + (x.tipo === 'Guardei' ? '🐷 Guardado' : '💸 Pix/dinheiro') + '</small></span><span class="vl num' + (x.tipo === 'Guardei' ? ' neg' : '') + '">' + BRL.format(x.valor) + '</span></div>';
    }).join('');
    $('#caixaBox').innerHTML = linha('Pix e dinheiro neste mês', c.pixMes, c.pixMeta, true) + linha('Guardado neste mês', c.guardadoMes, c.guardaMeta, false) +
      '<p class="streak">Total guardado: <b>' + BRL0.format(c.guardadoTotal) + '</b>. Meses seguidos na meta de guardar: <b>' + c.sequencia + '</b>.</p>' + (rec ? '<div style="margin-top:8px">' + rec + '</div>' : '');
  }`);
  troca("$('#f').addEventListener('submit', function (e) {", `$('#f').addEventListener('submit', function (e) {
    if (tipo === 'cartao') return;
    e.preventDefault(); e.stopImmediatePropagation();
    var valor = parseValor($('#valor').value), t = tipo, b = $('#go');
    if (!isFinite(valor) || valor <= 0) return;
    b.disabled = true; b.textContent = 'Lançando...';
    google.script.run
      .withSuccessHandler(function (d) {
        $('#valor').value = ''; $('#desc').value = ''; b.textContent = rotuloGo(); refreshGo(); render(d);
        toast('Lançado: ' + BRL.format(valor) + (t === 'Guardei' ? ' guardados.' : ' no Pix/dinheiro.'), true, false);
        buzz(18);
      })
      .withFailureHandler(function (err) { b.textContent = rotuloGo(); refreshGo(); toast((err && err.message) || 'Não consegui lançar.', false, true); })
      .addCaixa({ valor: valor, descricao: $('#desc').value, tipo: t, data: $('#data').value });
  });
  $('#f').addEventListener('submit', function (e) {`);

  P.forEach(function (t) {
    if (html.indexOf(t[0]) < 0) { Logger.log('Parcelas: trecho não encontrado: ' + t[0].slice(0, 60)); return; }
    html = html.split(t[0]).join(t[1]);
  });
  return html;
}
