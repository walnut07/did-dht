import { IDIDManager, IKeyManager } from '@veramo/core-types';
import { DIDManager, MemoryDIDStore } from '@veramo/did-manager';
import { DHTDIDProvider, DHTNetworkConfiguration } from '../dht-did-provider';
import { createAgent } from '@veramo/core';
import { KeyManager, MemoryKeyStore, MemoryPrivateKeyStore } from '@veramo/key-manager';
import { KeyManagementSystem } from '@veramo/kms-local';
import { jest } from '@jest/globals';
import { hexToBytes } from '@veramo/utils'; // Use hexToBytes from veramo/utils for encoding
import * as zbase32 from 'zbase32'; // Import zbase32 for encoding
import DHT from 'bittorrent-dht';

jest.mock('bittorrent-dht');

const PROVIDER = 'did:dht:example-network';
const KMS = 'local';

let dhtInstance: DHT;
let agent: ReturnType<typeof createAgent>;

beforeEach(() => {
  dhtInstance = new DHT();
  jest.clearAllMocks();

  const dhtDidProvider = new DHTDIDProvider({
    defaultKms: KMS,
    networks: [{ dhtInstance: dhtInstance, networkName: 'example-network' }],
  });

  agent = createAgent<IKeyManager, IDIDManager>({
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
});

interface DNSRecord {
  name: string;
  type: string;
  ttl: number;
  rdata: string;
}

function parseDNSRecords(input: string): DNSRecord[] {
  const regex = /(_[^\s]+)\s+(TXT)\s+(\d+)\s*/g;
  const records: DNSRecord[] = [];
  const matches = [];
  let match: any | null;

  // Find all matches of the DNS record pattern
  while ((match = regex.exec(input)) !== null) {
    matches.push({
      name: match[1],
      type: match[2],
      ttl: parseInt(match[3], 10),
      start: match.index,
      end: regex.lastIndex,
    });
  }

  // Extract rdata for each record
  for (let i = 0; i < matches.length; i++) {
    const current: any = matches[i];
    const next: any = matches[i + 1];
    const rdataStart = current.end;
    const rdataEnd = next ? next.start : input.length;
    const rdata = input.substring(rdataStart, rdataEnd).trim();

    records.push({
      name: current.name,
      type: current.type,
      ttl: current.ttl,
      rdata: rdata,
    });
  }

  return records;
}

describe('DHTDIDProvider', () => {
  describe('createIdentifier', () => {
    it('should create a new DID identifier', async () => {
      const identifier = await agent.didManagerCreate();
      expect(identifier).toBeDefined();

      expect(identifier.did).toMatch(/^did:dht:[a-km-uw-z13-9]+$/); // did:dht:<z-base-32-public-key>
      expect(identifier.controllerKeyId).toBeDefined();
      expect(identifier.keys).toHaveLength(1);
    });

    it('should create a DID with the correct z-base-32 encoding', async () => {
      const identifier = await agent.didManagerCreate();
      const encodedKey = identifier.did.split(':')[2];
      expect(encodedKey).toMatch(/^[a-km-uw-z13-9]+$/);
    });

    it('should create all expected DNS records for the DID Document', async () => {
      const identifier = await agent.didManagerCreate();
      const key = identifier.keys[0];
      const publicKeyBytes = hexToBytes(key.publicKeyHex);
      const zBase32PublicKey = zbase32.encode(publicKeyBytes);

      const expectedRootRecordName = `_did.${zBase32PublicKey}.`;
      const expectedKeyRecordName = `_k0._did.${zBase32PublicKey}.`;
      console.log('expected: ', expectedKeyRecordName, expectedRootRecordName);

      // Check values that have been put into a dht instance
      const putCallArguments = (dhtInstance.put as jest.Mock).mock.calls[0][0] as { v: Buffer };
      const dnsPacketBuffer = putCallArguments.v;
      const dnsRecords = parseDNSRecords(dnsPacketBuffer.toString());

      // Verify the root record
      const rootRecord = dnsRecords.find((record) => record.name == expectedRootRecordName);
      expect(rootRecord).toBeDefined();
      expect(rootRecord?.type).toBe('TXT');
      expect(rootRecord?.ttl).toBe(7200);
      expect(rootRecord?.rdata).toContain('v=0;vm=k0;auth=k0;');

      // Verify the key record
      const keyRecord = dnsRecords.find((record) => record.name == expectedKeyRecordName);
      expect(keyRecord).toBeDefined();
      expect(keyRecord?.type).toBe('TXT');
      expect(keyRecord?.ttl).toBe(7200);
      expect(keyRecord?.rdata).toContain(`id=0;t=0;k=${key.publicKeyHex}`);
    });

    it('should not allow the identity key to be rotated', async () => {
      const identifier = await agent.didManagerCreate();
      await expect(
        agent.didManagerAddKey({
          did: identifier.did,
          key: {
            kid: 'new-key-id',
            type: 'Ed25519',
            kms: 'local',
            publicKeyHex: 'newPublicKey',
          },
        }),
      ).rejects.toThrow('not_implemented: addKey');
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
