import { AsyncEntry } from '@napi-rs/keyring';

export type CredentialPersistence = 'protected'|'session'|'none';
export interface CredentialBackend {
  available():Promise<boolean>;
  read():Promise<string|null>;
  write(secret:string):Promise<void>;
  remove():Promise<void>;
  readonly name:string;
}

/** Uses Windows Credential Manager through the keyring crate on Windows. On Linux,
 * require Secret Service explicitly so the library cannot silently fall back to
 * a kernel-only keyring and misrepresent it as persistent storage. */
export class OsCredentialBackend implements CredentialBackend {
  readonly name:string;
  constructor(private readonly service='SheepWolf',private readonly account='deepseek-api-key'){
    this.name=process.platform==='win32'?'Windows Credential Manager':process.platform==='darwin'?'macOS Keychain':'Secret Service';
  }
  private entry(){
    const options=process.platform==='linux'?{linux:{store:'secret-service' as const}}:undefined;
    return new AsyncEntry(this.service,this.account,options);
  }
  async available(){try{await this.entry().getPassword();return true;}catch{return false;}}
  async read(){return this.entry().getPassword();}
  async write(secret:string){await this.entry().setPassword(secret);}
  async remove(){await this.entry().deletePassword();}
}

export class CredentialVault {
  private sessionSecret:string|null=null;
  private sessionConfigured=false;
  constructor(private readonly backend:CredentialBackend=new OsCredentialBackend()){}

  async persistentAvailable(){return this.backend.available();}
  storageName(){return this.backend.name;}
  async status(){
    if(this.sessionConfigured)return {configured:Boolean(this.sessionSecret),storage:'session' as CredentialPersistence,persistentAvailable:await this.persistentAvailable(),storageName:this.storageName()};
    try{
      const secret=await this.backend.read();
      return {configured:Boolean(secret),storage:secret?'protected' as CredentialPersistence:'none' as CredentialPersistence,persistentAvailable:await this.persistentAvailable(),storageName:this.storageName()};
    }catch{return {configured:false,storage:'none' as CredentialPersistence,persistentAvailable:false,storageName:this.storageName()};}
  }
  async get(){
    if(this.sessionConfigured)return this.sessionSecret;
    try{return await this.backend.read();}catch{throw new Error('The protected credential store is unavailable.');}
  }
  async save(secret:string,persistence:Exclude<CredentialPersistence,'none'>){
    if(persistence==='session'){
      try{if(await this.backend.available())await this.backend.remove();}catch{throw new Error('The protected credential could not be replaced. No session copy was retained.');}
      this.sessionSecret=secret;
      this.sessionConfigured=true;
      return 'session' as const;
    }
    if(!await this.backend.available())throw new Error('Protected credential storage is unavailable. Choose session-only storage instead.');
    try{await this.backend.write(secret);}catch{throw new Error('The API key could not be saved in protected operating system storage.');}
    this.sessionSecret=null;
    this.sessionConfigured=false;
    return 'protected' as const;
  }
  async remove(){
    const hadSession=this.sessionConfigured;
    this.sessionSecret=null;
    this.sessionConfigured=false;
    if(hadSession&&!await this.backend.available())return;
    try{await this.backend.remove();}catch{throw new Error('The protected credential could not be removed from the operating system store.');}
  }
}
