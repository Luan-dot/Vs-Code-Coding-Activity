export interface ActivitySummary {
  description: string;
  metrics: {
    filesChanged: number;
    linesAdded: number;
    linesRemoved: number;
    codingTime: number;
    fileTypes: Record<string, number>;
    timestamp: string;
    [key: string]: any;
  };
  changedFiles: string[];
}

export interface CommitOptions {
  sign?: boolean;
  message?: string;
  author?: string;
}

export interface TrackingConfig {
  enabled: boolean;
  interval: number;
  excludePatterns: string[];
}

export interface ActivityReport {
  summary: string;
  metrics: {
    totalCommits: number;
    filesChanged: number;
    linesAdded: number;
    linesRemoved: number;
  };
  timestamp: string;
}

export interface CommitAnalysis {
  type: string;
  scope: string;
  description: string;
  details: string;
}

export interface SecurityIssue {
  file: string;
  type: string;
  description: string;
}

export interface ScanResult {
  issues: SecurityIssue[];
}
