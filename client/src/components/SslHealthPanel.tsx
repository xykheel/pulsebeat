import { useState } from 'react';
import { Box, Button, Grid, Stack, Table, TableBody, TableCell, TableRow, Typography } from '@mui/material';
import { useTheme, type SxProps, type Theme } from '@mui/material/styles';
import ShieldIcon from '@mui/icons-material/Shield';
import GlassCard from './GlassCard';
import type { SslCheckRow } from '../types';

function tlsRank(v: string | null | undefined): number {
  if (!v) return 0;
  if (v.includes('1.3')) return 3;
  if (v.includes('1.2')) return 2;
  return 1;
}

type ShieldLevel = 'neutral' | 'ok' | 'warn' | 'error';

function sslShieldLevel(
  latest: SslCheckRow,
  expired: boolean,
  trustOk: boolean,
  daysRemaining: number | null
): ShieldLevel {
  if (expired || latest.status !== 1) return 'error';
  if (!trustOk) return 'error';
  if (daysRemaining != null && daysRemaining <= 7) return 'error';
  if (daysRemaining != null && daysRemaining <= 30) return 'warn';
  if (tlsRank(latest.tls_version) < 2) return 'warn';
  return 'ok';
}

function shieldSx(level: ShieldLevel) {
  switch (level) {
    case 'ok':
      return { color: 'success.main' };
    case 'warn':
      return { color: 'warning.main' };
    case 'error':
      return { color: 'error.main' };
    default:
      return { color: 'text.secondary' };
  }
}

export default function SslHealthPanel({
  latest,
  history,
  sx,
}: {
  latest: SslCheckRow | null;
  history: SslCheckRow[];
  sx?: SxProps<Theme>;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const theme = useTheme();
  if (!latest) {
    return (
      <GlassCard
        sx={[
          {
            p: 2.5,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <ShieldIcon sx={{ fontSize: 28, ...shieldSx('neutral') }} aria-hidden />
          <Typography variant="h6" component="h2" sx={{ m: 0 }}>
            SSL / TLS health
          </Typography>
        </Stack>
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
  const shieldLevel = sslShieldLevel(latest, expired, trustOk, dr);
  const timelineSpan =
    validFrom != null && validTo != null && validTo > validFrom ? validTo - validFrom : 0;
  const markerPct =
    timelineSpan > 0 && validTo != null
      ? Math.min(100, Math.max(0, ((now - validFrom!) / timelineSpan) * 100))
      : 50;

  const trend = [...history].reverse().filter((r) => r.days_remaining != null);
  return (
    <GlassCard
      sx={[
        {
          p: 2.5,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <ShieldIcon sx={{ fontSize: 28, ...shieldSx(shieldLevel) }} aria-hidden />
        <Typography variant="h6" component="h2" sx={{ m: 0 }}>
          SSL / TLS health
        </Typography>
      </Stack>

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
          <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="caption" color="text.secondary">
              {new Date(validFrom).toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney' })}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {new Date(validTo).toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney' })}
            </Typography>
          </Box>
        </Box>
      ) : null}

      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={2}
        sx={{ pt: 1, mt: 'auto' }}
      >
        <Typography variant="body2" color="text.secondary">
          {trend.length > 1
            ? `Tracking ${history.length} recent TLS checks`
            : 'Need more checks to show TLS trend history'}
        </Typography>
        <Button size="small" onClick={() => setShowDetails((prev) => !prev)}>
          {showDetails ? 'Details ↑' : 'Details ↓'}
        </Button>
      </Stack>

      {showDetails ? (
        <>
          <Typography variant="subtitle2" gutterBottom sx={{ mt: 1 }}>
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
        </>
      ) : null}
    </GlassCard>
  );
}
