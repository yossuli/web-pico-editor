import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { pico } from './pico';

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

    this.onData((data) => {
      if (pico) {
        pico.sendCommand(data);
      }
    });
  }
}

// Term クラスのインスタンスを作成
export const term = new ReplTerminal({ scrollback: 10_000 }, new FitAddon());
