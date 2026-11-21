// Checks that index.html still obeys the rules it was built on.
//
//   node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { band, contrast, pack } from './swatches.mjs';

const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');

const embedded = (name) => {
  const block = html.match(new RegExp(`const ${name} = \\[([^\\]]+)\\]`));
  assert.ok(block, `${name} table not found in index.html`);
  return block[1].match(/[0-9a-f]{72}/g);
};
const split = (packed) => packed.match(/.{6}/g).map((hex) => '#' + hex);

const LIGHT = embedded('LIGHT');
const DEEP = embedded('DEEP');

test('the embedded swatches are the ones the color rule produces', () => {
  assert.deepEqual(LIGHT, [pack(band('normal', 'light')), pack(band('more', 'light'))]);
  assert.deepEqual(DEEP, [pack(band('normal', 'deep')), pack(band('more', 'deep'))]);
});

test('every one of the 144 pairs is legible', () => {
  // [light set, deep set, lowest contrast allowed]
  for (const [lights, deeps, floor] of [[LIGHT[0], DEEP[0], 7], [LIGHT[1], DEEP[1], 9]]) {
    let pairs = 0;
    for (const light of split(lights)) {
      for (const deep of split(deeps)) {
        const ratio = contrast(light, deep);
        assert.ok(ratio >= floor, `${light} on ${deep} is ${ratio.toFixed(2)}:1, below ${floor}:1`);
        pairs++;
      }
    }
    assert.equal(pairs, 144);
  }
});

test('without scripts the page shows the signature pair', () => {
  assert.match(html, /--deep: #6a0300;/);
  assert.match(html, /--light: #77ebff;/);
  assert.equal(split(DEEP[0])[0], '#6a0300'); // ruby, wheel step 0
  assert.equal(split(LIGHT[0])[6], '#77ebff'); // cyan, wheel step 6
});

test('the name is real text, written exactly', () => {
  const h1 = html.match(/<h1[^>]*>(.*?)<\/h1>/s);
  assert.ok(h1, 'no <h1>');
  assert.equal(h1[1].replace(/<[^>]+>/g, ''), 'Tomás Augusto Müller');
  assert.match(html, /<title>Tomás Augusto Müller<\/title>/);
});

test('there are exactly two links, to Logs and LinkedIn', () => {
  const links = [...html.matchAll(/<a\s[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gs)].map((m) => [m[2], m[1]]);
  assert.deepEqual(links, [
    ['Logs', 'https://logs.tomasmuller.dev?utm_source=tomasmuller.dev'],
    ['LinkedIn', 'https://www.linkedin.com/in/t0masmuller/'],
  ]);
});

test('the font, its license and the share image are in place', () => {
  const font = html.match(/url\((fonts\/[^)]+\.woff2)\)/);
  assert.ok(font, 'no font URL');
  assert.ok(statSync(new URL(font[1], root)).size < 40_000, 'font subset grew past 40 KB');
  assert.ok(statSync(new URL('fonts/OFL.txt', root)).size > 0);
  assert.ok(statSync(new URL('og.png', root)).size < 300_000, 'share image is over 300 KB');
});
