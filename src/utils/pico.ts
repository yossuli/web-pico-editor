import { picoSerial as picoSerial } from './picoSerial';
import { readFromPort } from './readFromPort';
import { term } from './replTerminal';

/**
 * Class representing a Pico device.
 */
class Pico {
  /**
   * Prepare the writable port.
   * @return {WritableStreamDefaultWriter | null}
   * The writer instance or null if not available.
   */
  getWritablePort() {
    return picoSerial.getWritablePort();
  }

  /**
   * Release the picoWriter lock.
   */
  releaseLock() {
    picoSerial.releaseLock();
  }

  /**
   * Write a string to the picoWriter.
   * @param {string} s - The string to write.
   * @throws {Error} If the picoWriter is not available.
   */
  async write(s: string) {
    await picoSerial.picoWrite(new TextEncoder().encode(s));
  }

  /**
   * Send command to the Pico device.
   * @param {string} command - The command to send.
   */
  async sendCommand(command: string) {
    if (this.getWritablePort()) {
      await this.write(command);
      this.releaseLock();
    }
  }

  /**
   * 読み込みバッファをクリアし、特定の文字を待ち、それまでに受信した文字を返す
   * @param {string | false} targetChar
   *  - 待機する特定の文字、またはチェックを無効にするためのfalse
   * @param {function(string): void} callback
   * - コールバック関数。引数として文字列を受け取り、戻り値はありません。
   * @return {Promise<string>} - 受信した文字列を返すプロミス
   */
  async clearPicoPort(
    targetChar: string | false,
    callback: ((chunk: string) => void) | null
  ): Promise<string> {
    let result = '';
    if (picoSerial.picoPort && picoSerial.picoPort.readable) {
      picoSerial.picoReader = picoSerial.picoPort.readable.getReader();
      const generator = readFromPort(picoSerial.picoReader, targetChar);
      if (picoSerial.picoReader) {
        try {
          for await (const chunk of generator) {
            if (callback) {
              callback(chunk);
            }
            if (targetChar && chunk.includes(targetChar)) {
              // 特定の文字が含まれている部分を除外
              const [beforeTarget] = chunk.split(targetChar);
              result += beforeTarget;
              break;
            } else {
              result += chunk;
            }
          }
          // console.log('DONE!!!!!!!!!');
        } catch (e) {
          console.error(e);
          await new Promise<void>((resolve) => {
            if (e instanceof Error) {
              term.writeln(`<ERROR: ${e.message}>`, resolve);
            }
          });
        } finally {
          picoSerial.picoReader.releaseLock();
          picoSerial.picoReader = undefined;
        }
      }
    }
    return result;
  }

  /**
   * read the port.
   */
  async readPicoPort(): Promise<void> {
    // console.log('readpicoport!');
    await this.clearPicoPort(false, async (chunk) => {
      // console.log('chunk:', chunk);
      // ターミナルに出力
      await new Promise<void>((resolve) => {
        term.write(chunk, resolve);
      });
    });
    // console.log('!!readpicoport!!');
  }

  /**
   * Write a file to the MicroPython device.
   * @param {string} filename - The name of the file.
   * @param {string} content - The content to write to the file.
   */
  async writeFile(filename: string, content: Uint8Array) {
    if (picoSerial.picoReader) {
      await picoSerial.picoReader.cancel(); // ターミナル出力を停止
    }
    this.clearPicoPort(false, null); // ターミナル出力せずに読み込み（バッファをクリア）
    if (this.getWritablePort()) {
      await this.write('\x01'); // CTRL+A
      await this.write(`with open("${filename}", "wb") as f:\r`);
      const chunk = JSON.stringify(Array.from(content));
      // console.log('chunk:', chunk);
      await this.write(`  f.write(bytes(${chunk}))\r`);
      await this.write('\x04'); // CTRL+D
      this.releaseLock();
      pico.sendCommand('\x02'); // CTRL+B
    }
    if (picoSerial.picoReader) {
      await picoSerial.picoReader.cancel(); // ターミナル出力を停止
    }
    this.readPicoPort(); // ターミナル出力を再開
  }
}
// Pico クラスのインスタンスを作成
export const pico = new Pico();
