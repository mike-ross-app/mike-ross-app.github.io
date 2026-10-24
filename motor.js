/* Motor do Mike Ross: recebe os números somados pelo Apps Script e calcula tudo que o Painel, o Meu dia e o modo TV mostram.
   Regras de negócio ficam aqui, num lugar só. */
/* Mês fiscal: normalmente do dia 26 ao dia 25, com o nome do mês em que fecha.
   Exceções: meses fiscais que começaram em outro dia (o mês anterior termina na véspera). */
const INICIO_FISCAL = { '2026-09': '2026-08-28' };
const pad2 = (n) => String(n).padStart(2, '0');
const inicioFiscal = (a, m) => INICIO_FISCAL[a + '-' + pad2(m)] || (m === 1 ? (a - 1) + '-12-26' : a + '-' + pad2(m - 1) + '-26');
const proxMes = (a, m) => (m === 12 ? [a + 1, 1] : [a, m + 1]);
const antMes = (a, m) => (m === 1 ? [a - 1, 12] : [a, m - 1]);
const mesFiscalDe = (iso) => {
  const [a, m, d] = iso.split('-').map(Number);
  const f = d >= 26 ? proxMes(a, m) : [a, m];
  const p = proxMes(...f);
  if (iso >= inicioFiscal(...p)) return p;
  if (iso < inicioFiscal(...f)) return antMes(...f);
  return f;
};


/* Serviços: nomes padronizados. TEA é o nome antigo de Juros Empréstimo menor. */
const areaDe = (a) => {
  const s = String(a || '').trim();
  if (!s) return 'Não informado';
  const k = s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (k.startsWith('trabalh')) return 'Trabalhista';
  if (k.startsWith('previd')) return 'Previdenciário';
  if (k === 'tea' || (k.startsWith('juros') && (k.includes('emprest') || k.includes('tea')))) return 'Juros Empréstimo menor';
  if (k.startsWith('juros') && k.includes('rmc')) return 'Juros RMC';
  if (k.startsWith('juros') || k.startsWith('banc')) return 'Juros';
  if (k.startsWith('civ')) return 'Civil';
  if (k.startsWith('consum')) return 'Consumidor';
  if (k.startsWith('nao inform')) return 'Não informado';
  return s;
};

/* Time de vendas. Ganhos no nome do Daniel são clientes fechados pela Julia, a IA. Quem não é do time entra em "Outros". */
const VENDEDORES = ['Lucas Wilker', 'Wilton Araújo', 'Gustavo Campos', 'Julia IA'];
const APELIDO = { 'Daniel Figueiredo': 'Julia IA' };
const vendedorDe = (v) => { const n = APELIDO[String(v || '').trim()] || String(v || '').trim(); return VENDEDORES.includes(n) ? n : 'Outros'; };

/* Serviço que começou no meio do mês: as semanas antes do início não têm meta. */
const INICIO_SERVICO = { 'Juros Empréstimo menor': '2026-10-05' };

const calcCalendario = (ganhos) => {
  // Mês fiscal: dia 26 ao dia 25, com o nome do mês em que fecha. Semanas de segunda a domingo.
  // Dias úteis: segunda a sexta, sem feriados nacionais (fixos + Sexta-feira Santa). "Hoje" é a data de quem abre o painel.
  const DIA = 864e5;
  const dia = (a, m, d) => Date.UTC(a, m - 1, d) / DIA;
  const iso = (n) => new Date(n * DIA).toISOString().slice(0, 10);
  const semana = (n) => new Date(n * DIA).getUTCDay();
  const fer = {};
  const feriado = (n) => {
    const a = new Date(n * DIA).getUTCFullYear();
    if (!fer[a]) {
      const f = new Set(['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'].map((x) => a + '-' + x));
      const c = a % 19, b = Math.floor(a / 100), d = a % 100, e = Math.floor(b / 4), g = b % 4, h = Math.floor((b + 8) / 25);
      const i = Math.floor((b - h + 1) / 3), j = (19 * c + b - e - i + 15) % 30, k = Math.floor(d / 4), l = d % 4;
      const m = (32 + 2 * g + 2 * k - j - l) % 7, q = Math.floor((c + 11 * j + 22 * m) / 451);
      const pascoa = dia(a, Math.floor((j + m - 7 * q + 114) / 31), ((j + m - 7 * q + 114) % 31) + 1);
      f.add(iso(pascoa - 2));
      fer[a] = f;
    }
    return fer[a].has(iso(n));
  };
  const uteis = (a, b) => { let n = 0; for (let x = a; x <= b; x++) { const w = semana(x); if (w > 0 && w < 6 && !feriado(x)) n++; } return n; };
  globalThis.uteisEntre = (a, b) => { const [x, y] = [a, b].map((t) => { const [p, q, r] = t.split('-').map(Number); return dia(p, q, r); }); return uteis(x, y); };
  const fiscal = (a, m, d) => mesFiscalDe(a + '-' + pad2(m) + '-' + pad2(d));
  const deIso = (x) => { const [a, m, d] = x.split('-').map(Number); return dia(a, m, d); };
  const NOMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  const agora = new Date();
  const hoje = dia(agora.getFullYear(), agora.getMonth() + 1, agora.getDate());
  const [anoAtual, mesAtual] = fiscal(agora.getFullYear(), agora.getMonth() + 1, agora.getDate());
  // primeiro mês fiscal deste ano com ganho registrado
  let primeiro = mesAtual;
  for (const r of ganhos) {
    const [a, m, d] = r.data_ganho.split('-').map(Number);
    const [fa, fm] = fiscal(a, m, d);
    if (fa === anoAtual && fm < primeiro) primeiro = fm;
  }
  const rows = [];
  for (let mes = primeiro; mes <= mesAtual; mes++) {
    const ini = deIso(inicioFiscal(anoAtual, mes)), fim = deIso(inicioFiscal(...proxMes(anoAtual, mes))) - 1;
    const sem = [];
    let comeco = ini;
    for (let x = ini; x <= fim; x++) {
      if (semana(x) === 0 || x === fim) { sem.push({ ini: comeco, fim: x }); comeco = x + 1; }
    }
    if (sem.length > 1 && (semana(sem[0].ini) === 6 || semana(sem[0].ini) === 0)) { sem[1].ini = sem[0].ini; sem.shift(); }
    const ult = sem[sem.length - 1];
    if (sem.length > 1 && ult.ini === ult.fim) { sem[sem.length - 2].fim = ult.fim; sem.pop(); }
    const total = sem.reduce((s, x) => s + uteis(x.ini, x.fim), 0);
    const dentro = hoje >= ini && hoje <= fim, passado = hoje > fim;
    const atual = dentro ? sem.findIndex((x) => hoje >= x.ini && hoje <= x.fim) + 1 : 0;
    const passados = dentro ? uteis(ini, hoje - 1) : passado ? total : 0;
    const restantes = dentro ? uteis(hoje, fim) : passado ? 0 : total;
    const chaveMes = anoAtual + '-' + String(mes).padStart(2, '0');
    sem.forEach((x, k) => rows.push({
      chave: chaveMes + '|' + (k + 1),
      mes: chaveMes,
      nome_mes: NOMES[mes - 1] + ' de ' + anoAtual,
      ini: iso(ini),
      fim: iso(fim),
      semana: k + 1,
      semanas: sem.length,
      semana_ini: iso(x.ini),
      semana_fim: iso(x.fim),
      uteis_semana: uteis(x.ini, x.fim),
      uteis_mes: total,
      uteis_passados: passados,
      uteis_restantes: restantes,
      fracao_mes: total ? passados / total : 0,
      semana_atual: atual,
      situacao: dentro ? 'em andamento' : passado ? 'encerrado' : 'futuro',
    }));
  }
  return rows;
};

const calcPorArea = (ganhos, metas, calendario) => {
  // Feito e meta por mês fiscal, vendedor e área do direito ("Equipe toda" soma todos; área "Total" soma as áreas).
  // Metas do funil Simeão, pelo mês em que o período fecha. Meta da semana = meta do mês × dias úteis da semana ÷ dias úteis do mês, arredondada pra cima.
  const EQUIPE = 'Equipe toda', FUNIL = 'Simeão';
  const ORDEM = ['Trabalhista', 'Previdenciário', 'Juros Empréstimo menor', 'Juros RMC', 'Juros', 'Civil', 'Consumidor', 'Não informado'];
  const area = areaDe;
  const meses = {};
  for (const c of calendario) (meses[c.mes] = meses[c.mes] || []).push(c);
  const rows = [];
  for (const [mes, sem] of Object.entries(meses)) {
    const c0 = sem[0], num = Number(mes.slice(5));
    const grupos = {};
    const pegar = (v, a) => {
      const k = v + '|' + a;
      return (grupos[k] = grupos[k] || { vendedor: v, area: a, s: sem.map(() => 0), feito: 0, meta: 0, valor: 0 });
    };
    for (const g of ganhos) {
      if (g.data_ganho < c0.ini || g.data_ganho > c0.fim) continue;
      let k = sem.findIndex((x) => g.data_ganho <= x.semana_fim);
      if (k < 0) k = sem.length - 1;
      const a = area(g.area), v = g.vendedor || 'Sem vendedor';
      for (const grupo of [pegar(v, a), pegar(v, 'Total'), pegar(EQUIPE, a), pegar(EQUIPE, 'Total')]) {
        grupo.s[k] += g.n || 1; grupo.feito += g.n || 1; grupo.valor += g.valor || 0;
      }
    }
    for (const m of metas) {
      if (m.mes !== num || m.funil !== FUNIL) continue;
      const a = area(m.area);
      for (const grupo of [pegar(m.vendedor, a), pegar(m.vendedor, 'Total'), pegar(EQUIPE, a), pegar(EQUIPE, 'Total')]) grupo.meta += m.meta;
    }
    const lista = Object.values(grupos).filter((g) => g.feito || g.meta || g.area === 'Total');
    const pos = (a) => (a === 'Total' ? 999 : ORDEM.indexOf(a) < 0 ? 99 : ORDEM.indexOf(a));
    lista.sort((x, y) => (x.vendedor === EQUIPE ? -1 : 0) - (y.vendedor === EQUIPE ? -1 : 0) || x.vendedor.localeCompare(y.vendedor) || pos(x.area) - pos(y.area));
    for (const g of lista) {
      // peso de cada semana = dias úteis; semanas antes do início do serviço ficam sem meta
      const ini = INICIO_SERVICO[g.area];
      const peso = sem.map((x) => (ini && x.semana_fim < ini ? 0 : x.uteis_semana));
      const pesoMes = peso.reduce((a, b) => a + b, 0) || 1;
      const pesoFora = sem.reduce((a, x, k) => a + (peso[k] ? 0 : x.uteis_semana), 0);
      const fracao = c0.situacao === 'encerrado' ? 1 : c0.situacao === 'futuro' ? 0 : Math.max(0, c0.uteis_passados - pesoFora) / pesoMes;
      const esperado = g.meta ? Math.round(g.meta * fracao) : null;
      const falta = Math.max(0, g.meta - g.feito);
      const linha = {
        chave: mes + '|' + g.vendedor + '|' + g.area,
        mes,
        vendedor: g.vendedor,
        area: g.area,
        feito: g.feito,
        meta: g.meta || null,
        atingido_pct: g.meta ? Math.round((g.feito / g.meta) * 100) : null,
        esperado_hoje: esperado,
        ritmo: g.meta ? g.feito - esperado : null,
        atras: g.meta ? Math.max(0, esperado - g.feito) : null,
        falta: g.meta ? falta : null,
        por_dia_util: g.meta ? Math.round((c0.uteis_restantes > 0 ? falta / c0.uteis_restantes : falta) * 10) / 10 : null,
        valor: g.valor,
      };
      for (let k = 0; k < 5; k++) {
        linha['s' + (k + 1)] = k < sem.length ? g.s[k] : null;
        linha['meta_s' + (k + 1)] = k < sem.length && g.meta ? Math.ceil((g.meta * peso[k]) / pesoMes) : null;
      }
      // Da semana atual em diante: meta recalculada pelo que falta (feito até a semana anterior), dividido pelos dias úteis das semanas que restam.
      if (c0.situacao === 'em andamento' && g.meta) {
        const at = c0.semana_atual - 1;
        if (at >= 0 && at < sem.length) {
          let antes = 0; for (let k = 0; k < at; k++) antes += g.s[k] || 0;
          const restaMes = Math.max(0, g.meta - antes);
          let uteisResta = 0; for (let k = at; k < sem.length; k++) uteisResta += peso[k];
          for (let k = at; k < sem.length; k++) {
            linha['plano_s' + (k + 1)] = linha['meta_s' + (k + 1)];
            linha['meta_s' + (k + 1)] = uteisResta ? Math.ceil((restaMes * peso[k]) / uteisResta) : (k === at ? restaMes : 0);
          }
        }
      }
      rows.push(linha);
    }
  }
  // "todos": soma de todos os meses fiscais do calendário
  const soma = {};
  for (const r of rows) {
    const k = r.vendedor + '|' + r.area;
    const t = (soma[k] = soma[k] || { vendedor: r.vendedor, area: r.area, feito: 0, meta: 0, valor: 0 });
    t.feito += r.feito; t.meta += r.meta || 0; t.valor += r.valor;
  }
  for (const t of Object.values(soma)) {
    const linha = { chave: 'todos|' + t.vendedor + '|' + t.area, mes: 'todos', vendedor: t.vendedor, area: t.area, feito: t.feito, meta: t.meta || null,
      atingido_pct: t.meta ? Math.round((t.feito / t.meta) * 100) : null, esperado_hoje: null, ritmo: null, atras: null, falta: null, por_dia_util: null, valor: t.valor };
    for (let k = 1; k <= 5; k++) { linha['s' + k] = null; linha['meta_s' + k] = null; }
    rows.push(linha);
  }
  return rows;
};

const calcConversao = (leads, por_area, calendario) => {
  // Taxa de conversão = ganhos no mês fiscal ÷ leads que entraram (foram criados) no Funil de Vendas no mesmo mês fiscal.
  // Por vendedor e área; "Equipe toda" soma todos os leads, inclusive os sem vendedor. Mês "todos" soma todos os meses fiscais.
  const EQUIPE = 'Equipe toda';
  const area = areaDe;
  const periodos = {};
  for (const c of calendario) periodos[c.mes] = { ini: c.ini, fim: c.fim };
  const entraram = {};
  for (const l of leads) {
    const mes = Object.keys(periodos).find((m) => l.data_criacao >= periodos[m].ini && l.data_criacao <= periodos[m].fim);
    if (!mes) continue;
    const v = l.vendedor || 'Não informado', a = area(l.area);
    for (const m of [mes, 'todos']) {
      for (const k of [m + '|' + v + '|' + a, m + '|' + v + '|Total', m + '|' + EQUIPE + '|' + a, m + '|' + EQUIPE + '|Total']) entraram[k] = (entraram[k] || 0) + (l.n || 1);
    }
  }
  const chaves = new Set([...por_area.map((r) => r.chave), ...Object.keys(entraram)]);
  const ganhos = Object.fromEntries(por_area.map((r) => [r.chave, r.feito]));
  return [...chaves].map((chave) => {
    const [mes, vendedor, a] = chave.split('|');
    const n = entraram[chave] || 0, g = ganhos[chave] || 0;
    return { chave, mes, vendedor, area: a, leads_entraram: n, ganhos: g, conversao_pct: n ? Math.round((g / n) * 1000) / 10 : null };
  });
};

const calcDiario = (ganhos, leads, calendario) => {
  // Ganhos (pela data do ganho) e leads que entraram (pela data de criação) por dia, vendedor e área, dentro dos meses fiscais do calendário.
  const EQUIPE = 'Equipe toda';
  const area = areaDe;
  const ini = calendario.reduce((m, c) => (c.ini < m ? c.ini : m), '9999'), fim = calendario.reduce((m, c) => (c.fim > m ? c.fim : m), '0000');
  const t = {};
  const somar = (dia, v, a, campo, n) => {
    for (const [vv, aa] of [[v, a], [v, 'Total'], [EQUIPE, a], [EQUIPE, 'Total']]) {
      const k = dia + '|' + vv + '|' + aa;
      (t[k] = t[k] || { chave: k, dia, vendedor: vv, area: aa, ganhos: 0, leads: 0 })[campo] += n;
    }
  };
  for (const g of ganhos) if (g.data_ganho >= ini && g.data_ganho <= fim) somar(g.data_ganho, g.vendedor || 'Sem vendedor', area(g.area), 'ganhos', g.n || 1);
  for (const l of leads) if (l.data_criacao >= ini && l.data_criacao <= fim) somar(l.data_criacao, l.vendedor || 'Não informado', area(l.area), 'leads', l.n || 1);
  return Object.values(t);
};

const calcRecordes = (ganhos) => {
  // Recordes de ganhos da equipe toda: melhor dia, melhor semana (segunda a domingo) e melhor mês fiscal (26 ao 25, salvo exceções).
  // "recorde_anterior" ignora o período de hoje, então "bateu" diz se o período atual já passou o melhor que existia antes dele.
  const iso = (d) => d.toISOString().slice(0, 10);
  const agora = new Date();
  const hoje = iso(new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate())));
  const semanaDe = (dia) => { const d = new Date(dia + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return iso(d); };
  const mesDe = (dia) => { const [a, m] = mesFiscalDe(dia); return a + '-' + pad2(m); };
  const tipos = { dia: (x) => x, semana: semanaDe, mes: mesDe };
  return Object.entries(tipos).map(([tipo, chaveDe]) => {
    const cont = {};
    for (const g of ganhos) { const k = chaveDe(g.data_ganho); cont[k] = (cont[k] || 0) + (g.n || 1); }
    const atualPeriodo = chaveDe(hoje), atual = cont[atualPeriodo] || 0;
    let rec = null, ant = null;
    for (const [k, n] of Object.entries(cont)) {
      if (!rec || n > rec[1] || (n === rec[1] && k < rec[0])) rec = [k, n];
      if (k !== atualPeriodo && k < atualPeriodo && (!ant || n > ant[1] || (n === ant[1] && k < ant[0]))) ant = [k, n];
    }
    return {
      tipo,
      periodo_atual: atualPeriodo,
      atual,
      recorde: rec ? rec[1] : 0,
      recorde_periodo: rec ? rec[0] : null,
      recorde_anterior: ant ? ant[1] : 0,
      recorde_anterior_periodo: ant ? ant[0] : null,
      bateu: atual > 0 && (!ant || atual > ant[1]),
    };
  });
};

const montarPainel = (bruto) => {
  // "Juros" sem subserviço: até setembro/2026 só existia RMC; de outubro em diante é Empréstimo menor (antigo TEA).
  const INICIO_EMPRESTIMO = '2026-09-26';
  const jurosPorData = (a, dia) => { const n = areaDe(a); return n === 'Juros' ? (dia < INICIO_EMPRESTIMO ? 'Juros RMC' : 'Juros Empréstimo menor') : n; };
  const ganhos = bruto.ganhos.map(([dia, vendedor, area, n, valor]) => ({ data_ganho: dia, vendedor: vendedorDe(vendedor), area: jurosPorData(area, dia), n, valor }));
  const leads = (bruto.leads || []).map(([dia, vendedor, area, n]) => ({ data_criacao: dia, vendedor: vendedorDe(vendedor), area: jurosPorData(area, dia), n }));
  // A partir de outubro/2026, Juros virou dois serviços: a meta de Juros vale 80% pra Empréstimo menor e 20% pra RMC. Antes disso, toda meta de Juros era RMC.
  const DIVISAO_JUROS = [['Juros Empréstimo menor', 0.8], ['Juros RMC', 0.2]];
  const dividirJuros = (mes) => new Date().getFullYear() > 2026 || mes >= 10;
  const metas = [];
  for (const [funil, vendedor, area, mes, meta] of bruto.metas) {
    if (String(area).trim().toLowerCase() === 'juros' && dividirJuros(mes)) {
      const emp = Math.round(meta * DIVISAO_JUROS[0][1]);
      metas.push({ funil, vendedor: vendedorDe(vendedor), area: DIVISAO_JUROS[0][0], mes, meta: emp }, { funil, vendedor: vendedorDe(vendedor), area: DIVISAO_JUROS[1][0], mes, meta: meta - emp });
    } else if (String(area).trim().toLowerCase() === 'juros') metas.push({ funil, vendedor: vendedorDe(vendedor), area: 'Juros RMC', mes, meta });
    else metas.push({ funil, vendedor: vendedorDe(vendedor), area: areaDe(area), mes, meta });
  }
  const calendario = calcCalendario(ganhos);
  const por_area = calcPorArea(ganhos, metas, calendario);
  const temLeads = bruto.tem_leads !== false && leads.length > 0;
  return {
    calendario, por_area,
    conversao: temLeads ? calcConversao(leads, por_area, calendario) : null,
    diario: calcDiario(ganhos, leads, calendario),
    recordes: calcRecordes(ganhos),
  };
};

/* Endereço do Apps Script "Mike Ross Painel". Ele devolve ganhos, leads e metas somados (sem nome de cliente) e, na rota ?aba=tarefas, as tarefas. */
const MR_API = 'https://script.google.com/macros/s/AKfycbzHT8B1qAj5Jt7NyV0K_hOGanYbPhPbdFFTOuZOcE4vxb5XfGpdINoHDRgKoPO7sg6DeQ/exec';
const hojeIso = () => { const d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
const lerLocal = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
const gravarLocal = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } };

/* Números de um vendedor (ou "Equipe toda") hoje, na semana e no mês fiscal em andamento. */
const resumoDe = (painel, vend) => {
  const cal = painel.calendario.filter((c) => c.situacao === 'em andamento');
  if (!cal.length) return null;
  const c0 = cal[0], mes = c0.mes, hoje = hojeIso();
  const at = Math.max(0, c0.semana_atual - 1), sem = cal[at] || cal[cal.length - 1];
  const linha = (a) => painel.por_area.find((r) => r.mes === mes && r.vendedor === vend && r.area === a);
  const T = linha('Total') || { feito: 0, meta: null, valor: 0 };
  const feitoHoje = painel.diario.filter((d) => d.dia === hoje && d.vendedor === vend && d.area === 'Total').reduce((s, d) => s + d.ganhos, 0);
  const metaSem = T['meta_s' + (at + 1)] || null, feitoSem = T['s' + (at + 1)] || 0;
  const util = uteisEntre(hoje, hoje) === 1, restSem = uteisEntre(hoje, sem.semana_fim);
  const metaHoje = metaSem && util ? Math.ceil(Math.max(0, metaSem - (feitoSem - feitoHoje)) / Math.max(1, restSem)) : null;
  const servicos = painel.por_area.filter((r) => r.mes === mes && r.vendedor === vend && r.area !== 'Total' && (r.feito || r.meta));
  return { c0, sem, at, mes, hoje, util, feitoHoje, metaHoje, feitoSem, metaSem, restSem, T, servicos };
};
