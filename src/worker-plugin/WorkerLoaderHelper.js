export function createInlineWorkerFactory(fn, sourcemap = null) {
    const source = fn.toString();
    const start = source.indexOf('\n', 10) + 1;
    const end = source.indexOf('}', source.length - 1);
    const body = source.substring(start, end) + (sourcemap ? `\/\/# sourceMappingURL=${sourcemap}` : '');
    const blankPrefixLength = body.search(/\S/);
    const lines = body.split('\n').map(line => line.substring(blankPrefixLength) + '\n');

    /* browser */
    const blob = new Blob(lines, { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    return function WorkerFactory(options) {
        return new Worker(url, options);
    };
}

export function browserDecodeBase64(base64, enableUnicode) {
    const binaryString = atob(base64);
    if (enableUnicode) {
        const binaryView = new Uint8Array(binaryString.length);
        Array.prototype.forEach.call(binaryView, (el, idx, arr) => {
            arr[idx] = binaryString.charCodeAt(idx);
        });
        return String.fromCharCode.apply(null, new Uint16Array(binaryView.buffer));
    }
    return binaryString;
}

export function nodeDecodeBase64(base64, enableUnicode) {
    return Buffer.from(base64, 'base64').toString(enableUnicode ? 'utf16' : 'utf8');
}

export function createBase64WorkerFactory(base64, sourcemap = null, enableUnicode = false) {
    const source = browserDecodeBase64(base64, enableUnicode);
    const start = source.indexOf('\n', 10) + 1;
    const body = source.substring(start) + (sourcemap ? `\/\/# sourceMappingURL=${sourcemap}` : '');

    /* browser */
    const blob = new Blob([body], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    return function WorkerFactory(options) {
        return new Worker(url, options);
    };
}
