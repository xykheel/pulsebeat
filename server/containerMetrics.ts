import fs from 'fs';
import os from 'os';
import path from 'path';

export interface ContainerMetricsPayload {
  /** How metrics were collected */
  source: 'cgroup_v2' | 'cgroup_v1_memory' | 'process';
  cpu_percent: number | null;
  memory_bytes: number | null;
  memory_limit_bytes: number | null;
  memory_percent: number | null;
  net_rx_bytes: number | null;
  net_tx_bytes: number | null;
  block_read_bytes: number | null;
  block_write_bytes: number | null;
  pids: number | null;
  pids_max: number | null;
  sampled_at_ms: number;
}

function readFileTrim(p: string): string | null {
  try {
    return fs.readFileSync(p, 'utf8').trim();
  } catch {
    return null;
  }
}

function parsePositiveInt(s: string | null): number | null {
  if (s == null || s === '') return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Resolve cgroup v2 directory for this process (Docker / modern Linux). */
function resolveCgroupV2Base(): string | null {
  const raw = readFileTrim('/proc/self/cgroup');
  if (!raw) return null;
  for (const line of raw.split('\n')) {
    if (!line.startsWith('0::')) continue;
    const rest = line.slice(3).trim();
    const suffix = rest === '' || rest === '/' ? '' : `/${rest.replace(/^\/+/, '')}`;
    const candidates = [`/sys/fs/cgroup${suffix}`, '/sys/fs/cgroup'];
    for (const base of candidates) {
      try {
        if (fs.existsSync(path.join(base, 'memory.current'))) return base;
      } catch {
        /* ignore */
      }
    }
  }
  try {
    if (fs.existsSync('/sys/fs/cgroup/memory.current')) return '/sys/fs/cgroup';
  } catch {
    /* ignore */
  }
  return null;
}

function parseCpuStatUsageUsec(content: string): number | null {
  for (const line of content.split('\n')) {
    if (line.startsWith('usage_usec ')) {
      return parsePositiveInt(line.slice('usage_usec '.length).trim());
    }
  }
  return null;
}

function parseMemoryMax(s: string): number | null {
  const t = s.trim();
  if (!t || t === 'max') return null;
  return parsePositiveInt(t);
}

function parseProcNetDev(): { rx: number; tx: number } | null {
  const raw = readFileTrim('/proc/net/dev');
  if (!raw) return null;
  const lines = raw.split('\n');
  let rx = 0;
  let tx = 0;
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const iface = line.slice(0, colon).trim();
    if (iface === 'lo') continue;
    const rest = line.slice(colon + 1).trim().split(/\s+/);
    if (rest.length < 9) continue;
    const r = parseInt(rest[0], 10);
    const t = parseInt(rest[8], 10);
    if (Number.isFinite(r)) rx += r;
    if (Number.isFinite(t)) tx += t;
  }
  return { rx, tx };
}

function parseIoStat(content: string): { read: number; write: number } {
  let read = 0;
  let write = 0;
  const rbytes = /rbytes=(\d+)/g;
  const wbytes = /wbytes=(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = rbytes.exec(content)) !== null) {
    read += parseInt(m[1], 10) || 0;
  }
  while ((m = wbytes.exec(content)) !== null) {
    write += parseInt(m[1], 10) || 0;
  }
  return { read, write };
}

/** cgroup v1 memory path from `N:memory:/path` */
function resolveCgroupV1MemoryDir(): string | null {
  const raw = readFileTrim('/proc/self/cgroup');
  if (!raw) return null;
  for (const line of raw.split('\n')) {
    const parts = line.split(':');
    if (parts.length >= 3 && parts[1] === 'memory') {
      const rel = parts.slice(2).join(':').replace(/^\/+/, '');
      const base = path.join('/sys/fs/cgroup/memory', rel);
      try {
        if (fs.existsSync(path.join(base, 'memory.usage_in_bytes'))) return base;
      } catch {
        /* ignore */
      }
    }
  }
  return null;
}

let prevCpuUsageUsec: number | undefined;
let prevCpuSampleAtMs: number | undefined;

function cpuPercentSinceLastSample(usageUsec: number, nowMs: number, numCpu: number): number | null {
  if (prevCpuUsageUsec === undefined || prevCpuSampleAtMs === undefined) {
    prevCpuUsageUsec = usageUsec;
    prevCpuSampleAtMs = nowMs;
    return null;
  }
  const du = usageUsec - prevCpuUsageUsec;
  const dtSec = (nowMs - prevCpuSampleAtMs) / 1000;
  prevCpuUsageUsec = usageUsec;
  prevCpuSampleAtMs = nowMs;
  if (dtSec <= 0 || numCpu <= 0) return null;
  const cpuSeconds = du / 1_000_000;
  const pct = (100 * cpuSeconds) / (dtSec * numCpu);
  return Math.min(100, Math.max(0, pct));
}

export function getContainerMetrics(): ContainerMetricsPayload {
  const now = Date.now();
  const numCpu = Math.max(1, os.cpus().length);
  const net = parseProcNetDev();

  const base = resolveCgroupV2Base();
  if (base) {
    const memCur = parsePositiveInt(readFileTrim(path.join(base, 'memory.current')));
    const memMaxRaw = readFileTrim(path.join(base, 'memory.max'));
    const memLimit = memMaxRaw != null ? parseMemoryMax(memMaxRaw) : null;
    const memPct =
      memCur != null && memLimit != null && memLimit > 0
        ? Math.min(100, (100 * memCur) / memLimit)
        : null;

    const cpuStat = readFileTrim(path.join(base, 'cpu.stat'));
    const usageUsec = cpuStat ? parseCpuStatUsageUsec(cpuStat) : null;
    const cpuPct = usageUsec != null ? cpuPercentSinceLastSample(usageUsec, now, numCpu) : null;

    const pidsCur = parsePositiveInt(readFileTrim(path.join(base, 'pids.current')));
    const pidsMaxRaw = readFileTrim(path.join(base, 'pids.max'));
    const pidsMax = pidsMaxRaw != null && pidsMaxRaw !== 'max' ? parsePositiveInt(pidsMaxRaw) : null;

    let blockRead: number | null = null;
    let blockWrite: number | null = null;
    const ioStatPath = path.join(base, 'io.stat');
    const ioContent = readFileTrim(ioStatPath);
    if (ioContent) {
      const io = parseIoStat(ioContent);
      blockRead = io.read;
      blockWrite = io.write;
    }

    return {
      source: 'cgroup_v2',
      cpu_percent: cpuPct,
      memory_bytes: memCur,
      memory_limit_bytes: memLimit,
      memory_percent: memPct,
      net_rx_bytes: net?.rx ?? null,
      net_tx_bytes: net?.tx ?? null,
      block_read_bytes: blockRead,
      block_write_bytes: blockWrite,
      pids: pidsCur,
      pids_max: pidsMax,
      sampled_at_ms: now,
    };
  }

  const memV1 = resolveCgroupV1MemoryDir();
  if (memV1) {
    const memCur = parsePositiveInt(readFileTrim(path.join(memV1, 'memory.usage_in_bytes')));
    const memLimRaw = parsePositiveInt(readFileTrim(path.join(memV1, 'memory.limit_in_bytes')));
    /** Treat kernel “no limit” sentinel (~9e18) as unlimited */
    const HUGE_BYTES = 64 * 1024 * 1024 * 1024 * 1024; // 64 TiB
    const effectiveLimit =
      memLimRaw != null && memLimRaw > 0 && memLimRaw < HUGE_BYTES ? memLimRaw : null;
    const memPct =
      memCur != null && effectiveLimit != null && effectiveLimit > 0
        ? Math.min(100, (100 * memCur) / effectiveLimit)
        : null;

    return {
      source: 'cgroup_v1_memory',
      cpu_percent: null,
      memory_bytes: memCur,
      memory_limit_bytes: effectiveLimit,
      memory_percent: memPct,
      net_rx_bytes: net?.rx ?? null,
      net_tx_bytes: net?.tx ?? null,
      block_read_bytes: null,
      block_write_bytes: null,
      pids: null,
      pids_max: null,
      sampled_at_ms: now,
    };
  }

  const mu = process.memoryUsage();
  return {
    source: 'process',
    cpu_percent: null,
    memory_bytes: mu.rss,
    memory_limit_bytes: null,
    memory_percent: null,
    net_rx_bytes: net?.rx ?? null,
    net_tx_bytes: net?.tx ?? null,
    block_read_bytes: null,
    block_write_bytes: null,
    pids: null,
    pids_max: null,
    sampled_at_ms: now,
  };
}
