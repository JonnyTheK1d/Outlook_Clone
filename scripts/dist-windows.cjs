const { build } = require('electron-builder');
const config = require('../dist-electron/shared/release-config').releaseConfig;
async function run() {
  const signing = config.automaticUpdates;
  if (signing && (!config.publisher || !process.env.CSC_LINK)) throw new Error('Signed updates require a publisher and CSC_LINK. No unsigned fallback.');
  const extra = process.argv.slice(2);
  // Cloud cross-build can provide a verified Electron cache, without touching TLS.
  const cache = extra.find(a=>a.startsWith('--config.electronDownload.cache='));
  await build({ win:['nsis'],x64:true,publish:'never',config:{
    forceCodeSigning:signing,
    win:{signExecutable:signing,...(signing?{publisherName:config.publisher}:{})},
    publish:{provider:'github',owner:'JonnyTheK1d',repo:'Outlook_Clone'},
    ...(cache?{electronDownload:{cache:cache.slice('--config.electronDownload.cache='.length)}}:{})
  }});
}
run().catch(error=>{if(!config.automaticUpdates)console.error(error.message);console.error('Windows packaging failed. Check build output, signing configuration and tool availability.');process.exitCode=1;});
