(() => {
  'use strict';

  const model = window.PizzaDashboardModel;
  const form = document.getElementById('dashboard-filter-form');
  const shell = document.getElementById('dashboard-shell');
  const loading = document.getElementById('dashboard-loading');
  if (!form || !shell || !loading) return;

  const byId = id => document.getElementById(id);
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const money = value => new Intl.NumberFormat('en-US', {style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format((Number(value) || 0) / 100);
  const integer = value => new Intl.NumberFormat('en-US', {maximumFractionDigits:0}).format(Number(value) || 0);
  const compactMoney = value => new Intl.NumberFormat('en-US', {style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1}).format((Number(value) || 0) / 100);
  const percentage = value => `${((Number(value) || 0) * 100).toFixed(1)}%`;
  const hourLabel = hour => `${String(hour).padStart(2,'0')}:00`;
  const dateLabel = value => {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-GB', {day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(date) : value;
  };
  const groupDefinitions = [
    {key:'cities',label:'City',plural:'cities',columns:2},
    {key:'segments',label:'Customer segment',plural:'customer segments'},
    {key:'categories',label:'Pizza category',plural:'pizza categories'},
    {key:'revenueBands',label:'Revenue band',plural:'revenue bands',help:'Per order line: Low < $20; Moderate $20–$60; High > $60.'}
  ];
  const palette = ['#d5f66b','#91b669','#67a5a0','#c3a0cc','#f0bf74'];
  const questions = ['overview','trend','products','operations','customers'];
  const storageKey = 'portfolio-pizza-dashboard-view-v1';
  let data;
  let options;
  let result;
  let pendingFrame = 0;
  let announcementTimer = 0;

  function renderFilterGroups() {
    const groups = byId('dashboard-filter-groups');
    groups.className = 'dashboard-filter-groups';
    groups.innerHTML = groupDefinitions.map(group => `<fieldset class="dashboard-filter-group"><legend>${escapeHTML(group.label)}</legend><div class="dashboard-filter-group-heading"><span class="dashboard-filter-count" data-filter-count="${group.key}"></span><div class="dashboard-group-actions"><button type="button" data-group-action="all" data-group="${group.key}" aria-label="Select all ${group.plural}">All</button><button type="button" data-group-action="clear" data-group="${group.key}" aria-label="Clear all ${group.plural}">Clear</button></div></div><div class="dashboard-filter-options" data-filter-options="${group.key}"${group.columns ? ` data-columns="${group.columns}"` : ''}>${options[group.key].map((value,index) => `<label class="dashboard-filter-option" for="filter-${group.key}-${index}"><input type="checkbox" id="filter-${group.key}-${index}" name="${group.key}" value="${escapeHTML(value)}" checked><span>${escapeHTML(value)}</span></label>`).join('')}</div>${group.help ? `<p class="dashboard-filter-help">${escapeHTML(group.help)}</p>` : ''}</fieldset>`).join('');
    [byId('filter-start'),byId('filter-end')].forEach(input => { input.min = options.startDate; input.max = options.endDate; });
    byId('filter-start').value = options.startDate;
    byId('filter-end').value = options.endDate;
  }

  function readFilters() {
    const filters = {startDate:byId('filter-start').value,endDate:byId('filter-end').value};
    for (const group of groupDefinitions) filters[group.key] = Array.from(form.querySelectorAll(`input[name="${group.key}"]:checked`), input => input.value);
    return filters;
  }

  function restoreView() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey));
      if (!saved || typeof saved !== 'object') return;
      for (const group of groupDefinitions) {
        const selection = saved.filters?.[group.key];
        if (!Array.isArray(selection) && selection !== null) continue;
        form.querySelectorAll(`input[name="${group.key}"]`).forEach(input => { input.checked = selection === null || selection.includes(input.value); });
      }
      for (const [key,id] of [['startDate','filter-start'],['endDate','filter-end']]) {
        const value = saved.filters?.[key];
        if (typeof value === 'string' && /^2015-\d{2}-\d{2}$/.test(value) && value >= options.startDate && value <= options.endDate) byId(id).value = value;
      }
      if (questions.includes(saved.question)) byId('dashboard-question').value = saved.question;
    } catch {}
  }

  function storeView(filters) {
    try { sessionStorage.setItem(storageKey, JSON.stringify({filters,question:byId('dashboard-question').value})); } catch {}
  }

  function scopeMarkup(filters) {
    const scope = [`${dateLabel(filters.startDate)} – ${dateLabel(filters.endDate)}`];
    for (const group of groupDefinitions) {
      const selection = filters[group.key];
      if (selection.length === options[group.key].length) scope.push(`All ${group.plural}`);
      else if (!selection.length) scope.push(`No ${group.plural} selected`);
      else scope.push(`${group.label}: ${selection.length <= 2 ? selection.join(', ') : `${selection.length} selected`}`);
      const count = form.querySelector(`[data-filter-count="${group.key}"]`);
      if (count) count.textContent = `${selection.length} of ${options[group.key].length} selected`;
    }
    byId('dashboard-scope').innerHTML = scope.map(text => `<span>${escapeHTML(text)}</span>`).join('');
    return scope.join('. ');
  }

  function validDateRange(filters) {
    const start = byId('filter-start');
    const end = byId('filter-end');
    const valid = start.validity.valid && end.validity.valid && filters.startDate && filters.endDate && filters.startDate <= filters.endDate;
    const error = byId('date-error');
    error.hidden = Boolean(valid);
    error.textContent = valid ? '' : 'Choose a valid date range within 2015, with the start date on or before the end date.';
    [start,end].forEach(input => input.setAttribute('aria-invalid',String(!valid)));
    return Boolean(valid);
  }

  function setMetrics(totals) {
    const metrics = {revenue:money(totals?.revenueCents),orders:integer(totals?.orders),quantity:integer(totals?.quantity),customers:integer(totals?.customers),aov:money(totals?.aovCents)};
    document.querySelectorAll('[data-kpi]').forEach(element => { element.textContent = totals ? metrics[element.dataset.kpi] : '—'; });
  }

  function table(headers, rows, caption, numericColumns = []) {
    return `<table class="dashboard-table"><caption>${escapeHTML(caption)}</caption><thead><tr>${headers.map((heading,index) => `<th scope="col"${numericColumns.includes(index) ? ' class="number"' : ''}>${escapeHTML(heading)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map((value,index) => index === 0 ? `<th scope="row">${escapeHTML(value)}</th>` : `<td${numericColumns.includes(index) ? ' class="number"' : ''}>${escapeHTML(value)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }

  function chartScroll(svg, label) {
    return `<div class="dashboard-chart-scroll" tabindex="0" role="region" aria-label="${escapeHTML(label)}">${svg}</div>`;
  }

  function animateChange(element) {
    if (!element?.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off') return;
    element.animate([{opacity:.8},{opacity:1}], {duration:180,easing:'ease-out'});
  }

  function renderInsight() {
    if (!result) return;
    const question = byId('dashboard-question').value;
    const narrative = model.buildNarrative(data,result,question);
    const list = entries => (entries || []).map(text => `<li>${escapeHTML(text)}</li>`).join('');
    byId('dashboard-insight').innerHTML = `<h3>${escapeHTML(narrative.title)}</h3><p class="dashboard-insight-summary">${escapeHTML(narrative.summary)}</p><div class="dashboard-insight-columns"><div><h4>What the data shows</h4><ul>${list(narrative.observations)}</ul></div><div><h4>What to investigate</h4><ul>${list(narrative.implications)}</ul></div></div>${narrative.limits?.length ? `<details class="dashboard-insight-notes"><summary>Interpretation notes</summary><ul>${list(narrative.limits)}</ul></details>` : ''}`;
    const focusId = {trend:'chart-trend',products:'chart-products',operations:'chart-operations',customers:'chart-customers'}[question];
    document.querySelectorAll('.dashboard-chart-card').forEach(card => card.dataset.questionFocus = String(card.id === focusId));
    animateChange(byId('dashboard-insight'));
  }

  function renderMonthly() {
    const rows = result.monthly || [];
    const width = 820, height = 294, left = 74, right = 25, top = 23, bottom = 48;
    const max = Math.max(1,...rows.map(row => Number(row.revenueCents) || 0));
    const ceiling = Math.ceil(max / (10 ** Math.floor(Math.log10(max)))) * (10 ** Math.floor(Math.log10(max)));
    const plotWidth = width-left-right, plotHeight = height-top-bottom;
    const x = index => rows.length === 1 ? left + plotWidth / 2 : left + index * plotWidth / Math.max(1,rows.length-1);
    const y = value => top + plotHeight * (1 - value / ceiling);
    const peak = rows.reduce((best,row) => row.revenueCents > (best?.revenueCents || -1) ? row : best,null);
    const body = [];
    for (let i=0;i<=4;i++) {
      const value = ceiling*i/4, position = y(value);
      body.push(`<line class="dashboard-chart-grid" x1="${left}" x2="${width-right}" y1="${position}" y2="${position}"/><text class="dashboard-axis" x="${left-12}" y="${position+4}" text-anchor="end">${escapeHTML(compactMoney(value))}</text>`);
    }
    body.push(`<polyline class="dashboard-monthly-line" points="${rows.map((row,index) => `${x(index)},${y(row.revenueCents)}`).join(' ')}"/>`);
    rows.forEach((row,index) => {
      const description = `${row.label}: ${money(row.revenueCents)}, ${integer(row.orders)} matching orders, ${integer(row.quantity)} pizzas`;
      body.push(`<g class="dashboard-point-group" tabindex="0" role="img" aria-label="${escapeHTML(description)}"><title>${escapeHTML(description)}</title><circle class="dashboard-chart-point" cx="${x(index)}" cy="${y(row.revenueCents)}" r="${row === peak ? 5.5 : 4}"/></g><text class="dashboard-axis" x="${x(index)}" y="${height-18}" text-anchor="middle">${escapeHTML(row.label)}</text>`);
    });
    const svg = `<svg class="dashboard-svg dashboard-monthly-svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="monthly-visual-title monthly-visual-desc"><title id="monthly-visual-title">Monthly sales revenue for the current selection</title><desc id="monthly-visual-desc">${escapeHTML(peak ? `${peak.label} has the highest recorded monthly revenue at ${money(peak.revenueCents)}. Exact figures are available in the data table.` : 'No monthly revenue is available.')}</desc>${body.join('')}</svg>`;
    byId('trend-visual').innerHTML = chartScroll(svg,'Monthly revenue chart, scroll horizontally on smaller screens') + '<p class="dashboard-chart-caption">Revenue from matching order lines. Date boundaries can include partial months. Hover or focus a point for its exact figures.</p>';
    byId('trend-context').textContent = peak ? `${peak.label} contributes the highest monthly revenue in this selection: ${money(peak.revenueCents)}.` : 'No monthly revenue matches the selection.';
    byId('trend-table').innerHTML = table(['Month','Revenue','Orders','Pizzas'],rows.map(row => [row.month,money(row.revenueCents),integer(row.orders),integer(row.quantity)]),'Monthly totals for the current filters',[1,2,3]);
  }

  function renderProducts() {
    const products = [...(result.products || [])].sort((a,b) => b.revenueCents-a.revenueCents);
    const maximum = Math.max(1,...products.map(product => product.revenueCents));
    const top = products.slice(0,8);
    byId('products-visual').innerHTML = `<ol class="dashboard-rank-list">${top.map(product => `<li class="dashboard-rank-item" tabindex="0" aria-label="${escapeHTML(`${product.name}: ${money(product.revenueCents)}, ${percentage(product.share)} of selected revenue, ${integer(product.quantity)} pizzas`)}"><div class="dashboard-rank-heading"><span>${escapeHTML(product.name)}</span><strong>${escapeHTML(money(product.revenueCents))}</strong></div><div class="dashboard-bar-track" aria-hidden="true"><div class="dashboard-bar-fill" style="width:${product.revenueCents/maximum*100}%"></div></div><div class="dashboard-rank-note">${escapeHTML(percentage(product.share))} of revenue · ${integer(product.quantity)} pizzas · ${escapeHTML(product.category)}</div></li>`).join('')}</ol><p class="dashboard-chart-caption">${products.length > 8 ? 'The eight leading pizza types are shown. The complete selection is available below.' : 'Pizza types are ranked by revenue from the selected order lines.'}</p>`;
    const first = products[0];
    byId('products-context').textContent = first ? `${first.name} leads this view with ${percentage(first.share)} of matching revenue.` : 'No pizza types match the selection.';
    byId('products-table').innerHTML = table(['Pizza type','Category','Revenue','Share','Pizzas','Orders'],products.map(product => [product.name,product.category,money(product.revenueCents),percentage(product.share),integer(product.quantity),integer(product.orders)]),'All matching pizza types; order counts can overlap between types',[2,3,4,5]);
  }

  function renderOperations() {
    const rows = result.hourly || [];
    const width = 560, height = 287, left = 43, right = 75, top = 25, bottom = 47;
    const plotWidth = width-left-right, plotHeight = height-top-bottom;
    const maxOrders = Math.max(1,...rows.map(row => row.orders));
    const orderCeiling = Math.max(4,Math.ceil(maxOrders/4)*4);
    const maxRevenue = Math.max(1,...rows.map(row => row.revenueCents));
    const revenueCeiling = Math.ceil(maxRevenue / (10 ** Math.floor(Math.log10(maxRevenue)))) * (10 ** Math.floor(Math.log10(maxRevenue)));
    const slot = plotWidth / Math.max(1,rows.length);
    const x = index => left + slot*(index+.5);
    const yOrder = value => top + plotHeight*(1-value/orderCeiling);
    const yRevenue = value => top + plotHeight*(1-value/revenueCeiling);
    const body=[];
    for(let i=0;i<=4;i++) {
      const position=top+plotHeight*(1-i/4);
      body.push(`<line class="dashboard-chart-grid" x1="${left}" x2="${width-right}" y1="${position}" y2="${position}"/><text class="dashboard-axis" x="${left-8}" y="${position+4}" text-anchor="end">${escapeHTML(integer(orderCeiling*i/4))}</text><text class="dashboard-axis" x="${width-right+8}" y="${position+4}">${escapeHTML(compactMoney(revenueCeiling*i/4))}</text>`);
    }
    rows.forEach((row,index) => {
      const description=`${hourLabel(row.hour)}–${String(row.hour).padStart(2,'0')}:59: ${integer(row.orders)} orders and ${money(row.revenueCents)} revenue`;
      body.push(`<g class="dashboard-point-group" tabindex="0" role="img" aria-label="${escapeHTML(description)}"><title>${escapeHTML(description)}</title><rect class="dashboard-hour-bar" x="${x(index)-slot*.29}" y="${yOrder(row.orders)}" width="${slot*.58}" height="${Math.max(0,top+plotHeight-yOrder(row.orders))}"/></g>`);
      if(index%2===0 || rows.length<9) body.push(`<text class="dashboard-axis" x="${x(index)}" y="${height-18}" text-anchor="middle">${String(row.hour).padStart(2,'0')}</text>`);
    });
    body.push(`<polyline class="dashboard-hour-line" points="${rows.map((row,index)=>`${x(index)},${yRevenue(row.revenueCents)}`).join(' ')}"/>`);
    const peak=rows.reduce((best,row)=>row.orders>(best?.orders||-1)?row:best,null);
    const svg=`<svg class="dashboard-svg dashboard-hourly-svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="hourly-visual-title hourly-visual-desc"><title id="hourly-visual-title">Hourly orders and revenue for the current selection</title><desc id="hourly-visual-desc">Bars show order counts on the left axis. The line shows revenue on the right axis. ${escapeHTML(peak ? `${hourLabel(peak.hour)} has the most matching orders: ${integer(peak.orders)}.` : '')} Exact figures are available in the data table.</desc>${body.join('')}</svg>`;
    byId('operations-visual').innerHTML='<div class="dashboard-legend"><span><i style="--swatch:#758d47" aria-hidden="true"></i>Orders · left axis</span><span><i aria-hidden="true"></i>Revenue · right axis</span></div>'+chartScroll(svg,'Hourly orders and revenue chart, scroll horizontally on smaller screens')+'<p class="dashboard-chart-caption">Hour of day · totals across your selected period, not orders per day. Each hour covers :00–:59.</p>';
    byId('operations-context').textContent=peak ? `${hourLabel(peak.hour)}–${String(peak.hour).padStart(2,'0')}:59 is the busiest order window in this view, with ${integer(peak.orders)} matching orders.` : 'No hourly activity matches the selection.';
    byId('operations-table').innerHTML=table(['Hour','Orders','Revenue','Pizzas'],rows.map(row=>[`${hourLabel(row.hour)}–${String(row.hour).padStart(2,'0')}:59`,integer(row.orders),money(row.revenueCents),integer(row.quantity)]),'Recorded activity by order hour within the current filters',[1,2,3]);
    renderHeatmap();
  }

  function heatColour(value,max) {
    const amount=max ? value/max : 0;
    const base=[29,33,28],accent=[213,246,107];
    const rgb=base.map((number,index)=>Math.round(number+(accent[index]-number)*amount));
    const components=rgb.map(number=>number/255).map(number=>number<=.04045?number/12.92:((number+.055)/1.055)**2.4);
    const luminance=components[0]*.2126+components[1]*.7152+components[2]*.0722;
    const white=1.05/(luminance+.05),black=(luminance+.05)/.05;
    return `background:rgb(${rgb.join(',')});color:${white>=black?'#ffffff':'#000000'}`;
  }

  function renderHeatmap() {
    const heatmap=result.heatmap;
    if (!heatmap?.days?.length || !heatmap?.hours?.length) { byId('operations-heatmap').textContent='No weekday and hour data is available.';return; }
    const maximum=Math.max(0,...heatmap.counts.flat());
    byId('operations-heatmap').innerHTML=`<table class="dashboard-table dashboard-heatmap"><caption>Matching orders by weekday and hour. Brighter cells indicate more orders; numbers give exact counts.</caption><thead><tr><th scope="col">Weekday</th>${heatmap.hours.map(hour=>`<th scope="col">${hourLabel(hour)}</th>`).join('')}</tr></thead><tbody>${heatmap.days.map((day,index)=>`<tr><th scope="row">${escapeHTML(day)}</th>${heatmap.counts[index].map((value,hourIndex)=>`<td style="${heatColour(value,maximum)}" title="${escapeHTML(`${day}, ${hourLabel(heatmap.hours[hourIndex])}: ${integer(value)} ${value===1?'order':'orders'}`)}">${integer(value)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }

  function renderCustomers() {
    const customers=[...(result.customers||[])].sort((a,b)=>b.revenueCents-a.revenueCents).slice(0,10);
    const maximum=Math.max(1,...customers.map(customer=>customer.revenueCents));
    byId('customers-visual').innerHTML=`<ol class="dashboard-rank-list dashboard-customer-list">${customers.map(customer=>`<li class="dashboard-rank-item" tabindex="0" aria-label="${escapeHTML(`${customer.label}: ${money(customer.revenueCents)}, ${integer(customer.orders)} orders, ${integer(customer.quantity)} pizzas`)}"><div class="dashboard-rank-heading"><span>${escapeHTML(customer.label)}</span><strong>${escapeHTML(money(customer.revenueCents))}</strong></div><div class="dashboard-bar-track" aria-hidden="true"><div class="dashboard-bar-fill" style="width:${customer.revenueCents/maximum*100}%"></div></div><div class="dashboard-rank-note">${integer(customer.orders)} ${customer.orders===1?'order':'orders'} · ${integer(customer.quantity)} pizzas</div></li>`).join('')}</ol><p class="dashboard-chart-caption">Labels are anonymous and remain consistent across filters. This is historical spending within the selected period, not predicted lifetime value.</p>`;
    const share=customers.reduce((sum,customer)=>sum+customer.revenueCents,0)/Math.max(1,result.totals.revenueCents);
    byId('customers-context').textContent=`The top ${customers.length} ${customers.length===1?'customer accounts':'customers account'} for ${percentage(share)} of the matching revenue.`;
    byId('customers-table').innerHTML=table(['Anonymous customer','Revenue','Orders','Pizzas'],customers.map(customer=>[customer.label,money(customer.revenueCents),integer(customer.orders),integer(customer.quantity)]),'Top matching customers by selected historical spending',[1,2,3]);
  }

  function renderDemographics() {
    const rows=[...(result.demographics||[])].map(row=>({...row,total:row.segments.reduce((sum,segment)=>sum+segment.customers,0)})).sort((a,b)=>b.total-a.total);
    const max=Math.max(1,...rows.map(row=>row.total));
    const segmentNames=[...new Set(rows.flatMap(row=>row.segments.map(segment=>segment.name)))];
    byId('demographics-visual').innerHTML=`<div class="dashboard-legend">${segmentNames.map((name,index)=>`<span><i style="--swatch:${palette[index%palette.length]}" aria-hidden="true"></i>${escapeHTML(name)}</span>`).join('')}</div><ul class="dashboard-demography-list">${rows.map(row=>`<li><div class="dashboard-demography-heading"><span>${escapeHTML(row.city)}</span><strong>${integer(row.total)} ${row.total===1?'customer':'customers'}</strong></div><div class="dashboard-demography-track" style="width:${row.total/max*100}%" aria-label="${escapeHTML(`${row.city}: ${row.segments.map(segment=>`${integer(segment.customers)} ${segment.name}`).join(', ')}`)}">${row.segments.filter(segment=>segment.customers>0).map(segment=>`<span class="dashboard-demography-segment" role="img" tabindex="0" aria-label="${escapeHTML(`${row.city}, ${segment.name}: ${integer(segment.customers)} ${segment.customers===1?'customer':'customers'}`)}" title="${escapeHTML(`${segment.name}: ${integer(segment.customers)}`)}" style="--swatch:${palette[segmentNames.indexOf(segment.name)%palette.length]};width:${segment.customers/Math.max(1,row.total)*100}%"></span>`).join('')}</div></li>`).join('')}</ul><p class="dashboard-chart-caption">Distinct customers with at least one matching order line, grouped by their recorded city and segment.</p>`;
    const top=rows[0];
    byId('demographics-context').textContent=top ? `${top.city} has the largest active customer count in this view: ${integer(top.total)}.` : 'No customer demographics match the selection.';
    byId('demographics-table').innerHTML=table(['City',...segmentNames,'Total customers'],rows.map(row=>[row.city,...segmentNames.map(name=>integer(row.segments.find(segment=>segment.name===name)?.customers||0)),integer(row.total)]),'Distinct matching customers by city and recorded customer segment',segmentNames.map((_,index)=>index+1).concat(segmentNames.length+1));
  }

  function showInvalidView() {
    result=null;
    setMetrics(null);
    byId('dashboard-charts').hidden=true;
    byId('dashboard-empty').hidden=true;
    byId('dashboard-result-count').textContent='Date range needs attention';
    byId('dashboard-insight').innerHTML='<h3>Choose a valid trading period.</h3><p class="dashboard-insight-summary">Set the start date on or before the end date, within the available 2015 records. The charts will update when the range is valid.</p>';
  }

  function updateView(announce = true) {
    pendingFrame=0;
    clearTimeout(announcementTimer);
    const filters=readFilters();
    const scope=scopeMarkup(filters);
    if (!validDateRange(filters)) { showInvalidView(); return; }
    try {
      result=model.filterAndAggregate(data,filters);
      setMetrics(result.totals);
      byId('dashboard-result-count').textContent=`${integer(result.totals.orders)} matching ${result.totals.orders===1?'order':'orders'}`;
      byId('dashboard-charts').hidden=result.empty;
      byId('dashboard-empty').hidden=!result.empty;
      renderInsight();
      if(!result.empty) { renderMonthly();renderProducts();renderOperations();renderCustomers();renderDemographics(); }
      storeView(filters);
      animateChange(byId('dashboard-kpis'));
      if(announce) {
        clearTimeout(announcementTimer);
        announcementTimer=setTimeout(()=>{ byId('dashboard-announcement').textContent=`${integer(result.totals.orders)} matching orders. ${scope}. All dashboard views updated.`; },180);
      }
    } catch(error) {
      result=null;
      setMetrics(null);
      byId('dashboard-charts').hidden=true;
      byId('dashboard-empty').hidden=true;
      byId('dashboard-result-count').textContent='Unable to calculate this selection';
      byId('dashboard-insight').innerHTML='<h3>This view could not be calculated.</h3><p class="dashboard-insight-summary">Reset the filters to try again, or return to the case study for the verified static analysis.</p>';
      byId('dashboard-announcement').textContent='The selected view could not be calculated. Reset the filters to try again.';
    }
  }

  function scheduleUpdate() {
    if(!pendingFrame) pendingFrame=requestAnimationFrame(()=>updateView());
  }

  function resetFilters() {
    form.querySelectorAll('input[type="checkbox"]').forEach(input=>{input.checked=true;});
    byId('filter-start').value=options.startDate;
    byId('filter-end').value=options.endDate;
    scheduleUpdate();
  }

  form.addEventListener('submit',event=>event.preventDefault());
  form.addEventListener('change',scheduleUpdate);
  form.addEventListener('click',event=>{
    const action=event.target.closest('[data-group-action]');
    if(!action) return;
    const group=groupDefinitions.find(group=>group.key===action.dataset.group);
    if(!group) return;
    form.querySelectorAll(`input[name="${group.key}"]`).forEach(input=>{input.checked=action.dataset.groupAction==='all';});
    scheduleUpdate();
  });
  document.querySelectorAll('[data-reset-filters]').forEach(button=>button.addEventListener('click',()=>{if(options)resetFilters();}));
  byId('dashboard-question').addEventListener('change',()=>{
    clearTimeout(announcementTimer);
    if(!result)return;
    renderInsight();storeView(readFilters());
    byId('dashboard-announcement').textContent=`Insights updated for: ${byId('dashboard-question').selectedOptions[0].textContent}`;
  });

  async function initialise() {
    try {
      if(!model)throw new Error('The dashboard calculation engine is unavailable.');
      const response=await fetch('assets/pizza-dashboard-data.json');
      if(!response.ok)throw new Error('The dashboard snapshot is unavailable.');
      data=await response.json();
      options=model.getOptions(data);
      renderFilterGroups();restoreView();
      if(window.matchMedia('(max-width: 950px)').matches)byId('dashboard-filter-disclosure').open=false;
      shell.hidden=false;loading.hidden=true;
      updateView(false);
    } catch(error) {
      loading.dataset.error='true';
      loading.innerHTML='The interactive snapshot could not be loaded. Please reload the page or <a href="pizza-sales-analysis.html#pizza-insights-title">read the verified project analysis</a>.';
      shell.hidden=true;
    }
  }
  initialise();
})();
