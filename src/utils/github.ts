import { Octokit } from "@octokit/rest";
import * as vscode from "vscode";

export async function initializeGitHub() {
  const token = await vscode.authentication.getSession("github", ["repo"], {
    createIfNone: true,
  });
  return new Octokit({ auth: token.accessToken });
}

export async function setupRepository(octokit: Octokit, repoName: string) {
  try {
    const { data } = await octokit.repos.createForAuthenticatedUser({
      name: repoName,
      private: true,
      auto_init: true,
      description: "Automated coding activity tracking",
    });
    return data.clone_url;
  } catch (error: any) {
    throw new Error("Failed to create repository");
  }
}
