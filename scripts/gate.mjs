import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
const phase = Number(process.argv[2]);
if (!Number.isInteger(phase) || phase < 1 || phase > 17) throw new Error('Expected phase 1–17');
await mkdir('artifacts', {recursive:true});
const tag = String(phase).padStart(2,'0');
for (const [label, command, args] of [
  ['build','npm',['run','check']],
  ['tests','npm',['test','--workspace=server']],
  ['browser','node',['scripts/phase-smoke.mjs',String(phase)]],
]) {
  const child = spawn(command,args,{stdio:['ignore','pipe','pipe']});
  let output='';
  child.stdout.on('data', x=>output+=x); child.stderr.on('data', x=>output+=x);
  const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve);});
  await writeFile(`artifacts/phase-${tag}-${label}.log`,output,{mode:0o600});
  console.log(`PHASE ${phase} ${label.toUpperCase()}: ${code === 0 ? 'PASS' : 'FAIL'}\n${output.slice(-6500)}`);
  if(code !== 0) {process.exitCode=1; break;}
}
console.log('Gate logs recorded. A passing gate still requires visual inspection of the screenshots.');
