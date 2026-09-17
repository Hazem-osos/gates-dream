import type { FieldErrors } from 'react-hook-form';
import { toast } from '@/lib/feedback/toast';
import { firstFieldError } from './first-field-error';

export function onFieldErrors(setError: (message: string) => void) {
  return (errors: FieldErrors) => {
    const message = firstFieldError(errors);
    setError(message);
    toast.error(message, { id: 'gates-form-error', duration: 6000 });
  };
}
