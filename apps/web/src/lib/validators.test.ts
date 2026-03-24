/** @jest-environment jsdom */

import {
  validateCPF,
  validateCNPJ,
  formatCPF,
  formatCNPJ,
  stripMask,
} from './validators';

describe('validateCPF', () => {
  it('accepts a valid unformatted CPF', () => {
    // 529.982.247-25 is a well-known valid CPF
    expect(validateCPF('52998224725')).toBe(true);
  });

  it('accepts a valid formatted CPF', () => {
    expect(validateCPF('529.982.247-25')).toBe(true);
  });

  it('rejects all-same-digit CPFs', () => {
    expect(validateCPF('00000000000')).toBe(false);
    expect(validateCPF('11111111111')).toBe(false);
    expect(validateCPF('99999999999')).toBe(false);
  });

  it('rejects CPF that is too short', () => {
    expect(validateCPF('123456')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(validateCPF('')).toBe(false);
  });
});

describe('validateCNPJ', () => {
  it('accepts a valid unformatted CNPJ', () => {
    // 11.222.333/0001-81 is a well-known valid CNPJ
    expect(validateCNPJ('11222333000181')).toBe(true);
  });

  it('accepts a valid formatted CNPJ', () => {
    expect(validateCNPJ('11.222.333/0001-81')).toBe(true);
  });

  it('rejects all-same-digit CNPJs', () => {
    expect(validateCNPJ('00000000000000')).toBe(false);
    expect(validateCNPJ('11111111111111')).toBe(false);
  });

  it('rejects CNPJ that is too short', () => {
    expect(validateCNPJ('12345')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(validateCNPJ('')).toBe(false);
  });
});

describe('formatCPF', () => {
  it('formats an 11-digit string correctly', () => {
    expect(formatCPF('52998224725')).toBe('529.982.247-25');
  });

  it('returns input unchanged if wrong length', () => {
    expect(formatCPF('123')).toBe('123');
    expect(formatCPF('123456789012')).toBe('123456789012');
  });
});

describe('formatCNPJ', () => {
  it('formats a 14-digit string correctly', () => {
    expect(formatCNPJ('11222333000181')).toBe('11.222.333/0001-81');
  });
});

describe('stripMask', () => {
  it('removes dots, dashes, and slashes', () => {
    expect(stripMask('529.982.247-25')).toBe('52998224725');
    expect(stripMask('11.222.333/0001-81')).toBe('11222333000181');
  });

  it('returns unchanged string if no mask characters', () => {
    expect(stripMask('12345678901')).toBe('12345678901');
  });
});
