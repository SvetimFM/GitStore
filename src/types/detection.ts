import type { ProjectType } from './app.js';

export interface BinaryAsset {
  name: string;
  downloadUrl: string;
  size: number;
  tagName: string;
}

export interface DetectionResult {
  primaryRuntime: ProjectType;
  alternativeRuntimes: ProjectType[];
  confidence: 'high' | 'medium' | 'low';
  manifest: string;
  installCommand: string;
  buildCommand: string | null;
  startCommand: string;
  detectedPort: number | null;
  runtimeVersion: string | null;
  envVarsRequired: string[];
  /** How this app should be installed. Defaults to 'source' if absent. */
  installType?: 'binary' | 'source' | 'container';
  /** Matched binary asset from GitHub Releases (only when installType='binary'). */
  binaryAsset?: BinaryAsset;
}

export interface RiskAssessment {
  level: 'low' | 'medium' | 'high';
  score: number;
  reasons: string[];
  hasPostinstallScripts: boolean;
  hasDockerfile: boolean;
}

export interface PrerequisiteCheck {
  met: boolean;
  missing: string[];
  available: string[];
  fallbackDetection?: DetectionResult;
}
