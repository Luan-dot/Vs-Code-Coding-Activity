import * as vscode from "vscode";

export class ConfigManager {
  constructor(private context: vscode.ExtensionContext) {}

  async getConfiguration<T>(key: string): Promise<T | undefined> {
    const config = vscode.workspace.getConfiguration("commitHistoryTracker");
    return config.get<T>(key);
  }

  async setConfiguration(key: string, value: any): Promise<void> {
    const config = vscode.workspace.getConfiguration("commitHistoryTracker");
    await config.update(key, value, vscode.ConfigurationTarget.Global);
  }

  async storeSecret(key: string, value: string): Promise<void> {
    await this.context.secrets.store(key, value);
  }

  async getSecret(key: string): Promise<string | undefined> {
    return await this.context.secrets.get(key);
  }
}
