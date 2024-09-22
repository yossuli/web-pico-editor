/**
 * Copyright Programing Educational Laboratory
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Terminal} from 'xterm';
import {FitAddon} from 'xterm-addon-fit';
import {WebLinksAddon} from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import * as monaco from 'monaco-editor';

/**
 * REPL用ターミナル
 */
class ReplTerminal extends Terminal {
  public fitAddon: FitAddon;
  /**
   * REPL用ターミナルのコンストラクタ
   * @param {any} options - ターミナルのオプション
   * @param {FitAddon} fitAddon - FitAddonインスタンス
   */
  constructor(options: any, fitAddon: FitAddon) {
    // 親クラスのコンストラクタを呼び出す
    super(options);
    this.fitAddon = fitAddon;
    this.loadAddon(this.fitAddon);
    this.loadAddon(new WebLinksAddon());

    this.onData((data)=>{
      if (pico) {
        pico.sendCommand(data);
      }
    });
  }
}

// Term クラスのインスタンスを作成
const term = new ReplTerminal(
    {scrollback: 10_000},
    new FitAddon(),
);

document.addEventListener('DOMContentLoaded', async () => {
  const terminalElement = document.getElementById('terminal');
  if (terminalElement) {
    term.open(terminalElement);
    term.fitAddon.fit();

    window.addEventListener('resize', () => {
      term.fitAddon.fit();
    });
  }

  const downloadOutput =
    document.getElementById('download') as HTMLSelectElement;
  downloadOutput.addEventListener('click', downloadTerminalContents);

  const clearOutput = document.getElementById('clear') as HTMLSelectElement;
  clearOutput.addEventListener('click', ()=>{
    term.clear();
  });
});

/**
 * Download the terminal's contents to a file.
 */
function downloadTerminalContents(): void {
  if (!term) {
    throw new Error('no terminal instance found');
  }

  if (term.rows === 0) {
    console.log('No output yet');
    return;
  }

  term.selectAll();
  const contents = term.getSelection();
  term.clearSelection();
  const linkContent = URL.createObjectURL(
      new Blob([new TextEncoder().encode(contents).buffer],
          {type: 'text/plain'}));
  const fauxLink = document.createElement('a');
  fauxLink.download = `terminal_content_${new Date().getTime()}.txt`;
  fauxLink.href = linkContent;
  fauxLink.click();
}

/**
 * シリアルポートの選択
 */
declare class PortOption extends HTMLOptionElement {
  port: SerialPort;
}

/**
 * PicoSerialクラスは、シリアルポートの選択と接続を管理します。
 */
class PicoSerial {
  public portSelector: HTMLSelectElement; // ポート選択ドロップダウン
  public connectButton: HTMLButtonElement; // 接続ボタン
  private portCounter = 1; // addNewPort で名前の末尾に付ける番号

  // 現在使用しているポート
  public picoport: SerialPort | undefined;
  // 現在使用しているリーダー
  public picoreader: ReadableStreamDefaultReader | undefined;

  constructor(portSelector: HTMLSelectElement, connectButton: HTMLButtonElement) {
    this.portSelector = portSelector;
    this.connectButton = connectButton;
  }

  /**
   * 指定されたSerialPortを検索して返します。
   *
   * @param {SerialPort} port 検索するポート
   * @return {PortOption}
   */
  findPortOption(port: SerialPort):
    PortOption | null {
    for (let i = 0; i < this.portSelector.options.length; ++i) {
      const option = this.portSelector.options[i];
      if (option.value === 'prompt') {
        continue;
      }
      const portOption = option as PortOption;
      if (portOption.port === port) {
        return portOption;
      }
    }
    return null;
  }

  /**
  * 指定されたポートを選択ドロップダウンに追加します。
  *
  * @param {SerialPort} port 追加するポート
  * @return {PortOption}
  */
  addNewPort(port: SerialPort): PortOption {
    const portOption = document.createElement('option') as PortOption;
    portOption.textContent = `Port ${this.portCounter++}`;
    portOption.port = port;
    this.portSelector.appendChild(portOption);
    return portOption;
  }

  /**
  * 指定されたポートを選択ドロップダウンに追加するか、既に存在する場合は既存のオプションを返します。
  *
  * @param {SerialPort} port 追加するポート
  * @return {PortOption}
  */
  maybeAddNewPort(port: SerialPort): PortOption {
    const portOption = this.findPortOption(port);
    if (portOption) {
      return portOption;
    }
    return this.addNewPort(port);
  }

  /**
  * 現在選択されているポートを |picoport| に設定します。
  * 選択されていない場合は、ユーザーにポートの選択を促します。
  */
  async getSelectedPort(): Promise<void> {
    if (this.portSelector.value == 'prompt') {
      try {
        const serial = navigator.serial;
        this.picoport = await serial.requestPort({});
      } catch (e) {
        return;
      }
      const portOption = this.maybeAddNewPort(this.picoport);
      portOption.selected = true;
    } else {
      const selectedOption = this.portSelector.selectedOptions[0] as PortOption;
      this.picoport = selectedOption.port;
    }
  }

  /**
  * 接続をクローズします
  */
  async disconnectFromPort(): Promise<void> {
    // Move |port| into a local variable so that connectToPort() doesn't try to
    // close it on exit.
    const localPort = this.picoport;
    this.picoport = undefined;

    if (this.picoreader) {
      await this.picoreader.cancel();
    }

    if (localPort) {
      try {
        await localPort.close();
      } catch (e) {
        console.error(e);
      }
    }
    this.markDisconnected();
  }

  /**
   * みためを|未接続|状態にリセットします
   */
  markDisconnected(): void {
    this.picoport = undefined;
    term.writeln('<DISCONNECTED>');
    this.portSelector.disabled = false;
    this.connectButton.textContent = 'Connect';
    this.connectButton.classList.add('button-default');
    this.connectButton.disabled = false;
  }

  /**
   * みためを|接続|状態にします
   */
  markConnected(): void {
    this.portSelector.disabled = true;
    this.connectButton.textContent = 'Disconnect';
    this.connectButton.classList.remove('button-default');
    this.connectButton.disabled = false;
  }

  /**
   * ポートをオープンします
   */
  async openpicoport(): Promise<void> {
    await this.getSelectedPort();
    if (!this.picoport) {
      return;
    }
    this.markConnected();
    try {
      await this.picoport.open({baudRate: 115200});
      term.writeln('<CONNECTED>');
    } catch (e) {
      console.error(e);
      if (e instanceof Error) {
        term.writeln(`<ERROR: ${e.message}>`);
      }
      this.markDisconnected();
      return;
    }
  }

  private picowriter: WritableStreamDefaultWriter | null = null;

  /**
   * WritableStreamDefaultWriter を取得します。
   * @return {WritableStreamDefaultWriter | null}
   */
  getWritablePort(): WritableStreamDefaultWriter | null {
    if (this.picoport && this.picoport.writable) {
      this.picowriter = this.picoport.writable.getWriter();
    } else {
      this.picowriter = null;
    }
    return this.picowriter;
  }
  /**
   * Releases the lock held by the `picowriter` if it exists.
   * This method checks if the `picowriter` is defined and, if so,
   * calls its `releaseLock` method to release any held resources.
   */
  releaseLock() {
    if (this.picowriter) {
      this.picowriter.releaseLock();
    }
  }
  /**
   * Writes the provided data to the Pico writer.
   *
   * @param {Uint8Array} data - The data to be written, represented as a Uint8Array.
   * @return A promise that resolves when the write operation is complete.
   */
  async picowrite(data: Uint8Array) {
    await this.picowriter?.write(data);
  }
}

var picoserial:any = null;

document.addEventListener('DOMContentLoaded', async () => {
  const portSelector =
    document.getElementById('ports') as HTMLSelectElement;
  const connectButton =
    document.getElementById('connect') as HTMLButtonElement;

  picoserial = new PicoSerial(portSelector, connectButton);
  
  const ports: (SerialPort)[] = await navigator.serial.getPorts();
  ports.forEach((port) => picoserial.addNewPort(port));

  picoserial.connectButton.addEventListener('click', async () => {
    if (picoserial.picoport) {
      picoserial.disconnectFromPort();
    } else {
      await picoserial.openpicoport(); // ポートを開く
      await pico.readpicoport(); // ポートから読み取りターミナルに出力
    }
  });

  // These events are not supported by the polyfill.
  // https://github.com/google/web-serial-polyfill/issues/20
  navigator.serial.addEventListener('connect', (event) => {
    const portOption = picoserial.addNewPort(event.target as SerialPort);
    portOption.selected = true;
  });
  navigator.serial.addEventListener('disconnect', (event) => {
    const portOption = picoserial.findPortOption(event.target as SerialPort);
    if (portOption) {
      portOption.remove();
    }
  });
});

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
    return picoserial.getWritablePort();
  }

  /**
   * Release the picowriter lock.
   */
  releaseLock() {
    picoserial.releaseLock();
  }

  /**
   * Write a string to the picowriter.
   * @param {string} s - The string to write.
   * @throws {Error} If the picowriter is not available.
   */
  async write(s: string) {
    await picoserial.picowrite(new TextEncoder().encode(s));
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
   * @param {(chunk: string) => void} callback
   *  - チャンクを処理するコールバック関数
   * @return {Promise<string>} - 受信した文字列を返すプロミス
   */
  async clearpicoport(
      targetChar: string | false,
      callback: ((chunk: string) => void) | null
  ): Promise<string> {
    let result = '';
    if (picoserial.picoport && picoserial.picoport.readable) {
      picoserial.picoreader = picoserial.picoport.readable.getReader();
      const generator = readFromPort(picoserial.picoreader, targetChar);
      if (picoserial.picoreader) {
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
          picoserial.picoreader.releaseLock();
          picoserial.picoreader = undefined;
        }
      }
    }
    return result;
  }

  /**
   * read the port.
   */
  async readpicoport(): Promise<void> {
    // console.log('readpicoport!');
    await this.clearpicoport(false, async (chunk)=> {
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
    if (picoserial.picoreader) {
      await picoserial.picoreader.cancel(); // ターミナル出力を停止
    }
    this.clearpicoport(false, null); // ターミナル出力せずに読み込み（バッファをクリア）
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
    if (picoserial.picoreader) {
      await picoserial.picoreader.cancel(); // ターミナル出力を停止
    }
    this.readpicoport(); // ターミナル出力を再開
  }
}

/**
 * シリアルポートからデータを読み取るジェネレーター関数
 * @param {ReadableStreamDefaultReader} reader
 *  - シリアルポートのリーダー
 * @param {string | false} targetChar
 *  - 待機する特定の文字、またはチェックを無効にするためのfalse
 * @return {AsyncGenerator<string>}
 *  - データチャンクを文字列として返す非同期ジェネレーター
 */
async function* readFromPort(
    reader: ReadableStreamDefaultReader,
    targetChar: string | false
): AsyncGenerator<string> {
  const decoder = new TextDecoder();

  while (true) {
    const {value, done} = await reader.read();
    if (done) {
      return;
    }

    const chunk = decoder.decode(value, {stream: true});
    yield chunk;

    // targetChar が false でない場合にのみチェック
    if (targetChar && chunk.includes(targetChar)) {
      return;
    }
  }
}

// Pico クラスのインスタンスを作成
const pico = new Pico();

/**
 * b'...'形式のバイナリデータをUint8Arrayに変換する関数
 * @param {string} binaryStr - b'...'形式のバイナリデータ文字列
 * @return {Uint8Array} - 変換されたUint8Array
 */
function binaryStringToUint8Array(binaryStr: string): Uint8Array {
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

/**
 * Load main.py from the MicroPython device and display it in the editor.
 *
 * @param {monaco.editor.IStandaloneCodeEditor} editor
 *  - The Monaco editor instance.
 */
async function loadTempPy(editor: monaco.editor.IStandaloneCodeEditor) {
  if (picoserial.picoreader) {
    await picoserial.picoreader.cancel(); // ターミナル出力を停止
  }
  const filename = 'temp.py';
  if (pico.getWritablePort()) {
    await pico.write('\x01'); // CTRL+A：raw モード
    await pico.write('import os\r');
    await pico.write(`with open("${filename}", "rb") as f:\r`);
    await pico.write('  import ubinascii\r');
    await pico.write('  print(ubinascii.hexlify(f.read()))\r');
    await pico.write('\x04'); // CTRL+D
    pico.releaseLock();

    await pico.clearpicoport('OK', null); // ">OK"を待つ
    const result = await pico.clearpicoport('\x04', null); // CTRL-Dを待つ

    // ファイル内容を表示
    console.log('result:', result);
    const binaryData = binaryStringToUint8Array(result);
    console.log('binary dump:', binaryData);
    const text = new TextDecoder('utf-8').decode(binaryData);
    console.log('text:', text);
    pico.sendCommand('\x02'); // CTRL+B
    // エディタに結果を表示
    editor.setValue(text);
  }
  pico.readpicoport(); // ターミナル出力を再開
}

/**
 * 文字列をUint8Arrayに変換する関数
 * @param {string} str - 変換する文字列
 * @return {Uint8Array} - 変換されたUint8Array
 */
function stringToUint8Array(str: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

// Monaco Editorの初期化
document.addEventListener('DOMContentLoaded', () => {
  const editor =
    monaco.editor.create(document.getElementById('editor') as HTMLElement, {
      value: '',
      language: 'python',
      theme: 'vs-dark',
    });

  // Load main.pyボタンのクリックイベント
  const loadFileButton =
    document.getElementById('loadFileButton') as HTMLButtonElement;
  loadFileButton.addEventListener('click', async () => {
    await loadTempPy(editor);
  });

  // Send Textボタンのクリックイベント
  const saveFileButton =
    document.getElementById('saveFileButton') as HTMLButtonElement;
  saveFileButton.addEventListener('click', async () => {
    const text = editor.getValue();
    const binaryData = stringToUint8Array(text);
    await pico.writeFile('temp.py', binaryData); // エディタの内容をファイルに書き込む
  });

  // run Code ボタンのクリックイベント
  const runCodeButton =
    document.getElementById('runCodeButton') as HTMLButtonElement;
  runCodeButton.addEventListener('click', async () => {
    // CTRL+A, コード, CTRL+D, CTRL+B
    const text = '\x01' + editor.getValue() + '\x04\x02';
    await pico.sendCommand(text); // エディタの内容を実行
  });

  // STOPボタン：CTRL-C を送信
  const stopButton =
    document.getElementById('stopButton') as HTMLButtonElement;
  stopButton.addEventListener('click', async ()=> {
    await pico.sendCommand('\x03'); // CTRL+C
  });
});
