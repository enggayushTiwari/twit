export const AUTO_GENERATION_INTERVAL_MINUTES = 270;
export const AUTO_GENERATION_HEARTBEAT_MINUTES = 5;

export function isAutoGenerationDue(lastGeneratedAt: string | null | undefined, now = new Date()) {
  if (!lastGeneratedAt) {
    return true;
  }

  const lastGeneratedDate = new Date(lastGeneratedAt);
  if (Number.isNaN(lastGeneratedDate.getTime())) {
    return true;
  }

  const elapsedMinutes = (now.getTime() - lastGeneratedDate.getTime()) / (1000 * 60);
  return elapsedMinutes >= AUTO_GENERATION_INTERVAL_MINUTES;
}
