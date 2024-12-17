import { SimpleGit, simpleGit } from "simple-git";
import { ConfigManager } from "../utils/ConfigManager";
import { ActivitySummary } from "../types/types";
import * as vscode from "vscode";
import { logInfo, logError } from "../utils/logger";
import * as path from "path";
import { promises as fsPromises } from "fs";

export class GitManager {
  private git: SimpleGit;
  private readonly maxRetries = 3;

  constructor(private configManager: ConfigManager) {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!workspaceRoot) {
      throw new Error("No workspace folder found");
    }
    this.git = simpleGit(workspaceRoot);
  }

  async isGitRepository(): Promise<boolean> {
    try {
      await this.git.status();
      return true;
    } catch {
      return false;
    }
  }

  async initializeRepository(): Promise<void> {
    try {
      const isRepo = await this.isGitRepository();
      if (!isRepo) {
        await this.git.init();
      }

      await this.setUserConfig();
      await this.createInitialFiles();

      // First make the initial commit
      await this.git.add(".");
      await this.git.commit("chore: Initial repository setup");

      // Then create and switch to main branch
      await this.ensureMainBranchExists();

      // Finally push
      await this.pushWithRetry();

      logInfo("Repository initialized with basic structure");
    } catch (error: any) {
      throw new Error(`Failed to initialize repository: ${error.message}`);
    }
  }

  private async createInitialFiles(): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!workspaceRoot) {
      throw new Error("No workspace folder found");
    }

    // Create README.md
    const readmePath = path.join(workspaceRoot, "README.md");
    const readmeContent = `# Commit History Tracker\n\nAutomated tracking of coding activity.\n\nThis repository is managed by the VS Code Commit History Tracker extension to provide insights into coding patterns and activity.`;
    await fsPromises.writeFile(readmePath, readmeContent);

    // Create .gitignore
    const gitignorePath = path.join(workspaceRoot, ".gitignore");
    const gitignoreContent = `node_modules/
.env
.vscode/
*.log
dist/
build/
coverage/
.DS_Store`;
    await fsPromises.writeFile(gitignorePath, gitignoreContent);
  }

  private async setUserConfig(): Promise<void> {
    try {
      const config = await this.git.listConfig();
      if (!config.values["user.name"]) {
        await this.git.addConfig("user.name", "Commit History Tracker");
      }
      if (!config.values["user.email"]) {
        await this.git.addConfig("user.email", "tracker@example.com");
      }
    } catch (error: any) {
      logError("Failed to set user config", error);
      throw error;
    }
  }

  async setRemote(remoteUrl: string): Promise<void> {
    try {
      const remotes = await this.git.getRemotes();
      const hasOrigin = remotes.some((remote) => remote.name === "origin");

      if (hasOrigin) {
        await this.git.remote(["set-url", "origin", remoteUrl]);
        logInfo("Updated existing remote origin");
      } else {
        await this.git.addRemote("origin", remoteUrl);
        logInfo("Added new remote origin");
      }
    } catch (error: any) {
      throw new Error(`Failed to set remote: ${error.message}`);
    }
  }

  async ensureMainBranchExists(): Promise<void> {
    try {
      const branches = await this.git.branchLocal();

      if (!branches.all.includes("main")) {
        await this.git.checkoutLocalBranch("main");
        logInfo("Created and switched to main branch");
      } else {
        await this.git.checkout("main");
        logInfo("Switched to existing main branch");
      }
    } catch (error: any) {
      throw new Error(`Failed to setup main branch: ${error.message}`);
    }
  }

  async createInitialCommitIfNeeded(): Promise<void> {
    try {
      const status = await this.git.status();

      // Check if we have any changes to commit
      const hasChanges = status.files.length > 0;

      if (hasChanges) {
        await this.git.add(".");
        await this.git.commit("chore: Update repository structure");
        await this.pushWithRetry();
        logInfo("Created and pushed commit");
      }
    } catch (error: any) {
      throw new Error(`Failed to create initial commit: ${error.message}`);
    }
  }

  async createAndPushCommit(
    summary: ActivitySummary,
    commitMessage: string
  ): Promise<void> {
    try {
      const status = await this.git.status();
      if (status.files.length === 0) {
        logInfo("No changes to commit");
        return;
      }

      await this.git.add(".");
      await this.git.commit(commitMessage);
      await this.pushWithRetry();
      logInfo("Successfully created and pushed commit");
    } catch (error: any) {
      throw new Error(`Git operation failed: ${error.message}`);
    }
  }

  private async pushWithRetry(attempt = 1): Promise<void> {
    try {
      await this.git.push("origin", "main");
    } catch (error: any) {
      if (attempt < this.maxRetries) {
        logInfo(`Push attempt ${attempt} failed, retrying...`);
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        return this.pushWithRetry(attempt + 1);
      }
      throw error;
    }
  }

  async diffSummary(): Promise<{
    files: { file: string; additions: number; deletions: number }[];
  }> {
    const diff = await this.git.diffSummary();
    const files = diff.files.map((f) => ({
      file: f.file,
      additions: (f as any).insertions ?? 0,
      deletions: (f as any).deletions ?? 0,
    }));
    return { files };
  }
}
