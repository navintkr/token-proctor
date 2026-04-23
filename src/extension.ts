import * as vscode from "vscode";
import { registerConductor } from "./participant.js";

export function activate(context: vscode.ExtensionContext) {
  registerConductor(context);
  console.log("Copilot Conductor activated");
}

export function deactivate() {}
