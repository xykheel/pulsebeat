import { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { LineChart } from '@mui/x-charts/LineChart';
import type { HeartbeatPoint, IncidentRow } from '../types';

export default function ResponseTimeChart({
  points,
  incidents = [],
  timezone = 'Australia/Sydney',
  height = 220,
}: {
  points: HeartbeatPoint[];
  incidents?: IncidentRow[];
  timezone?: string;
  height?: number;
}) {
  const theme = useTheme();
  const lineColor = theme.palette.chart.line;
  const muted = theme.palette.text.muted;
  const fontSans = theme.typography.fontFamily;
  const fillOpacity = theme.palette.chart.fillStartOpacity;

  const { xData, yData, rows } = useMemo(() => {
    const rows = points.filter(
      (p): p is HeartbeatPoint & { latency_ms: number } =>
        p.status === 1 && p.latency_ms != null
    );
    return {
      rows,
      xData: rows.map((p) => new Date(p.checked_at)),
      yData: rows.map((p) => p.latency_ms),
    };
  }, [points]);
  const yMax = useMemo(() => Math.max(...yData, 0), [yData]);

  const incidentAnnotations = useMemo(() => {
    if (!rows.length || !incidents.length || yMax <= 0) return [];
    const first = rows[0].checked_at;
    const last = rows[rows.length - 1].checked_at;
    const span = Math.max(1, last - first);

    return incidents
      .slice(0, 8)
      .map((incident) => {
        const nearest = rows.reduce((best, row) => {
          const bestDelta = Math.abs(best.checked_at - incident.started_at);
          const nextDelta = Math.abs(row.checked_at - incident.started_at);
          return nextDelta < bestDelta ? row : best;
        }, rows[0]);

        const leftPct = ((nearest.checked_at - first) / span) * 100;
        const topPct = 100 - (nearest.latency_ms / yMax) * 100;
        return {
          id: incident.id,
          leftPct,
          topPct: Math.max(8, topPct - 10),
          label: incident.cause?.trim() || 'outage',
        };
      })
      .filter((a) => a.leftPct >= 0 && a.leftPct <= 100);
  }, [incidents, rows, yMax]);

  const tickLabelStyle = {
    fontFamily: fontSans,
    fontSize: 11,
    fill: muted,
  };

  if (!xData.length) {
    return (
      <Box sx={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography color="text.secondary">No response time data yet</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', height, overflowX: 'auto', position: 'relative' }}>
      <LineChart
        height={height}
        margin={{ left: 56, right: 20, top: 16, bottom: 40 }}
        xAxis={[
          {
            id: 'checked',
            scaleType: 'time',
            data: xData,
            valueFormatter: (d) =>
              (d as Date).toLocaleString('en-AU', {
                timeZone: timezone,
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }),
            tickLabelStyle,
            stroke: muted,
          },
        ]}
        yAxis={[
          {
            id: 'latency',
            valueFormatter: (v) => {
              const rounded = Math.round(v as number);
              if (rounded === 0) return '0 ms';
              return rounded.toLocaleString('en-AU').replace(/,/g, ' ');
            },
            tickLabelStyle,
            stroke: muted,
          },
        ]}
        series={[
          {
            type: 'line',
            data: yData,
            area: true,
            showMark: true,
            curve: 'linear',
            color: lineColor,
          },
        ]}
        sx={{
          '& .MuiLineElement-root': {
            strokeWidth: 2,
          },
          '& .MuiAreaElement-root': {
            fill: alpha(lineColor, fillOpacity),
          },
        }}
      />
      {incidentAnnotations.map((annotation) => (
        <Box
          key={annotation.id}
          sx={{
            position: 'absolute',
            left: `${annotation.leftPct}%`,
            top: `${annotation.topPct}%`,
            transform: 'translate(-50%, -100%)',
            px: 0.75,
            py: 0.25,
            borderRadius: 1,
            fontSize: 11,
            lineHeight: 1.2,
            textTransform: 'lowercase',
            bgcolor: 'error.light',
            color: 'error.contrastText',
            border: 1,
            borderColor: 'error.main',
            pointerEvents: 'none',
            maxWidth: 96,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {annotation.label}
        </Box>
      ))}
    </Box>
  );
}
