import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Validates Brazilian CNPJ (Cadastro Nacional de Pessoa Jurídica)
 * Check digit algorithm validation
 */
@ValidatorConstraint({ name: 'isCNPJ', async: false })
export class IsCNPJConstraint implements ValidatorConstraintInterface {
  validate(value: string): boolean {
    if (!value || typeof value !== 'string') {
      return false;
    }

    const cleaned = value.replace(/\D/g, '');

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

  defaultMessage(): string {
    return 'CNPJ inválido';
  }
}

/**
 * Decorator to validate CNPJ format and check digits
 * @param options - Validation options
 * @returns PropertyDecorator
 */
export function IsCNPJ(options?: ValidationOptions) {
  return function (target: object, propertyKey?: string | symbol) {
    registerDecorator({
      target: target.constructor,
      propertyName: propertyKey as string,
      options: {
        message: 'CNPJ inválido',
        ...options,
      },
      constraints: [],
      validator: IsCNPJConstraint,
    });
  };
}
