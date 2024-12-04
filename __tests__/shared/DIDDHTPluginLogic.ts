// noinspection ES6PreferShortImport
import { TAgent, IMessageHandler, IDIDManager, ICredentialPlugin } from '@veramo/core-types';
import { IDIDDHTPlugin } from '../../src/types/DIDDHTPlugin.js';

type ConfiguredAgent = TAgent<IDIDDHTPlugin & IMessageHandler & IDIDManager & ICredentialPlugin>

export default (testContext: {
  getAgent: () => ConfiguredAgent;
  setup: () => Promise<boolean>;
  tearDown: () => Promise<boolean>;
}) => {
  describe('DIDDHTPlugin Logic Tests', () => {
    let agent: ConfiguredAgent;

    beforeAll(async () => {
      await testContext.setup();
      agent = testContext.getAgent();
    });

    afterAll(async () => {
      await testContext.tearDown();
    });
  
    describe('createDHTIdentifier', () => {
      it('should create a new DID identifier', async () => {
        const identifier = await agent.didManagerCreate({
          provider: 'did:dht',
          options: { networkName: 'example-network' },
          kms: 'local'
        });

        expect(identifier).toBeDefined();
        expect(identifier.provider).toEqual('did:dht');
        expect(identifier.did).toMatch(/^did:dht:[a-km-uw-z13-9]+$/);
        expect(identifier.controllerKeyId).toBeDefined();
        expect(identifier.keys).toHaveLength(1);
      });

      it('should throw an error for invalid network name', async () => {
        await expect(
          agent.didManagerCreate({
            provider: 'did:dht',
            options: { networkName: 'invalid-network' },
          })
        ).rejects.toThrow('invalid_network: No configuration found for network invalid-network');
      });
    });
  });
};
