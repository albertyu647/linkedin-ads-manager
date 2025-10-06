/**
 * Utility functions for bid tracking display
 */

/**
 * Format time since adjustment in a human-readable way
 */
export function formatTimeSinceAdjustment(timestamp: string): string {
  const adjustmentTime = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - adjustmentTime.getTime();
  
  const diffMinutes = Math.floor(diffMs / 1000 / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMinutes < 1) {
    return 'just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return adjustmentTime.toLocaleDateString();
  }
}
