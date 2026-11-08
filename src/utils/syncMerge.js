// Multi-device sync logic. Pure functions only: no React, no network, no storage.
//
// Why this exists
// ---------------
// Once the same data is edited on a phone AND in a browser, "keep whichever side has
// more transactions" is no longer safe: an edit made on one device would be lost, and
// anything deleted on one device would come back from the other. So every record now
// carries an `updatedAt` time, every delete leaves a small tombstone, and two copies of
// the data are merged record by record:
//
//   • the newest version of each record wins (last write wins)
//   • a delete beats an older edit; a newer edit beats an older delete
//   • merging is symmetric and repeatable: merging the result again changes nothing,
//     so two devices converge instead of ping-ponging uploads forever
//
// The list collections that sync:
export const COLLECTIONS = ['transactions', 'accounts', 'budgets', 'categories', 'goals'];

// Tombstones older than this are dropped (a device offline for longer than a year could
// resurrect something it deleted elsewhere; acceptable for a personal app).
const TOMBSTONE_TTL_MS = 365 * 24 * 60 * 60 * 1000;

const tkey = (collection, id) => `${collection}:${id}`;
const stamp = (v) => (typeof v === 'string' && v ? v : '');   // ISO strings compare correctly as text

// JSON with sorted keys, so equal data always gives equal text regardless of key order.
export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).filter(k => value[k] !== undefined).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

// Text that identifies the *content* of a dataset (ignores when it was last uploaded).
export function fingerprint(data) {
  if (!data) return '';
  const { lastSynced, ...rest } = data;
  return stableStringify(rest);
}

const withoutStamp = (rec) => {
  if (!rec || typeof rec !== 'object') return rec;
  const { updatedAt, ...rest } = rec;
  return rest;
};

// ── Stamping local changes ────────────────────────────────────────────────────
// Called by the app every time it saves. Compares the previous and the next dataset and:
//   • gives new / changed records a fresh `updatedAt`
//   • leaves unchanged records alone (so they keep their original time)
//   • writes a tombstone for every record that disappeared
//   • removes the tombstone of a record that came back (Undo)
// Because it works by comparing, none of the add / edit / delete actions need to know about it.
export function stampChanges(prev, next, now = new Date().toISOString()) {
  const out = { ...next };
  const tombstones = { ...(next.tombstones || prev?.tombstones || {}) };

  for (const col of COLLECTIONS) {
    const before = new Map((prev?.[col] || []).map(r => [r.id, r]));
    const after = next[col] || [];
    const seen = new Set();

    out[col] = after.map(rec => {
      seen.add(rec.id);
      delete tombstones[tkey(col, rec.id)];
      const old = before.get(rec.id);
      if (old === rec) return rec;                                   // same object: untouched
      if (old && stableStringify(withoutStamp(old)) === stableStringify(withoutStamp(rec))) {
        return old;                                                  // rebuilt but identical
      }
      return { ...rec, updatedAt: now };
    });

    for (const id of before.keys()) {
      if (!seen.has(id)) tombstones[tkey(col, id)] = now;
    }
  }

  // settings is one object: stamp it as a whole
  if (prev && next.settings !== prev.settings) {
    const unchanged = stableStringify(withoutStamp(prev.settings)) === stableStringify(withoutStamp(next.settings));
    out.settings = unchanged ? prev.settings : { ...next.settings, updatedAt: now };
  }

  out.tombstones = tombstones;
  return out;
}

// ── Merging two datasets ──────────────────────────────────────────────────────
function mergeCollection(name, local = [], remote = [], tombs) {
  const byId = new Map();
  local.forEach(r => byId.set(r.id, r));
  remote.forEach(r => {
    const mine = byId.get(r.id);
    // Newer wins. On an exact tie (including old records that have no stamp yet) the
    // remote copy wins: the file on Drive is the shared source of truth, so a tie
    // always resolves the same way on every device.
    if (!mine || stamp(r.updatedAt) >= stamp(mine.updatedAt)) byId.set(r.id, r);
  });

  // Order: the Drive copy's order first, then anything only this device has. Once a
  // merged copy is uploaded, every device re-merging it gets exactly the same order,
  // so identical data never looks "changed" and devices don't keep re-uploading.
  const order = [...remote.map(r => r.id), ...local.map(r => r.id)];
  const result = [];
  const done = new Set();
  for (const id of order) {
    if (done.has(id)) continue;
    done.add(id);
    const rec = byId.get(id);
    const deletedAt = tombs[tkey(name, id)];
    // The record survives only if it was edited after it was deleted
    if (deletedAt && stamp(rec.updatedAt) <= deletedAt) continue;
    result.push(rec);
  }
  return result;
}

export function mergeData(local, remote, now = Date.now()) {
  if (!remote) return local;
  if (!local) return remote;

  // union of tombstones, keeping the latest time; drop very old ones
  const tombs = {};
  const add = (t = {}) => {
    for (const [k, v] of Object.entries(t)) {
      if (!tombs[k] || v > tombs[k]) tombs[k] = v;
    }
  };
  add(local.tombstones);
  add(remote.tombstones);
  for (const [k, v] of Object.entries(tombs)) {
    const t = Date.parse(v);
    if (Number.isFinite(t) && now - t > TOMBSTONE_TTL_MS) delete tombs[k];
  }

  const merged = { ...local, ...remote };
  for (const col of COLLECTIONS) merged[col] = mergeCollection(col, local[col], remote[col], tombs);

  // settings: the most recently changed copy wins as a whole (tie → remote)
  const ls = local.settings || {};
  const rs = remote.settings || {};
  merged.settings = stamp(ls.updatedAt) > stamp(rs.updatedAt) ? { ...rs, ...ls } : { ...ls, ...rs };

  merged.tombstones = tombs;
  return merged;
}

// A brand-new install that has never held real data. Its built-in sample accounts,
// budgets and categories must NOT be merged into your real data: if you deleted
// them on your phone, merging would bring them back.
export function isPristine(data, initial) {
  if (!data) return true;
  if ((data.transactions || []).length) return false;
  if (Object.keys(data.tombstones || {}).length) return false;
  const same = (k) => stableStringify(withoutStamp(data[k])) === stableStringify(withoutStamp(initial[k]));
  return COLLECTIONS.filter(c => c !== 'transactions').every(same) && same('settings');
}
