export const APPROVED_QUESTION = 'Does this filing report at least 20 rent-regulated residential units?';
export const DECLINE_QUESTION = 'Did the operating balance calculated from reported income and expenses fall by more than 20% from the previous year?';
export const APPROVED_THRESHOLD = 20;
export const PREDICATE_ID = 'Q001';
export const SCHEMA_VERSION = 'rpie-demo-v1';
export const COMMITMENT_ENCODING = 'housingproof-field-poseidon2-v3';
export const EXPENSE_KEYS = ['fuel', 'light_and_power', 'cleaning_contracts', 'wages_and_payroll', 'repairs_and_maintenance', 'management_and_administration', 'insurance', 'water_and_sewer', 'advertising', 'interior_painting_and_decorating', 'amortized_leasing_costs', 'amortized_tenant_improvement_costs', 'miscellaneous'] as const;
export const EXCLUDED_KEYS = ['real_estate_taxes', 'bad_debt', 'depreciation', 'mortgage_interest'] as const;
export const POLICIES = {
  Q001: { id: 'Q001', number: 1, version: 1, threshold: 20, question: APPROVED_QUESTION },
  Q002: { id: 'Q002', number: 2, version: 1, threshold: 2000, question: DECLINE_QUESTION },
} as const;
export type PredicateId = keyof typeof POLICIES;
export function approvedPolicy(question: unknown, threshold: unknown) {
  if (typeof question !== 'string') return undefined;
  return Object.values(POLICIES).find(p => p.question === question.replace(/\s+/g, ' ').trim() && p.threshold === threshold);
}
