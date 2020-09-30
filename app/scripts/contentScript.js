/**
 * This file is licensed und The MIT License
 * Copyright (c) 2019 Riegler Daniel
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

const { toBlob } = require('html-to-image');
const build = require('build-url');
const axios = require('axios');
const JSZip = require('jszip');

window.onload = () => {
    if (!document.title.includes('Labels'))
        return;
    window.URL = window.webkitURL || window.URL;

    const lineBreak = document.createElement('hr');
    const closeButton = document.createElement('button');
    const printButton = document.createElement('button');
    const downloadButton = document.createElement('button');

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
        if (blobs.length == 1) resolve({
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
            };
        };
    });

    const serverAddressKey = 'printServerAddress';
    // https://www.tutorialspoint.com/How-to-validate-URL-address-in-JavaScript
    const serverAddressRegex = new RegExp('^(https?:\\/\\/)?' + // protocol
        '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.?)+[a-z]{2,}|' + // domain name
        '((\\d{1,3}\\.){3}\\d{1,3}))' + // ip (v4) address
        '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'); //port
    const setServerAddress = () => new Promise(async resolve => {
        let address = prompt('Print server address:');
        if (!serverAddressRegex.test(address))
            address = await setServerAddress();
        else
            chrome.storage.sync.set({ [serverAddressKey]: address }, () => resolve(address));
    });

    const getServerStatus = () => new Promise(resolve => {
        const key = 'printServerAddress';
        chrome.storage.sync.get([serverAddressKey], async result => {
            const address = result[key] || await setServerAddress();
            axios({
                method: 'GET',
                url: build(address, { path: 'status' }),
                withCredentials: true
            }).then(response => resolve({
                authenticated: response.data.authenticated,
                address
            })).catch(error => {
                alert(error);
                setServerAddress();
                resolve(getServerStatus());
            });
        });
    });

    printButton.innerHTML = 'Print';
    printButton.addEventListener('click', async () => {
        if (printButton.disabled)
            return;
        printButton.disabled = true;
        const { authenticated, address } = await getServerStatus();
        const print = async () => {
            const { blob } = await getLabels();
            axios({
                method: 'POST',
                headers: { 'Content-Type': blob.type },
                url: build(address, { path: 'print/label' }),
                withCredentials: true,
                data: blob
            }).catch(error => {
                printButton.disabled = false;
                alert(error);
            });
        };
        if (!authenticated) {
            const username = prompt('Username:'), password = prompt('Password:');
            if (!username || !password) {
                alert('Please enter a username and a password.');
                printButton.disabled = false;
                return;
            }
            axios({
                method: 'POST',
                headers: { 'Content-Type': 'application/json', },
                url: build(address, { path: 'auth' }),
                data: { username, password },
                withCredentials: true
            }).then(() => print()).catch(error => {
                printButton.disabled = false;
                alert(error);
            });
        } else print();
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
            download(blob, `labels.${archive ? 'zip' : 'png'}`)
            downloadButton.disabled = false;
        };
    });

    document.body.prepend(lineBreak);
    document.body.prepend(closeButton);
    document.body.prepend(printButton);
    document.body.prepend(downloadButton);
};