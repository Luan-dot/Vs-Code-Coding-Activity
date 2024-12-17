import * as vscode from "vscode";
import { Octokit } from "@octokit/rest";
import { GitManager } from "./GitManager";
import { logInfo, logError } from "../utils/logger";

export class SetupWizard {
  constructor(
    private context: vscode.ExtensionContext,
    private gitManager: GitManager
  ) {}

  async run(): Promise<void> {
    try {
      // Get GitHub token first
      const token = await this.getGitHubToken();
      if (!token) {
        throw new Error("GitHub token is required");
      }

      // Show progress during setup
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Setting up repository",
          cancellable: false,
        },
        async (progress) => {
          progress.report({ message: "Authenticating with GitHub..." });

          // Get repository choice
          const choice = await vscode.window.showQuickPick(
            ["Connect to an existing repository", "Create a new repository"],
            { placeHolder: "Choose an option to set up your repository" }
          );

          if (!choice) {
            throw new Error("Setup cancelled by user");
          }

          let repoUrl: string;
          if (choice === "Connect to an existing repository") {
            progress.report({
              message: "Connecting to existing repository...",
            });
            repoUrl = await this.connectToExistingRepository();
          } else {
            progress.report({ message: "Creating new repository..." });
            repoUrl = await this.createNewRepository(token);
          }

          // Initialize repository structure
          progress.report({ message: "Initializing repository structure..." });
          await this.gitManager.initializeRepository();

          // Set up remote
          progress.report({ message: "Configuring remote..." });
          await this.gitManager.setRemote(repoUrl);

          // Create and switch to main branch
          progress.report({ message: "Setting up main branch..." });
          await this.gitManager.ensureMainBranchExists();

          // Create initial commit and push
          progress.report({ message: "Creating initial commit..." });
          await this.gitManager.createInitialCommitIfNeeded();

          progress.report({ message: "Setup complete!" });
        }
      );

      vscode.window.showInformationMessage(
        "Repository setup completed successfully"
      );
      logInfo("Setup completed successfully");
    } catch (error: any) {
      vscode.window.showErrorMessage(`Setup failed: ${error.message}`);
      logError("Setup failed", error);
      throw error;
    }
  }

  private async getGitHubToken(): Promise<string | undefined> {
    const session = await vscode.authentication.getSession("github", ["repo"], {
      createIfNone: true,
    });
    return session?.accessToken;
  }

  private async connectToExistingRepository(): Promise<string> {
    const repoUrl = await vscode.window.showInputBox({
      prompt:
        "Enter the URL of the existing repository (e.g., https://github.com/user/repo)",
      validateInput: (value) => {
        return value.includes("github.com")
          ? null
          : "Please enter a valid GitHub repository URL";
      },
    });

    if (!repoUrl) {
      throw new Error("Repository URL is required");
    }

    return repoUrl;
  }

  private async createNewRepository(token: string): Promise<string> {
    const repoName = await vscode.window.showInputBox({
      prompt: "Enter the name for the new repository",
      validateInput: (value) => {
        return /^[a-zA-Z0-9_.-]+$/.test(value)
          ? null
          : "Please use only letters, numbers, hyphens, and underscores";
      },
    });

    if (!repoName) {
      throw new Error("Repository name is required");
    }

    const octokit = new Octokit({ auth: token });

    try {
      const { data } = await octokit.repos.createForAuthenticatedUser({
        name: repoName,
        private: false,
        auto_init: false,
        description: "Automated coding activity tracking repository",
      });

      return data.clone_url;
    } catch (error: any) {
      throw new Error(`Failed to create repository: ${error.message}`);
    }
  }
}
