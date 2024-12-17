Project Overview

Name: Commit History Tracker
Purpose: Automate the process of tracking coding activity and committing changes to a dedicated GitHub repository at regular intervals, providing developers with data-driven insights into their coding patterns and productivity.
Key Goals:
•	Automate the commit process on a user-defined schedule.
•	Track various coding activity metrics (files changed, lines added/removed, coding time, file types touched).
•	Provide a dashboard for viewing commit history reports.
•	Allow configuration of repository, intervals, and excluded files.
•	Ensure privacy and security by detecting sensitive data and giving the user control.
________________________________________
High-Level Architecture
The extension integrates with Visual Studio Code’s API and the GitHub API. It leverages simple-git for local Git operations and @octokit/rest for repository creation and management. The extension also uses VS Code’s authentication features to access GitHub tokens and store settings securely.
Core Components:
1.	Setup Wizard (SetupWizard.ts):
Guides the user through initial configuration—connecting to an existing repo or creating a new one on GitHub. After setup, it ensures the workspace is under version control and sets up the extension’s tracking configuration.
2.	Configuration Manager (ConfigManager.ts):
Handles reading and writing user preferences (e.g., commit intervals, excluded file patterns, enabling/disabling tracking). It uses VS Code’s global configuration and secret storage for tokens.
3.	Activity Tracker (ActivityTracker.ts):
Watches the workspace for file changes. It records which files change between commits, calculates how many lines were added/removed (via Git diffs), notes which file types are involved, and tracks coding time (based on how frequently files are modified).
4.	Commit Analyzer (CommitAnalyzer.ts):
Generates meaningful commit messages following a conventional format and can produce summary reports of past activities. It takes the ActivitySummary from the ActivityTracker and translates it into structured commit messages and visualizable reports.
5.	Git Manager (GitManager.ts):
Handles all local Git operations, including:
o	Initializing a repository if none exists.
o	Setting a remote repository.
o	Creating and pushing commits at the scheduled interval.
o	Retrieving diff summaries to determine lines added/removed.
It ensures that commits are retried if pushing fails and respects the user’s configuration (e.g., no GPG signing if not desired).
6.	Security Scanner (SecurityScanner.ts):
Before each commit, the extension scans changed files for patterns that might indicate sensitive data (like emails, API keys, or passwords). If any are found and the user’s settings block committing in that scenario, the user is warned and can choose to proceed or abort.
7.	Webview Dashboard (invoked in extension.ts):
When requested, the extension displays a dashboard (a webview panel) showing charts and metrics about coding activity—like total commits, files changed over time, lines of code added/removed. This provides insight into productivity patterns.
________________________________________
Workflow
1.	Initialization and Setup:
o	The user runs Start Commit History Tracking from the Command Palette.
o	The SetupWizard prompts the user to authenticate with GitHub and either connect to an existing repository or create a new one.
o	Once completed, a Git repository is ensured locally. If none exists, it’s initialized. The specified remote is set up.
o	Tracking is enabled by default upon completion.
2.	Configuration:
o	Users can adjust settings via VS Code’s Settings UI or settings.json:
	Interval: How often to commit (in minutes).
	Exclude Patterns: Files or directories not to track.
	Block on Sensitive Data: Whether to prevent committing if sensitive data is detected.
	Enabled: Turn tracking on or off globally.
3.	Tracking File Changes:
o	The ActivityTracker uses a file system watcher to listen for file create/change/delete events.
o	It accumulates changes in memory until the next commit time.
o	Upon a commit cycle, it runs git diff to summarize lines added/removed per file and determine file types involved.
o	Coding time is approximated by how frequently files are changed (time since last commit).
4.	Commit Cycle (Periodic Commits):
o	A timer (based on the interval setting) triggers performCommitCycle() at regular intervals.
o	performCommitCycle():
	Retrieves current changes from ActivityTracker.
	If no changes, it skips committing.
	If changes exist, it passes them to the SecurityScanner to detect sensitive data.
	If sensitive data is found and blocking is enabled, the user is prompted to allow or abort the commit.
	If allowed (or no sensitive data), it uses CommitAnalyzer to generate a structured commit message:
	By default, uses a feat(tracking) format.
	Includes a description and details about lines changed, coding time, etc.
	GitManager stages all changes, commits with the generated message, and pushes to the remote’s main branch.
o	After a successful commit, ActivityTracker resets its in-memory changes and the cycle repeats.
5.	Webview Report:
o	The user can run Show Commit History Report.
o	CommitAnalyzer produces a summary report (mocked or from historical data).
o	The extension creates a webview panel and displays charts and statistics (e.g., total commits, lines added/removed).
o	This gives a visual overview of coding activity patterns.
________________________________________
Key Features Explained
Automatic Commits:
No need to remember to commit changes regularly. The extension commits automatically at an interval, helping create a detailed commit history that can show incremental progress over time.
GitHub Integration:
The extension uses VS Code’s built-in GitHub auth for a seamless experience:
•	Automatically creates or connects to a GitHub repository.
•	Pushes each commit to the remote, ensuring your history is backed up online.
Conventional Commit Messages:
Commits follow a standardized format (feat(tracking): Updated 3 files ...), making it easier to parse and understand commit messages. This standardization can help future analysis and integration with other tools.
Activity Metrics:
Beyond just creating commits, the extension tracks:
•	Files changed: How many files are modified each interval.
•	Lines added/removed: Helps understand coding churn.
•	File types: Identifies which languages or file types see the most activity.
•	Coding time approximation: Roughly measures active coding sessions.
Security & Privacy:
Sensitive data scanning before commit helps prevent accidentally pushing secrets (like passwords or tokens) to the remote repository. If found, the user can decide whether to proceed or stop.
Exclude Patterns:
Users can specify certain files or directories to ignore (such as build outputs, environment files, or logs), preventing clutter in commit history and reducing noise in activity metrics.
Status Bar Integration:
A status bar item shows when tracking is active and indicates when the next commit will happen, providing a quick glance at the extension’s state.
User-Friendly Setup Wizard:
A simple UI guides initial setup, ensuring even users not deeply familiar with Git/GitHub can get started quickly. It handles all the initial steps: Git init, remote setup, initial commit, etc.
________________________________________
Technical Stack and Libraries
•	TypeScript: Strong typing and modern JavaScript features.
•	VS Code Extension API: For commands, configuration, file watching, webviews, and authentication sessions.
•	simple-git: A Node.js library that provides a convenient API for running Git commands.
•	@octokit/rest: For interacting with GitHub’s REST API, enabling repository creation and configuration.
•	minimatch: For pattern matching file paths (used in exclude patterns).
•	Chart.js: Used in the webview for generating simple charts to visualize activity metrics.
________________________________________
Typical User Flow Example
1.	Developer installs the extension and runs Start Commit History Tracking.
2.	The Setup Wizard requests GitHub authentication and asks whether to create a new repo or connect an existing one.
3.	Once set up, the extension waits for 30 minutes (default interval).
4.	In the meantime, the developer edits multiple files.
5.	After 30 minutes, the extension detects changed files. It calculates lines added/removed and checks for sensitive data.
6.	No sensitive data found, so it commits changes with a message like feat(tracking): Updated 5 files.
7.	Commits are pushed to the GitHub repository.
8.	After a week, the developer runs Show Commit History Report to see a bar chart of their last commits, lines added/removed, and other metrics.
________________________________________
Conclusion
The Commit History Tracker extension automates the tedious parts of maintaining a healthy commit history. By integrating activity tracking, security checks, and user-friendly setup, it simplifies the developer’s workflow. The metrics and visualizations empower the user with insights into their coding patterns and productivity trends, all while ensuring their code is safely version-controlled and backed up on GitHub.

