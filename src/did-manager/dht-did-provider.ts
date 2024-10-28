import {
  IIdentifier,
  IKey,
  IService,
  IAgentContext,
  IKeyManager,
  DIDDocument,
} from '@veramo/core-types';
import { AbstractIdentifierProvider } from '@veramo/did-manager';
import DHT from 'bittorrent-dht'; // Using bittorrent-dht library
import Debug from 'debug';

const debug = Debug('veramo:did-provider-dht');

type IContext = IAgentContext<IKeyManager>;

/**
 * DHTDIDProvider options
 */
export interface DHTNetworkConfiguration {
  networkName: string;
  dhtInstance: DHT;
}

/**
 * {@link @veramo/did-manager#DIDManager} provider for `did:dht` identifiers
 * @beta
 */
export class DHTDIDProvider extends AbstractIdentifierProvider {
  private defaultKms: string;
  private networks: DHTNetworkConfiguration[];

  constructor(options: { defaultKms: string; networks: DHTNetworkConfiguration[] }) {
    super();
    this.defaultKms = options.defaultKms;
    this.networks = options.networks;
  }

  async createIdentifier(
    { kms, options }: { kms?: string; options?: any },
    context: IContext,
  ): Promise<Omit<IIdentifier, 'provider'>> {
    const networkSpecifier = options?.networkName || this.networks[0]?.networkName;
    const network = this.getNetworkFor(networkSpecifier);
    if (!network) {
      throw new Error(`invalid_network: No configuration found for network ${networkSpecifier}`);
    }

    const key = await context.agent.keyManagerCreate({
      kms: kms || this.defaultKms,
      type: 'Ed25519',
    });
    const did = `did:dht:${network.networkName}:${key.publicKeyHex}`;

    // Ed25519 keys are required by DHT & DID DHT:https://did-dht.com/#identity-key-pair.
    const didDocument = {
      '@context': 'https://w3id.org/did/v1',
      id: did,
      publicKey: [
        {
          id: `${did}#keys-1`,
          type: 'Ed25519VerificationKey2018',
          controller: did,
          publicKeyHex: key.publicKeyHex,
        },
      ],
      authentication: [
        {
          type: 'Ed25519SignatureAuthentication',
          publicKey: `${did}#keys-1`,
        },
      ],
    };

    const value = Buffer.from(JSON.stringify(didDocument));
    // Create a promise for async programming because `put` in `bittorrent-dht` does not return a promise.
    await new Promise<void>((resolve, reject) => {
      network.dhtInstance.put({ v: value }, (err, hash) => {
        if (err) {
          reject(new Error(`Failed to store DID Document in DHT: ${err.message}`));
        } else {
          resolve();
        }
      });
    });

    debug('Created DID:', did);

    return {
      did,
      controllerKeyId: key.kid,
      keys: [key],
      services: [],
    };
  }

  async deleteIdentifier(identity: IIdentifier, context: IContext): Promise<boolean> {
    throw new Error('not_implemented: deleteIdentifier');
  }

  async addKey(
    { identifier, key, options }: { identifier: IIdentifier; key: IKey; options?: any },
    context: IContext,
  ): Promise<any> {
    throw new Error('not_implemented: addKey');
  }

  async addService(
    { identifier, service, options }: { identifier: IIdentifier; service: IService; options?: any },
    context: IContext,
  ): Promise<any> {
    throw new Error('not_implemented: addService');
  }

  async removeKey(
    args: { identifier: IIdentifier; kid: string; options?: any },
    context: IContext,
  ): Promise<any> {
    throw new Error('not_implemented: removeKey');
  }

  async removeService(
    args: { identifier: IIdentifier; id: string; options?: any },
    context: IContext,
  ): Promise<any> {
    throw new Error('not_implemented: removeService');
  }

  updateIdentifier?(
    args: { did: string; document: Partial<DIDDocument>; options?: { [x: string]: any } },
    context: IContext,
  ): Promise<IIdentifier> {
    throw new Error('not_implemented: updateIdentifier');
  }

  private getNetworkFor(networkSpecifier?: string): DHTNetworkConfiguration | undefined {
    if (!networkSpecifier) {
      return this.networks[0];
    }

    const network = this.networks.find((net) => net.networkName === networkSpecifier);
    return network;
  }
}
