import { IPluginMethodMap, IAgentContext, IDIDManager, IResolver } from '@veramo/core-types';

/**
 * TODO: Add explanation
 *
 * @beta
 */
export interface IDIDDHTPlugin extends IPluginMethodMap {
  /**
   * Creates a new DHT-based DID identifier.
   *
   * @param args - Input parameters for creating a DHT DID
   * @param context - The required context for accessing DHT and DID manager functionality.
   */
  createDHTIdentifier(
    args: ICreateDHTIdentifierArgs,
    context: IRequiredContext,
  ): Promise<ICreateDHTIdentifierResult>;
}

/**
 * Arguments for {@link DIDDHTPlugin.createDHTIdentifier}
 *
 * @beta
 */
export interface ICreateDHTIdentifierArgs {
  /**
   * Network name for DHT DID, e.g., "example-network".
   */
  networkName: string;
}

/**
 * Result of creating a DHT identifier.
 */
export interface ICreateDHTIdentifierResult {
  /**
   * The generated DID identifier.
   */
  did: string;

  /**
   * Identifier of the controller key for this DID.
   */
  controllerKeyId: string;

  /**
   * Array of keys associated with the DID.
   */
  keys: Array<{
    kid: string;
    publicKeyHex: string;
  }>;

  /**
   * Array of services associated with the DID.
   */
  services?: Array<{
    id: string;
    type: string;
    serviceEndpoint: string;
  }>;
}

/**
 * Required context for this plugin.
 *
 * @beta
 */
export type IRequiredContext = IAgentContext<IResolver & IDIDManager>;
