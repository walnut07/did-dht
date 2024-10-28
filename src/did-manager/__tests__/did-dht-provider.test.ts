import { IDIDManager, IKeyManager } from '@veramo/core-types';
import { DIDManager, MemoryDIDStore } from '@veramo/did-manager';
import { DHTDIDProvider, DHTNetworkConfiguration } from '../dht-did-provider';
import { createAgent } from '@veramo/core';
import { KeyManager, MemoryKeyStore, MemoryPrivateKeyStore } from '@veramo/key-manager';
import { KeyManagementSystem } from '@veramo/kms-local';
import { jest } from '@jest/globals';
import DHT from 'bittorrent-dht';

jest.mock('bittorrent-dht');

const PROVIDER = 'did:dht:example-network';
const KMS = 'local';

const dhtInstance = new DHT();
const dhtDidProvider = new DHTDIDProvider({
  defaultKms: KMS,
  networks: [{ dhtInstance: dhtInstance, networkName: 'example-network' }],
});

const agent = createAgent<IKeyManager, IDIDManager>({
  plugins: [
    new KeyManager({
      store: new MemoryKeyStore(),
      kms: {
        [KMS]: new KeyManagementSystem(new MemoryPrivateKeyStore()),
      },
    }),
    new DIDManager({
      providers: { [PROVIDER]: dhtDidProvider },
      defaultProvider: PROVIDER,
      store: new MemoryDIDStore(),
    }),
  ],
});

describe('DHTDIDProvider', () => {
  describe('createIdentifier', () => {
    it('should create a new DID identifier and store it in the DHT', async () => {
      expect.assertions(4);
      const identifier = await agent.didManagerCreate();
      expect(identifier).toBeDefined();
      expect(identifier.did).toMatch(/^did:dht:example-network:/);
      expect(identifier.controllerKeyId).toBeDefined();
      expect(identifier.keys).toHaveLength(1);
    });

    it('should handle network error during DHT put operation', async () => {
      // Mock a network error
      jest.spyOn(dhtInstance, 'put').mockImplementationOnce((opts, callback) => {
        callback(new Error('Network error'), '');
      });

      await expect(agent.didManagerCreate()).rejects.toThrow('Network error');
    });
  });
});
