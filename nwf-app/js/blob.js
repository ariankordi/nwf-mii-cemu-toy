if (typeof window.Blob !== 'function') {
    window.Blob = function(blobParts, options) {
        var builder = new window.WebKitBlobBuilder();
        blobParts.forEach(function(part) {
            builder.append(part);
        });
        var type = options ? (options.type || '') : '';
        return builder.getBlob(type);
    };
}
