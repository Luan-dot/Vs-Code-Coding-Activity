import {
  ActivityReport,
  ActivitySummary,
  CommitAnalysis,
} from "../types/types";

export class CommitAnalyzer {
  async generateReport(): Promise<ActivityReport> {
    // In a real scenario, you might want to load historical data from storage,
    // but here we return a mock report.
    return {
      summary: "Activity Report",
      metrics: {
        totalCommits: 10,
        filesChanged: 50,
        linesAdded: 200,
        linesRemoved: 50,
      },
      timestamp: new Date().toISOString(),
    };
  }

  analyzeChanges(changes: ActivitySummary[]): CommitAnalysis {
    // Basic logic: if multiple file types, just say "Updated files"
    // If mostly code files, say "Updated code files"
    // This can be more elaborate.
    const summary = changes[0]; // We usually have one summary per commit cycle

    const filesChanged = summary.metrics.filesChanged;
    const description = `Updated ${filesChanged} file${
      filesChanged !== 1 ? "s" : ""
    }`;
    const details = `Lines Added: ${summary.metrics.linesAdded}, Lines Removed: ${summary.metrics.linesRemoved}, Coding Time: ${summary.metrics.codingTime}ms`;

    // For simplicity, always use feat(tracking)
    return {
      type: "feat",
      scope: "tracking",
      description,
      details,
    };
  }
}
