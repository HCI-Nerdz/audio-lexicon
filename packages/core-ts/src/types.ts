export type ParamKind = "float" | "int" | "bool" | "enum";

export interface ParamOption {
  value: string | number | boolean;
  label: string;
}

export interface ParameterDef {
  id: string;
  label: string;
  kind: ParamKind;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  default: number | boolean | string;
  options?: ParamOption[];
}

export type VizKind =
  | "freq-response"
  | "envelope"
  | "waveform"
  | "spectrum"
  | "conceptual"
  | "stereo";

export type AuditionKind =
  | "none"
  | "biquad-peaking"
  | "biquad-lowshelf"
  | "biquad-highshelf"
  | "biquad-lowpass"
  | "biquad-highpass"
  | "biquad-notch"
  | "biquad-bandpass"
  | "biquad-allpass"
  | "gain"
  | "delay"
  | "compressor"
  | "ducking"
  | "gate"
  | "tremolo"
  | "pan";

export interface TermExports {
  equalizerApo?: string;
  obs?: Record<string, unknown>;
}

export interface Term {
  id: string;
  name: string;
  aliases?: string[];
  category: string;
  summary: string;
  plainMeaning: string;
  history: string;
  whenToUse: string;
  commonConfusion: string;
  stub?: boolean;
  viz: VizKind;
  parameters: ParameterDef[];
  audition: AuditionKind;
  exports: TermExports;
}

export interface TreeNode {
  id: string;
  label: string;
  termId?: string;
  children?: TreeNode[];
}

export interface SampleMeta {
  id: string;
  title: string;
  license: string;
  source: string;
  path: string;
  attribution: string;
  downloadUrl?: string;
  curated?: boolean;
}

export interface Lexicon {
  version: string;
  tree: TreeNode[];
  terms: Record<string, Term>;
  samples: SampleMeta[];
}

export type ParamValues = Record<string, number | boolean | string>;
