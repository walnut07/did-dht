import { jest } from '@jest/globals';
import express from 'express';
import { Server } from 'http';
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
import { AgentRestClient } from '@veramo/remote-client';
import { AgentRouter, RequestWithAgentRouter } from '@veramo/remote-server';
import { KeyManager } from '@veramo/key-manager';
import { DIDManager } from '@veramo/did-manager';
import { DIDResolverPlugin } from '@veramo/did-resolver';
import { DataStore, DataStoreORM, DIDStore, KeyStore, PrivateKeyStore, migrations, Entities } from '@veramo/data-store';
import { DataSource } from 'typeorm';
import { KeyManagementSystem, SecretBox } from '@veramo/kms-local';
import { IDIDDHTPlugin } from '../src/types/DIDDHTPlugin';
import DIDDHTPluginLogic from './shared/DIDDHTPluginLogic';
import DHT from 'bittorrent-dht';
import { DHTDIDProvider } from '../src/did-manager/dht-did-provider';
import * as fs from 'fs';

jest.setTimeout(120000);

const secretKey = '29739248cad1bd1a0fc4d9b75cd4d2990de535baf5caadfdf8d8f86664aa830c';
const port = 3002;
const basePath = '/agent';

let remoteAgent: TAgent<
  IDIDManager &
  IKeyManager &
  IDataStore &
  IDataStoreORM &
  IResolver &
  IMessageHandler &
  ICredentialPlugin &
  IDIDDHTPlugin
>;
let localAgent: TAgent<
  IDIDManager &
  IKeyManager &
  IDataStore &
  IDataStoreORM &
  IResolver &
  IMessageHandler &
  ICredentialPlugin &
  IDIDDHTPlugin
>;
let dbConnection: Promise<DataSource>;
let restServer: Server;
let databaseFile: string;

const setupRemoteAgent = async (): Promise<boolean> => {
  databaseFile = ':memory:';
  dbConnection = new DataSource({
    name: 'test',
    type: 'sqlite',
    database: databaseFile,
    synchronize: false,
    migrations: migrations,
    migrationsRun: true,
    logging: false,
    entities: Entities,
  }).initialize();

  // Create the remote agent
  remoteAgent = createAgent<
    IDIDManager &
    IKeyManager &
    IDataStore &
    IDataStoreORM &
    IResolver &
    IMessageHandler &
    ICredentialPlugin &
    IDIDDHTPlugin
  >({
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
      new DataStore(dbConnection),
      new DataStoreORM(dbConnection),
    ],
  });

  const agentRouter = AgentRouter({
    exposedMethods: remoteAgent.availableMethods(),
  });
  const requestWithAgent = RequestWithAgentRouter({
    agent: remoteAgent,
  });

  return new Promise((resolve) => {
    const app = express();
    app.use(basePath, requestWithAgent, agentRouter);
    restServer = app.listen(port, () => {
      resolve(true);
    });
  });
};

const setupLocalAgent = () => {
  localAgent = createAgent<
    IDIDManager &
    IKeyManager &
    IDataStore &
    IDataStoreORM &
    IResolver &
    IMessageHandler &
    ICredentialPlugin &
    IDIDDHTPlugin
  >({
    plugins: [
      new AgentRestClient({
        url: `http://localhost:${port}${basePath}`,
        enabledMethods: remoteAgent.availableMethods(),
        schema: remoteAgent.getSchema(),
      }),
    ],
  });
};

const tearDown = async (): Promise<boolean> => {
  try {
    await new Promise((resolve, reject) => {
      restServer.close((err) => (err ? reject(err) : resolve(null)));
    });
    await (await dbConnection).dropDatabase();
    await (await dbConnection).close();
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

const testContext = {
  getAgent: () => localAgent,
  setup: async () => {
    await setupRemoteAgent();
    setupLocalAgent();
    return true;
  },
  tearDown,
};

describe('Remote agent integration tests', () => {
  DIDDHTPluginLogic(testContext);
});
function getWebDidResolver(): { resolver?: import("did-resolver").Resolvable; } | { [didMethod: string]: import("did-resolver").DIDResolver; } {
  throw new Error('Function not implemented.');
}

