/**
 * Validation Messages (Portuguese - pt-BR)
 * Centralized error messages for form validation
 */

export const messages = {
  required: 'Campo obrigatório',
  invalidCPF: 'CPF inválido',
  invalidCNPJ: 'CNPJ inválido',
  invalidEmail: 'E-mail inválido',
  minLength: (n: number) => `Mínimo de ${n} caracteres`,
  maxLength: (n: number) => `Máximo de ${n} caracteres`,
  invalidPhone: 'Telefone inválido',
  invalidCEP: 'CEP inválido',
  invalidDate: 'Data inválida',
  passwordMismatch: 'As senhas não coincidem',
  duplicateValue: 'Valor já cadastrado',
  invalidURL: 'URL inválida',
  invalidUUID: 'Identificador inválido',
  minValue: (n: number) => `Valor mínimo é ${n}`,
  maxValue: (n: number) => `Valor máximo é ${n}`,
} as const;
