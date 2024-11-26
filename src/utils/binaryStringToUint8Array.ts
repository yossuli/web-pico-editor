/**
 * b'...'形式のバイナリデータをUint8Arrayに変換する関数
 * @param {string} binaryStr - b'...'形式のバイナリデータ文字列
 * @return {Uint8Array} - 変換されたUint8Array
 */
export function binaryStringToUint8Array(binaryStr: string): Uint8Array {
  // プレフィックスb'とサフィックス'を取り除く
  let hexStr = binaryStr.slice(2, -1);
  // 文字列の長さが奇数の場合、先頭に0を追加
  if (hexStr.length % 2 !== 0) {
    hexStr = hexStr + '0';
  }
  // 2文字ごとに分割してUint8Arrayに変換
  const byteArray = new Uint8Array(hexStr.length / 2);
  for (let i = 0; i < hexStr.length; i += 2) {
    byteArray[i / 2] = parseInt(hexStr.substr(i, 2), 16);
  }
  // 最後のデータがNULLの場合は除外
  if (byteArray[byteArray.length - 1] === 0) {
    return byteArray.slice(0, -1);
  }
  return byteArray;
}
