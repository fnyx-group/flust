import { parseCustomText, type CustomText } from '@/domain/custom-text';
import type { Plan, PlanAction } from '@/domain/onboarding';
import { isActionId, isPlanTrigger } from '@/domain/presets';

// Values stored as JSON are read back as unknown and checked field by field: anything that does
// not match comes back as null rather than as a wrong value.

export function decodePlan(value: unknown): Plan | null {
  if (!isRecord(value) || !isPlanTrigger(value.trigger)) return null;
  const action = decodeAction(value.action);
  return action === null ? null : { trigger: value.trigger, action };
}

export function decodeAction(value: unknown): PlanAction | null {
  if (!isRecord(value)) return null;
  if (value.kind === 'preset' && isActionId(value.id)) return { kind: 'preset', id: value.id };
  const text = value.kind === 'custom' ? decodeText(value.text) : null;
  return text === null ? null : { kind: 'custom', text };
}

export function decodeText(value: unknown): CustomText | null {
  if (typeof value !== 'string') return null;
  const text = parseCustomText(value);
  return text.ok ? text.value : null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function arrayOf(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

export function parseJson(text: unknown): unknown {
  if (typeof text !== 'string') return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
