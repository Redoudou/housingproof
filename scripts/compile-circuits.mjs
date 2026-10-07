import { compile_program, createFileManager } from '@noir-lang/noir_wasm';
import { mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
mkdirSync('proof-artifacts', { recursive: true });
for (const [id, path] of [['Q001', 'threshold_question'], ['Q002', 'balance_decline']]) {
  const { program } = await compile_program(createFileManager(resolve('circuits', path)));
  writeFileSync(`proof-artifacts/${id}.json.tmp`, JSON.stringify({ abi: program.abi, bytecode: program.bytecode }));
  renameSync(`proof-artifacts/${id}.json.tmp`, `proof-artifacts/${id}.json`);
  console.log(`Compiled ${id}`);
}
