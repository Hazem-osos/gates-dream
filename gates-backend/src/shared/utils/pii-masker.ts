/**
 * PII (Personally Identifiable Information) Masking Utilities
 * Masks sensitive data in logs and responses
 */

/**
 * Mask email address
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) {
    return email;
  }
  const [localPart, domain] = email.split('@');
  if (localPart.length <= 2) {
    return `${localPart[0]}***@${domain}`;
  }
  const visibleChars = Math.min(2, Math.floor(localPart.length / 3));
  const masked = localPart.substring(0, visibleChars) + '***' + localPart.substring(localPart.length - 1);
  return `${masked}@${domain}`;
}

/**
 * Mask phone number
 */
export function maskPhone(phone: string): string {
  if (!phone) {
    return phone;
  }
  // Keep last 4 digits visible
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) {
    return '***' + digits;
  }
  return '***' + digits.substring(digits.length - 4);
}

/**
 * Mask credit card number
 */
export function maskCreditCard(cardNumber: string): string {
  if (!cardNumber) {
    return cardNumber;
  }
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 4) {
    return '****';
  }
  return '****' + digits.substring(digits.length - 4);
}

/**
 * Mask SSN/National ID
 */
export function maskSSN(ssn: string): string {
  if (!ssn) {
    return ssn;
  }
  const digits = ssn.replace(/\D/g, '');
  if (digits.length <= 4) {
    return '***' + digits;
  }
  return '***' + digits.substring(digits.length - 4);
}

/**
 * Mask IP address (keep first octet)
 */
export function maskIP(ip: string): string {
  if (!ip) {
    return ip;
  }
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.xxx.xxx.xxx`;
  }
  return 'xxx.xxx.xxx.xxx';
}

/**
 * Mask any string (generic masking)
 */
export function maskString(value: string, visibleChars: number = 2): string {
  if (!value || value.length <= visibleChars) {
    return '***';
  }
  return value.substring(0, visibleChars) + '***' + value.substring(value.length - visibleChars);
}

/**
 * Recursively mask PII in an object
 */
export function maskPIIInObject(obj: any, depth: number = 0): any {
  if (depth > 10) {
    // Prevent infinite recursion
    return '[Object too deep]';
  }

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    // Check for email
    if (obj.includes('@') && obj.includes('.')) {
      return maskEmail(obj);
    }
    // Check for phone (contains digits and common phone chars)
    if (/[\d\s\-\(\)\+]/.test(obj) && obj.replace(/\D/g, '').length >= 7) {
      return maskPhone(obj);
    }
    // Check for credit card (16 digits)
    if (/^\d{13,19}$/.test(obj.replace(/\D/g, ''))) {
      return maskCreditCard(obj);
    }
    // Check for SSN/National ID (9+ digits)
    if (/^\d{9,}$/.test(obj.replace(/\D/g, ''))) {
      return maskSSN(obj);
    }
    // Check for IP address
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(obj)) {
      return maskIP(obj);
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => maskPIIInObject(item, depth + 1));
  }

  if (typeof obj === 'object') {
    const masked: any = {};
    const sensitiveKeys = [
      'email',
      'phone',
      'mobile',
      'telephone',
      'ssn',
      'nationalId',
      'national_id',
      'creditCard',
      'credit_card',
      'cardNumber',
      'card_number',
      'password',
      'passwordHash',
      'password_hash',
      'token',
      'secret',
      'apiKey',
      'api_key',
      'accessToken',
      'access_token',
      'refreshToken',
      'refresh_token',
      'ip',
      'ipAddress',
      'ip_address',
    ];

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const lowerKey = key.toLowerCase();
        const isSensitive = sensitiveKeys.some((sk) => lowerKey.includes(sk.toLowerCase()));

        if (isSensitive && typeof obj[key] === 'string') {
          // Mask sensitive fields
          if (lowerKey.includes('email')) {
            masked[key] = maskEmail(obj[key]);
          } else if (lowerKey.includes('phone') || lowerKey.includes('mobile') || lowerKey.includes('telephone')) {
            masked[key] = maskPhone(obj[key]);
          } else if (lowerKey.includes('card') || lowerKey.includes('credit')) {
            masked[key] = maskCreditCard(obj[key]);
          } else if (lowerKey.includes('ssn') || lowerKey.includes('national')) {
            masked[key] = maskSSN(obj[key]);
          } else if (lowerKey.includes('ip')) {
            masked[key] = maskIP(obj[key]);
          } else {
            // Generic masking for other sensitive fields
            masked[key] = '***MASKED***';
          }
        } else {
          masked[key] = maskPIIInObject(obj[key], depth + 1);
        }
      }
    }
    return masked;
  }

  return obj;
}

/**
 * Check if a field name indicates PII
 */
export function isPIIField(fieldName: string): boolean {
  const lowerName = fieldName.toLowerCase();
  const piiPatterns = [
    'email',
    'phone',
    'mobile',
    'telephone',
    'ssn',
    'nationalid',
    'national_id',
    'creditcard',
    'credit_card',
    'cardnumber',
    'card_number',
    'password',
    'passwordhash',
    'password_hash',
    'token',
    'secret',
    'apikey',
    'api_key',
    'accesstoken',
    'access_token',
    'refreshtoken',
    'refresh_token',
    'ip',
    'ipaddress',
    'ip_address',
  ];

  return piiPatterns.some((pattern) => lowerName.includes(pattern));
}

