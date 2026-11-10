'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const model = require('../dist/assets/pizza-dashboard-model.js');

const publicDataPath = path.resolve(__dirname, '../dist/assets/pizza-dashboard-data.json');
const dataPath = process.env.PIZZA_DASHBOARD_DATA_FILE || (fs.existsSync(publicDataPath) ? publicDataPath : '/tmp/pizza-dashboard-anonymous.json');
const real = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}

// Small independent fixture: a basket may contain several categories and bands.
const sample = freeze({
  version: 1,
  period: { start: '2015-01-01', end: '2015-03-01' },
  currency: 'USD',
  cities: ['Harbor', 'Hill'],
  segments: ['Adult', 'Senior'],
  categories: ['Classic', 'Veggie'],
  revenueBands: ['Low Revenue', 'Moderate Revenue', 'High Revenue'],
  types: [
    { name: 'Classic Pizza', category: 0, ingredients: 'Cheese, Tomato' },
    { name: 'Garden Pizza', category: 1, ingredients: 'Mushroom, Pepper' }
  ],
  variants: [[0, 'S', 1000], [0, 'L', 2000], [1, 'S', 1500], [1, 'L', 3000]],
  customers: [[0, 0], [0, 1], [1, 0]],
  orders: [
    [0, 12, 0, [[0, 1, 0], [2, 2, 1]]],
    [0, 13, 0, [[1, 1, 1]]],
    [1, 18, 1, [[3, 3, 2], [0, 1, 0]]],
    [31, 12, 2, [[2, 1, 0]]],
    [59, 9, 2, [[1, 3, 1]]]
  ]
});

function checkTotals(result, expected) {
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(result.totals[key], value, key);
  }
  assert.equal(result.empty, expected.orders === 0);
  assert.ok(Number.isFinite(result.totals.aovCents));
  if (expected.orders) assert.equal(result.totals.aovCents, expected.revenueCents / expected.orders);
  else assert.equal(result.totals.aovCents, 0);
}

function assertNarrativeShape(value) {
  assert.equal(typeof value.title, 'string');
  assert.ok(value.title.trim());
  assert.equal(typeof value.summary, 'string');
  assert.ok(value.summary.trim());
  for (const key of ['observations', 'implications', 'limits']) {
    assert.ok(Array.isArray(value[key]), key);
    assert.ok(value[key].every(item => typeof item === 'string' && item.trim()), key);
  }
  assert.doesNotMatch(JSON.stringify(value), /NaN|Infinity|undefined/);
}

test('options expose the actual dimensions without mutating the data', () => {
  const options = model.getOptions(sample);
  for (const key of ['cities', 'segments', 'categories', 'revenueBands']) assert.deepEqual(options[key], sample[key]);
  assert.equal(options.startDate, sample.period.start);
  assert.equal(options.endDate, sample.period.end);
});

test('full workbook baseline reconciles to recorded revenue, pizzas, orders and customers', () => {
  const result = model.filterAndAggregate(real, {});
  checkTotals(result, { revenueCents: 81786005, quantity: 49574, orders: 21350, customers: 800 });
  assert.equal(result.monthly.length, 12);
  assert.equal(result.monthly.reduce((sum, row) => sum + row.revenueCents, 0), result.totals.revenueCents);
  assert.equal(result.hourly.reduce((sum, row) => sum + row.orders, 0), result.totals.orders);
  assert.equal(result.products.reduce((sum, row) => sum + row.revenueCents, 0), result.totals.revenueCents);
  assert.equal(result.cityBreakdown.reduce((sum, row) => sum + row.orders, 0), result.totals.orders);
  assert.equal(result.segmentBreakdown.reduce((sum, row) => sum + row.orders, 0), result.totals.orders);
  assert.equal(result.heatmap.counts.flat().reduce((sum, count) => sum + count, 0), result.totals.orders);
  assert.ok(Math.abs(result.products.reduce((sum, row) => sum + row.share, 0) - 1) < 1e-12);
});

test('native Low Revenue baseline reconciles after line-level filtering', () => {
  checkTotals(model.filterAndAggregate(real, { revenueBands: ['Low Revenue'] }), {
    revenueCents: 48027900, quantity: 33066, orders: 18052, customers: 800
  });
});

test('native High Revenue baseline retains only its six matching baskets', () => {
  checkTotals(model.filterAndAggregate(real, { revenueBands: ['High Revenue'] }), {
    revenueCents: 39350, quantity: 19, orders: 6, customers: 6
  });
});

test('real category, city and calendar filters reconcile to independent subsets', () => {
  checkTotals(model.filterAndAggregate(real, { categories: ['Classic'] }), {
    revenueCents: 22005310, quantity: 14888, orders: 10859, customers: 800
  });
  checkTotals(model.filterAndAggregate(real, { cities: ['Bandung'] }), {
    revenueCents: 8837510, quantity: 5351, orders: 2349, customers: 88
  });
  const january = model.filterAndAggregate(real, { startDate: '2015-01-01', endDate: '2015-01-31' });
  checkTotals(january, { revenueCents: 6979330, quantity: 4232, orders: 1845, customers: 800 });
  assert.deepEqual(january.monthly.map(row => row.month), ['2015-01']);
});

test('dimensions intersect while values within a dimension are alternatives', () => {
  checkTotals(model.filterAndAggregate(real, {
    cities: ['Bandung', 'Bogor'], categories: ['Classic'], segments: ['Senior'],
    startDate: '2015-01-01', endDate: '2015-03-31'
  }), { revenueCents: 444750, quantity: 303, orders: 209, customers: 65 });
  checkTotals(model.filterAndAggregate(sample, {
    cities: ['Harbor'], categories: ['Veggie'], revenueBands: ['Moderate Revenue']
  }), { revenueCents: 3000, quantity: 2, orders: 1, customers: 1 });
  checkTotals(model.filterAndAggregate(sample, { cities: ['Harbor', 'Hill'] }), {
    revenueCents: 23500, quantity: 12, orders: 5, customers: 3
  });
});

test('category and band filters apply to lines, not whole matching baskets', () => {
  checkTotals(model.filterAndAggregate(sample, { categories: ['Classic'] }), {
    revenueCents: 10000, quantity: 6, orders: 4, customers: 3
  });
  checkTotals(model.filterAndAggregate(sample, { revenueBands: ['Moderate Revenue'] }), {
    revenueCents: 11000, quantity: 6, orders: 3, customers: 2
  });
  checkTotals(model.filterAndAggregate(sample, { categories: ['Classic'], revenueBands: ['Low Revenue'] }), {
    revenueCents: 2000, quantity: 2, orders: 2, customers: 2
  });
});

test('distinct baskets are counted once even when categories or variants overlap', () => {
  const all = model.filterAndAggregate(sample, {});
  const classic = model.filterAndAggregate(sample, { categories: ['Classic'] });
  const veggie = model.filterAndAggregate(sample, { categories: ['Veggie'] });
  assert.ok(classic.totals.orders + veggie.totals.orders > all.totals.orders);
  const sameProduct = { ...sample, orders: [[0, 12, 0, [[0, 1, 0], [1, 1, 1]]]] };
  const result = model.filterAndAggregate(sameProduct, {});
  checkTotals(result, { revenueCents: 3000, quantity: 2, orders: 1, customers: 1 });
  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].orders, 1);
  assert.equal(result.customers[0].orders, 1);
});

test('an explicit empty selection means no records; null means all values', () => {
  for (const key of ['cities', 'segments', 'categories', 'revenueBands']) {
    const result = model.filterAndAggregate(sample, { [key]: [] });
    checkTotals(result, { revenueCents: 0, quantity: 0, orders: 0, customers: 0 });
    assert.deepEqual(result.products, []);
    assert.deepEqual(result.customers, []);
    assert.deepEqual(result.menu, []);
  }
  checkTotals(model.filterAndAggregate(sample, { cities: null, segments: null, categories: null, revenueBands: null }), {
    revenueCents: 23500, quantity: 12, orders: 5, customers: 3
  });
});

test('date endpoints are inclusive and partially overlapping windows are clamped', () => {
  checkTotals(model.filterAndAggregate(sample, { startDate: '2015-01-01', endDate: '2015-01-01' }), {
    revenueCents: 6000, quantity: 4, orders: 2, customers: 1
  });
  checkTotals(model.filterAndAggregate(sample, { startDate: '2014-12-01', endDate: '2015-01-01' }), {
    revenueCents: 6000, quantity: 4, orders: 2, customers: 1
  });
  checkTotals(model.filterAndAggregate(sample, { startDate: '2015-02-01', endDate: '2015-12-31' }), {
    revenueCents: 7500, quantity: 4, orders: 2, customers: 1
  });
});

test('invalid, reversed or wholly outside date windows yield safe empty results', () => {
  for (const filters of [
    { startDate: '2015-03-01', endDate: '2015-01-01' },
    { startDate: '2014-01-01', endDate: '2014-12-31' },
    { startDate: '2016-01-01', endDate: '2016-12-31' },
    { startDate: 'not-a-date' }, { startDate: '2015-02-30' }, { endDate: '2015-13-01' }
  ]) {
    checkTotals(model.filterAndAggregate(sample, filters), { revenueCents: 0, quantity: 0, orders: 0, customers: 0 });
  }
});

test('monthly rows and chronological hour rows retain zeroes within the selected view', () => {
  const result = model.filterAndAggregate(sample, { startDate: '2015-01-01', endDate: '2015-02-28' });
  assert.deepEqual(result.monthly.map(row => row.month), ['2015-01', '2015-02']);
  assert.deepEqual(result.hourly.map(row => row.hour), [9, 12, 13, 18]);
  assert.equal(result.hourly.find(row => row.hour === 9).orders, 0);
  assert.equal(result.heatmap.counts.length, 7);
  assert.ok(result.heatmap.counts.every(row => row.length === result.heatmap.hours.length));
});

test('the menu contains matching types with every actual variant price', () => {
  const result = model.filterAndAggregate(sample, { revenueBands: ['High Revenue'] });
  assert.equal(result.menu.length, 1);
  assert.equal(result.menu[0].name, 'Garden Pizza');
  assert.equal(result.menu[0].category, 'Veggie');
  assert.equal(result.menu[0].ingredients, 'Mushroom, Pepper');
  assert.deepEqual([...result.menu[0].variants].sort((a, b) => a.priceCents - b.priceCents), [
    { size: 'S', priceCents: 1500 }, { size: 'L', priceCents: 3000 }
  ]);
});

test('historical customers are anonymous, distinct, and ranked by selected spending', () => {
  const result = model.filterAndAggregate(sample, {});
  assert.equal(result.customers.length, 3);
  assert.equal(result.customers[0].revenueCents, 10000);
  assert.ok(result.customers.every(row => /^Customer \d+$/.test(row.label)));
  assert.equal(new Set(result.customers.map(row => row.index)).size, 3);
  assert.equal(result.customers.reduce((sum, row) => sum + row.revenueCents, 0), result.totals.revenueCents);
  const allowedKeys = ['index', 'label', 'revenueCents', 'quantity', 'orders'];
  assert.ok(result.customers.every(row => Object.keys(row).every(key => allowedKeys.includes(key))));
  assert.ok(real.customers.every(row => row.length === 2 && row.every(Number.isInteger)));
  assert.ok(real.orders.every(row => row.length === 4 && row[3].every(line => line.length === 3)));
});

test('every question produces finite, filter-specific narratives', () => {
  const filters = { cities: ['Harbor'], categories: ['Veggie'], revenueBands: ['Moderate Revenue'] };
  const selected = model.filterAndAggregate(sample, filters);
  const all = model.filterAndAggregate(sample, {});
  for (const question of ['overview', 'trend', 'products', 'operations', 'customers']) {
    const value = model.buildNarrative(sample, selected, question);
    assertNarrativeShape(value);
    assert.match(JSON.stringify(value), /Harbor/);
    assert.notDeepEqual(value, model.buildNarrative(sample, all, question));
  }
});

test('empty, single-month and tied-month narratives remain meaningful and finite', () => {
  const empty = model.filterAndAggregate(sample, { cities: [] });
  const single = model.filterAndAggregate(sample, { startDate: '2015-02-01', endDate: '2015-02-28' });
  const tied = { ...sample, period: { start: '2015-01-01', end: '2015-02-01' }, orders: [[0, 12, 0, [[0, 1, 0]]], [31, 12, 1, [[0, 1, 0]]]] };
  for (const question of ['overview', 'trend', 'products', 'operations', 'customers']) {
    assertNarrativeShape(model.buildNarrative(sample, empty, question));
    assertNarrativeShape(model.buildNarrative(sample, single, question));
    assertNarrativeShape(model.buildNarrative(tied, model.filterAndAggregate(tied, {}), question));
  }
  const text = JSON.stringify(model.buildNarrative(tied, model.filterAndAggregate(tied, {}), 'trend'));
  assert.match(text, /tie|same|equal|joint|both|share/i);
});

test('aggregation and narrative generation leave frozen inputs unchanged', () => {
  const before = JSON.stringify(sample);
  const filters = freeze({ cities: ['Harbor'], startDate: '2015-01-01', endDate: '2015-01-31' });
  const result = model.filterAndAggregate(sample, filters);
  model.buildNarrative(sample, result, 'overview');
  assert.equal(JSON.stringify(sample), before);
  assert.deepEqual(filters, { cities: ['Harbor'], startDate: '2015-01-01', endDate: '2015-01-31' });
});

test('city and segment demographic totals reconcile to distinct active customers', () => {
  const result = model.filterAndAggregate(real, {});
  const cityCounts = Object.fromEntries(result.cityBreakdown.map(row => [row.name, row.customers]));
  const segmentCounts = Object.fromEntries(result.segmentBreakdown.map(row => [row.name, row.customers]));
  assert.equal(cityCounts.Bandung, 88);
  assert.equal(cityCounts.Jakarta, 88);
  assert.equal(segmentCounts.Adult, 502);
  assert.equal(segmentCounts.Senior, 298);
  assert.equal(Object.values(cityCounts).reduce((sum, value) => sum + value, 0), 800);
  assert.equal(Object.values(segmentCounts).reduce((sum, value) => sum + value, 0), 800);
  assert.equal(result.demographics.reduce((sum, row) => sum + row.segments.reduce((total, segment) => total + segment.customers, 0), 0), result.totals.customers);
  for (const row of result.demographics) {
    assert.equal(row.segments.reduce((sum, segment) => sum + segment.customers, 0), cityCounts[row.city]);
    assert.deepEqual(row.segments.map(segment => segment.name), real.segments);
  }
  for (const name of real.segments) {
    assert.equal(result.demographics.reduce((sum, row) => sum + row.segments.find(segment => segment.name === name).customers, 0), segmentCounts[name]);
  }
});

test('demographics count a customer once despite repeat orders, lines and quantities', () => {
  const result = model.filterAndAggregate(sample, {});
  assert.deepEqual(result.demographics, [
    { city: 'Harbor', segments: [{ name: 'Adult', customers: 1 }, { name: 'Senior', customers: 1 }] },
    { city: 'Hill', segments: [{ name: 'Adult', customers: 1 }, { name: 'Senior', customers: 0 }] }
  ]);
  assert.deepEqual(Object.fromEntries(result.cityBreakdown.map(row => [row.name, row.customers])), { Harbor: 2, Hill: 1 });
  assert.deepEqual(Object.fromEntries(result.segmentBreakdown.map(row => [row.name, row.customers])), { Adult: 2, Senior: 1 });
  assert.equal(result.totals.orders, 5);
  assert.equal(result.totals.customers, 3);
});

test('demographics follow intersecting date, city, segment, category and band filters', () => {
  const selected = model.filterAndAggregate(sample, {
    cities: ['Harbor'], segments: ['Adult'], categories: ['Veggie'], revenueBands: ['Moderate Revenue'],
    startDate: '2015-01-01', endDate: '2015-01-01'
  });
  checkTotals(selected, { revenueCents: 3000, quantity: 2, orders: 1, customers: 1 });
  assert.deepEqual(selected.demographics, [
    { city: 'Harbor', segments: [{ name: 'Adult', customers: 1 }, { name: 'Senior', customers: 0 }] }
  ]);
  assert.equal(selected.cityBreakdown[0].customers, 1);
  assert.equal(selected.segmentBreakdown[0].customers, 1);
  const senior = model.filterAndAggregate(sample, { segments: ['Senior'], categories: ['Classic'] });
  assert.deepEqual(senior.demographics, [
    { city: 'Harbor', segments: [{ name: 'Adult', customers: 0 }, { name: 'Senior', customers: 1 }] }
  ]);
  const empty = model.filterAndAggregate(sample, { segments: [] });
  assert.deepEqual(empty.demographics, []);
  assert.deepEqual(empty.cityBreakdown, []);
  assert.deepEqual(empty.segmentBreakdown, []);
});
