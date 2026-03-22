import type { ProjectType } from './app.js';

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
