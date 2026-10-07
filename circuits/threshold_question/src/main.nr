fn main(regulated_units: u32, threshold: u32, salt: Field, commitment: pub Field) -> pub bool {
    let expected = (regulated_units as Field) * 1000000000 + (threshold as Field) * 1000 + salt;
    assert(expected == commitment);
    regulated_units >= threshold
}
