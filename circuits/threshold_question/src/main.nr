use source_projection::{Source, Projection, check_source};
fn main(source: pub Source, predicate: pub u32, version: pub u32, threshold: pub u32, answer: pub bool, values: Projection) {
    assert(predicate == 1);
    assert(version == 1);
    assert(threshold == 20);
    check_source(source, values);
    assert(answer == (values.regulated >= 20));
}
