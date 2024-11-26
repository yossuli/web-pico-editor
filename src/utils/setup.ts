import { pico } from './pico';
import { picoSerial } from './picoSerial';

export const setup = () => {
  document.addEventListener('DOMContentLoaded', async () => {
    picoSerial.portSelector = document.getElementById(
      'ports'
    ) as HTMLSelectElement;
    picoSerial.connectButton = document.getElementById(
      'connect'
    ) as HTMLButtonElement;

    // picoSerial = new PicoSerial(portSelector, connectButton);

    const ports: SerialPort[] = await navigator.serial.getPorts();
    ports.forEach((port) => picoSerial.addNewPort(port));

    picoSerial.connectButton.addEventListener('click', async () => {
      if (picoSerial.picoPort) {
        picoSerial.disconnectFromPort();
      } else {
        await picoSerial.openPicoPort(); // ポートを開く
        await pico.readPicoPort(); // ポートから読み取りターミナルに出力
      }
    });

    // These events are not supported by the polyfill.
    // https://github.com/google/web-serial-polyfill/issues/20
    navigator.serial.addEventListener('connect', (event) => {
      const portOption = picoSerial.addNewPort(event.target as SerialPort);
      portOption.selected = true;
    });
    navigator.serial.addEventListener('disconnect', (event) => {
      const portOption = picoSerial.findPortOption(event.target as SerialPort);
      if (portOption) {
        portOption.remove();
      }
    });
  });
};
