import type { FieldErrors } from 'react-hook-form';
import { firstFieldError } from './first-field-error';

export function onFieldErrors(setError: (message: string) => void) {
  return (errors: FieldErrors) => {
    setError(firstFieldError(errors));
  };
}
