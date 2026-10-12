import { G } from './state.js';

// Co-op networking over WebRTC (PeerJS, free public signalling server).
// Star topology: the fireteam leader ("host") runs the mission simulation;
// members send their state, hits and effects to the host, which relays.

const PEER_URL = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
// Cloudflare Worker that hands out short-lived TURN relay credentials (relay-worker/worker.js).
const RELAY_URL = '';
const STUN_ONLY = [{ urls: 'stun:stun.cloudflare.com:3478' }, { urls: 'stun:stun.l.google.com:19302' }];
const PREFIX = 'afterlight-ft1-';
export const MAX_FIRETEAM = 3;

export const net = {
  role: 'solo', // solo | host | client
  peer: null,
  conns: new Map(), // host: peerId -> DataConnection
  hostConn: null, // client: connection to the host
  myId: null,
  code: null,
  members: [], // [{ id, name, cls, power }]
  sel: null, // host's selected mission { li, mi }
  status: '',
  relay: false, // true once Cloudflare relay credentials were fetched
  handlers: {},
  onLobby: null, // UI hook
  get active() { return this.role !== 'solo'; },
  get isHost() { return this.role === 'host'; },
  get isClient() { return this.role === 'client'; },
  count() { return this.active ? Math.max(1, this.members.length) : 1; },
  on(type, fn) { this.handlers[type] = fn; },
};

// ?localtest: connect tabs of the same browser through a BroadcastChannel
// instead of WebRTC, so co-op can be tested on one computer.
const LOCAL_TEST = new URLSearchParams(location.search).has('localtest');

class LocalConn {
  constructor(owner, remoteId) { this.owner = owner; this.peer = remoteId; this.open = false; this.h = {}; }
  on(ev, fn) { (this.h[ev] ??= []).push(fn); }
  emit(ev, ...a) { for (const fn of this.h[ev] || []) fn(...a); }
  send(data) { if (this.open) this.owner.post({ to: this.peer, k: 'data', p: data }); }
  close() { if (!this.open) return; this.owner.post({ to: this.peer, k: 'close' }); this.closed(); }
  opened() { this.open = true; this.emit('open'); }
  closed() { if (!this.open) return; this.open = false; this.owner.conns.delete(this.peer); this.emit('close'); }
}

class LocalPeer {
  constructor(id) {
    this.id = id || `local-${Math.random().toString(36).slice(2, 10)}`;
    this.h = {}; this.conns = new Map(); this.open = true; this.destroyed = false;
    this.bc = new BroadcastChannel('afterlight-localtest');
    this.bc.onmessage = (ev) => this.rx(ev.data);
    setTimeout(() => this.emit('open', this.id), 0);
  }
  on(ev, fn) { (this.h[ev] ??= []).push(fn); }
  emit(ev, ...a) { for (const fn of this.h[ev] || []) fn(...a); }
  post(m) { if (!this.destroyed) this.bc.postMessage({ ...m, from: this.id }); }
  connect(id) {
    const c = new LocalConn(this, id);
    this.conns.set(id, c);
    this.post({ to: id, k: 'connect' });
    setTimeout(() => { if (!c.open) this.emit('error', Object.assign(new Error('not found'), { type: 'peer-unavailable' })); }, 3000);
    return c;
  }
  rx(m) {
    if (m.to !== this.id || this.destroyed) return;
    if (m.k === 'connect') {
      const c = new LocalConn(this, m.from);
      this.conns.set(m.from, c);
      this.emit('connection', c);
      this.post({ to: m.from, k: 'accept' });
      setTimeout(() => c.opened(), 0);
    } else if (m.k === 'accept') this.conns.get(m.from)?.opened();
    else if (m.k === 'data') this.conns.get(m.from)?.emit('data', m.p);
    else if (m.k === 'close') this.conns.get(m.from)?.closed();
  }
  reconnect() {}
  destroy() { for (const c of [...this.conns.values()]) c.close(); this.destroyed = true; this.open = false; this.bc.close(); }
}

function loadPeer() {
  if (LOCAL_TEST || window.Peer) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = PEER_URL;
    s.onload = () => res();
    s.onerror = () => rej(new Error('Could not load the multiplayer library. Check your internet connection.'));
    document.head.appendChild(s);
  });
}

function makeCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => A[Math.floor(Math.random() * A.length)]).join('');
}

/** ICE servers: Cloudflare relay when available, otherwise direct connections only. */
async function iceServers() {
  if (!RELAY_URL) { net.relay = false; return STUN_ONLY; }
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 5000);
    const res = await fetch(RELAY_URL, { signal: ctl.signal });
    clearTimeout(t);
    const data = await res.json();
    if (!res.ok || !Array.isArray(data.iceServers)) throw new Error(data.error || `relay returned ${res.status}`);
    net.relay = true;
    return data.iceServers;
  } catch (e) {
    console.warn('Relay credentials unavailable; using direct connections only.', e);
    net.relay = false;
    return STUN_ONLY;
  }
}

async function openPeer(id) {
  const opts = LOCAL_TEST ? null : { debug: 1, config: { iceServers: await iceServers() } };
  return new Promise((res, rej) => {
    const Ctor = LOCAL_TEST ? LocalPeer : window.Peer;
    const peer = LOCAL_TEST ? new Ctor(id) : id ? new Ctor(id, opts) : new Ctor(opts);
    const fail = (err) => { peer.destroy(); rej(err); };
    const t = setTimeout(() => fail(new Error('The matchmaking server did not answer. Try again in a moment.')), 12000);
    peer.on('open', (pid) => { clearTimeout(t); res(peer); });
    peer.on('error', (err) => { clearTimeout(t); fail(err); });
  });
}

function lobbyChanged() {
  if (net.isHost) broadcast({ t: 'lobby', members: net.members, sel: net.sel });
  net.onLobby?.();
}

function dispatch(msg, fromId) {
  const h = net.handlers[msg.t];
  if (h) h(msg, fromId);
}

// ---------------------------------------------------------------------------
// Host
// ---------------------------------------------------------------------------
export async function createFireteam(profile) {
  await loadPeer();
  let peer = null;
  for (let tries = 0; tries < 4 && !peer; tries++) {
    const code = makeCode();
    try { peer = await openPeer(PREFIX + code); net.code = code; }
    catch (e) { if (e.type !== 'unavailable-id') throw e; }
  }
  if (!peer) throw new Error('Could not reserve a fireteam code. Try again.');
  net.peer = peer;
  net.role = 'host';
  net.myId = peer.id;
  net.members = [{ id: peer.id, ...profile, leader: true }];
  net.status = '';
  peer.on('connection', (conn) => {
    conn.on('open', () => {
      if (net.members.length >= MAX_FIRETEAM) { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 300); return; }
      net.conns.set(conn.peer, conn);
    });
    conn.on('data', (msg) => {
      if (msg.t === 'hello') {
        if (!net.members.some((m) => m.id === conn.peer)) net.members.push({ id: conn.peer, name: msg.name, cls: msg.cls, power: msg.power });
        lobbyChanged();
        dispatch({ t: 'joined', id: conn.peer }, conn.peer);
        return;
      }
      dispatch(msg, conn.peer);
    });
    conn.on('close', () => dropMember(conn.peer));
    conn.on('error', () => dropMember(conn.peer));
  });
  peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) { console.warn('Peer reconnect failed', e); } });
  lobbyChanged();
  return net.code;
}

function dropMember(id) {
  net.conns.delete(id);
  const m = net.members.find((x) => x.id === id);
  net.members = net.members.filter((x) => x.id !== id);
  dispatch({ t: 'left', id, name: m?.name }, id);
  lobbyChanged();
}

export function setSelection(li, mi) {
  net.sel = { li, mi };
  if (net.isHost) broadcast({ t: 'lobby', members: net.members, sel: net.sel });
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------
export async function joinFireteam(code, profile) {
  code = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) throw new Error('Fireteam codes are 6 letters or numbers.');
  await loadPeer();
  const peer = await openPeer(null);
  const conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
  await new Promise((res, rej) => {
    // the server knows the code but the direct link never opened: usually a strict network/firewall
    const t = setTimeout(() => rej(new Error(net.relay
      ? `Found fireteam ${code}, but couldn't connect, even through the relay. Check both connections and try again.`
      : `Found fireteam ${code}, but couldn't connect directly, and the relay server isn't available. Some school, work, or mobile networks block direct connections.`)), 15000);
    conn.on('open', () => { clearTimeout(t); res(); });
    peer.on('error', (e) => { clearTimeout(t); rej(e.type === 'peer-unavailable' ? new Error(`No fireteam found with code ${code}.`) : e); });
  }).catch((e) => { peer.destroy(); throw e; });
  net.peer = peer;
  net.hostConn = conn;
  net.role = 'client';
  net.myId = peer.id;
  net.code = code;
  net.status = '';
  conn.on('data', (msg) => {
    if (msg.t === 'lobby') { net.members = msg.members; net.sel = msg.sel; net.onLobby?.(); return; }
    if (msg.t === 'full') { leaveFireteam('That fireteam is full (3 players).'); return; }
    dispatch(msg, conn.peer);
  });
  conn.on('close', () => { if (net.isClient) { dispatch({ t: 'hostgone' }); leaveFireteam('The fireteam leader disconnected.'); } });
  conn.send({ t: 'hello', ...profile });
  return code;
}

export function leaveFireteam(reason = '') {
  const wasActive = net.active;
  try { net.peer?.destroy(); } catch (e) { console.warn(e); }
  Object.assign(net, { role: 'solo', peer: null, hostConn: null, myId: null, code: null, members: [], sel: null, status: reason });
  net.conns = new Map();
  if (wasActive) dispatch({ t: 'disbanded', reason });
  net.onLobby?.();
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------
function safeSend(conn, msg) {
  try { if (conn?.open) conn.send(msg); } catch (e) { console.warn('send failed', e); }
}
/** Host: to every member. Client: to the host. */
export function send(msg) {
  if (net.isHost) broadcast(msg);
  else if (net.isClient) safeSend(net.hostConn, msg);
}
export function broadcast(msg, exceptId = null) {
  for (const [id, c] of net.conns) if (id !== exceptId) safeSend(c, msg);
}
export function sendTo(id, msg) {
  if (net.isHost) safeSend(net.conns.get(id), msg);
}
