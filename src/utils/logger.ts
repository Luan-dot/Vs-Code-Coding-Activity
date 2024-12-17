export function logInfo(message: string) {
  console.log(`[CommitHistoryTracker] INFO: ${message}`);
}

export function logError(message: string, error?: Error) {
  console.error(`[CommitHistoryTracker] ERROR: ${message}`, error);
}
