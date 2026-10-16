use source_projection::{Source, Projection, check_source, operating_balance};
fn main(current: pub Source, prior: pub Source, predicate: pub u32, version: pub u32, threshold: pub u32, answer: pub bool, current_values: Projection, prior_values: Projection) {
    assert(predicate == 2);
    assert(version == 1);
    assert(threshold == 2000);
    check_source(current, current_values);
    check_source(prior, prior_values);
    assert(current.property_hash == prior.property_hash);
    assert(current.year == prior.year + 1);
    let p = operating_balance(prior_values);
    let c = operating_balance(current_values);
    assert(p > 0);
    assert(answer == (10000 * (p - c) > 2000 * p));
}
