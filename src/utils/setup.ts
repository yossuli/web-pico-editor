import { pico } from './pico';
import { picoserial } from './picoSerial';

export const setup = () => {
  document.addEventListener('DOMContentLoaded', async () => {
    picoserial.portSelector = document.getElementById(
      'ports'
    ) as HTMLSelectElement;
    picoserial.connectButton = document.getElementById(
      'connect'
    ) as HTMLButtonElement;

    // picoserial = new PicoSerial(portSelector, connectButton);

    const ports: SerialPort[] = await navigator.serial.getPorts();
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
};
