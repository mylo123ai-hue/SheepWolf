import { describe, expect, it } from 'vitest';
import { CredentialVault, type CredentialBackend } from './credential-vault.js';

class TestBackend implements CredentialBackend {
  readonly name='Test protected store';
  value:string|null=null;isAvailable=true;failWrite=false;failRead=false;
  async available(){return this.isAvailable;}
  async read(){if(this.failRead)throw new Error('private platform detail');return this.value;}
  async write(secret:string){if(this.failWrite)throw new Error('private platform detail');this.value=secret;}
  async remove(){if(this.failRead)throw new Error('private platform detail');this.value=null;}
}

describe('protected credential vault',()=>{
  it('stores protected keys outside application data and reveals only status',async()=>{
    const backend=new TestBackend();const vault=new CredentialVault(backend);
    await expect(vault.save('sk-test-not-a-real-key','protected')).resolves.toBe('protected');
    expect(backend.value).toBe('sk-test-not-a-real-key');
    expect(await vault.status()).toMatchObject({configured:true,storage:'protected',persistentAvailable:true});
    expect(JSON.stringify(await vault.status())).not.toContain('sk-test-not-a-real-key');
    expect(await vault.get()).toBe('sk-test-not-a-real-key');
    await vault.remove();expect(backend.value).toBeNull();expect(await vault.status()).toMatchObject({configured:false,storage:'none'});
  });

  it('refuses persistent plaintext fallback when the OS store is unavailable or fails',async()=>{
    const backend=new TestBackend();backend.isAvailable=false;const vault=new CredentialVault(backend);
    await expect(vault.save('sk-test-not-a-real-key','protected')).rejects.toThrow('session-only');
    expect(backend.value).toBeNull();expect(await vault.get()).toBeNull();
    backend.isAvailable=true;backend.failWrite=true;
    await expect(vault.save('sk-test-not-a-real-key','protected')).rejects.toThrow();
    expect(backend.value).toBeNull();
  });

  it('keeps explicit session credentials only in process memory and clears them on remove/restart',async()=>{
    const backend=new TestBackend();backend.isAvailable=false;const vault=new CredentialVault(backend);
    await vault.save('sk-temporary-not-a-real-key','session');
    expect(await vault.status()).toMatchObject({configured:true,storage:'session',persistentAvailable:false});
    expect(backend.value).toBeNull();
    const restarted=new CredentialVault(backend);expect(await restarted.get()).toBeNull();
    await vault.remove();expect(await vault.get()).toBeNull();
  });

  it('does not echo details from a failed protected-store read',async()=>{
    const backend=new TestBackend();backend.failRead=true;const vault=new CredentialVault(backend);
    expect(await vault.status()).toMatchObject({configured:false,persistentAvailable:false});
    await expect(vault.get()).rejects.toThrow('protected credential store is unavailable');
  });
});
