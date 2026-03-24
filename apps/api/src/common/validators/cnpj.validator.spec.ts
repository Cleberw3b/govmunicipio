import { IsCNPJConstraint } from './cnpj.validator';

describe('IsCNPJConstraint', () => {
  let validator: IsCNPJConstraint;

  beforeEach(() => {
    validator = new IsCNPJConstraint();
  });

  // ── Valid CNPJs ─────────────────────────────────────────────────────────────

  it('should accept a valid unformatted CNPJ (11222333000181)', () => {
    expect(validator.validate('11222333000181')).toBe(true);
  });

  it('should accept a valid formatted CNPJ (11.222.333/0001-81)', () => {
    expect(validator.validate('11.222.333/0001-81')).toBe(true);
  });

  it('should accept another known valid CNPJ (11444777000161)', () => {
    expect(validator.validate('11444777000161')).toBe(true);
  });

  it('should accept a valid CNPJ with leading zeros (00.000.000/0001-91)', () => {
    // 00000000000191 - computed check digits
    expect(validator.validate('00.000.000/0001-91')).toBe(true);
  });

  // ── All-same-digit patterns ────────────────────────────────────────────────

  it.each([
    '00000000000000',
    '11111111111111',
    '22222222222222',
    '33333333333333',
    '44444444444444',
    '55555555555555',
    '66666666666666',
    '77777777777777',
    '88888888888888',
    '99999999999999',
  ])('should reject all-same-digit CNPJ: %s', (cnpj) => {
    expect(validator.validate(cnpj)).toBe(false);
  });

  // ── Wrong length ───────────────────────────────────────────────────────────

  it('should reject a CNPJ that is too short (13 digits)', () => {
    expect(validator.validate('1122233300018')).toBe(false);
  });

  it('should reject a CNPJ that is too long (15 digits)', () => {
    expect(validator.validate('112223330001810')).toBe(false);
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
    expect(validator.validate(11222333000181 as unknown as string)).toBe(false);
  });

  // ── Non-numeric strings ────────────────────────────────────────────────────

  it('should reject alphabetic characters', () => {
    expect(validator.validate('abcdefghijklmn')).toBe(false);
  });

  // ── Off-by-one check digit ─────────────────────────────────────────────────

  it('should reject off-by-one check digit (11222333000182)', () => {
    expect(validator.validate('11222333000182')).toBe(false);
  });

  it('should reject CNPJ with swapped check digits (11222333000118)', () => {
    expect(validator.validate('11222333000118')).toBe(false);
  });

  // ── Whitespace ─────────────────────────────────────────────────────────────

  it('should reject whitespace-only string', () => {
    expect(validator.validate('   ')).toBe(false);
  });

  // ── Default message ────────────────────────────────────────────────────────

  it('should return the correct default validation message', () => {
    expect(validator.defaultMessage()).toBe('CNPJ inv\u00e1lido');
  });
});
