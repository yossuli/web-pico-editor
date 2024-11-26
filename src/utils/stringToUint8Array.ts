/**
 * 文字列をUint8Arrayに変換する関数
 * @param {string} str - 変換する文字列
 * @return {Uint8Array} - 変換されたUint8Array
 */
export function stringToUint8Array(str: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}
