const { test }=require('node:test');
const assert=require('node:assert/strict');
const { spawnWithLimit }=require('../scripts/nsis-exec.cjs');
test('compiler wrapper preserves stdin, stdout and nonzero exit status',async()=>{
  const result=await spawnWithLimit(process.execPath,['-e',"process.stdin.on('data',data=>process.stdout.write(data));"],'installer source',{},10000);
  assert.equal(result.stdout,'installer source');
  await assert.rejects(spawnWithLimit(process.execPath,['-e',"console.error('compile failed');process.exit(2);"],'',{},10000),/failed.*2/);
});
test('compiler timeout kills the child and rejects incomplete output',async()=>{
  await assert.rejects(spawnWithLimit(process.execPath,['-e',"setInterval(()=>{},1000);"],'',{},200),/time limit/);
});
test('compiler processes do not inherit signing passwords or tokens',async()=>{
  const result=await spawnWithLimit(process.execPath,['-e',"console.log(process.env.CSC_KEY_PASSWORD === undefined && process.env.TEST_TOKEN === undefined);"],'',{env:{...process.env,CSC_KEY_PASSWORD:'test-only',TEST_TOKEN:'test-only'}},10000);
  assert.equal(result.stdout.trim(),'true');
});
