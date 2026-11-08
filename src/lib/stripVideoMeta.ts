// Removes location and device tags from MP4/MOV files without re-encoding.
// Phones store GPS in `udta` (©xyz) and `meta` boxes inside `moov`/`trak`.
// Each such box is turned into a harmless `free` box of the SAME size and its
// contents are zeroed, so every byte offset in the file stays valid and the
// video still plays.
const CONTAINERS = new Set(["moov", "trak", "mdia", "minf", "stbl", "edts"]);
const STRIP = new Set(["udta", "meta", "ilst", "keys", "©xyz"]);

function walk(b: Buffer, start: number, end: number, depth: number) {
  let off = start;
  while (off + 8 <= end && depth < 8) {
    let size = b.readUInt32BE(off);
    const type = b.toString("latin1", off + 4, off + 8);
    let header = 8;
    if (size === 1) {
      if (off + 16 > end) return;
      const big = b.readBigUInt64BE(off + 8);
      if (big > BigInt(end - off)) return;
      size = Number(big);
      header = 16;
    } else if (size === 0) {
      size = end - off;
    }
    if (size < header || off + size > end) return;
    if (STRIP.has(type)) {
      b.fill(0, off + header, off + size);
      b.write("free", off + 4, "latin1");
    } else if (CONTAINERS.has(type)) {
      walk(b, off + header, off + size, depth + 1);
    }
    off += size;
  }
}

export function stripVideoMeta(input: Buffer, mime: string): Buffer {
  if (mime !== "video/mp4" && mime !== "video/quicktime") return input;
  try {
    const out = Buffer.from(input); // work on a copy
    walk(out, 0, out.length, 0);
    return out;
  } catch {
    return input;
  }
}
