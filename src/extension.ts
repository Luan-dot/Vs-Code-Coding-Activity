import * as vscode from "vscode";
import { GitManager } from "./core/GitManager";
import { ActivityTracker } from "./core/ActivityTracker";
import { CommitAnalyzer } from "./core/CommitAnalyzer";
import { SecurityScanner } from "./core/SecurityScanner";
import { ConfigManager } from "./utils/ConfigManager";
import { SetupWizard } from "./core/SetupWizard";
import { logInfo, logError } from "./utils/logger";
import { ActivityReport, ActivitySummary } from "./types/types";

let commitTimer: NodeJS.Timeout | undefined;
let statusUpdateTimer: NodeJS.Timeout | undefined;
let nextCommitTime: Date | undefined;
let activityTracker: ActivityTracker | undefined;
let gitManager: GitManager | undefined;
let commitAnalyzer: CommitAnalyzer | undefined;
let securityScanner: SecurityScanner | undefined;
let configManager: ConfigManager | undefined;
let statusBar: vscode.StatusBarItem | undefined;
let isSetupComplete = false;
let isDisposing = false;

export async function activate(context: vscode.ExtensionContext) {
  try {
    logInfo("Commit History Tracker is now active!");

    // Initialize components
    await initializeComponents(context);

    // Setup status bar
    setupStatusBar(context);

    // Register commands
    registerCommands(context);

    // Check and restore previous state
    await restorePreviousState();
  } catch (error: any) {
    logError("Failed to activate extension", error);
    vscode.window.showErrorMessage(
      `Failed to activate extension: ${error.message}`
    );
    updateStatusBar("Commit Tracking: Failed to Initialize");
  }
}

async function initializeComponents(context: vscode.ExtensionContext) {
  configManager = new ConfigManager(context);
  gitManager = new GitManager(configManager);
  activityTracker = new ActivityTracker(configManager);
  commitAnalyzer = new CommitAnalyzer();
  securityScanner = new SecurityScanner(configManager);
}

function setupStatusBar(context: vscode.ExtensionContext) {
  statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  updateStatusBar("Commit Tracking: Not Setup");
  statusBar.command = "commit-history-tracker.showMenu";
  statusBar.show();
  context.subscriptions.push(statusBar);
}

function registerCommands(context: vscode.ExtensionContext) {
  // Register main commands
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "commit-history-tracker.startTracking",
      () => handleStartTracking(context)
    ),
    vscode.commands.registerCommand(
      "commit-history-tracker.stopTracking",
      handleStopTracking
    ),
    vscode.commands.registerCommand(
      "commit-history-tracker.showReport",
      handleShowReport
    ),
    vscode.commands.registerCommand(
      "commit-history-tracker.showMenu",
      showQuickMenu
    )
  );
}

async function showQuickMenu() {
  const items = [
    {
      label: "$(play) Start Tracking",
      command: "commit-history-tracker.startTracking",
    },
    {
      label: "$(stop) Stop Tracking",
      command: "commit-history-tracker.stopTracking",
    },
    {
      label: "$(graph) Show Report",
      command: "commit-history-tracker.showReport",
    },
  ];

  const selection = await vscode.window.showQuickPick(items, {
    placeHolder: "Select an action",
  });

  if (selection) {
    vscode.commands.executeCommand(selection.command);
  }
}

async function restorePreviousState() {
  const enabled = await configManager!.getConfiguration<boolean>("enabled");
  if (enabled) {
    try {
      const isRepo = await gitManager!.isGitRepository();
      if (isRepo) {
        isSetupComplete = true;
        await startCommitLoop();
      } else {
        updateStatusBar("Commit Tracking: Setup Required");
        vscode.window.showInformationMessage(
          "Please run 'Start Commit History Tracking' to set up the repository."
        );
      }
    } catch (error) {
      const err = error as Error;
      logError("Error checking repository status", err);
      updateStatusBar("Commit Tracking: Setup Required");
    }
  }
}

async function handleStartTracking(context: vscode.ExtensionContext) {
  try {
    if (!gitManager) {
      throw new Error("Git manager not initialized");
    }

    updateStatusBar("Commit Tracking: Setting up...");

    // Initialize setup wizard
    const setupWizard = new SetupWizard(context, gitManager);

    // Run setup process
    await setupWizard.run();

    // Enable tracking
    isSetupComplete = true;
    await configManager!.setConfiguration("enabled", true);

    // Start commit loop
    await startCommitLoop();

    vscode.window.showInformationMessage("Commit History Tracking Started");
    logInfo("Tracking started successfully");
  } catch (error: any) {
    isSetupComplete = false;
    stopAllTimers();
    const errorMessage = `Failed to start tracking: ${error.message}`;
    vscode.window.showErrorMessage(errorMessage);
    logError(errorMessage, error);
    updateStatusBar("Commit Tracking: Setup Failed");
  }
}

async function handleStopTracking() {
  try {
    stopAllTimers();
    activityTracker?.dispose();
    await configManager!.setConfiguration("enabled", false);
    updateStatusBar("Commit Tracking: Stopped");
    vscode.window.showInformationMessage("Commit History Tracking Stopped");
    logInfo("Tracking stopped successfully");
  } catch (error: any) {
    logError("Failed to stop tracking", error);
    vscode.window.showErrorMessage(`Failed to stop tracking: ${error.message}`);
  }
}

async function handleShowReport() {
  try {
    if (!commitAnalyzer) {
      throw new Error("Commit analyzer not initialized");
    }

    const report = await commitAnalyzer.generateReport();
    await displayReport(report);
  } catch (error: any) {
    logError("Failed to show report", error);
    vscode.window.showErrorMessage(`Failed to show report: ${error.message}`);
  }
}

async function startCommitLoop() {
  if (!isSetupComplete) {
    updateStatusBar("Commit Tracking: Setup Required");
    return;
  }

  stopAllTimers();

  try {
    const interval =
      (await configManager!.getConfiguration<number>("interval")) || 30;
    const intervalMs = interval * 60 * 1000;

    // Set initial next commit time
    nextCommitTime = new Date(Date.now() + intervalMs);
    updateStatusBar(
      `Commit Tracking: Active (Next: ${nextCommitTime.toLocaleTimeString()})`
    );

    // Start status update timer (updates every minute)
    statusUpdateTimer = setInterval(() => {
      if (nextCommitTime && !isDisposing) {
        const now = new Date();
        if (now >= nextCommitTime) {
          updateStatusBar("Commit Tracking: Processing...");
        } else {
          updateStatusBar(
            `Commit Tracking: Active (Next: ${nextCommitTime.toLocaleTimeString()})`
          );
        }
      }
    }, 60000); // Update every minute

    // Start main commit timer
    commitTimer = setInterval(async () => {
      if (!isDisposing) {
        try {
          await performCommitCycle();
          nextCommitTime = new Date(Date.now() + intervalMs);
          updateStatusBar(
            `Commit Tracking: Active (Next: ${nextCommitTime.toLocaleTimeString()})`
          );
        } catch (error: any) {
          logError("Error during commit cycle", error);
          vscode.window.showErrorMessage(`Commit failed: ${error.message}`);
          updateStatusBar("Commit Tracking: Error occurred");
        }
      }
    }, intervalMs);
  } catch (error: any) {
    logError("Failed to start commit loop", error);
    throw error;
  }
}

function stopAllTimers() {
  if (commitTimer) {
    clearInterval(commitTimer);
    commitTimer = undefined;
  }
  if (statusUpdateTimer) {
    clearInterval(statusUpdateTimer);
    statusUpdateTimer = undefined;
  }
  nextCommitTime = undefined;
}

async function performCommitCycle() {
  if (
    !isSetupComplete ||
    !gitManager ||
    !activityTracker ||
    !commitAnalyzer ||
    !securityScanner
  ) {
    throw new Error("Extension not properly initialized");
  }

  // Get changes
  const summary = await activityTracker.getChanges();

  // Skip if no changes
  if (summary.metrics.filesChanged === 0) {
    logInfo("No files changed, skipping commit");
    vscode.window.showInformationMessage("No changes to commit");
    return;
  }

  // Check for sensitive data
  const blockOnSensitive =
    (await configManager!.getConfiguration<boolean>("blockOnSensitiveData")) ??
    true;
  const scanResult = await securityScanner.scanForSensitiveData(
    summary.changedFiles
  );

  if (scanResult.issues.length > 0 && blockOnSensitive) {
    const choice = await vscode.window.showWarningMessage(
      "Sensitive data detected in changed files. Do you want to commit anyway?",
      "Yes",
      "No"
    );
    if (choice !== "Yes") {
      updateStatusBar("Commit Tracking: Commit cancelled (sensitive data)");
      return;
    }
  }

  // Create commit
  const analysis = commitAnalyzer.analyzeChanges([summary]);
  const commitMessage = `${analysis.type}(${analysis.scope}): ${analysis.description}\n\n${analysis.details}`;

  // Perform commit and push
  await gitManager.createAndPushCommit(summary, commitMessage);

  // Update UI
  const filesChanged = summary.metrics.filesChanged;
  vscode.window.showInformationMessage(
    `Successfully committed ${filesChanged} file${
      filesChanged !== 1 ? "s" : ""
    }`
  );
  logInfo(`Successfully committed ${filesChanged} files`);
}

function updateStatusBar(message: string) {
  if (statusBar && !isDisposing) {
    statusBar.text = message;
  }
}

async function displayReport(report: ActivityReport) {
  const panel = vscode.window.createWebviewPanel(
    "commitHistoryReport",
    "Commit History Report",
    vscode.ViewColumn.One,
    { enableScripts: true }
  );

  panel.webview.html = generateReportHtml(report);
}

function generateReportHtml(report: ActivityReport): string {
  return `<!DOCTYPE html>
    <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 20px; }
                .summary { margin-bottom: 20px; }
                .chart-container { height: 400px; }
            </style>
        </head>
        <body>
            <h1>Coding Activity Report</h1>
            <div class="summary">
                <h2>Summary</h2>
                <p>${report.summary}</p>
            </div>
            <div class="metrics">
                <h2>Metrics</h2>
                <ul>
                    <li>Total Commits: ${report.metrics.totalCommits}</li>
                    <li>Files Changed: ${report.metrics.filesChanged}</li>
                    <li>Lines Added: ${report.metrics.linesAdded}</li>
                    <li>Lines Removed: ${report.metrics.linesRemoved}</li>
                </ul>
            </div>
            <div class="chart-container">
                <canvas id="activityChart"></canvas>
            </div>
            <script>
                const ctx = document.getElementById('activityChart');
                new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: ['Total Commits', 'Files Changed', 'Lines Added', 'Lines Removed'],
                        datasets: [{
                            label: 'Activity Metrics',
                            data: [
                                ${report.metrics.totalCommits},
                                ${report.metrics.filesChanged},
                                ${report.metrics.linesAdded},
                                ${report.metrics.linesRemoved}
                            ],
                            backgroundColor: [
                                'rgba(54, 162, 235, 0.5)',
                                'rgba(75, 192, 192, 0.5)',
                                'rgba(153, 102, 255, 0.5)',
                                'rgba(255, 99, 132, 0.5)'
                            ]
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: {
                                beginAtZero: true
                            }
                        }
                    }
                });
            </script>
        </body>
    </html>`;
}

export function deactivate() {
  isDisposing = true;
  stopAllTimers();
  activityTracker?.dispose();
  statusBar?.dispose();
  logInfo("Extension deactivated");
}
