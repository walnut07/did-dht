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
import { hexToBytes } from '@veramo/utils'; // Use hexToBytes from veramo/utils for encoding
import * as zbase32 from 'zbase32'; // Import zbase32 for encoding

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

    // Create a new Ed25519 key for the DID
    const key = await context.agent.keyManagerCreate({
      kms: kms || this.defaultKms,
      type: 'Ed25519',
    });

    // Encode the public key in z-base-32 format as required by DID DHT
    const publicKeyBytes = hexToBytes(key.publicKeyHex);
    const zBase32PublicKey = zbase32.encode(publicKeyBytes);
    const did = `did:dht:${zBase32PublicKey}`;

    // Define DNS Records
    // TODO: Create a helper function to construct DNS records for readability
    const rootRecordName = `_did.${zBase32PublicKey}.`;
    const dnsRecords = [
      {
        type: 'TXT',
        name: rootRecordName,
        ttl: 7200,
        rdata: `v=0;vm=k0;auth=k0;`, // Root record specifying version and verification method
      },
      {
        type: 'TXT',
        name: `_k0._did.${zBase32PublicKey}.`,
        ttl: 7200,
        rdata: `id=0;t=0;k=${key.publicKeyHex}`, // Verification method record for Identity Key
      },
    ];

    // Convert DNS packet into a Buffer for storage in DHT
    const value = Buffer.concat(
      dnsRecords.map((record) =>
        Buffer.from(`${record.name} ${record.type} ${record.ttl} ${record.rdata}`, 'utf-8'),
      ),
    );

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
      services: [], // TODO: Add services if any are provided in the options
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
