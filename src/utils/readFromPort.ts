/**
 * シリアルポートからデータを読み取るジェネレーター関数
 * @param {ReadableStreamDefaultReader} reader
 *  - シリアルポートのリーダー
 * @param {string | false} targetChar
 *  - 待機する特定の文字、またはチェックを無効にするためのfalse
 * @return {AsyncGenerator<string>}
 *  - データチャンクを文字列として返す非同期ジェネレーター
 */
export async function* readFromPort(
  reader: ReadableStreamDefaultReader,
  targetChar: string | false
): AsyncGenerator<string> {
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      return;
    }

    const chunk = decoder.decode(value, { stream: true });
    yield chunk;

    if (targetChar && chunk.includes(targetChar)) {
      return;
    }
  }
}
