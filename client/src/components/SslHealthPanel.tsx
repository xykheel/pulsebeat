import { Box, Grid, Table, TableBody, TableCell, TableRow, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import GlassCard from './GlassCard';
import type { SslCheckRow } from '../types';

function tlsRank(v: string | null | undefined): number {
  if (!v) return 0;
  if (v.includes('1.3')) return 3;
  if (v.includes('1.2')) return 2;
  return 1;
}

export default function SslHealthPanel({
  latest,
  history,
}: {
  latest: SslCheckRow | null;
  history: SslCheckRow[];
}) {
  const theme = useTheme();
  if (!latest) {
    return (
      <GlassCard sx={{ p: 2.5 }}>
        <Typography variant="h6" gutterBottom>
          SSL / TLS health
        </Typography>
        <Typography variant="body2" color="text.secondary">
          No TLS validation data yet. Enable “Validate TLS certificate” for this HTTPS monitor.
        </Typography>
      </GlassCard>
    );
  }

  const now = Date.now();
  const dr = latest.days_remaining;
  const validTo = latest.valid_to;
  const validFrom = latest.valid_from;
  const expired = validTo != null && validTo < now;
  const certStatus = expired ? 'Expired' : latest.status === 1 ? 'Valid' : 'Invalid';
  const drColour =
    dr == null ? theme.palette.text.secondary : dr > 30 ? 'success.main' : dr >= 7 ? 'warning.main' : 'error.main';
  const tlsV = latest.tls_version || '—';
  const tlsColour =
    tlsRank(latest.tls_version) >= 3 ? 'success.main' : tlsRank(latest.tls_version) >= 2 ? 'warning.main' : 'error.main';
  const trustOk = latest.chain_fully_trusted === 1;
  const timelineSpan =
    validFrom != null && validTo != null && validTo > validFrom ? validTo - validFrom : 0;
  const markerPct =
    timelineSpan > 0 && validTo != null
      ? Math.min(100, Math.max(0, ((now - validFrom!) / timelineSpan) * 100))
      : 50;

  const trend = [...history].reverse().filter((r) => r.days_remaining != null);
  const w = 720;
  const h = 140;
  const pad = { t: 16, r: 16, b: 28, l: 44 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const days = trend.map((r) => r.days_remaining!);
  const dMin = days.length ? Math.min(...days) : 0;
  const dMax = days.length ? Math.max(...days, dMin + 1) : 1;
  const dSpan = dMax - dMin || 1;
  const t0 = trend[0]?.checked_at ?? now;
  const t1 = trend[trend.length - 1]?.checked_at ?? now;
  const tSpan = Math.max(1, t1 - t0);
  const path =
    trend.length > 1
      ? trend
          .map((p, i) => {
            const x = pad.l + ((p.checked_at - t0) / tSpan) * innerW;
            const y = pad.t + innerH - ((p.days_remaining! - dMin) / dSpan) * innerH;
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
          })
          .join(' ')
      : '';

  return (
    <GlassCard sx={{ p: 2.5 }}>
      <Typography variant="h6" gutterBottom>
        SSL / TLS health
      </Typography>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={6} sm={3}>
          <Typography variant="caption" color="text.secondary">
            Certificate
          </Typography>
          <Typography variant="h6" sx={{ color: certStatus === 'Valid' ? 'success.main' : 'error.main', mt: 0.5 }}>
            {certStatus}
          </Typography>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Typography variant="caption" color="text.secondary">
            Days remaining
          </Typography>
          <Typography variant="h6" sx={{ color: drColour, mt: 0.5 }}>
            {dr != null ? dr : '—'}
          </Typography>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Typography variant="caption" color="text.secondary">
            TLS version
          </Typography>
          <Typography variant="h6" sx={{ color: tlsColour, mt: 0.5, fontSize: '1rem' }}>
            {tlsV}
          </Typography>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Typography variant="caption" color="text.secondary">
            Chain trust
          </Typography>
          <Typography variant="h6" sx={{ color: trustOk ? 'success.main' : 'error.main', mt: 0.5 }}>
            {trustOk ? 'Trusted' : 'Untrusted'}
          </Typography>
        </Grid>
      </Grid>

      {validFrom != null && validTo != null && timelineSpan > 0 ? (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
            Certificate lifetime
          </Typography>
          <Box
            sx={{
              position: 'relative',
              height: 10,
              borderRadius: 5,
              background: `linear-gradient(90deg, ${theme.palette.success.main}33 0%, ${theme.palette.warning.main}44 50%, ${theme.palette.error.main}55 100%)`,
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                left: `${markerPct}%`,
                top: -3,
                width: 3,
                height: 16,
                borderRadius: 1,
                bgcolor: 'primary.main',
                transform: 'translateX(-50%)',
              }}
            />
          </Box>
          <Box className="mt-1 flex justify-between">
            <Typography variant="caption" color="text.secondary">
              {new Date(validFrom).toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney' })}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {new Date(validTo).toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney' })}
            </Typography>
          </Box>
        </Box>
      ) : null}

      <Typography variant="subtitle2" gutterBottom sx={{ mt: 1 }}>
        Days remaining (last {history.length} checks)
      </Typography>
      {trend.length > 1 ? (
        <Box sx={{ width: '100%', overflowX: 'auto', mb: 2 }}>
          <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
            <path
              d={path}
              fill="none"
              stroke={theme.palette.chart.line}
              strokeWidth={1.8}
              strokeLinecap="round"
            />
            <text x={pad.l} y={h - 6} fill={theme.palette.text.muted} fontSize={10}>
              {new Date(t0).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}
            </text>
            <text x={w - pad.r} y={h - 6} textAnchor="end" fill={theme.palette.text.muted} fontSize={10}>
              {new Date(t1).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}
            </text>
          </svg>
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Need more checks to plot a trend.
        </Typography>
      )}

      <Typography variant="subtitle2" gutterBottom>
        Certificate details
      </Typography>
      <Table size="small">
        <TableBody>
          {[
            ['Subject (CN)', latest.subject_cn],
            ['Subject Alternative Names', latest.subject_alt_names],
            ['Serial number', latest.serial_number],
            ['SHA-256 fingerprint', latest.sha256_fingerprint],
            ['TLS version', latest.tls_version],
            ['Cipher suite', latest.cipher_suite],
            ['Chain fully trusted', latest.chain_fully_trusted === 1 ? 'Yes' : 'No'],
            ['Self-signed', latest.self_signed === 1 ? 'Yes' : 'No'],
            ['Valid from', validFrom ? new Date(validFrom).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' }) : '—'],
            ['Valid to', validTo ? new Date(validTo).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' }) : '—'],
            ['Last message', latest.message],
          ].map(([k, v]) => (
            <TableRow key={String(k)}>
              <TableCell sx={{ color: 'text.secondary', width: 200 }}>{k}</TableCell>
              <TableCell sx={{ wordBreak: 'break-word', typography: 'body2' }}>{v || '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </GlassCard>
  );
}
