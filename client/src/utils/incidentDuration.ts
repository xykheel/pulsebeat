export function formatIncidentDuration(durationSeconds: number | null | undefined): string {
  if (durationSeconds == null || !Number.isFinite(durationSeconds)) return '—';

  const totalSeconds = Math.max(0, Math.round(durationSeconds));
  if (totalSeconds < 60) return `${totalSeconds} sec`;

  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} min`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export function formatIncidentDurationTooltip(durationSeconds: number | null | undefined): string {
  if (durationSeconds == null || !Number.isFinite(durationSeconds)) return 'No duration recorded';
  const totalSeconds = Math.max(0, Math.round(durationSeconds));
  return `${totalSeconds} sec`;
}
