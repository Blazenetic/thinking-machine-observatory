const FLOAT32_BYTES = 4;
const BASE64_CHUNK_BYTES = 32_768;
const MAX_FLOAT32_VALUES = 1_000_000;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export interface EmbeddedFloat32Payload {
  readonly data: string;
  readonly encoding: 'float32-le-base64';
  readonly sha256: string;
  readonly valueCount: number;
}

export class LogitPayloadError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'LogitPayloadError';
  }
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_BYTES) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + BASE64_CHUNK_BYTES));
  }
  return btoa(binary);
}

function decodeBase64(value: string): Uint8Array {
  let binary: string;
  try {
    binary = atob(value);
  } catch {
    throw new LogitPayloadError('Float32 payload data is not valid base64.');
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (encodeBase64(bytes) !== value) {
    throw new LogitPayloadError('Float32 payload data is not canonical base64.');
  }
  return bytes;
}

function float32LittleEndianBytes(values: Float32Array): Uint8Array {
  if (values.length === 0) throw new LogitPayloadError('Float32 payload must not be empty.');
  if (values.length > MAX_FLOAT32_VALUES) {
    throw new LogitPayloadError(`Float32 payload exceeds ${MAX_FLOAT32_VALUES} values.`);
  }
  const bytes = new Uint8Array(values.length * FLOAT32_BYTES);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index] as number;
    if (!Number.isFinite(value)) {
      throw new LogitPayloadError(`Float32 payload value ${index} is not finite.`);
    }
    view.setFloat32(index * FLOAT32_BYTES, value, true);
  }
  return bytes;
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const copy = Uint8Array.from(bytes);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', copy);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

/** Encodes logits into canonical portable bytes suitable for content addressing. */
export async function createEmbeddedFloat32Payload(
  values: Float32Array,
): Promise<EmbeddedFloat32Payload> {
  const bytes = float32LittleEndianBytes(values);
  return Object.freeze({
    data: encodeBase64(bytes),
    encoding: 'float32-le-base64',
    sha256: await sha256(bytes),
    valueCount: values.length,
  });
}

/** Decodes and verifies a payload before any sampler may consume it. */
export async function decodeEmbeddedFloat32Payload(
  payload: EmbeddedFloat32Payload,
): Promise<Float32Array> {
  if (payload.encoding !== 'float32-le-base64') {
    throw new LogitPayloadError('Unsupported float32 payload encoding.');
  }
  if (!Number.isInteger(payload.valueCount) || payload.valueCount < 1) {
    throw new LogitPayloadError('Float32 payload valueCount must be a positive integer.');
  }
  if (payload.valueCount > MAX_FLOAT32_VALUES) {
    throw new LogitPayloadError(`Float32 payload exceeds ${MAX_FLOAT32_VALUES} values.`);
  }
  if (!SHA256_PATTERN.test(payload.sha256)) {
    throw new LogitPayloadError('Float32 payload SHA-256 is malformed.');
  }

  const expectedBytes = payload.valueCount * FLOAT32_BYTES;
  if (payload.data.length !== Math.ceil(expectedBytes / 3) * 4) {
    throw new LogitPayloadError('Float32 payload byte length does not match valueCount.');
  }
  const bytes = decodeBase64(payload.data);
  if (bytes.byteLength !== expectedBytes) {
    throw new LogitPayloadError('Float32 payload byte length does not match valueCount.');
  }
  if ((await sha256(bytes)) !== payload.sha256) {
    throw new LogitPayloadError('Float32 payload SHA-256 does not match its bytes.');
  }

  const values = new Float32Array(payload.valueCount);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let index = 0; index < values.length; index += 1) {
    const value = view.getFloat32(index * FLOAT32_BYTES, true);
    if (!Number.isFinite(value)) {
      throw new LogitPayloadError(`Float32 payload value ${index} is not finite.`);
    }
    values[index] = value;
  }
  return values;
}
