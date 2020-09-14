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
const JSZip = require('jszip');

window.onload = () => {
    if (!document.title.includes('Labels'))
        return;
    window.URL = window.webkitURL || window.URL;

    const lineBreak = document.createElement('hr');
    const closeButton = document.createElement('button');
    const downloadButton = document.createElement('button');

    closeButton.innerHTML = 'Hide';
    closeButton.addEventListener('click', () => {
        downloadButton.remove();
        closeButton.remove();
        lineBreak.remove();
    });

    downloadButton.innerHTML = 'Download';
    downloadButton.addEventListener('click', () => {
        if (!downloadButton.disabled) {
            downloadButton.disabled = true;
            downloadButton.innerHTML = 'Downloading...';
            (async () => {
                const blobs = [];
                const labels = document.getElementsByClassName('label');
                for (let index = 0; index < labels.length; index++)
                    blobs.push(await toBlob(labels[index]));
                const zip = new JSZip();
                for (let index = 0; index < blobs.length; index++) {
                    zip.file(`label-${index + 1}.png`, blobs[index]);
                    if (labels.length - 1 === index) {
                        const button = document.createElement('a');
                        button.href = URL.createObjectURL(await zip.generateAsync({ type: 'blob' }));
                        button.download = 'labels.zip';
                        button.style.display = 'none';
                        document.body.appendChild(button);
                        downloadButton.innerHTML = 'Downloaded';
                        button.click();
                        button.remove();
                    };
                };
            })();
        };
    });

    document.body.prepend(lineBreak);
    document.body.prepend(closeButton);
    document.body.prepend(downloadButton);
};