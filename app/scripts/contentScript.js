/*
 *     ________________ __
 *    / ____/ ___/ ___// /____  __  _______
 *   / __/  \__ \\__ \/ __/ _ \/ / / / ___/
 *  / /___ ___/ /__/ / /_/  __/ /_/ / /
 * /_____//____/____/\__/\___/\__, /_/
 *                           /____/
 *
 * This file is licensed under The MIT License
 * Copyright (c) 2020 Riegler Daniel
 * Copyright (c) 2020 ESS Engineering Software Steyr GmbH
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

const axiosCookieJarSupport = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const { toBlob } = require('html-to-image');
const build = require('build-url');
const { create } = require('axios').default;
const JSZip = require('jszip');

const SERVICE_URL = 'https://labelprinter.essteyr.com';

window.onload = () => {
  if (!document.title.includes('Labels'))
    return;

  const instance = create({
    jar: new CookieJar(),
    withCredentials: true,
    headers: { Accept: 'application/json' }
  });

  axiosCookieJarSupport(instance);

  const
    lineBreak = document.createElement('hr'),
    closeButton = document.createElement('button'),
    printButton = document.createElement('button'),
    downloadButton = document.createElement('button');

  closeButton.innerHTML = 'Hide';
  closeButton.addEventListener('click', () => {
    downloadButton.remove();
    closeButton.remove();
    printButton.remove();
    lineBreak.remove();
  });

  const getLabels = () => new Promise(async resolve => {
    const blobs = [];
    const labels = document.getElementsByClassName('label');
    for (let index = 0; index < labels.length; index++)
      blobs.push(await toBlob(labels[index], { pixelRatio: 1 }));
    if (1 === blobs.length) resolve({
      archive: false,
      blob: blobs[0]
    }); else {
      const zip = new JSZip();
      for (let index = 0; index < blobs.length; index++) {
        zip.file(`label-${index + 1}.png`, blobs[index]);
        if (labels.length - 1 === index) resolve({
          archive: true,
          blob: await zip.generateAsync({ type: 'blob' })
        });
      }
    }
  });

  printButton.innerHTML = 'Print';
  printButton.addEventListener('click', async () => {
    if (printButton.disabled)
      return;
    printButton.disabled = true;
    const { blob } = await getLabels();
    instance({
      method: 'POST',
      headers: { 'Content-Type': blob.type },
      url: build(SERVICE_URL, { path: 'queue' }),
      data: blob
    }).then(response => {
      const { status, data } = response;
      if (200 === status) {
        const
          addedItems = data.data.addedItems,
          positionInQueue = data.data.positionInQueue;
        alert(`Added ${1 === addedItems ? 'one item' : `${addedItems} items`} to queue (#${positionInQueue}).`);
      } else {
        const error = new Error(response.data.error.message);
        error.name = response.data.error.type;
        throw error;
      }
      printButton.disabled = false;
    }).catch(error => {
      alert(`${error.name || 'Error'}: ${error.message}`);
      printButton.disabled = false;
    });
  });

  const download = (blob, name) => {
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    link.remove();
  };

  downloadButton.innerHTML = 'Download';
  downloadButton.addEventListener('click', async () => {
    if (!downloadButton.disabled) {
      downloadButton.disabled = true;
      const { blob, archive } = await getLabels();
      download(blob, `label${archive ? 's.zip' : '.png'}`)
      downloadButton.disabled = false;
    }
  });

  document.body.prepend(lineBreak);
  document.body.prepend(closeButton);
  document.body.prepend(printButton);
  document.body.prepend(downloadButton);
};
