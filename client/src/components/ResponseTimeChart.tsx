import { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { LineChart } from '@mui/x-charts/LineChart';
import type { HeartbeatPoint } from '../types';

export default function ResponseTimeChart({
  points,
  height = 220,
}: {
  points: HeartbeatPoint[];
  height?: number;
}) {
  const theme = useTheme();
  const lineColor = theme.palette.chart.line;
  const muted = theme.palette.text.muted;
  const fontSans = theme.typography.fontFamily;
  const fillOpacity = theme.palette.chart.fillStartOpacity;

  const { xData, yData } = useMemo(() => {
    const rows = points.filter(
      (p): p is HeartbeatPoint & { latency_ms: number } =>
        p.status === 1 && p.latency_ms != null
    );
    return {
      xData: rows.map((p) => new Date(p.checked_at)),
      yData: rows.map((p) => p.latency_ms),
    };
  }, [points]);

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
    <Box sx={{ width: '100%', height, overflowX: 'auto' }}>
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
                timeZone: 'Australia/Sydney',
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
            valueFormatter: (v) => `${Math.round(v as number)} ms`,
            tickLabelStyle,
            stroke: muted,
          },
        ]}
        series={[
          {
            type: 'line',
            data: yData,
            area: true,
            showMark: false,
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
    </Box>
  );
}
