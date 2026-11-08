import test from 'node:test';
import assert from 'node:assert/strict';
import { stampChanges, mergeData, isPristine, fingerprint, stableStringify } from '../src/utils/syncMerge.js';

const base = () => ({
  version: 5,
  transactions: [], accounts: [{ id: 'a1', name: 'Bank' }], budgets: [], categories: [{ id: 'food', name: 'Food' }], goals: [],
  settings: { currency: 'Rs', monthStartDay: 1 }, tombstones: {},
});
const T = (n) => new Date(Date.UTC(2026, 10, 1, 12, 0, n)).toISOString();
const tx = (id, amount) => ({ id, type: 'expense', amount, date: '2026-11-01' });
const ids = (d) => d.transactions.map(t => t.id).sort();

test('stamp: new record gets updatedAt, untouched records keep theirs', () => {
  let d = { ...base(), transactions: [{ ...tx('t1', 5), updatedAt: T(1) }] };
  const next = { ...d, transactions: [tx('t2', 9), ...d.transactions] };
  const s = stampChanges(d, next, T(50));
  assert.equal(s.transactions.find(t => t.id === 't2').updatedAt, T(50));
  assert.equal(s.transactions.find(t => t.id === 't1').updatedAt, T(1));
});

test('stamp: edit bumps only the edited record; rebuilt-but-identical keeps its stamp', () => {
  const d = { ...base(), transactions: [{ ...tx('t1', 5), updatedAt: T(1) }, { ...tx('t2', 6), updatedAt: T(2) }] };
  const next = { ...d, transactions: [{ ...d.transactions[0], amount: 7 }, { ...d.transactions[1] }] };
  const s = stampChanges(d, next, T(60));
  assert.equal(s.transactions[0].updatedAt, T(60));
  assert.equal(s.transactions[1].updatedAt, T(2));
});

test('stamp: delete writes a tombstone; undo (re-add) removes it', () => {
  const d = { ...base(), transactions: [{ ...tx('t1', 5), updatedAt: T(1) }] };
  const del = stampChanges(d, { ...d, transactions: [] }, T(10));
  assert.equal(del.tombstones['transactions:t1'], T(10));
  const undo = stampChanges(del, { ...del, transactions: [d.transactions[0]] }, T(11));
  assert.equal(undo.tombstones['transactions:t1'], undefined);
  assert.equal(undo.transactions[0].updatedAt, T(11));
});

test('stamp: settings change is stamped, unchanged settings are not', () => {
  const d = { ...base(), settings: { currency: 'Rs', updatedAt: T(1) } };
  assert.equal(stampChanges(d, { ...d, settings: { ...d.settings, currency: '€' } }, T(9)).settings.updatedAt, T(9));
  assert.equal(stampChanges(d, { ...d, settings: { ...d.settings } }, T(9)).settings.updatedAt, T(1));
});

test('merge: records added on both devices are both kept', () => {
  const phone = { ...base(), transactions: [{ ...tx('p1', 1), updatedAt: T(1) }] };
  const web   = { ...base(), transactions: [{ ...tx('w1', 2), updatedAt: T(2) }] };
  assert.deepEqual(ids(mergeData(phone, web)), ['p1', 'w1']);
});

test('merge: newest edit wins, in either direction', () => {
  const a = { ...base(), transactions: [{ ...tx('t', 10), updatedAt: T(5) }] };
  const b = { ...base(), transactions: [{ ...tx('t', 99), updatedAt: T(9) }] };
  assert.equal(mergeData(a, b).transactions[0].amount, 99);
  assert.equal(mergeData(b, a).transactions[0].amount, 99);
});

test('merge: a delete is not undone by the other device still holding the old copy', () => {
  const old = { ...tx('t', 10), updatedAt: T(1) };
  const phone = { ...base(), transactions: [], tombstones: { 'transactions:t': T(5) } };
  const web = { ...base(), transactions: [old] };
  assert.deepEqual(ids(mergeData(web, phone)), []);
  assert.deepEqual(ids(mergeData(phone, web)), []);
});

test('merge: an edit made AFTER the other device deleted it brings it back', () => {
  const phone = { ...base(), transactions: [], tombstones: { 'transactions:t': T(5) } };
  const web = { ...base(), transactions: [{ ...tx('t', 10), updatedAt: T(8) }] };
  assert.deepEqual(ids(mergeData(web, phone)), ['t']);
});

test('merge: symmetric and idempotent (devices converge, no upload ping-pong)', () => {
  const phone = { ...base(), transactions: [{ ...tx('p', 1), updatedAt: T(1) }, { ...tx('s', 3), updatedAt: T(3) }],
                  tombstones: { 'transactions:gone': T(4) } };
  const web = { ...base(), transactions: [{ ...tx('w', 2), updatedAt: T(2) }, { ...tx('s', 4), updatedAt: T(4) }],
                tombstones: { 'transactions:gone2': T(6) } };
  const ab = mergeData(phone, web), ba = mergeData(web, phone);
  assert.deepEqual(ids(ab), ids(ba));
  assert.deepEqual(ab.tombstones, ba.tombstones);
  // ab is now the file on Drive. Every device re-merging against it must land on exactly that, so nothing re-uploads.
  assert.equal(fingerprint(mergeData(ab, ab)), fingerprint(ab));
  assert.equal(fingerprint(mergeData(phone, ab)), fingerprint(ab));
  assert.equal(fingerprint(mergeData(web, ab)), fingerprint(ab));
});

test('merge: tie on old (unstamped) records resolves to the remote copy on both sides', () => {
  const a = { ...base(), categories: [{ id: 'food', name: 'Food' }] };
  const b = { ...base(), categories: [{ id: 'food', name: 'Meals' }] };
  assert.equal(mergeData(a, b).categories[0].name, 'Meals');
});

test('merge: settings — newest whole-object wins', () => {
  const a = { ...base(), settings: { currency: 'Rs', monthStartDay: 25, updatedAt: T(9) } };
  const b = { ...base(), settings: { currency: 'Rs', monthStartDay: 1, updatedAt: T(3) } };
  assert.equal(mergeData(a, b).settings.monthStartDay, 25);
  assert.equal(mergeData(b, a).settings.monthStartDay, 25);
});

test('merge: tombstones older than a year are dropped', () => {
  const now = Date.parse('2026-11-07T00:00:00Z');
  const a = { ...base(), tombstones: { 'transactions:x': '2025-01-01T00:00:00.000Z', 'transactions:y': '2026-10-01T00:00:00.000Z' } };
  const m = mergeData(a, base(), now);
  assert.deepEqual(Object.keys(m.tombstones), ['transactions:y']);
});

test('pristine: a fresh install is pristine, one with a transaction or a delete is not', () => {
  const init = base();
  assert.equal(isPristine(base(), init), true);
  assert.equal(isPristine({ ...base(), transactions: [tx('a', 1)] }, init), false);
  assert.equal(isPristine({ ...base(), tombstones: { 'budgets:b3': T(1) } }, init), false);
  assert.equal(isPristine({ ...base(), accounts: [] }, init), false);
});

test('fingerprint ignores key order and lastSynced', () => {
  const a = { x: 1, y: { b: 2, a: 1 }, lastSynced: 'now' };
  const b = { y: { a: 1, b: 2 }, x: 1, lastSynced: 'later' };
  assert.equal(fingerprint(a), fingerprint(b));
  assert.equal(stableStringify({ a: undefined, b: 1 }), '{"b":1}');
});

test('scenario: delete on phone, edit different record on web, both sync twice', () => {
  const t1 = { ...tx('t1', 1), updatedAt: T(1) }, t2 = { ...tx('t2', 2), updatedAt: T(1) };
  let drive = { ...base(), transactions: [t1, t2] };
  let phone = drive, web = drive;
  phone = stampChanges(phone, { ...phone, transactions: [t2] }, T(10));                       // phone deletes t1
  web = stampChanges(web, { ...web, transactions: [t1, { ...t2, amount: 50 }] }, T(11));      // web edits t2
  drive = mergeData(phone, drive); phone = drive;                                              // phone syncs
  web = mergeData(web, drive); drive = web;                                                    // web syncs
  phone = mergeData(phone, drive);                                                             // phone syncs again
  assert.deepEqual(ids(phone), ['t2']);
  assert.equal(phone.transactions[0].amount, 50);
  assert.equal(fingerprint(phone), fingerprint(web));
});
