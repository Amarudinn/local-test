/**
 * Address validation utilities for blockchain addresses
 * Supports both Ethereum (40-char) and GenLayer (64-char) hex addresses
 */

/**
 * Validate if a string is a valid Ethereum/GenLayer address
 * 
 * Valid formats:
 * - Ethereum: 0x followed by 40 hexadecimal characters
 * - GenLayer: 0x followed by 64 hexadecimal characters
 * 
 * @param address - The address string to validate
 * @returns true if valid, false otherwise
 */
export function isValidAddress(address: string): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }

  // Must start with 0x
  if (!address.startsWith('0x')) {
    return false;
  }

  // Remove 0x prefix
  const hexPart = address.slice(2);

  // Must be 40 (Ethereum) or 64 (GenLayer) hex characters
  if (hexPart.length !== 40 && hexPart.length !== 64) {
    return false;
  }

  // Must contain only hexadecimal characters (0-9, a-f, A-F)
  const hexRegex = /^[0-9a-fA-F]+$/;
  return hexRegex.test(hexPart);
}

/**
 * Validate if a string is a valid Ethereum address (40 hex chars)
 */
export function isValidEthereumAddress(address: string): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }

  if (!address.startsWith('0x')) {
    return false;
  }

  const hexPart = address.slice(2);
  return hexPart.length === 40 && /^[0-9a-fA-F]+$/.test(hexPart);
}

/**
 * Validate if a string is a valid GenLayer address (64 hex chars)
 */
export function isValidGenLayerAddress(address: string): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }

  if (!address.startsWith('0x')) {
    return false;
  }

  const hexPart = address.slice(2);
  return hexPart.length === 64 && /^[0-9a-fA-F]+$/.test(hexPart);
}

/**
 * Get the type of address (Ethereum or GenLayer)
 */
export function getAddressType(address: string): 'ethereum' | 'genlayer' | 'invalid' {
  if (isValidEthereumAddress(address)) {
    return 'ethereum';
  }
  if (isValidGenLayerAddress(address)) {
    return 'genlayer';
  }
  return 'invalid';
}

/**
 * Normalize address to lowercase (standard format)
 */
export function normalizeAddress(address: string): string {
  if (!isValidAddress(address)) {
    throw new Error('Invalid address format');
  }
  return address.toLowerCase();
}
