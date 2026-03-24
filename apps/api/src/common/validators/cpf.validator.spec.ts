import { IsCPFConstraint } from './cpf.validator';

describe('IsCPFConstraint', () => {
  let validator: IsCPFConstraint;

  beforeEach(() => {
    validator = new IsCPFConstraint();
  });

  // ── Valid CPFs ──────────────────────────────────────────────────────────────

  it('should accept a valid unformatted CPF (52998224725)', () => {
    expect(validator.validate('52998224725')).toBe(true);
  });

  it('should accept a valid formatted CPF (111.444.777-35)', () => {
    expect(validator.validate('111.444.777-35')).toBe(true);
  });

  it('should accept a valid CPF with leading zeros (000.000.001-91)', () => {
    expect(validator.validate('000.000.001-91')).toBe(true);
  });

  it('should accept another known valid CPF (935.411.347-80)', () => {
    // Computed: digits 9354113478, first check = 8, second check = 0
    expect(validator.validate('93541134780')).toBe(true);
  });

  it('should accept yet another valid CPF (529.982.247-25 formatted)', () => {
    expect(validator.validate('529.982.247-25')).toBe(true);
  });

  // ── All-same-digit patterns (all 10 invalid) ──────────────────────────────

  it.each([
    '00000000000',
    '11111111111',
    '22222222222',
    '33333333333',
    '44444444444',
    '55555555555',
    '66666666666',
    '77777777777',
    '88888888888',
    '99999999999',
  ])('should reject all-same-digit CPF: %s', (cpf) => {
    expect(validator.validate(cpf)).toBe(false);
  });

  // ── Wrong length ───────────────────────────────────────────────────────────

  it('should reject a CPF that is too short (10 digits)', () => {
    expect(validator.validate('1234567890')).toBe(false);
  });

  it('should reject a CPF that is too long (12 digits)', () => {
    expect(validator.validate('123456789012')).toBe(false);
  });

  // ── Empty / null / undefined / non-string ──────────────────────────────────

  it('should reject an empty string', () => {
    expect(validator.validate('')).toBe(false);
  });

  it('should reject null', () => {
    expect(validator.validate(null as unknown as string)).toBe(false);
  });

  it('should reject undefined', () => {
    expect(validator.validate(undefined as unknown as string)).toBe(false);
  });

  it('should reject a number type', () => {
    expect(validator.validate(12345678901 as unknown as string)).toBe(false);
  });

  // ── Non-numeric strings ────────────────────────────────────────────────────

  it('should reject alphabetic characters', () => {
    expect(validator.validate('abcdefghijk')).toBe(false);
  });

  // ── Valid format but invalid check digit ───────────────────────────────────

  it('should reject formatted CPF with invalid check digit (123.456.789-00)', () => {
    expect(validator.validate('123.456.789-00')).toBe(false);
  });

  it('should reject off-by-one check digit (52998224726 instead of 52998224725)', () => {
    expect(validator.validate('52998224726')).toBe(false);
  });

  // ── Whitespace ─────────────────────────────────────────────────────────────

  it('should reject whitespace-only string', () => {
    expect(validator.validate('   ')).toBe(false);
  });

  // ── Default message ────────────────────────────────────────────────────────

  it('should return the correct default validation message', () => {
    expect(validator.defaultMessage()).toBe('CPF inv\u00e1lido');
  });
});
