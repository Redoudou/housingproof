# Synthetic RPIE subset and source mapping

The authoritative machine-readable contract is [`data/schema.json`](../data/schema.json). This is a narrow internal projection, not an official DOF JSON/XML format. It replaces the starter's generic gross-potential-rent and vacancy-loss P&L model.

Source: [RPIE-2025 worksheet and instructions](https://www.nyc.gov/assets/finance/downloads/pdf/rpie/rpie-worksheet.pdf), revised March 2, 2026. It is preparation guidance, not the electronic filing form. See the [MVP plan](mvp-plan.md) for the source review and unverified rent-roll-template details.

| Our field | Source | Interpretation |
|---|---|---|
| `reporting_period` | I | Full calendar-year bounds |
| `property.residential_units` | E.1 | Residential capacity |
| `income.regulated_units_reported` and regulated receipts | J.1a | Reported count and annual income |
| Unregulated count and receipts | J.1b | Reported count and annual income |
| Other service income | J.10d | The one additional income category used here |
| Operating expense slots | L(I).1–13 | Explicit components, not a supplied total |
| Excluded expenses | L(I).15 | Separately stored; excluded from the MVP balance |

All other income categories, owner-occupied units, commercial activity, and replacement-reserve activity are explicitly absent in this subset. Ingestion rejects unknown fields, wrong schema/scope, missing components, non-integer or oversized values, inconsistent counts, and partial periods. Amounts are integer USD cents, bounded to 10^12 per line; counts are bounded to 10,000. The supported sample has 40 units.

The runtime fixture list is `data/filings.json`: eight scenario source records plus deliberately invalid and incomplete examples. The independent scenario oracle in `data/fixtures/demo-cases.json` covers eight comparisons. Fixture checks establish the dataset contract and arithmetic, not cryptography.

The 2024 comparison uses the same MVP projection; it is not an independently mapped 2024 official form. Rent-roll questions are deferred until the current template and status values are checked. Latest monthly rent and end-of-period occupancy are not interchangeable with annual receipts or worksheet E's taxable-status-date vacancy.

Q001 proves only a reported regulated count. The proposed Q002 balance is the three included income components minus L(I).1–13. It is not DOF-assessed NOI, legal rent, or a compliance verdict.
