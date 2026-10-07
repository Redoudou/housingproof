// DISABLED LEGACY PLACEHOLDER: not the signed SHA-256 projection.
// src/proof.ts refuses to use this circuit. Replace it with the reviewed
// fixed-Q001 circuit and shared encoding before enabling any verified answer.
fn main(regulated_units: u32, threshold: u32, salt: Field, commitment: pub Field) -> pub bool {
    let expected = (regulated_units as Field) * 1000000000 + (threshold as Field) * 1000 + salt;
    assert(expected == commitment);
    regulated_units >= threshold
}
