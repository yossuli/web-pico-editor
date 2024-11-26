import { PortOption } from '../../types';
import { term } from './replTerminal';

/**
 * PicoSerialクラスは、シリアルポートの選択と接続を管理します。
 */
class PicoSerial {
  // ポート選択ドロップダウン
  public portSelector: HTMLSelectElement | undefined = undefined;
  // 接続ボタン
  public connectButton: HTMLButtonElement | undefined = undefined;
  private portCounter = 1; // addNewPort で名前の末尾に付ける番号

  // 現在使用しているポート
  public picoport: SerialPort | undefined;
  // 現在使用しているリーダー
  public picoreader: ReadableStreamDefaultReader | undefined;

  /**
   * 指定されたSerialPortを検索して返します。
   *
   * @param {SerialPort} port 検索するポート
   * @return {PortOption}
   */
  findPortOption(port: SerialPort): PortOption | null {
    if (!this.portSelector) return null;
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
    this.portSelector?.appendChild(portOption);
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
    if (this.portSelector?.value == 'prompt') {
      try {
        const serial = navigator.serial;
        this.picoport = await serial.requestPort({});
      } catch (e) {
        return;
      }
      const portOption = this.maybeAddNewPort(this.picoport);
      portOption.selected = true;
    } else {
      const selectedOption = this.portSelector
        ?.selectedOptions[0] as PortOption;
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
    if (this.portSelector) {
      this.portSelector.disabled = false;
    }
    if (this.connectButton) {
      this.connectButton.textContent = 'Connect';
      this.connectButton.classList.add('button-default');
      this.connectButton.disabled = false;
    }
  }

  /**
   * みためを|接続|状態にします
   */
  markConnected(): void {
    if (this.portSelector) {
      this.portSelector.disabled = true;
    }
    if (this.connectButton) {
      this.connectButton.textContent = 'Disconnect';
      this.connectButton.classList.remove('button-default');
      this.connectButton.disabled = false;
    }
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
      await this.picoport.open({ baudRate: 115200 });
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
   * @param {Uint8Array} data - The data to be written,
   * represented as a Uint8Array.
   * @return {void}
   * A promise that resolves when the write operation is complete.
   */
  async picowrite(data: Uint8Array) {
    await this.picowriter?.write(data);
  }
}

export const picoserial = new PicoSerial();
