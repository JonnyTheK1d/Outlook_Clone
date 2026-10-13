import { app, dialog, type BrowserWindow } from 'electron';
import { releaseConfig } from '../shared/release-config';
export function initializeUpdates(window: BrowserWindow) {
  if (!app.isPackaged || process.platform !== 'win32' || !releaseConfig.automaticUpdates || !releaseConfig.publisher) return;
  const { autoUpdater } = require('electron-updater') as typeof import('electron-updater');
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.on('error', () => {
    window.webContents.send('update-notice', 'Das Update konnte nicht sicher geprüft werden. Die aktuelle Version bleibt installiert.');
  });
  autoUpdater.on('update-downloaded', async () => {
    const result = await dialog.showMessageBox(window, { type:'info',title:'Postblick aktualisieren',message:'Ein geprüftes Update ist bereit.',buttons:['Später','Jetzt neu starten'],defaultId:0,cancelId:0 });
    if (result.response === 1) autoUpdater.quitAndInstall(false,true);
  });
  // electron-updater verifies SHA-512 and the publisher configured in app-update.yml.
  const check=()=>{void autoUpdater.checkForUpdates().catch(()=>{});};
  check();const timer=setInterval(check,6*3600000);timer.unref();
}
