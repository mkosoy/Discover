export function ago(input: string | number) {
  const ms = Date.now() - new Date(input).getTime();
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function until(input: string | number) {
  const ms = new Date(input).getTime() - Date.now();
  if (ms <= 0) return ago(input);
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return 'under 1m';
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in ${hours}h`;
  return `in ${Math.round(hours / 24)}d`;
}
