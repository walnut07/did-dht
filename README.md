# DID-DHT

The DID-DHT plugin for [Veramo](https://veramo.io/) provides a decentralized identifier (DID) method that leverages the BitTorrent Distributed Hash Table (DHT) network. 
The DID-DHT method uses the public key as an identifier in a way that is compliant with the DID Specification. The DID Document is encoded and stored in the DHT as DNS records.

Please note that this plugin is still under development and expected to undergo breaking changes.

## Usage
The plugin can be integrated into a Veramo agent by configuring it with the appropriate DHT settings:

```ts
import { createAgent } from '@veramo/core';
import { DIDManager, MemoryDIDStore } from '@veramo/did-manager';
import { KeyManager, MemoryKeyStore, MemoryPrivateKeyStore } from '@veramo/key-manager';
import { KeyManagementSystem } from '@veramo/kms-local';
import { DHTDIDProvider } from 'did-dht-plugin';
import DHT from 'bittorrent-dht';

const PROVIDER = 'did:dht:example-network';
const KMS = 'local';

const dhtInstance = new DHT();
const dhtDidProvider = new DHTDIDProvider({
  defaultKms: KMS,
  networks: [{ dhtInstance: dhtInstance, networkName: 'example-network' }],
});

const agent = createAgent({
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
```

Creating a DID identifier:
```ts
const identifier = await agent.didManagerCreate({
  provider: 'did:dht',
  options: { networkName: 'example-network' },
  kms: 'local'
});

console.log(identifier.did); // Outputs a DID like did:dht:<z-base-32-public-key>
```

## Spec compliance
TODO

## License
This plugin is licensed under the MIT License.
