/**
 * Gates on-prem license PUBLIC key (Ed25519). Safe to publish: it can only check licenses.
 *
 * The matching private key lives on the license issuer's machine at
 * ~/.gates-license/gates-license-private.pem and must never be committed, copied into a
 * release, or sent to a customer. Rotating it means every issued license must be re-issued.
 */
export const GATES_LICENSE_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAwAf7o403qnRiuCK4xr3tMd/B0xc7ViiYPQhXeqTct8o=
-----END PUBLIC KEY-----
`;
