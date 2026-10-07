# RPIE residential subset schema (internal synthetic model)

The repository uses a narrow internal JSON schema that maps to the main concepts in the NYC DOF RPIE worksheet. This is not an official DOF export schema and is intentionally limited to the fields used in the milestone-one proof.

## Example object

```json
{
  "id": "synthetic-rpie-40-24",
  "propertyId": "SIM-40-2025",
  "propertyType": "residential",
  "reportingPeriod": "2025",
  "schemaVersion": "rpie-2025-residential-v1",
  "sourceRevision": "synthetic-rpie-2025-v1",
  "status": "valid",
  "unitCounts": {
    "totalDwellingUnits": 40,
    "regulatedResidentialUnits": 24,
    "marketRateUnits": 16,
    "otherResidentialUnits": 0
  },
  "annualIncomeCategories": {
    "grossPotentialRent": 64000000,
    "vacancyAndCollectionLoss": 4800000,
    "netEffectiveGrossIncome": 59200000,
    "otherOperatingIncome": 500000,
    "totalIncome": 59700000
  },
  "operatingExpenses": {
    "repairsAndMaintenance": 8500000,
    "utilities": 4100000,
    "insurance": 2600000,
    "taxesAndAssessments": 1100000,
    "management": 3200000,
    "otherOperatingExpenses": 700000,
    "totalOperatingExpenses": 20100000
  }
}
```

## Mapping to the worksheet

- `reportingPeriod` maps to the filing year / reporting period.
- `unitCounts.totalDwellingUnits` maps to the residential unit summary section.
- `unitCounts.regulatedResidentialUnits` maps to the number of rent-regulated units.
- `annualIncomeCategories.*` maps to the annual income categories in the worksheet.
- `operatingExpenses.*` maps to the annual expense categories in the worksheet.

## Validation rules

- `propertyId` is required.
- `reportingPeriod` is required.
- `schemaVersion` is required.
- `totalDwellingUnits` must be a positive integer.
- `regulatedResidentialUnits` must be an integer between zero and `totalDwellingUnits`.
- Monetary values are stored as integer USD cents to avoid floating point noise.
- The synthetic data omits real addresses, taxpayer identifiers, and tenant identities.

## Implementation note

This schema is deliberately narrow and internal. It is for the synthetic demo only and is not an official DOF export format.
