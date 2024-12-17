import * as vscode from "vscode";
import { ConfigManager } from "../utils/ConfigManager";
import { SecurityIssue, ScanResult } from "../types/types";
import { promises as fsPromises } from "fs";

export class SecurityScanner {
  private sensitivePatterns = [
    /(\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b)/, // Email
    /([0-9a-fA-F]{40})/, // Potential API keys (40 hex chars)
    /(password\s*=\s*['"][^'"]*['"])/i, // password=...
  ];

  constructor(private configManager: ConfigManager) {}

  async scanForSensitiveData(files: string[]): Promise<ScanResult> {
    const issues: SecurityIssue[] = [];

    for (const file of files) {
      try {
        const content = await fsPromises.readFile(file, "utf8");
        this.sensitivePatterns.forEach((pattern) => {
          if (pattern.test(content)) {
            issues.push({
              file,
              type: "sensitive_data",
              description: "Potential sensitive data found",
            });
          }
        });
      } catch {
        // If file no longer exists or can't be read, skip
      }
    }

    return { issues };
  }

  // If GPG signing is desired, ensure git is configured correctly.
  async signCommit(message: string): Promise<string> {
    // This could be a no-op since `GitManager` handles `git commit -S`
    // Return message unchanged or implement additional signing logic if required.
    return message;
  }
}
