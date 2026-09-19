export const patterns = {
  text: /^[\p{L}\p{M}0-9][\p{L}\p{M}0-9 .,'’()/_-]{1,99}$/u,
  address: /^[\p{L}\p{M}0-9][\p{L}\p{M}0-9 .,'’()/#°+\/-]{4,199}$/u,
  phone: /^\+?[0-9][0-9\s().-]{7,19}$/,
  moroccoPhone: /^[67][0-9]{8}$/,
  moroccoLandline: /^(?:\+212[\s.-]?5|05)[\s.-]?[0-9]{2}[\s.-]?[0-9]{2}[\s.-]?[0-9]{2}[\s.-]?[0-9]{2}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
}

export const messages = {
  text: 'Utilisez uniquement du texte valide (2 à 100 caractères).',
  address: 'Saisissez une adresse valide.',
  phone: 'Saisissez un numéro de téléphone valide.',
  email: 'Saisissez une adresse e-mail valide.',
  uuid: 'Sélectionnez une valeur valide.'
}

export const validatePattern = (value, pattern, message) =>
  !value || pattern.test(value.trim()) || message
