import * as vscode from "vscode";
import { ActivitySummary } from "../types/types";
import { ConfigManager } from "../utils/ConfigManager";
import { minimatch } from "minimatch";
import { GitManager } from "./GitManager";

export class ActivityTracker {
  private fileWatcher!: vscode.FileSystemWatcher;
  private changes: Set<string> = new Set();
  private disposables: vscode.Disposable[] = [];
  private codingStartTime: number = Date.now();
  private lastActiveTime: number = Date.now();

  constructor(private configManager: ConfigManager) {
    this.setupFileWatchers();
  }

  private setupFileWatchers() {
    this.fileWatcher = vscode.workspace.createFileSystemWatcher("**/*");

    this.disposables.push(
      this.fileWatcher.onDidChange((uri) => this.trackChange(uri)),
      this.fileWatcher.onDidCreate((uri) => this.trackChange(uri)),
      this.fileWatcher.onDidDelete((uri) => this.trackChange(uri))
    );
  }

  private async trackChange(uri: vscode.Uri) {
    const excludePatterns =
      (await this.configManager.getConfiguration<string[]>(
        "excludePatterns"
      )) || [];
    if (shouldExclude(uri.fsPath, excludePatterns)) {
      return;
    }
    this.changes.add(uri.fsPath);
    this.lastActiveTime = Date.now();
  }

  async getChanges(): Promise<ActivitySummary> {
    const changedFiles = Array.from(this.changes);
    this.changes.clear();

    const codingTime = this.lastActiveTime - this.codingStartTime;
    this.codingStartTime = Date.now();

    // Use Git to determine lines added/removed
    const gitManager = new GitManager(this.configManager);
    const diff = await gitManager.diffSummary();
    let linesAdded = 0;
    let linesRemoved = 0;
    const fileTypes: Record<string, number> = {};

    for (const f of diff.files) {
      // Only count files that are changed now
      if (changedFiles.includes(vscode.Uri.file(f.file).fsPath)) {
        linesAdded += f.additions;
        linesRemoved += f.deletions;

        const ext = getExtension(f.file);
        fileTypes[ext] = (fileTypes[ext] || 0) + 1;
      }
    }

    return {
      description: `Updated ${changedFiles.length} files`,
      metrics: {
        filesChanged: changedFiles.length,
        linesAdded,
        linesRemoved,
        codingTime,
        fileTypes,
        timestamp: new Date().toISOString(),
      },
      changedFiles,
    };
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.changes.clear();
  }
}

function shouldExclude(filePath: string, patterns: string[]): boolean {
  return patterns.some((pattern) => minimatch(filePath, pattern));
}

function getExtension(filename: string): string {
  return filename.split(".").pop() || "unknown";
}
