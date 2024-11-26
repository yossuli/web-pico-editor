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

import 'xterm/css/xterm.css';
import * as monaco from 'monaco-editor';
import { term } from './utils/replTerminal';
import { picoSerial } from './utils/picoSerial';
import { pico } from './utils/pico';
import { setup } from './utils/setup';
import { binaryStringToUint8Array } from './utils/binaryStringToUint8Array';
import { stringToUint8Array } from './utils/stringToUint8Array';

document.addEventListener('DOMContentLoaded', async () => {
  const terminalElement = document.getElementById('terminal');
  if (terminalElement) {
    term.open(terminalElement);
    term.fitAddon.fit();

    window.addEventListener('resize', () => {
      term.fitAddon.fit();
    });
  }

  const downloadOutput = document.getElementById(
    'download'
  ) as HTMLSelectElement;
  downloadOutput.addEventListener('click', downloadTerminalContents);

  const clearOutput = document.getElementById('clear') as HTMLSelectElement;
  clearOutput.addEventListener('click', () => {
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
    new Blob([new TextEncoder().encode(contents).buffer], {
      type: 'text/plain',
    })
  );
  const fauxLink = document.createElement('a');
  fauxLink.download = `terminal_content_${new Date().getTime()}.txt`;
  fauxLink.href = linkContent;
  fauxLink.click();
}

setup();

/**
 * Load main.py from the MicroPython device and display it in the editor.
 *
 * @param {monaco.editor.IStandaloneCodeEditor} editor
 *  - The Monaco editor instance.
 */
async function loadTempPy(editor: monaco.editor.IStandaloneCodeEditor) {
  if (picoSerial.picoReader) {
    await picoSerial.picoReader.cancel(); // ターミナル出力を停止
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

    await pico.clearPicoPort('OK', null); // ">OK"を待つ
    const result = await pico.clearPicoPort('\x04', null); // CTRL-Dを待つ

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
  pico.readPicoPort(); // ターミナル出力を再開
}

// Monaco Editorの初期化
document.addEventListener('DOMContentLoaded', () => {
  const editor = monaco.editor.create(
    document.getElementById('editor') as HTMLElement,
    {
      value: '',
      language: 'python',
      theme: 'vs-dark',
    }
  );

  // Load main.pyボタンのクリックイベント
  const loadFileButton = document.getElementById(
    'loadFileButton'
  ) as HTMLButtonElement;
  loadFileButton.addEventListener('click', async () => {
    await loadTempPy(editor);
  });

  // Send Textボタンのクリックイベント
  const saveFileButton = document.getElementById(
    'saveFileButton'
  ) as HTMLButtonElement;
  saveFileButton.addEventListener('click', async () => {
    const text = editor.getValue();
    const binaryData = stringToUint8Array(text);
    await pico.writeFile('temp.py', binaryData); // エディタの内容をファイルに書き込む
  });

  // run Code ボタンのクリックイベント
  const runCodeButton = document.getElementById(
    'runCodeButton'
  ) as HTMLButtonElement;
  runCodeButton.addEventListener('click', async () => {
    // CTRL+A, コード, CTRL+D, CTRL+B
    const text = '\x01' + editor.getValue() + '\x04\x02';
    await pico.sendCommand(text); // エディタの内容を実行
  });

  // STOPボタン：CTRL-C を送信
  const stopButton = document.getElementById('stopButton') as HTMLButtonElement;
  stopButton.addEventListener('click', async () => {
    await pico.sendCommand('\x03'); // CTRL+C
  });
});
