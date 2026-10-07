// Fixed-order field encoding. Host vector: src/commitment.ts.
pub struct Source {
    pub commitment: Field,
    pub source_hash: [Field; 2],
    pub property_hash: [Field; 2],
    pub year: u32,
    pub revision: u32,
}
pub struct Projection {
    pub residential: u32,
    pub regulated: u32,
    pub unregulated: u32,
    pub income: [u64; 3],
    pub expenses: [u64; 13],
    pub excluded: [u64; 4],
    pub salt: [Field; 2],
}
pub fn check_source(source: Source, values: Projection) {
    assert((source.year == 2024) | (source.year == 2025));
    assert((source.revision >= 1) & (source.revision <= 1000000));
    assert((values.residential >= 1) & (values.residential <= 10000));
    assert((values.regulated <= 10000) & (values.unregulated <= 10000));
    assert(values.regulated + values.unregulated == values.residential);
    for amount in values.income { assert(amount <= 1000000000000); }
    for amount in values.expenses { assert(amount <= 1000000000000); }
    for amount in values.excluded { assert(amount <= 1000000000000); }
    let mut encoded: [Field; 34] = [0; 34];
    encoded[0] = 0x686f7573696e6770726f6f663a76333a; // ASCII housingproof:v3:
    encoded[1] = 1; // rpie-demo-v1
    encoded[2] = 1; // residential-only-main-statement-v1; all scope flags false
    encoded[3] = source.source_hash[0]; encoded[4] = source.source_hash[1];
    encoded[5] = source.property_hash[0]; encoded[6] = source.property_hash[1];
    encoded[7] = source.year as Field; encoded[8] = source.revision as Field;
    encoded[9] = values.residential as Field; encoded[10] = values.regulated as Field; encoded[11] = values.unregulated as Field;
    for i in 0..3 { encoded[12 + i] = values.income[i] as Field; }
    for i in 0..13 { encoded[15 + i] = values.expenses[i] as Field; }
    for i in 0..4 { encoded[28 + i] = values.excluded[i] as Field; }
    encoded[32] = values.salt[0]; encoded[33] = values.salt[1];
    assert(std::hash::poseidon2::Poseidon2::hash(encoded, 34) == source.commitment);
}
pub fn operating_balance(values: Projection) -> i64 {
    let mut income: i64 = 0;
    let mut expense: i64 = 0;
    for amount in values.income { income = income + amount as i64; }
    for amount in values.expenses { expense = expense + amount as i64; }
    income - expense
}
