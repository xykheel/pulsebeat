import { execFile } from 'child_process';
import { promises as dnsPromises } from 'dns';
import net from 'net';
import tls from 'tls';
import { URL } from 'url';
import { promisify } from 'util';
import {
  insertHeartbeat,
  getMonitor,
  listMonitors,
  openIncident,
  resolveOpenIncident,
  getLatestHeartbeat,
  runRetentionPrune,
  insertSslCheck,
  getLatestSslCheck,
  getMergedSettings,
  type MonitorRow,
  type SslCheckInsert,
} from './db.js';
import { isMonitorInActiveMaintenance } from './maintenance.js';
import { notifyMonitorEvent, notifySslAlert } from './notifications/dispatch.js';

const execFileAsync = promisify(execFile);

const timers = new Map<number, ReturnType<typeof setInterval>>();

function parseTcpTarget(url: string): { host: string; port: number } {
  const s = url.trim();
  if (s.startsWith('tcp://')) {
    const u = new URL(s);
    return { host: u.hostname, port: Number(u.port) || 0 };
  }
  const idx = s.lastIndexOf(':');
  if (idx <= 0) return { host: s, port: 0 };
  const host = s.slice(0, idx).replace(/^\[|\]$/g, '');
  const port = Number(s.slice(idx + 1));
  return { host, port: Number.isFinite(port) ? port : 0 };
}

interface CheckResult {
  ok: boolean;
  latency: number | null;
  message: string;
  resolved?: string | null;
}

function checkTcp(host: string, port: number, timeoutMs: number): Promise<CheckResult> {
  const started = Date.now();
  return new Promise((resolve) => {
    if (!host || !port) {
      resolve({ ok: false, latency: null, message: 'Invalid host:port' });
      return;
    }
    const socket = net.createConnection({ host, port }, () => {
      const latency = Date.now() - started;
      socket.destroy();
      resolve({ ok: true, latency, message: 'Connected' });
    });
    socket.setTimeout(timeoutMs);
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ ok: false, latency: null, message: 'TCP timeout' });
    });
    socket.on('error', (err: Error) => {
      resolve({ ok: false, latency: null, message: err.message || 'TCP error' });
    });
  });
}

async function checkPing(host: string, timeoutMs: number): Promise<CheckResult> {
  const waitSec = Math.max(1, Math.ceil(timeoutMs / 1000));
  const started = Date.now();
  try {
    const { stdout } = await execFileAsync('ping', ['-c', '1', '-W', String(waitSec), host], {
      timeout: timeoutMs + 2000,
      maxBuffer: 256 * 1024,
    });
    const latency = Date.now() - started;
    const m = stdout.toString().match(/time[=<]([\d.]+)\s*ms/i);
    const parsed = m ? Math.round(parseFloat(m[1])) : latency;
    return { ok: true, latency: parsed, message: 'Ping OK' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Ping failed';
    return { ok: false, latency: null, message };
  }
}

function parseHttpsHostPort(rawUrl: string): { host: string; port: number } | null {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'https:') return null;
    const host = u.hostname;
    const port = u.port ? Number(u.port) : 443;
    if (!host || !Number.isFinite(port)) return null;
    return { host, port };
  } catch {
    return null;
  }
}

function tlsVersionRank(v: string | null | undefined): number {
  if (!v) return 0;
  if (v.includes('1.3') || v === 'TLSv1.3') return 3;
  if (v.includes('1.2') || v === 'TLSv1.2') return 2;
  if (v.includes('1.1') || v === 'TLSv1.1') return 1;
  if (v.includes('1.0') || v === 'TLSv1') return 0;
  return 0;
}

function buildSslRowFromSocket(
  socket: tls.TLSSocket,
  monitorId: number,
  httpOk: boolean,
  baseMessage: string
): { check: CheckResult; ssl: SslCheckInsert } {
  const checkedAt = Date.now();
  try {
    const authorized = Boolean(socket.authorized);
    const cipher = socket.getCipher();
    const proto = socket.getProtocol() || '';
    const cert = socket.getPeerCertificate(true) as tls.PeerCertificate;

    const validToStr = cert?.valid_to;
    const validFromStr = cert?.valid_from;
    if (!validToStr || !cert || Object.keys(cert).length === 0) {
      const ssl: SslCheckInsert = {
        monitor_id: monitorId,
        checked_at: checkedAt,
        status: 0,
        days_remaining: null,
        subject_cn: null,
        subject_alt_names: null,
        serial_number: null,
        sha256_fingerprint: null,
        tls_version: proto || null,
        cipher_suite: cipher?.name || null,
        chain_fully_trusted: authorized ? 1 : 0,
        self_signed: null,
        valid_from: null,
        valid_to: null,
        message: 'TLS: no certificate',
      };
      return {
        check: { ok: false, latency: null, message: `${baseMessage} · TLS: no certificate` },
        ssl,
      };
    }

    const exp = new Date(validToStr);
    const notBefore = validFromStr ? new Date(validFromStr) : null;
    const now = Date.now();
    const expOk = !Number.isNaN(exp.getTime());
    const daysLeft = expOk ? Math.floor((exp.getTime() - now) / (24 * 60 * 60 * 1000)) : null;
    const cn =
      (cert.subject && typeof cert.subject === 'object' && 'CN' in cert.subject
        ? String((cert.subject as { CN?: string }).CN)
        : null) || null;
    const sanRaw =
      typeof (cert as { subjectaltname?: string }).subjectaltname === 'string'
        ? String((cert as { subjectaltname?: string }).subjectaltname)
        : null;
    const serial = cert.serialNumber != null ? String(cert.serialNumber) : null;
    const sha =
      typeof (cert as { fingerprint256?: string }).fingerprint256 === 'string'
        ? String((cert as { fingerprint256?: string }).fingerprint256)
        : typeof cert.fingerprint === 'string'
          ? String(cert.fingerprint)
          : null;
    const issuerCert = (cert as tls.PeerCertificate & { issuerCertificate?: tls.PeerCertificate })
      .issuerCertificate;
    const selfSigned =
      !issuerCert ||
      issuerCert.fingerprint256 === cert.fingerprint256 ||
      JSON.stringify(cert.issuer) === JSON.stringify(cert.subject)
        ? 1
        : 0;

    let certOk = true;
    let msg = `TLS OK · CN ${cn ?? '—'} · expires ${exp.toISOString().slice(0, 10)} (${daysLeft ?? '?'}d)`;
    if (!expOk) {
      certOk = false;
      msg = 'TLS: invalid certificate dates';
    } else if (exp.getTime() < now) {
      certOk = false;
      msg = `TLS: certificate expired ${exp.toISOString().slice(0, 10)}`;
    } else if (!authorized) {
      certOk = false;
      msg = `TLS: chain not trusted (${socket.authorizationError || 'unauthorised'})`;
    }

    const ssl: SslCheckInsert = {
      monitor_id: monitorId,
      checked_at: checkedAt,
      status: certOk && httpOk ? 1 : 0,
      days_remaining: daysLeft,
      subject_cn: cn,
      subject_alt_names: sanRaw,
      serial_number: serial,
      sha256_fingerprint: sha,
      tls_version: proto || null,
      cipher_suite: cipher?.name || null,
      chain_fully_trusted: authorized ? 1 : 0,
      self_signed: selfSigned,
      valid_from: notBefore && !Number.isNaN(notBefore.getTime()) ? notBefore.getTime() : null,
      valid_to: expOk ? exp.getTime() : null,
      message: msg,
    };

    const overallOk = httpOk && certOk;
    return {
      check: {
        ok: overallOk,
        latency: null,
        message: httpOk ? `${baseMessage} · ${msg}` : baseMessage,
      },
      ssl,
    };
  } catch (e: unknown) {
    const m = e instanceof Error ? e.message : 'TLS error';
    const ssl: SslCheckInsert = {
      monitor_id: monitorId,
      checked_at: checkedAt,
      status: 0,
      days_remaining: null,
      subject_cn: null,
      subject_alt_names: null,
      serial_number: null,
      sha256_fingerprint: null,
      tls_version: null,
      cipher_suite: null,
      chain_fully_trusted: 0,
      self_signed: null,
      valid_from: null,
      valid_to: null,
      message: `TLS: ${m}`,
    };
    return {
      check: { ok: false, latency: null, message: `${baseMessage} · TLS: ${m}` },
      ssl,
    };
  }
}

function checkTlsCertificateExtended(
  monitorId: number,
  host: string,
  port: number,
  timeoutMs: number,
  httpOk: boolean,
  httpPart: string
): Promise<{ check: CheckResult; ssl: SslCheckInsert }> {
  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host,
        port,
        servername: host,
        rejectUnauthorized: true,
      },
      () => {
        try {
          const out = buildSslRowFromSocket(socket, monitorId, httpOk, httpPart);
          socket.destroy();
          resolve(out);
        } catch (e: unknown) {
          try {
            socket.destroy();
          } catch {
            /* ignore */
          }
          const msg = e instanceof Error ? e.message : 'TLS error';
          resolve({
            check: { ok: false, latency: null, message: `${httpPart} · TLS: ${msg}` },
            ssl: {
              monitor_id: monitorId,
              checked_at: Date.now(),
              status: 0,
              days_remaining: null,
              subject_cn: null,
              subject_alt_names: null,
              serial_number: null,
              sha256_fingerprint: null,
              tls_version: null,
              cipher_suite: null,
              chain_fully_trusted: 0,
              self_signed: null,
              valid_from: null,
              valid_to: null,
              message: `TLS: ${msg}`,
            },
          });
        }
      }
    );
    socket.setTimeout(timeoutMs, () => {
      socket.destroy();
      resolve({
        check: { ok: false, latency: null, message: `${httpPart} · TLS handshake timeout` },
        ssl: {
          monitor_id: monitorId,
          checked_at: Date.now(),
          status: 0,
          days_remaining: null,
          subject_cn: null,
          subject_alt_names: null,
          serial_number: null,
          sha256_fingerprint: null,
          tls_version: null,
          cipher_suite: null,
          chain_fully_trusted: 0,
          self_signed: null,
          valid_from: null,
          valid_to: null,
          message: 'TLS handshake timeout',
        },
      });
    });
    socket.on('error', (err: Error) => {
      resolve({
        check: { ok: false, latency: null, message: `${httpPart} · TLS: ${err.message || 'error'}` },
        ssl: {
          monitor_id: monitorId,
          checked_at: Date.now(),
          status: 0,
          days_remaining: null,
          subject_cn: null,
          subject_alt_names: null,
          serial_number: null,
          sha256_fingerprint: null,
          tls_version: null,
          cipher_suite: null,
          chain_fully_trusted: 0,
          self_signed: null,
          valid_from: null,
          valid_to: null,
          message: `TLS: ${err.message || 'error'}`,
        },
      });
    });
  });
}

type DnsRecordType = 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT';

function parseDnsConfig(raw: string): {
  hostname: string;
  expected_ip: string;
  resolver: string;
  record_type: DnsRecordType;
} {
  try {
    const j = JSON.parse(raw || '{}') as Record<string, unknown>;
    const hostname = String(j.hostname || '').trim();
    const expected_ip = String(j.expected_ip || '').trim();
    const resolver = String(j.resolver || '').trim();
    const rt = String(j.record_type || 'A').toUpperCase();
    const record_type = (['A', 'AAAA', 'CNAME', 'MX', 'TXT'].includes(rt) ? rt : 'A') as DnsRecordType;
    return { hostname, expected_ip, resolver, record_type };
  } catch {
    return { hostname: '', expected_ip: '', resolver: '', record_type: 'A' };
  }
}

function dnsValueMatches(got: string, expected: string, recordType: DnsRecordType): boolean {
  const exp = expected.trim().toLowerCase();
  if (!exp) return true;
  const g = got.trim().toLowerCase();
  if (recordType === 'A' || recordType === 'AAAA') {
    return g.split(/,\s*/).some((x) => x.trim() === exp);
  }
  return g.includes(exp);
}

async function checkDns(monitor: MonitorRow, timeoutMs: number): Promise<CheckResult> {
  const cfg = parseDnsConfig(monitor.dns_config);
  const host = (cfg.hostname || monitor.url).trim();
  if (!host) {
    return { ok: false, latency: null, message: 'DNS: missing hostname', resolved: null };
  }
  const resolver = new dnsPromises.Resolver();
  if (cfg.resolver) {
    try {
      resolver.setServers([cfg.resolver]);
    } catch {
      return { ok: false, latency: null, message: 'DNS: invalid resolver', resolved: null };
    }
  }
  const t0 = Date.now();
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), timeoutMs);
  let value = '';
  try {
    const work = async (): Promise<void> => {
      switch (cfg.record_type) {
        case 'A': {
          const r = await resolver.resolve4(host);
          value = r.join(', ');
          break;
        }
        case 'AAAA': {
          const r = await resolver.resolve6(host);
          value = r.join(', ');
          break;
        }
        case 'CNAME': {
          const r = await resolver.resolveCname(host);
          value = r.join(', ');
          break;
        }
        case 'MX': {
          const r = await resolver.resolveMx(host);
          value = r
            .slice()
            .sort((a, b) => a.priority - b.priority)
            .map((x) => `${x.priority} ${x.exchange}`)
            .join('; ');
          break;
        }
        case 'TXT': {
          const r = await resolver.resolveTxt(host);
          value = r.map((chunk) => chunk.join('')).join(' | ');
          break;
        }
        default:
          value = '';
      }
    };
    const abortPromise = new Promise<never>((_, rej) => {
      controller.signal.addEventListener('abort', () => rej(new Error('DNS timeout')));
    });
    await Promise.race([work(), abortPromise]);
    clearTimeout(to);
    const latency = Date.now() - t0;
    if (!dnsValueMatches(value, cfg.expected_ip, cfg.record_type)) {
      return {
        ok: false,
        latency,
        message: `DNS mismatch: got ${value || '—'}, expected ${cfg.expected_ip}`,
        resolved: value || null,
      };
    }
    return {
      ok: true,
      latency,
      message: `DNS ${cfg.record_type} OK · ${value}`,
      resolved: value || null,
    };
  } catch (e: unknown) {
    clearTimeout(to);
    const msg = e instanceof Error ? e.message : 'DNS error';
    return { ok: false, latency: null, message: `DNS: ${msg}`, resolved: null };
  }
}

async function checkHttp(
  monitorId: number,
  url: string,
  timeoutMs: number,
  retries: number,
  validateTls: boolean
): Promise<{ result: CheckResult; ssl: SslCheckInsert | null }> {
  let lastMessage = 'Request failed';
  for (let attempt = 0; attempt <= retries; attempt++) {
    const started = Date.now();
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
        headers: { Accept: '*/*', 'User-Agent': 'Pulsebeat/1.8' },
      });
      clearTimeout(t);
      const latency = Date.now() - started;
      if (res.ok) {
        const httpPart = `HTTP ${res.status}`;
        if (validateTls) {
          const hp = parseHttpsHostPort(url);
          if (!hp) {
            return {
              result: {
                ok: false,
                latency,
                message: `${httpPart} · TLS validation requires https:// URL`,
              },
              ssl: null,
            };
          }
          const ext = await checkTlsCertificateExtended(
            monitorId,
            hp.host,
            hp.port,
            timeoutMs,
            true,
            httpPart
          );
          return {
            result: { ok: ext.check.ok, latency, message: ext.check.message },
            ssl: ext.ssl,
          };
        }
        return { result: { ok: true, latency, message: httpPart }, ssl: null };
      }
      lastMessage = `HTTP ${res.status}`;
    } catch (e: unknown) {
      clearTimeout(t);
      const name = e instanceof Error ? e.name : '';
      const msg = e instanceof Error ? e.message : 'HTTP error';
      lastMessage = name === 'AbortError' ? 'HTTP timeout' : msg;
    }
    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return { result: { ok: false, latency: null, message: lastMessage }, ssl: null };
}

function maybeSslNotify(
  monitor: MonitorRow,
  ssl: SslCheckInsert,
  inMaint: boolean,
  prev: ReturnType<typeof getLatestSslCheck> | undefined
): void {
  if (inMaint || monitor.check_ssl !== 1) return;
  const settings = getMergedSettings();
  const warnD = parseInt(settings.ssl_warning_days || '30', 10);
  const critD = parseInt(settings.ssl_critical_days || '7', 10);
  const alertSelf = settings.ssl_alert_self_signed === '1';
  const alertTlsOld = settings.ssl_alert_tls_below_12 !== '0';
  const dr = ssl.days_remaining;
  const rank = tlsVersionRank(ssl.tls_version);
  const prevRank = tlsVersionRank(prev?.tls_version ?? null);
  const self = ssl.self_signed === 1;
  const lines: string[] = [];

  if (dr != null && Number.isFinite(dr)) {
    const pdr = prev?.days_remaining;
    if (dr < critD && (pdr == null || !Number.isFinite(pdr) || pdr >= critD)) {
      lines.push(`Certificate critical: ${dr} day(s) remaining`);
    } else if (
      dr >= critD &&
      dr < warnD &&
      (pdr == null || !Number.isFinite(pdr) || pdr >= warnD)
    ) {
      lines.push(`Certificate warning: ${dr} day(s) remaining`);
    }
  }
  if (alertSelf && self && prev?.self_signed !== 1) {
    lines.push('Certificate is self-signed');
  }
  if (alertTlsOld && rank < 2 && prevRank >= 2) {
    lines.push(`TLS version is below 1.2 (${ssl.tls_version || 'unknown'})`);
  }
  if (ssl.status !== 1 && prev?.status === 1) {
    lines.push(ssl.message || 'SSL check failed');
  }

  if (lines.length) {
    notifySslAlert(monitor, lines.join(' · ')).catch(() => {});
  }
}

/** Run a single check immediately (manual refresh). */
export async function checkMonitorNow(monitorId: number): Promise<void> {
  const fresh = getMonitor(monitorId);
  if (!fresh) throw new Error('Monitor not found');
  try {
    await runCheck(fresh);
  } catch {
    insertHeartbeat(
      fresh.id,
      false,
      null,
      'Checker error',
      null,
      isMonitorInActiveMaintenance(fresh.id) ? 1 : 0
    );
  }
}

async function runCheck(monitor: MonitorRow): Promise<void> {
  const timeout = monitor.timeout_ms;
  const retries = monitor.retries ?? 0;
  const inMaint = isMonitorInActiveMaintenance(monitor.id);
  let result: CheckResult;
  let sslRow: SslCheckInsert | null = null;

  if (monitor.type === 'http') {
    const validateTls = monitor.check_ssl === 1;
    const { result: r, ssl } = await checkHttp(monitor.id, monitor.url, timeout, retries, validateTls);
    result = r;
    sslRow = ssl;
  } else if (monitor.type === 'tcp') {
    const { host, port } = parseTcpTarget(monitor.url);
    result = await checkTcp(host, port, timeout);
    for (let i = 0; !result.ok && i < retries; i++) {
      await new Promise((res) => setTimeout(res, 500));
      result = await checkTcp(host, port, timeout);
    }
  } else if (monitor.type === 'ping') {
    const host = monitor.url.replace(/^ping:\/\//, '').trim();
    result = await checkPing(host, timeout);
    for (let i = 0; !result.ok && i < retries; i++) {
      await new Promise((res) => setTimeout(res, 500));
      result = await checkPing(host, timeout);
    }
  } else if (monitor.type === 'dns') {
    result = await checkDns(monitor, timeout);
    for (let i = 0; !result.ok && i < retries; i++) {
      await new Promise((res) => setTimeout(res, 500));
      result = await checkDns(monitor, timeout);
    }
  } else {
    result = { ok: false, latency: null, message: 'Unknown monitor type' };
  }

  if (sslRow) {
    const prevSsl = monitor.check_ssl === 1 ? getLatestSslCheck(monitor.id) : undefined;
    insertSslCheck(sslRow);
    maybeSslNotify(monitor, sslRow, inMaint, prevSsl);
  }

  const prev = getLatestHeartbeat(monitor.id);
  const wasUp = prev ? prev.status === 1 : true;

  insertHeartbeat(
    monitor.id,
    result.ok,
    result.latency,
    result.message,
    result.resolved ?? null,
    inMaint ? 1 : 0
  );

  if (inMaint) return;

  if (wasUp && !result.ok) {
    openIncident(monitor.id, result.message);
    notifyMonitorEvent(monitor, 'down', result.message).catch(() => {});
  } else if (!wasUp && result.ok) {
    resolveOpenIncident(monitor.id);
    notifyMonitorEvent(monitor, 'up', result.message).catch(() => {});
  }
}

export function scheduleMonitor(monitor: MonitorRow): void {
  clearMonitorSchedule(monitor.id);
  if (!monitor.active) return;
  const ms = Math.max(5, Number(monitor.interval_sec) || 60) * 1000;
  const tick = async (): Promise<void> => {
    const fresh = getMonitor(monitor.id);
    if (!fresh || !fresh.active) return;
    try {
      await runCheck(fresh);
    } catch {
      insertHeartbeat(
        fresh.id,
        false,
        null,
        'Checker error',
        null,
        isMonitorInActiveMaintenance(fresh.id) ? 1 : 0
      );
    }
  };
  setTimeout(tick, 1500);
  const id = setInterval(tick, ms);
  timers.set(monitor.id, id);
}

export function clearMonitorSchedule(monitorId: number): void {
  const id = timers.get(monitorId);
  if (id) {
    clearInterval(id);
    timers.delete(monitorId);
  }
}

export function rescheduleAll(): void {
  const all = listMonitors();
  for (const m of all) {
    if (m.active) scheduleMonitor(m);
    else clearMonitorSchedule(m.id);
  }
}

let pruneTimer: ReturnType<typeof setInterval> | undefined;
export function startPruneJob(): void {
  if (pruneTimer) clearInterval(pruneTimer);
  pruneTimer = setInterval(() => {
    try {
      runRetentionPrune();
    } catch {
      /* ignore */
    }
  }, 6 * 60 * 60 * 1000);
}
