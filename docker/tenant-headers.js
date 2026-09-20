// njs 0.4.3-compatible: inspect names before FastCGI maps '-' to '_'.
function credential(r, canonical) {
    var value = '';
    var count = 0;
    var headers = r.rawHeadersIn;
    for (var i = 0; i < headers.length; i++) {
        var name = headers[i][0].toLowerCase();
        if (name.replace(/-/g, '_') !== canonical) continue;
        if (name !== canonical || ++count > 1) return ',';
        value = headers[i][1];
    }
    return value;
}

function appid(r) { return credential(r, 'appid'); }
function screctId(r) { return credential(r, 'screct_id'); }

export default {appid, screctId};
