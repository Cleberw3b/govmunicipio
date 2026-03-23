/**
 * CPF and CNPJ Validation Utilities
 * Brazilian identification document validation with check digit algorithms
 */

/**
 * Validates a Brazilian CPF (Cadastro de Pessoas Físicas)
 * Algorithm: Two check digits calculated from first 9 digits
 * @param cpf - CPF string, with or without formatting
 * @returns true if CPF is valid, false otherwise
 */
export function validateCPF(cpf: string): boolean {
  const cleaned = stripMask(cpf);

  // Must be exactly 11 digits
  if (cleaned.length !== 11 || !/^\d+$/.test(cleaned)) {
    return false;
  }

  // Reject known invalid patterns (all same digit)
  if (/^(\d)\1{10}$/.test(cleaned)) {
    return false;
  }

  // Calculate first check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned[i], 10) * (10 - i);
  }
  let remainder = sum % 11;
  const firstCheckDigit = remainder < 2 ? 0 : 11 - remainder;

  // Verify first check digit
  if (parseInt(cleaned[9], 10) !== firstCheckDigit) {
    return false;
  }

  // Calculate second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned[i], 10) * (11 - i);
  }
  remainder = sum % 11;
  const secondCheckDigit = remainder < 2 ? 0 : 11 - remainder;

  // Verify second check digit
  return parseInt(cleaned[10], 10) === secondCheckDigit;
}

/**
 * Validates a Brazilian CNPJ (Cadastro Nacional de Pessoa Jurídica)
 * Algorithm: Two check digits calculated from first 12 digits
 * @param cnpj - CNPJ string, with or without formatting
 * @returns true if CNPJ is valid, false otherwise
 */
export function validateCNPJ(cnpj: string): boolean {
  const cleaned = stripMask(cnpj);

  // Must be exactly 14 digits
  if (cleaned.length !== 14 || !/^\d+$/.test(cleaned)) {
    return false;
  }

  // Reject known invalid patterns (all same digit)
  if (/^(\d)\1{13}$/.test(cleaned)) {
    return false;
  }

  // First check digit multipliers: 5,4,3,2,9,8,7,6,5,4,3,2
  const firstMultipliers = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned[i], 10) * firstMultipliers[i];
  }
  let remainder = sum % 11;
  const firstCheckDigit = remainder < 2 ? 0 : 11 - remainder;

  // Verify first check digit
  if (parseInt(cleaned[12], 10) !== firstCheckDigit) {
    return false;
  }

  // Second check digit multipliers: 6,5,4,3,2,9,8,7,6,5,4,3,2
  const secondMultipliers = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleaned[i], 10) * secondMultipliers[i];
  }
  remainder = sum % 11;
  const secondCheckDigit = remainder < 2 ? 0 : 11 - remainder;

  // Verify second check digit
  return parseInt(cleaned[13], 10) === secondCheckDigit;
}

/**
 * Formats a CPF string as XXX.XXX.XXX-XX
 * @param cpf - CPF string with or without formatting
 * @returns Formatted CPF string
 */
export function formatCPF(cpf: string): string {
  const cleaned = stripMask(cpf);
  if (cleaned.length !== 11) {
    return cpf;
  }
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Formats a CNPJ string as XX.XXX.XXX/XXXX-XX
 * @param cnpj - CNPJ string with or without formatting
 * @returns Formatted CNPJ string
 */
export function formatCNPJ(cnpj: string): string {
  const cleaned = stripMask(cnpj);
  if (cleaned.length !== 14) {
    return cnpj;
  }
  return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

/**
 * Removes all non-digit characters from a string
 * @param value - Input string
 * @returns String with only digits
 */
export function stripMask(value: string): string {
  return value.replace(/\D/g, '');
}
