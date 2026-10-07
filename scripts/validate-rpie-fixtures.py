#!/usr/bin/env python3
"""Validate the planning fixtures and arithmetic. This does not generate ZK proofs.

Uses only Python's standard library. The small schema checker supports exactly
the JSON Schema keywords used by data/schema.json; it is not a general
JSON Schema library. Unknown validation keywords fail closed.
"""
import copy
import datetime
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'data'
ANNOTATIONS = {'$schema', '$id', 'title', 'description'}
SUPPORTED = ANNOTATIONS | {'type', 'const', 'enum', 'minimum', 'maximum',
                           'pattern', 'format', 'required', 'properties',
                           'additionalProperties'}


def check(value, schema, path='$'):
    unknown = set(schema) - SUPPORTED
    if unknown:
        raise ValueError(f'{path}: unsupported schema keywords {unknown}')
    kind = schema.get('type')
    valid_type = {'object': type(value) is dict, 'integer': type(value) is int,
                  'string': type(value) is str}
    if kind is not None and not valid_type.get(kind, False):
        raise ValueError(f'{path}: expected {kind}')
    if 'const' in schema and (type(value) is not type(schema['const']) or value != schema['const']):
        raise ValueError(f'{path}: wrong constant')
    if 'enum' in schema and value not in schema['enum']:
        raise ValueError(f'{path}: value outside enum')
    for key, operation in [('minimum', lambda a, b: a >= b),
                           ('maximum', lambda a, b: a <= b)]:
        if key in schema and not operation(value, schema[key]):
            raise ValueError(f'{path}: outside {key}')
    if 'pattern' in schema and not re.search(schema['pattern'], value):
        raise ValueError(f'{path}: invalid identifier')
    if schema.get('format') == 'date':
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
            raise ValueError(f'{path}: invalid date format')
        datetime.date.fromisoformat(value)
    if kind == 'object':
        missing = set(schema.get('required', [])) - set(value)
        extra = set(value) - set(schema.get('properties', {}))
        if missing or (extra and schema.get('additionalProperties') is False):
            raise ValueError(f'{path}: missing={missing}, extra={extra}')
        for key, child in schema.get('properties', {}).items():
            if key in value:
                check(value[key], child, f'{path}.{key}')


def validate_filing(filing, schema):
    check(filing, schema)
    period = filing['reporting_period']
    year = period['year']
    if period['start'] != f'{year}-01-01' or period['end'] != f'{year}-12-31':
        raise ValueError('Only full calendar years are supported')
    income = filing['income']
    if income['regulated_units_reported'] + income['unregulated_units_reported'] != filing['property']['residential_units']:
        raise ValueError('Fixture subset counts must reconcile')


def balance(filing):
    income = filing['income']
    return (income['regulated_rental_income_cents']
            + income['unregulated_rental_income_cents']
            + income['other_service_income_cents']
            - sum(filing['operating_expenses_cents'].values()))


def evaluate(current, previous, schema, minimum_units=20, decline_bps=2000):
    if minimum_units != 20 or decline_bps != 2000:
        return {'Q001': 'DENIED', 'Q002': 'DENIED'}
    try:
        validate_filing(current, schema)
    except (ValueError, KeyError, TypeError):
        return {'Q001': 'UNAVAILABLE', 'Q002': 'UNAVAILABLE'}
    q1 = current['income']['regulated_units_reported'] >= minimum_units
    try:
        validate_filing(previous, schema)
        compatible = (previous['property']['property_id'] == current['property']['property_id']
                      and previous['reporting_period']['year'] + 1 == current['reporting_period']['year']
                      and previous['schema_version'] == current['schema_version'])
        prior = balance(previous)
        q2 = 10000 * (prior - balance(current)) > decline_bps * prior if compatible and prior > 0 else 'UNAVAILABLE'
    except (ValueError, KeyError, TypeError):
        q2 = 'UNAVAILABLE'
    return {'Q001': q1, 'Q002': q2}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def main():
    schema = json.loads((ROOT / 'schema.json').read_text())
    bundle = json.loads((ROOT / 'fixtures' / 'demo-cases.json').read_text())
    catalog = json.loads((ROOT / 'predicates.json').read_text())
    require(bundle['synthetic'] is True, 'Bundle must be synthetic')
    by_id = {}
    for filing in bundle['filings']:
        validate_filing(filing, schema)
        require(filing['source_id'] not in by_id, 'Duplicate source id')
        by_id[filing['source_id']] = filing
    for case in bundle['cases']:
        current = by_id[case['current_source_id']]
        previous_id = case['previous_source_id']
        previous = by_id[previous_id] if previous_id is not None else None
        actual = evaluate(current, previous, schema)
        require(actual == case['expected'], f"{case['case_id']}: expected {case['expected']}, got {actual}")
        print(f"{case['case_id']}: {actual}; current balance=${balance(current) / 100:,.2f}")
    predicates = {p['id']: p for p in catalog['predicates']}
    require(predicates['Q001']['allowed_parameters'] == {'minimum_units': [20]}, 'Q001 policy drift')
    require(predicates['Q002']['allowed_parameters'] == {'decline_basis_points': [2000]}, 'Q002 policy drift')
    require(catalog['thresholds_requester_editable'] is False, 'Thresholds must be fixed')
    base = by_id['DEMO-RPIE-001-2025-BASE']
    prior = by_id['DEMO-RPIE-001-2024-BASE']
    damaged = copy.deepcopy(base)
    del damaged['operating_expenses_cents']['insurance']
    require(evaluate(damaged, prior, schema)['Q002'] == 'UNAVAILABLE', 'Missing value became a Boolean')
    wrong_year = copy.deepcopy(prior)
    wrong_year['reporting_period'] = copy.deepcopy(base['reporting_period'])
    require(evaluate(base, wrong_year, schema)['Q002'] == 'UNAVAILABLE', 'Same-year comparison accepted')
    wrong_property = copy.deepcopy(prior)
    wrong_property['property']['property_id'] = 'OTHER'
    require(evaluate(base, wrong_property, schema)['Q002'] == 'UNAVAILABLE', 'Wrong property accepted')
    require(evaluate(base, prior, schema, decline_bps=1000)['Q002'] == 'DENIED', 'Unapproved threshold accepted')
    require(balance(prior) == 60000000 and balance(base) == 54000000, 'Documented baseline amounts differ')
    print('PASS: 8 source fixtures, 8 expected-result cases, and 4 invalid-input/policy checks. No cryptography tested.')


if __name__ == '__main__':
    main()
