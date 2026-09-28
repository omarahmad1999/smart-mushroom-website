"""Unwraps a WOFF 1 font into a plain TrueType file Blender can load, with only the standard library.
   python3 tools/diorama/woff-to-ttf.py <in.woff> <out.ttf>"""
import struct, sys, zlib

data = open(sys.argv[1], 'rb').read()
signature, flavor, _, count = struct.unpack('>4sIIH', data[:14])
assert signature == b'wOFF', 'not a WOFF 1 font'
tables = []
for i in range(count):
    tag, offset, packed, size, checksum = struct.unpack('>4sIIII', data[44 + i * 20:64 + i * 20])
    body = data[offset:offset + packed]
    tables.append((tag, checksum, zlib.decompress(body) if packed < size else body))
power = 1 << (count.bit_length() - 1)
out = bytearray(struct.pack('>IHHHH', flavor, count, power * 16, power.bit_length() - 1, count * 16 - power * 16))
offset = 12 + 16 * count
for tag, checksum, body in tables:
    out += struct.pack('>4sIII', tag, checksum, offset, len(body))
    offset += (len(body) + 3) & ~3
for _, _, body in tables:
    out += body + b'\0' * ((4 - len(body) % 4) % 4)
open(sys.argv[2], 'wb').write(out)
