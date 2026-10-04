/**
 * ETA document serialization used as the SHA-256 input of the CAdES message-digest.
 * Property names are uppercased. Array names are repeated once for the array and
 * once before every element. Scalar text is the raw JSON token, so 10.50 stays 10.50.
 * https://sdk.invoicing.eta.gov.eg/document-serialization-approach/
 */

function upperName(name: string): string {
  return name.replace(/[a-z]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 32));
}

class EtaJsonParser {
  private index = 0;

  constructor(private readonly source: string) {}

  serialize(): string {
    this.skipWs();
    const text = this.parseValue();
    this.skipWs();
    if (!this.eof()) throw new Error('ETA_SERIALIZE_INVALID_JSON');
    return text;
  }

  private eof(): boolean {
    return this.index >= this.source.length;
  }

  private skipWs(): void {
    while (/\s/.test(this.source[this.index] ?? '')) this.index += 1;
  }

  private parseValue(): string {
    this.skipWs();
    const char = this.source[this.index];
    if (char === '{') return this.parseObject();
    if (char === '[') return this.parseArray(null);
    if (char === '"') return `"${this.parseString()}"`;
    return `"${this.parseLiteral()}"`;
  }

  private parseObject(): string {
    this.index += 1;
    let out = '';
    this.skipWs();
    if (this.source[this.index] === '}') {
      this.index += 1;
      return out;
    }
    while (true) {
      this.skipWs();
      if (this.source[this.index] !== '"') throw new Error('ETA_SERIALIZE_INVALID_JSON');
      const name = upperName(this.parseString());
      this.skipWs();
      if (this.source[this.index] !== ':') throw new Error('ETA_SERIALIZE_INVALID_JSON');
      this.index += 1;
      this.skipWs();
      const quoted = `"${name}"`;
      if (this.source[this.index] === '[') out += quoted + this.parseArray(name);
      else out += quoted + this.parseValue();
      this.skipWs();
      if (this.source[this.index] === ',') {
        this.index += 1;
        continue;
      }
      if (this.source[this.index] === '}') {
        this.index += 1;
        break;
      }
      throw new Error('ETA_SERIALIZE_INVALID_JSON');
    }
    return out;
  }

  private parseArray(name: string | null): string {
    this.index += 1;
    let out = '';
    this.skipWs();
    if (this.source[this.index] === ']') {
      this.index += 1;
      return out;
    }
    while (true) {
      if (name) out += `"${name}"`;
      out += this.parseValue();
      this.skipWs();
      if (this.source[this.index] === ',') {
        this.index += 1;
        continue;
      }
      if (this.source[this.index] === ']') {
        this.index += 1;
        break;
      }
      throw new Error('ETA_SERIALIZE_INVALID_JSON');
    }
    return out;
  }

  private parseString(): string {
    this.index += 1;
    let out = '';
    while (this.index < this.source.length) {
      const char = this.source[this.index];
      this.index += 1;
      if (char === '"') return out;
      if (char !== '\\') {
        out += char;
        continue;
      }
      const next = this.source[this.index];
      this.index += 1;
      if (next === 'u') {
        const hex = this.source.slice(this.index, this.index + 4);
        this.index += 4;
        out += String.fromCharCode(Number.parseInt(hex, 16));
        continue;
      }
      const escaped: Record<string, string> = {
        '"': '"',
        '\\': '\\',
        '/': '/',
        b: '\b',
        f: '\f',
        n: '\n',
        r: '\r',
        t: '\t',
      };
      out += escaped[next] ?? next;
    }
    throw new Error('ETA_SERIALIZE_INVALID_JSON');
  }

  private parseLiteral(): string {
    const start = this.index;
    while (this.index < this.source.length && !/[\s,\]}]/.test(this.source[this.index] ?? '')) {
      this.index += 1;
    }
    const literal = this.source.slice(start, this.index);
    if (!literal) throw new Error('ETA_SERIALIZE_INVALID_JSON');
    return literal;
  }
}

export function serializeEtaJsonText(json: string): string {
  return new EtaJsonParser(json).serialize();
}
