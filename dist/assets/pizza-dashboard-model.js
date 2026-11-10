(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PizzaDashboardModel = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DAY = 86400000;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const DIMENSIONS = ['cities', 'segments', 'categories', 'revenueBands'];
  const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const NUMBER = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  const PERCENT = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 });
  const LIST = new Intl.ListFormat('en-GB', { style: 'long', type: 'conjunction' });
  const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

  function validateData(data) {
    if (!data || data.version !== 1 || !data.period ||
        !['types', 'variants', 'customers', 'orders', ...DIMENSIONS].every(key => Array.isArray(data[key]))) {
      throw new TypeError('Unsupported pizza dashboard data.');
    }
  }

  function parseDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
    const milliseconds = Date.parse(value + 'T00:00:00Z');
    return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString().slice(0, 10) === value ? milliseconds : NaN;
  }

  function getOptions(data) {
    validateData(data);
    const result = { startDate: data.period.start, endDate: data.period.end };
    DIMENSIONS.forEach(key => { result[key] = data[key].slice(); });
    return result;
  }

  function normaliseFilters(data, input) {
    const source = input && typeof input === 'object' ? input : {};
    const filters = {};
    DIMENSIONS.forEach(key => {
      if (source[key] == null) filters[key] = null;
      else if (!Array.isArray(source[key])) filters[key] = [];
      else {
        const selected = new Set(source[key]);
        const recognised = data[key].filter(label => selected.has(label));
        filters[key] = data[key].length > 0 && recognised.length === data[key].length ? null : recognised;
      }
    });
    const first = parseDate(data.period.start), last = parseDate(data.period.end);
    if (!Number.isFinite(first) || !Number.isFinite(last) || first > last) throw new TypeError('Invalid dataset period.');
    const requestedStart = source.startDate == null || source.startDate === '' ? data.period.start : source.startDate;
    const requestedEnd = source.endDate == null || source.endDate === '' ? data.period.end : source.endDate;
    const start = parseDate(requestedStart), end = parseDate(requestedEnd);
    const valid = Number.isFinite(start) && Number.isFinite(end) && start <= end && start <= last && end >= first;
    filters.startDate = valid ? new Date(Math.max(first, start)).toISOString().slice(0, 10) : String(requestedStart);
    filters.endDate = valid ? new Date(Math.min(last, end)).toISOString().slice(0, 10) : String(requestedEnd);
    return { filters, valid, start: valid ? Math.max(first, start) : NaN, end: valid ? Math.min(last, end) : NaN };
  }

  function emptyMetric() { return { revenueCents: 0, quantity: 0, orders: 0 }; }
  function addMoneyAndQuantity(metric, revenueCents, quantity) {
    metric.revenueCents += revenueCents;
    metric.quantity += quantity;
  }
  function sortRevenue(a, b) {
    return b.revenueCents - a.revenueCents || String(a.name || a.label).localeCompare(String(b.name || b.label)) || a.index - b.index;
  }

  function filterAndAggregate(data, input) {
    validateData(data);
    const normalised = normaliseFilters(data, input);
    const filters = normalised.filters;
    const selected = {};
    DIMENSIONS.forEach(key => { selected[key] = filters[key] == null ? null : new Set(filters[key]); });
    const match = (key, index) => selected[key] === null || selected[key].has(data[key][index]);
    const year = Number(data.period.start.slice(0, 4));
    const origin = Date.UTC(year, 0, 1);
    const startDay = (normalised.start - origin) / DAY, endDay = (normalised.end - origin) / DAY;
    const hours = [...new Set(data.orders.map(order => order[1]))].sort((a, b) => a - b);
    const hourIndices = new Map(hours.map((hour, index) => [hour, index]));
    const monthly = [];
    if (normalised.valid) {
      let cursor = new Date(normalised.start);
      cursor = Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1);
      while (cursor <= normalised.end) {
        const date = new Date(cursor);
        monthly.push({ month: date.toISOString().slice(0, 7), label: MONTHS[date.getUTCMonth()], ...emptyMetric() });
        cursor = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
      }
    }
    const monthMap = new Map(monthly.map(month => [month.month, month]));
    const dayMetadata = new Map();
    const hourly = hours.map(hour => ({ hour, ...emptyMetric() }));
    const hourMap = new Map(hourly.map(hour => [hour.hour, hour]));
    const heatmap = { days: DAYS.slice(), hours: hours.slice(), counts: DAYS.map(() => hours.map(() => 0)) };
    const totals = { revenueCents: 0, quantity: 0, orders: 0, customers: 0, aovCents: 0 };
    const productMetrics = new Map(), customerMetrics = new Map();
    const cityMetrics = data.cities.map(name => ({ name, ...emptyMetric(), customerSet: new Set() }));
    const segmentMetrics = data.segments.map(name => ({ name, ...emptyMetric(), customerSet: new Set() }));
    const demographicSets = data.cities.map(() => data.segments.map(() => new Set()));

    if (normalised.valid) data.orders.forEach(order => {
      const [day, hour, customerIndex, lines] = order;
      if (day < startDay || day > endDay) return;
      const customer = data.customers[customerIndex];
      if (!customer || !match('cities', customer[0]) || !match('segments', customer[1])) return;
      const qualifyingProducts = new Set();
      let orderRevenue = 0, orderQuantity = 0, hasMatch = false;
      lines.forEach(line => {
        const [variantIndex, quantity, bandIndex] = line;
        const variant = data.variants[variantIndex];
        const type = variant && data.types[variant[0]];
        if (!type || quantity <= 0 || !match('categories', type.category) || !match('revenueBands', bandIndex)) return;
        const revenueCents = quantity * variant[2];
        hasMatch = true;
        orderRevenue += revenueCents;
        orderQuantity += quantity;
        qualifyingProducts.add(variant[0]);
        if (!productMetrics.has(variant[0])) productMetrics.set(variant[0], {
          index: variant[0], name: type.name, category: data.categories[type.category], ...emptyMetric()
        });
        addMoneyAndQuantity(productMetrics.get(variant[0]), revenueCents, quantity);
      });
      if (!hasMatch) return;
      totals.orders += 1;
      addMoneyAndQuantity(totals, orderRevenue, orderQuantity);
      let calendar = dayMetadata.get(day);
      if (!calendar) {
        const date = new Date(origin + day * DAY);
        calendar = { month: date.toISOString().slice(0, 7), weekday: (date.getUTCDay() + 6) % 7 };
        dayMetadata.set(day, calendar);
      }
      const month = monthMap.get(calendar.month);
      const hourMetric = hourMap.get(hour);
      if (month) { month.orders += 1; addMoneyAndQuantity(month, orderRevenue, orderQuantity); }
      hourMetric.orders += 1;
      addMoneyAndQuantity(hourMetric, orderRevenue, orderQuantity);
      heatmap.counts[calendar.weekday][hourIndices.get(hour)] += 1;
      if (!customerMetrics.has(customerIndex)) customerMetrics.set(customerIndex, {
        index: customerIndex, label: 'Customer ' + String(customerIndex + 1).padStart(3, '0'), ...emptyMetric()
      });
      const customerMetric = customerMetrics.get(customerIndex);
      customerMetric.orders += 1;
      addMoneyAndQuantity(customerMetric, orderRevenue, orderQuantity);
      const cityMetric = cityMetrics[customer[0]], segmentMetric = segmentMetrics[customer[1]];
      [cityMetric, segmentMetric].forEach(metric => {
        metric.orders += 1;
        metric.customerSet.add(customerIndex);
        addMoneyAndQuantity(metric, orderRevenue, orderQuantity);
      });
      demographicSets[customer[0]][customer[1]].add(customerIndex);
      qualifyingProducts.forEach(index => { productMetrics.get(index).orders += 1; });
    });

    totals.customers = customerMetrics.size;
    totals.aovCents = totals.orders ? totals.revenueCents / totals.orders : 0;
    const products = [...productMetrics.values()].map(product => ({
      ...product, share: totals.revenueCents ? product.revenueCents / totals.revenueCents : 0
    })).sort(sortRevenue);
    const customers = [...customerMetrics.values()].sort(sortRevenue);
    const finishBreakdown = metrics => metrics.filter(metric => metric.orders > 0).map(metric => ({
      name: metric.name, revenueCents: metric.revenueCents, quantity: metric.quantity,
      orders: metric.orders, customers: metric.customerSet.size
    }));
    const sizeOrder = ['S', 'M', 'L', 'XL', 'XXL'];
    const menu = products.map(product => ({
      index: product.index, name: product.name, category: product.category,
      ingredients: data.types[product.index].ingredients,
      variants: data.variants.filter(variant => variant[0] === product.index).map(variant => ({
        size: variant[1], priceCents: variant[2]
      })).sort((a, b) => {
        const first = sizeOrder.indexOf(a.size), second = sizeOrder.indexOf(b.size);
        return (first < 0 ? 99 : first) - (second < 0 ? 99 : second) || a.size.localeCompare(b.size);
      })
    })).sort((a, b) => a.name.localeCompare(b.name));
    const demographics = data.cities.map((city, cityIndex) => ({
      city, segments: data.segments.map((name, segmentIndex) => ({
        name, customers: demographicSets[cityIndex][segmentIndex].size
      }))
    })).filter(city => city.segments.some(segment => segment.customers > 0));
    return {
      empty: totals.orders === 0, filters, totals, monthly, hourly, products, customers,
      cityBreakdown: finishBreakdown(cityMetrics), segmentBreakdown: finishBreakdown(segmentMetrics),
      demographics, heatmap, menu
    };
  }

  const money = cents => USD.format(Number.isFinite(cents) ? cents / 100 : 0);
  const count = value => NUMBER.format(Number.isFinite(value) ? value : 0);
  const share = value => PERCENT.format(Number.isFinite(value) ? value : 0);
  const hourLabel = hour => String(hour).padStart(2, '0') + ':00–' + String(hour).padStart(2, '0') + ':59';

  function listLabels(values) {
    if (values.length <= 3) return LIST.format(values);
    return LIST.format([...values.slice(0, 3), count(values.length - 3) + ' other selections']);
  }

  function periodLabel(filters) {
    const start = parseDate(filters.startDate), end = parseDate(filters.endDate);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return 'the selected date range';
    return dateFormat.format(new Date(start)) + ' to ' + dateFormat.format(new Date(end));
  }

  function scopeLabel(filters) {
    const labels = [['cities', 'cities'], ['segments', 'customer segments'], ['categories', 'pizza categories'], ['revenueBands', 'revenue bands']];
    const chosen = labels.filter(([key]) => filters[key] !== null).map(([key, label]) => label + ': ' + (filters[key].length ? listLabels(filters[key]) : 'none'));
    return 'Scope: ' + periodLabel(filters) + (chosen.length ? '; ' + chosen.join('; ') : '; all cities, customer segments, pizza categories, and revenue bands') + '.';
  }

  function peak(items, key) {
    if (!items.length) return { value: 0, items: [] };
    const value = Math.max(...items.map(item => item[key]));
    return { value, items: items.filter(item => item[key] === value) };
  }

  function peakText(result, label, metric, valueFormat) {
    const names = result.items.map(label);
    if (names.length === 1) return names[0] + ' records the highest ' + metric + ', at ' + valueFormat(result.value) + '.';
    return listLabels(names) + ' share the highest ' + metric + ', at ' + valueFormat(result.value) + ' each.';
  }

  function buildNarrative(data, result, question) {
    validateData(data);
    if (!result || !result.totals) throw new TypeError('A dashboard result is required.');
    const mode = ['overview', 'trend', 'products', 'operations', 'customers'].includes(question) ? question : 'overview';
    const totals = result.totals;
    const limits = [
      'These are historical observations for the selected records; they do not establish causes, profit, or future demand.'
    ];
    if (result.filters.categories !== null || result.filters.revenueBands !== null) {
      limits.push('Revenue and quantity include matching order lines only. Average order value is matching revenue divided by matching orders, not the full value of every basket.');
    }
    const scope = scopeLabel(result.filters);
    if (result.empty) return {
      title: 'No matching orders',
      summary: 'The current filters do not match any orders. No sales, customer, or peak-period conclusion can be drawn for this selection.',
      observations: [scope],
      implications: ['Select at least one item in each filter, broaden the date range, or reset the filters to explore the available data.'],
      limits
    };

    const summary = money(totals.revenueCents) + ' in matching revenue comes from ' + count(totals.orders) + ' ' + (totals.orders === 1 ? 'order' : 'orders') + ' and ' + count(totals.quantity) + ' ' + (totals.quantity === 1 ? 'pizza' : 'pizzas') + ' across ' + count(totals.customers) + ' active ' + (totals.customers === 1 ? 'customer' : 'customers') + '. Average value is ' + money(totals.aovCents) + ' per matching order.';
    const monthlyPeak = peak(result.monthly, 'revenueCents');
    const hourlyOrders = peak(result.hourly, 'orders');
    const hourlyRevenue = peak(result.hourly, 'revenueCents');
    const weekdayTotals = result.heatmap.days.map((name, index) => ({ name, orders: result.heatmap.counts[index].reduce((sum, value) => sum + value, 0) }));
    const weekdayPeak = peak(weekdayTotals, 'orders');
    const observations = [scope], implications = [];
    let title = 'Selected sales at a glance';

    if (mode === 'trend' || mode === 'overview') {
      if (mode === 'trend') title = 'How revenue changes over the selected period';
      observations.push(peakText(monthlyPeak, item => item.label + ' ' + item.month.slice(0, 4), 'monthly revenue', money));
      if (result.monthly.length === 1) observations.push('Only one calendar month is included, so this selection does not support a month-to-month comparison.');
      if (mode === 'trend') {
        const activeMonths = result.monthly.filter(month => month.orders > 0);
        if (activeMonths.length > 1) {
          const lowValue = Math.min(...activeMonths.map(month => month.revenueCents));
          const lowMonths = activeMonths.filter(month => month.revenueCents === lowValue);
          if (lowValue !== monthlyPeak.value) observations.push(listLabels(lowMonths.map(month => month.label + ' ' + month.month.slice(0, 4))) + (lowMonths.length === 1 ? ' records' : ' record') + ' the lowest revenue among months with matching orders, at ' + money(lowValue) + '.');
        }
        const noOrderMonths = result.monthly.filter(month => month.orders === 0).length;
        if (noOrderMonths) observations.push(count(noOrderMonths) + ' selected ' + (noOrderMonths === 1 ? 'month contains' : 'months contain') + ' no matching orders.');
        implications.push('Review the product mix and order activity behind the higher-revenue months before using them as a reference for preparation or sales plans.');
        implications.push('Compare equivalent trading days and test any promotion against incremental orders and margin; monthly revenue alone does not explain the reason for a change.');
        limits.push('Months can contain different numbers of trading days. A partial date selection may include only part of the first or last month.');
      }
    }

    if (mode === 'products' || mode === 'overview') {
      if (mode === 'products') title = 'Which pizzas contribute to the selected sales';
      const leadingProducts = peak(result.products, 'revenueCents');
      observations.push(peakText(leadingProducts, product => product.name, 'product revenue', money));
      if (leadingProducts.items.length === 1) observations.push(leadingProducts.items[0].name + ' contributes ' + share(leadingProducts.items[0].share) + ' of the selected revenue.');
      if (mode === 'products') {
        const quantityLeaders = peak(result.products, 'quantity');
        observations.push(peakText(quantityLeaders, product => product.name, 'pizza quantity', value => count(value) + ' ' + (value === 1 ? 'pizza' : 'pizzas')));
        implications.push('Use the selected product and size mix to review ingredient preparation; compare revenue with quantities because a high-priced pizza can earn more without selling more units.');
        implications.push('Check ingredient costs and margins before promoting the revenue leaders. Menu prices describe available variants, not profitability.');
        limits.push('Product order counts overlap when a basket includes more than one pizza type; they must not be added to calculate total orders.');
      }
    }

    if (mode === 'operations' || mode === 'overview') {
      if (mode === 'operations') title = 'When the selected orders need service capacity';
      observations.push(peakText(hourlyOrders, item => hourLabel(item.hour), 'hourly order count', value => count(value) + ' ' + (value === 1 ? 'order' : 'orders')));
      if (mode === 'operations') {
        observations.push(peakText(weekdayPeak, item => item.name, 'weekday order total', value => count(value) + ' ' + (value === 1 ? 'order' : 'orders')));
        observations.push(peakText(hourlyRevenue, item => hourLabel(item.hour), 'hourly revenue', money));
        implications.push('Review preparation and overlapping staff coverage before the busiest matching order windows, then check waiting times, preparation duration, and kitchen capacity.');
        implications.push('Use quieter matching periods to investigate spare capacity. Test off-peak offers instead of assuming that an already busy service needs more demand.');
        limits.push('Hour and weekday counts accumulate across the selected dates. They are not orders per day or a staffing forecast, and zero orders do not establish opening hours.');
      }
    }

    if (mode === 'customers') {
      title = 'How spending is distributed across active customers';
      const customerLeaders = peak(result.customers, 'revenueCents');
      observations.push(peakText(customerLeaders, customer => customer.label, 'recorded customer spending in this selection', money));
      const topTen = result.customers.slice(0, 10);
      const topTenRevenue = topTen.reduce((sum, customer) => sum + customer.revenueCents, 0);
      const repeatCustomers = result.customers.filter(customer => customer.orders > 1).length;
      observations.push('The top ' + count(topTen.length) + ' active ' + (topTen.length === 1 ? 'customer accounts' : 'customers account') + ' for ' + share(totals.revenueCents ? topTenRevenue / totals.revenueCents : 0) + ' of selected revenue.');
      observations.push(count(repeatCustomers) + ' active ' + (repeatCustomers === 1 ? 'customer has' : 'customers have') + ' more than one matching order in the selected period.');
      const cityLeaders = peak(result.cityBreakdown, 'customers');
      if (cityLeaders.items.length) observations.push(peakText(cityLeaders, city => city.name, 'active customer count', value => count(value) + ' ' + (value === 1 ? 'customer' : 'customers')));
      implications.push('Review whether revenue is concentrated in a small group before planning retention or acquisition activities; compare the city and segment distributions within the same filters.');
      implications.push('Investigate repeat purchasing with a defined time window and suitable cost data before setting a retention budget.');
      limits.push('Customer labels are anonymous. Recorded customer spending is historical revenue, not predictive customer lifetime value, and repeat matching orders are not a retention rate.');
    }

    if (mode === 'overview') {
      implications.push('Choose a question above to explore the selected sales trend, product mix, service timing, or customer concentration in more detail.');
      implications.push('Use the observed patterns to prioritise decisions to investigate, then verify capacity, costs, and trading conditions before acting.');
    }
    return { title, summary, observations, implications, limits };
  }

  return Object.freeze({ getOptions, filterAndAggregate, buildNarrative });
});
