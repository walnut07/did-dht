import { jest } from '@jest/globals';
import { createAgent, TAgent } from '@veramo/core';
import {
  ICredentialPlugin,
  IDataStore,
  IDataStoreORM,
  IDIDManager,
  IKeyManager,
  IMessageHandler,
  IResolver,
} from '@veramo/core-types';
import { KeyManager } from '@veramo/key-manager';
import { DIDManager } from '@veramo/did-manager';
import { DIDResolverPlugin } from '@veramo/did-resolver';
import { DataStore, DataStoreORM, DIDStore, KeyStore, PrivateKeyStore, migrations, Entities } from '@veramo/data-store';
import { DataSource } from 'typeorm';
import { KeyManagementSystem, SecretBox } from '@veramo/kms-local';
import { IDIDDHTPlugin } from '../src/types/DIDDHTPlugin';
import DIDDHTPluginLogic from './shared/DIDDHTPluginLogic';
import * as fs from 'fs';
import DHT from 'bittorrent-dht';
import { DHTDIDProvider } from '../src/did-manager/dht-did-provider';
import { getResolver as getWebDidResolver } from 'web-did-resolver';
import { getResolver as getEthrDidResolver } from 'ethr-did-resolver';

jest.setTimeout(120000);

const secretKey = '29739248cad1bd1a0fc4d9b75cd4d2990de535baf5caadfdf8d8f86664aa830c';

let agent: TAgent<
  IDIDManager &
  IKeyManager &
  IDataStore &
  IDataStoreORM &
  IResolver &
  IMessageHandler &
  ICredentialPlugin &
  IDIDDHTPlugin
>;
let dbConnection: DataSource;
let databaseFile: string;

const setup = async (): Promise<boolean> => {
  databaseFile = ':memory:'; // Use in-memory database for testing
  dbConnection = await new DataSource({
    name: 'test',
    type: 'sqlite',
    database: databaseFile,
    synchronize: false,
    migrations: migrations,
    migrationsRun: true,
    logging: false,
    entities: Entities,
  }).initialize();

  // Create the agent
  agent = createAgent<
    IDIDManager &
    IKeyManager &
    IDataStore &
    IDataStoreORM &
    IResolver &
    IMessageHandler &
    ICredentialPlugin &
    IDIDDHTPlugin
  >({
    context: {
      database: dbConnection,
    },
    plugins: [
      new KeyManager({
        store: new KeyStore(dbConnection),
        kms: {
          local: new KeyManagementSystem(new PrivateKeyStore(dbConnection, new SecretBox(secretKey))),
        },
      }),
      new DIDManager({
        store: new DIDStore(dbConnection),
        defaultProvider: 'did:dht:example-network',
        providers: {
          'did:dht': new DHTDIDProvider({
            defaultKms: 'local',
            networks: [
              {
                networkName: 'example-network',
                dhtInstance: new DHT(),
              },
            ],
          }),
        },
      }),
      new DIDResolverPlugin({
        ...getWebDidResolver(),
        ...getEthrDidResolver({
          infuraProjectId: '3586660d179141e3801c3895de1c2eba',
        }),
      }),
      new DataStore(dbConnection),
      new DataStoreORM(dbConnection),
    ],
  });

  return true;
};

const tearDown = async (): Promise<boolean> => {
  try {
    await dbConnection.dropDatabase();
    await dbConnection.close();
  } catch (e) {
    // nop
  }
  try {
    fs.unlinkSync(databaseFile);
  } catch (e) {
    // nop
  }
  return true;
};

const getAgent = () => agent;

const testContext = { getAgent, setup, tearDown };

describe('Local integration tests', () => {
  DIDDHTPluginLogic(testContext);
});
