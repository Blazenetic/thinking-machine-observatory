import { describe, expect, it } from 'vitest';

import {
  createEmbeddedFloat32Payload,
  decodeEmbeddedFloat32Payload,
  LogitPayloadError,
} from './logit-payload';

describe('embedded float32 payload', () => {
  it('round-trips canonical little-endian bytes and preserves negative zero', async () => {
    const values = new Float32Array([0, -0, Math.PI, -7.5, 1e-30]);
    const payload = await createEmbeddedFloat32Payload(values);
    const restored = await decodeEmbeddedFloat32Payload(payload);

    expect(payload).toEqual({
      data: 'AAAAAAAAAIDbD0lAAADwwGBCog0=',
      encoding: 'float32-le-base64',
      sha256: '85bb6e54f58397cd7cf8c6690a13f1ee37ba2594238857f8ae11342739a45305',
      valueCount: 5,
    });
    expect([...restored]).toEqual([...values]);
    expect(Object.is(restored[1], -0)).toBe(true);
  });

  it('rejects non-finite values before encoding', async () => {
    await expect(createEmbeddedFloat32Payload(new Float32Array([1, Number.NaN]))).rejects.toThrow(
      LogitPayloadError,
    );
    await expect(createEmbeddedFloat32Payload(new Float32Array())).rejects.toThrow('empty');
    await expect(createEmbeddedFloat32Payload(new Float32Array(1_000_001))).rejects.toThrow(
      'exceeds',
    );
  });

  it('rejects malformed, non-canonical, truncated and tampered payloads', async () => {
    const payload = await createEmbeddedFloat32Payload(new Float32Array([1, 2]));
    const nonCanonical = `${payload.data.slice(0, -2)}B=`;
    await expect(decodeEmbeddedFloat32Payload({ ...payload, data: nonCanonical })).rejects.toThrow(
      'canonical',
    );
    await expect(
      decodeEmbeddedFloat32Payload({ ...payload, valueCount: payload.valueCount + 1 }),
    ).rejects.toThrow('byte length');
    await expect(
      decodeEmbeddedFloat32Payload({ ...payload, sha256: 'f'.repeat(64) }),
    ).rejects.toThrow('does not match');
    await expect(
      decodeEmbeddedFloat32Payload({ ...payload, data: '!!!!!!!!!!!!' }),
    ).rejects.toThrow('valid base64');
    await expect(
      decodeEmbeddedFloat32Payload({
        ...payload,
        encoding: 'float64-le-base64' as typeof payload.encoding,
      }),
    ).rejects.toThrow('Unsupported');
    await expect(decodeEmbeddedFloat32Payload({ ...payload, valueCount: 0 })).rejects.toThrow(
      'positive integer',
    );
    await expect(
      decodeEmbeddedFloat32Payload({ ...payload, valueCount: 1_000_001 }),
    ).rejects.toThrow('exceeds');
    await expect(decodeEmbeddedFloat32Payload({ ...payload, sha256: 'invalid' })).rejects.toThrow(
      'malformed',
    );
  });
});
