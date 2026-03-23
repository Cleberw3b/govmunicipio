import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Validates Brazilian CPF (Cadastro de Pessoas Físicas)
 * Check digit algorithm validation
 */
@ValidatorConstraint({ name: 'isCPF', async: false })
export class IsCPFConstraint implements ValidatorConstraintInterface {
  validate(value: string): boolean {
    if (!value || typeof value !== 'string') {
      return false;
    }

    const cleaned = value.replace(/\D/g, '');

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

  defaultMessage(): string {
    return 'CPF inválido';
  }
}

/**
 * Decorator to validate CPF format and check digits
 * @param options - Validation options
 * @returns PropertyDecorator
 */
export function IsCPF(options?: ValidationOptions) {
  return function (target: object, propertyKey?: string | symbol) {
    registerDecorator({
      target: target.constructor,
      propertyName: propertyKey as string,
      options: {
        message: 'CPF inválido',
        ...options,
      },
      constraints: [],
      validator: IsCPFConstraint,
    });
  };
}
