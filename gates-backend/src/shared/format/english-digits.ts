/** Western digits and a thousands comma. Fraction digits appear only when the number has them, up to four. */

const INSTALLED = Symbol.for('gates.englishDigits');

type IntlWithFlag = typeof Intl & { [INSTALLED]?: boolean };

function presentNumber(options?: Intl.NumberFormatOptions): Intl.NumberFormatOptions {
  const next: Intl.NumberFormatOptions = { ...(options ?? {}) };
  const usesSignificantDigits =
    next.minimumSignificantDigits != null || next.maximumSignificantDigits != null;
  next.useGrouping = true;
  if (usesSignificantDigits) return next;
  next.minimumFractionDigits = 0;
  next.maximumFractionDigits = 4;
  return next;
}

export function installEnglishDigits(): void {
  const intl = Intl as IntlWithFlag;
  if (intl[INSTALLED]) return;
  intl[INSTALLED] = true;

  const OriginalNumberFormat = Intl.NumberFormat;
  const OriginalDateTimeFormat = Intl.DateTimeFormat;
  const originalNumberToLocaleString = Number.prototype.toLocaleString;
  const originalDateToLocaleString = Date.prototype.toLocaleString;
  const originalDateToLocaleDateString = Date.prototype.toLocaleDateString;
  const originalDateToLocaleTimeString = Date.prototype.toLocaleTimeString;

  function EnglishNumberFormat(
    this: Intl.NumberFormat,
    _locales?: Intl.LocalesArgument,
    options?: Intl.NumberFormatOptions
  ): Intl.NumberFormat {
    return new OriginalNumberFormat('en-US', presentNumber(options));
  }
  EnglishNumberFormat.prototype = OriginalNumberFormat.prototype;
  EnglishNumberFormat.supportedLocalesOf = OriginalNumberFormat.supportedLocalesOf.bind(OriginalNumberFormat);
  Object.setPrototypeOf(EnglishNumberFormat, OriginalNumberFormat);

  function LatinDateTimeFormat(
    this: Intl.DateTimeFormat,
    locales?: Intl.LocalesArgument,
    options?: Intl.DateTimeFormatOptions
  ): Intl.DateTimeFormat {
    return new OriginalDateTimeFormat(locales, { ...options, numberingSystem: 'latn' });
  }
  LatinDateTimeFormat.prototype = OriginalDateTimeFormat.prototype;
  LatinDateTimeFormat.supportedLocalesOf = OriginalDateTimeFormat.supportedLocalesOf.bind(OriginalDateTimeFormat);
  Object.setPrototypeOf(LatinDateTimeFormat, OriginalDateTimeFormat);

  Object.defineProperty(Intl, 'NumberFormat', {
    configurable: true,
    writable: true,
    value: EnglishNumberFormat,
  });
  Object.defineProperty(Intl, 'DateTimeFormat', {
    configurable: true,
    writable: true,
    value: LatinDateTimeFormat,
  });

  const latinDateOptions = (options?: Intl.DateTimeFormatOptions): Intl.DateTimeFormatOptions => ({
    ...options,
    numberingSystem: 'latn',
  });

  Object.defineProperty(Number.prototype, 'toLocaleString', {
    configurable: true,
    writable: true,
    value(this: Number, _locales?: Intl.LocalesArgument, options?: Intl.NumberFormatOptions) {
      return originalNumberToLocaleString.call(this, 'en-US', presentNumber(options));
    },
  });
  Object.defineProperty(Date.prototype, 'toLocaleString', {
    configurable: true,
    writable: true,
    value(this: Date, locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions) {
      return originalDateToLocaleString.call(this, locales, latinDateOptions(options));
    },
  });
  Object.defineProperty(Date.prototype, 'toLocaleDateString', {
    configurable: true,
    writable: true,
    value(this: Date, locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions) {
      return originalDateToLocaleDateString.call(this, locales, latinDateOptions(options));
    },
  });
  Object.defineProperty(Date.prototype, 'toLocaleTimeString', {
    configurable: true,
    writable: true,
    value(this: Date, locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions) {
      return originalDateToLocaleTimeString.call(this, locales, latinDateOptions(options));
    },
  });
}

installEnglishDigits();
