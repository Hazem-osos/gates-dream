declare module 'pkcs11js' {
  export class PKCS11 {
    load(path: string): void;
    C_Initialize(): void;
    C_Finalize(): void;
  }
}
