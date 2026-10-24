import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { OsCredentialBackend } from './credential-vault.js';

const windowsTest=process.platform==='win32'?it:it.skip;
describe('Windows Credential Manager integration',()=>{
  windowsTest('round-trips a disposable credential through the OS-protected store',async()=>{
    const suffix=randomUUID();const backend=new OsCredentialBackend(`SheepWolf-CI-${suffix}`,`test-${suffix}`);const value=`disposable-${randomUUID()}`;
    try{
      expect(await backend.available()).toBe(true);await backend.write(value);expect(await backend.read()).toBe(value);
    }finally{await backend.remove();}
    expect(await backend.read()).toBeNull();
  });
});
