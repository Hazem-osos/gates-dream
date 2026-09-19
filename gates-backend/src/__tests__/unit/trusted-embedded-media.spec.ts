import { isTrustedEmbeddedMedia } from '../../shared/middleware/sanitize.middleware';

describe('isTrustedEmbeddedMedia', () => {
  it('accepts a normal JPEG data URL', () => {
    expect(isTrustedEmbeddedMedia('data:image/jpeg;base64,/9j/4AAQSkZJRg==')).toBe(true);
    expect(isTrustedEmbeddedMedia('data:image/jpg;base64,abc')).toBe(true);
    expect(isTrustedEmbeddedMedia('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
  });

  it('rejects scripts and SQL-looking strings', () => {
    expect(isTrustedEmbeddedMedia('data:text/html;base64,PHNjcmlwdD4=')).toBe(false);
    expect(isTrustedEmbeddedMedia("'; DROP TABLE items; --")).toBe(false);
    expect(isTrustedEmbeddedMedia('https://cdn.example/logo.jpg')).toBe(false);
  });
});
