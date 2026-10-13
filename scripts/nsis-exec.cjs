const { spawn } = require('node:child_process');
const path = require('node:path');
const { stripSensitiveEnvVars } = require('builder-util/out/util');
// electron-builder 26 hardcodes four minutes. Our custom script compresses the
// unpacked Electron tree, which can legitimately take longer on a cloud CPU.
function spawnWithLimit(command, args, input, options, limitMs = 20 * 60 * 1000) {
  return new Promise((resolve,reject) => {
    const child = spawn(command,args,{...options,env:stripSensitiveEnvVars(options?.env || process.env),stdio:['pipe','pipe','pipe'],shell:false});
    let stdout='',stderr='',timedOut=false;
    const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL');},limitMs);
    child.stdout.on('data',b=>{stdout+=b.toString();});
    child.stderr.on('data',b=>{stderr+=b.toString();});
    child.on('error',error=>{clearTimeout(timer);reject(error);});
    child.stdin.on('error',()=>{}); // close/error reports compiler failures
    child.on('close',(code,signal)=>{
      clearTimeout(timer);
      if(timedOut)reject(new Error('NSIS compiler exceeded its extended time limit.'));
      else if(code!==0)reject(new Error('NSIS compiler failed ('+code+', '+signal+'): '+stderr.slice(-3000)+'\n'+stdout.slice(-3000)));
      else resolve({stdout,stderr});
    });
    child.stdin.end(input);
  });
}
function configureNsisTimeout() {
  if(process.platform!=='linux')return;
  const util=require('builder-util/out/util');
  const original=util.spawnAndWriteWithOutput;
  util.spawnAndWriteWithOutput=(command,args,data,options)=>{
    if(path.basename(command)==='makensis')return spawnWithLimit(command,args,data,options);
    return original(command,args,data,options);
  };
}
module.exports={spawnWithLimit,configureNsisTimeout};
