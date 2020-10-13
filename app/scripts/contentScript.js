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
const {CookieJar} = require('tough-cookie');
const {toBlob} = require('html-to-image');
const Swal = require('sweetalert2');
const build = require('build-url');
const {create} = require('axios').default;
const JSZip = require('jszip');

window.onload = () => {
  if (!document.title.includes('Labels'))
    return;
  window.URL = window.webkitURL || window.URL;

  const instance = create({
    jar: new CookieJar(),
    withCredentials: true,
    headers: {Accept: 'application/json'}
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
      blobs.push(await toBlob(labels[index]));
    if (1 === blobs.length) resolve({
      archive: false,
      blob: blobs[0]
    }); else {
      const zip = new JSZip();
      for (let index = 0; index < blobs.length; index++) {
        zip.file(`label-${index + 1}.png`, blobs[index]);
        if (labels.length - 1 === index) resolve({
          archive: true,
          blob: await zip.generateAsync({type: 'blob'})
        });
      }
    }
  });

  const serverAddressKey = 'printServerAddress';
  const setServerAddress = () => new Promise(async resolve => {
    const {isDismissed, value: address} = await Swal.fire({
      input: 'url',
      icon: 'question',
      title: 'Enter print server address',
      inputPlaceholder: 'Print server address',
      allowOutsideClick: false,
      showCloseButton: true
    })
    if (isDismissed)
      printButton.disabled = false;
    else
      chrome.storage.sync.set({[serverAddressKey]: address}, () => resolve(address));
  });

  const getServerStatus = () => new Promise(resolve => chrome.storage.sync.get([serverAddressKey], async result => {
    const address = result[serverAddressKey] || await setServerAddress();
    instance({
      method: 'GET',
      url: build(address, {path: 'auth'}),
      headers: {Accept: 'application/json'},
    }).then(response => resolve({
      authenticated: response.data.data.isAuthenticated,
      address
    })).catch(async error => {
      await Swal.fire(error.name || 'Error', error.message, 'error');
      await setServerAddress();
      resolve(await getServerStatus());
    });
  }));

  printButton.innerHTML = 'Print';
  printButton.addEventListener('click', async () => {
    if (printButton.disabled)
      return;
    printButton.disabled = true;
    const {authenticated, address} = await getServerStatus();
    const print = async () => {
      const {blob} = await getLabels();
      instance({
        method: 'POST',
        headers: {'Content-Type': blob.type},
        url: build(address, {path: 'queue'}),
        data: blob
      }).then(response => {
        const {status, data} = response;
        if (200 === status) {
          const
            addedItems = data.data.addedItems,
            positionInQueue = data.data.positionInQueue;
          Swal.fire('Success!',
            `Added ${1 === addedItems ? 'one item' : `${addedItems} items`} to queue (#${positionInQueue}).`,
            'info'
          );
        } else {
          const error = new Error(response.data.error.message);
          error.name = response.data.error.type;
          throw error;
        }
        printButton.disabled = false;
      }).catch(error => {
        Swal.fire(error.name || 'Error', error.message, 'error');
        printButton.disabled = false;
      });
    };
    if (!authenticated) {
      const {value: username} = await Swal.fire({
        input: 'email',
        icon: 'question',
        title: 'Enter your email address',
        inputPlaceholder: 'Your email address',
        allowOutsideClick: false,
        allowEscapeKey: false,
      })
      const {value: password} = await Swal.fire({
        icon: 'question',
        input: 'password',
        title: 'Enter your password',
        inputPlaceholder: 'Your password',
        allowOutsideClick: false,
        allowEscapeKey: false,
        inputAttributes: {autocorrect: 'off', minLength: 8}
      });
      instance({
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        url: build(address, {path: 'auth'}),
        data: {username, password},
      }).then(() => print()).catch(error => {
        Swal.fire(error.name || 'Error', error.message, 'error');
        printButton.disabled = false;
      })
    } else await print();
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
      const {blob, archive} = await getLabels();
      download(blob, `label${archive ? 's.zip' : '.png'}`)
      downloadButton.disabled = false;
    }
  });

  document.body.prepend(lineBreak);
  document.body.prepend(closeButton);
  document.body.prepend(printButton);
  document.body.prepend(downloadButton);
};