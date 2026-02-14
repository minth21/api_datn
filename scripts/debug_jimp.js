const jimp = require('jimp');
console.log('Jimp exports:', Object.keys(jimp));
try {
    const J = jimp.Jimp;
    console.log('Jimp.Jimp:', J);
} catch (e) {
    console.log('Jimp.Jimp error:', e);
}
